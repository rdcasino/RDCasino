-- 0032 · NOWPayments: depósito automático (endereço e valor exato gerados por pagamento) e saque pelo admin.
-- Fluxo do depósito:
--   1. o jogador pede um depósito (moeda, rede, valor em USD) → np_deposit_open cria a transação 'awaiting'
--      (checa conta ativa, mínimo, limites de jogo responsável e no máximo 3 pedidos abertos por hora);
--   2. a função "nowpayments" (Edge Function) cria o pagamento na NOWPayments e grava endereço/valor (np_deposit_attach);
--   3. a NOWPayments avisa (IPN) ou o site consulta → a função busca o status direto na API da NOWPayments
--      (fonte da verdade, com a chave secreta) e chama np_settle, que credita UMA vez só.
-- Pagamento a menor: vai para a fila do admin com o valor proporcional (o admin aprova). Pagamento a maior (>1%): credita o proporcional.
-- Nada disso fica ativo no site até o admin ligar settings.np_enabled.

alter table public.transactions add column if not exists provider text;
alter table public.transactions add column if not exists provider_id text;
alter table public.transactions add column if not exists provider_status text;
alter table public.transactions add column if not exists expires_at timestamptz;
alter table public.transactions drop constraint if exists transactions_status_check;
alter table public.transactions add constraint transactions_status_check check (status = any (array['pending', 'completed', 'rejected', 'awaiting', 'expired']));
create unique index if not exists tx_provider_once on public.transactions(provider, provider_id) where provider_id is not null;
create index if not exists tx_awaiting_idx on public.transactions(provider, status) where status = 'awaiting';

insert into public.settings(key, value) values
  ('np_enabled', 'false'::jsonb),
  ('np_payouts', 'false'::jsonb),
  -- moeda/rede do site → código da NOWPayments (o admin pode corrigir aqui se a NOWPayments mudar um código)
  ('np_currencies', '{"BTC|Bitcoin":"btc","ETH|Ethereum (ERC20)":"eth","USDT|Ethereum (ERC20)":"usdterc20","USDC|Ethereum (ERC20)":"usdc","USDT|Solana (SPL)":"usdtsol","LTC|Litecoin":"ltc","TRX|Tron":"trx","DOGE|Dogecoin":"doge"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.np_deposit_open(p_coin text, p_network text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v numeric := round(coalesce(p_amount, 0), 2); v_min numeric; v_code text; v_id bigint; p profiles;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if coalesce((select value::text::boolean from settings where key = 'np_enabled'), false) is not true then raise exception 'Automatic deposits are not available yet.'; end if;
  select * into p from profiles where id = v_uid;
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  select greatest(min_deposit, coalesce((select (value)::text::numeric from settings where key = 'min_deposit'), 0)) into v_min from wallets where coin = p_coin and network = p_network and enabled;
  if v_min is null then raise exception 'This coin/network is not accepted.'; end if;
  v_code := (select value->>(p_coin || '|' || p_network) from settings where key = 'np_currencies');
  if v_code is null then raise exception 'This coin/network is not available for automatic deposits.'; end if;
  if v < v_min then raise exception 'Minimum deposit is %.', to_char(v_min, 'FM$999,990.00'); end if;
  if v > 100000 then raise exception 'Maximum deposit is $100,000 per payment.'; end if;
  perform rd_rg_check(v_uid, 'deposit', v);
  if (select count(*) from transactions where user_id = v_uid and provider = 'nowpayments' and status = 'awaiting' and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'You have 3 open deposits. Finish one or wait an hour.';
  end if;
  insert into transactions(user_id, type, status, amount_usd, coin, network, provider, note)
    values (v_uid, 'deposit', 'awaiting', v, p_coin, p_network, 'nowpayments', 'Awaiting payment') returning id into v_id;
  return jsonb_build_object('tx', v_id, 'pay_currency', v_code, 'amount', v);
end $$;

-- grava o pagamento criado na NOWPayments (só a Edge Function, com a chave de serviço)
create or replace function public.np_deposit_attach(p_tx bigint, p_payment_id text, p_address text, p_pay_amount numeric, p_extra text, p_expires timestamptz) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update transactions set provider_id = p_payment_id, address = p_address, amount_coin = p_pay_amount, provider_status = 'waiting',
    tx_hash = case when coalesce(p_extra, '') <> '' then null else tx_hash end, note = case when coalesce(p_extra, '') <> '' then 'Memo: ' || p_extra else note end,
    expires_at = p_expires
  where id = p_tx and provider = 'nowpayments' and status = 'awaiting' and provider_id is null;
  if not found then raise exception 'deposit not open'; end if;
end $$;

-- desfaz um pedido cuja criação falhou na NOWPayments
create or replace function public.np_deposit_cancel(p_tx bigint, p_reason text) returns void
language sql security definer set search_path to 'public' as $$
  update transactions set status = 'rejected', note = left(coalesce(p_reason, 'Payment could not be created'), 200), decided_at = now()
  where id = p_tx and provider = 'nowpayments' and status = 'awaiting' and provider_id is null
$$;

-- aplica o status vindo da API da NOWPayments; credita uma vez só
create or replace function public.np_settle(p_payment_id text, p_status text, p_pay_amount numeric, p_actually_paid numeric, p_data jsonb) returns text
language plpgsql security definer set search_path to 'public' as $$
declare t transactions; ratio numeric; credit numeric;
begin
  select * into t from transactions where provider = 'nowpayments' and provider_id = p_payment_id and type = 'deposit' for update;
  if not found then return 'unknown'; end if;
  update transactions set provider_status = p_status where id = t.id;
  if t.status not in ('awaiting', 'expired') then return 'already ' || t.status; end if;
  ratio := case when coalesce(p_pay_amount, 0) > 0 then coalesce(p_actually_paid, 0) / p_pay_amount else 0 end;
  if p_status = 'finished' then
    credit := case when ratio > 1.01 then round(t.amount_usd * ratio, 2) else t.amount_usd end;
    perform set_config('rd.coin', upper(coalesce(t.coin, '')), true);
    update profiles set balance = balance + credit where id = t.user_id;
    update transactions set status = 'completed', amount_usd = credit, decided_at = now(),
      tx_hash = coalesce(nullif(p_data->>'payin_hash', ''), tx_hash), note = 'Confirmed automatically' where id = t.id;
    insert into audit_log(who, what, data) values (null, 'nowpayments deposit', jsonb_build_object('tx', t.id, 'user', t.user_id, 'usd', credit, 'payment', p_payment_id));
    return 'credited';
  elsif p_status = 'partially_paid' then
    update transactions set status = 'pending', amount_usd = greatest(round(t.amount_usd * ratio, 2), 0.01),
      note = 'Partially paid: ' || coalesce(p_actually_paid, 0) || ' of ' || coalesce(p_pay_amount, 0) || ' ' || upper(coalesce(p_data->>'pay_currency', '')) || ' — review and approve' where id = t.id;
    return 'partial';
  elsif p_status in ('failed', 'refunded') then
    update transactions set status = 'rejected', decided_at = now(), note = 'Payment ' || p_status where id = t.id;
    return p_status;
  elsif p_status = 'expired' then
    update transactions set status = 'expired', note = 'Expired without payment' where id = t.id;
    return 'expired';
  end if;
  return 'waiting';
end $$;

-- saque enviado pela NOWPayments (admin aprova com o código 2FA na tela do admin)
create or replace function public.np_payout_mark(p_tx bigint, p_payout_id text, p_status text, p_hash text, p_admin uuid) returns text
language plpgsql security definer set search_path to 'public' as $$
declare t transactions;
begin
  select * into t from transactions where id = p_tx and type = 'withdrawal' for update;
  if not found then return 'unknown'; end if;
  if p_status in ('creating', 'sending', 'processing', 'waiting') then
    if t.status <> 'pending' then return 'already ' || t.status; end if;
    update transactions set provider = 'nowpayments', provider_id = coalesce(p_payout_id, provider_id), provider_status = p_status, note = 'Sending via NOWPayments', decided_by = coalesce(p_admin, decided_by) where id = p_tx;
    return 'sending';
  elsif p_status = 'finished' then
    if t.status <> 'pending' then return 'already ' || t.status; end if;
    update transactions set status = 'completed', provider_status = p_status, tx_hash = coalesce(nullif(p_hash, ''), tx_hash), decided_at = now(), note = 'Sent via NOWPayments' where id = p_tx;
    insert into audit_log(who, what, data) values (p_admin, 'nowpayments payout', jsonb_build_object('tx', p_tx, 'user', t.user_id, 'usd', t.amount_usd, 'payout', p_payout_id));
    return 'completed';
  elsif p_status in ('failed', 'rejected') then
    update transactions set provider_status = p_status, note = 'NOWPayments payout failed — send manually or retry' where id = p_tx and status = 'pending';
    return 'failed';
  end if;
  return 'ignored';
end $$;

-- limite de depósito: pedido aberto (até 2h) conta; expirado não
create or replace function public.rd_rg_check(p_uid uuid, p_kind text, p_amount numeric) returns void
language plpgsql security definer set search_path to 'public' as $$
declare g rg_limits; per text; lim numeric; used numeric;
begin
  g := rd_rg_load(p_uid);
  if g is null then return; end if;
  if g.excluded_until is not null and g.excluded_until > now() then raise exception 'Your account is self-excluded %. You can still withdraw your balance.', rd_rg_until(g.excluded_until); end if;
  if g.break_until is not null and g.break_until > now() then raise exception 'You are taking a break %. You can still withdraw your balance.', rd_rg_until(g.break_until); end if;
  if p_kind = 'bet' then
    foreach per in array array['day', 'week', 'month'] loop
      lim := (g.limits->'wager'->>per)::numeric;
      if lim is not null then
        select coalesce(sum(amount), 0) into used from bets where user_id = p_uid and created_at > now() - rd_rg_period(per);
        used := used + coalesce((select sum(amount) from rounds where user_id = p_uid), 0);
        if used + p_amount > lim then raise exception 'This bet goes over your wager limit (% per %). You have % left.', to_char(lim, 'FM$999,999,990.00'), case per when 'day' then '24 hours' when 'week' then '7 days' else '30 days' end, to_char(least(lim, greatest(lim - used, 0)), 'FM$999,999,990.00'); end if;
      end if;
      lim := (g.limits->'loss'->>per)::numeric;
      if lim is not null then
        select coalesce(sum(amount - payout), 0) into used from bets where user_id = p_uid and created_at > now() - rd_rg_period(per);
        used := used + coalesce((select sum(amount) from rounds where user_id = p_uid), 0);
        if used + p_amount > lim then raise exception 'This bet goes over your loss limit (% per %). You have % left.', to_char(lim, 'FM$999,999,990.00'), case per when 'day' then '24 hours' when 'week' then '7 days' else '30 days' end, to_char(least(lim, greatest(lim - used, 0)), 'FM$999,999,990.00'); end if;
      end if;
    end loop;
  elsif p_kind = 'deposit' then
    foreach per in array array['day', 'week', 'month'] loop
      lim := (g.limits->'deposit'->>per)::numeric;
      if lim is not null then
        select coalesce(sum(amount_usd), 0) into used from transactions where user_id = p_uid and type = 'deposit' and (status in ('pending', 'completed') or (status = 'awaiting' and created_at > now() - interval '2 hours')) and created_at > now() - rd_rg_period(per);
        if used + p_amount > lim then raise exception 'This deposit goes over your deposit limit (% per %). You have % left.', to_char(lim, 'FM$999,999,990.00'), case per when 'day' then '24 hours' when 'week' then '7 days' else '30 days' end, to_char(least(lim, greatest(lim - used, 0)), 'FM$999,999,990.00'); end if;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.rd_rg_json(p_uid uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare g rg_limits; per text; k text; used jsonb := '{}'; v numeric;
begin
  g := rd_rg_load(p_uid);
  foreach k in array array['deposit', 'loss', 'wager'] loop
    foreach per in array array['day', 'week', 'month'] loop
      if k = 'deposit' then select coalesce(sum(amount_usd), 0) into v from transactions where user_id = p_uid and type = 'deposit' and (status in ('pending', 'completed') or (status = 'awaiting' and created_at > now() - interval '2 hours')) and created_at > now() - rd_rg_period(per);
      elsif k = 'loss' then select coalesce(sum(amount - payout), 0) into v from bets where user_id = p_uid and created_at > now() - rd_rg_period(per);
      else select coalesce(sum(amount), 0) into v from bets where user_id = p_uid and created_at > now() - rd_rg_period(per); end if;
      used := jsonb_set(case when used ? k then used else used || jsonb_build_object(k, '{}'::jsonb) end, array[k, per], to_jsonb(round(greatest(v, 0), 2)));
    end loop;
  end loop;
  return jsonb_build_object('limits', coalesce(g.limits, '{}'), 'pending', coalesce(g.pending, '{}'), 'used', used,
    'break_until', case when g.break_until > now() then g.break_until end,
    'excluded_until', case when g.excluded_until > now() then g.excluded_until end);
end $$;

-- pedidos abertos do jogador (para mostrar de novo o endereço se ele fechar a janela)
create or replace function public.np_my_open() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount', amount_usd, 'coin', coin, 'network', network, 'address', address, 'pay_amount', amount_coin, 'memo', case when note like 'Memo: %' then substr(note, 7) end, 'expires', expires_at, 'status', provider_status) order by id desc), '[]')
  from transactions where user_id = auth.uid() and provider = 'nowpayments' and type = 'deposit' and status = 'awaiting' and provider_id is not null and created_at > now() - interval '24 hours'
$$;

revoke all on function public.np_deposit_attach(bigint, text, text, numeric, text, timestamptz), public.np_deposit_cancel(bigint, text), public.np_settle(text, text, numeric, numeric, jsonb), public.np_payout_mark(bigint, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.np_deposit_attach(bigint, text, text, numeric, text, timestamptz), public.np_deposit_cancel(bigint, text), public.np_settle(text, text, numeric, numeric, jsonb), public.np_payout_mark(bigint, text, text, text, uuid) to service_role;
grant execute on function public.np_deposit_open(text, text, numeric), public.np_my_open() to authenticated;

-- o site do jogador escuta as próprias transações (depósito confirmado, saque enviado) em tempo real; RLS own_tx limita a cada um
do $$ begin if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'transactions') then alter publication supabase_realtime add table public.transactions; end if; end $$;
