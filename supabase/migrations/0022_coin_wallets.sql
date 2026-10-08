-- =====================================================================
-- Saldo separado por moeda (estilo Razed/Shuffle).
--   profiles.wallet      = {"USDT": 1000, "BTC": 250}  (valor de cada moeda, em dólar)
--   profiles.active_coin = moeda escolhida no cabeçalho; as apostas usam só ela
--   profiles.balance     = continua sendo o total (soma da carteira), então o resto do sistema não muda
-- Um gatilho aplica cada mudança de saldo na moeda certa:
--   * se a função marcou rd.coin (depósito, saque, gorjeta), usa essa moeda; senão, a moeda ativa;
--   * o jogador nunca gasta mais do que tem naquela moeda; ações do admin podem completar com outras moedas.
-- Quem já tinha saldo: tudo fica em USDT.
-- =====================================================================
alter table public.profiles add column if not exists wallet jsonb not null default '{}';
alter table public.profiles add column if not exists active_coin text not null default 'USDT';
update public.profiles set wallet = jsonb_build_object('USDT', balance) where wallet = '{}' and balance <> 0;

create or replace function public.rd_wallet_sync()
returns trigger language plpgsql set search_path = public as $$
declare d numeric; c text; w jsonb; cur numeric; need numeric; k text; v numeric; total numeric;
begin
  if tg_op = 'INSERT' then
    if new.wallet = '{}' and new.balance <> 0 then new.wallet := jsonb_build_object(new.active_coin, new.balance); end if;
    return new;
  end if;
  d := new.balance - old.balance;
  if d = 0 then return new; end if;
  c := upper(coalesce(nullif(current_setting('rd.coin', true), ''), new.active_coin));
  w := coalesce(new.wallet, '{}');
  cur := coalesce((w->>c)::numeric, 0);
  if d < 0 and cur + d < -0.004 then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Insufficient % balance.', c;
    end if;
    need := -(cur + d); w := w || jsonb_build_object(c, 0);
    for k, v in select key, value::text::numeric from jsonb_each(w) where key <> c order by value::text::numeric desc loop
      exit when need <= 0;
      w := w || jsonb_build_object(k, round(v - least(v, need), 2)); need := need - least(v, need);
    end loop;
  else
    w := w || jsonb_build_object(c, round(cur + d, 2));
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}') into w from jsonb_each(w) where abs(value::text::numeric) >= 0.005 or key = new.active_coin;
  select coalesce(sum(value::text::numeric), 0) into total from jsonb_each(w);
  if abs(total - new.balance) >= 0.005 then w := w || jsonb_build_object(new.active_coin, round(coalesce((w->>new.active_coin)::numeric, 0) + new.balance - total, 2)); end if;
  new.wallet := w;
  return new;
end $$;
drop trigger if exists rd_wallet_sync on public.profiles;
create trigger rd_wallet_sync before insert or update of balance on public.profiles for each row execute function public.rd_wallet_sync();

create or replace function public.set_active_coin(p_coin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := upper(trim(coalesce(p_coin, '')));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if c <> all(array['USDT','USDC','BTC','ETH','SOL','LTC','DOGE','TRX']) then raise exception 'Unknown coin.'; end if;
  if exists(select 1 from rounds where user_id = auth.uid()) then raise exception 'Finish your open game first.'; end if;
  update profiles set active_coin = c where id = auth.uid();
  return public.rd_profile_json(auth.uid());
end $$;
revoke all on function public.set_active_coin(text) from public, anon;
grant execute on function public.set_active_coin(text) to authenticated;

create or replace function public.rd_profile_json(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('balance', coalesce((wallet->>active_coin)::numeric, 0), 'total', balance, 'wallet', wallet, 'coin', active_coin,
    'wagered', wagered, 'profit', profit, 'bets', bets_count, 'rakeback', rakeback, 'held', held) from profiles where id = p_uid
$$;

CREATE OR REPLACE FUNCTION public.play_bet(p_game text, p_amount numeric, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET extra_float_digits TO '1'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_amt numeric := round(coalesce(p_amount, 0), 2);
  p profiles; s seeds; v_nonce bigint;
  fs float8[] := '{}'; f float8;
  v_mult float8 := 0; v_win boolean := false; v_pay numeric := null; d jsonb := '{}';
  v_max numeric; v_rate numeric; v_bet bets;
  -- auxiliares
  t float8; c float8; res float8; v_over boolean; v_rows int; v_risk text; v_tab jsonb;
  v_slot int; v_path text; i int; j int; k int; tmp int; a int[]; v_drawn int[]; v_picks int[]; v_hits int;
  v_n int; v_key text; v_val numeric; v_total numeric; v_side text; v_res text[];
  v_cards int[]; v_P int[]; v_B int[]; v_ci int; v_pt int; v_bt int; v_p3 int; v_draw boolean; v_x int; v_winner text;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  if p_game not in ('dice','limbo','plinko','keno','wheel','roulette','coinflip','baccarat','double') then raise exception 'Unknown game.'; end if;

  -- Mesas com fichas: o total vem das fichas, não do valor enviado
  if p_game in ('roulette', 'baccarat') then
    v_total := 0;
    for v_key, v_val in select key, round(value::text::numeric, 2) from jsonb_each(coalesce(p_params->'bets', '{}')) loop
      if v_val <= 0 then raise exception 'Invalid chip.'; end if;
      if p_game = 'roulette' and not (v_key ~ '^n:([0-9]|[12][0-9]|3[0-6])$' or v_key in ('red','black','even','odd','low','high','doz:1','doz:2','doz:3','col:1','col:2','col:3')) then raise exception 'Invalid bet spot.'; end if;
      if p_game = 'baccarat' and v_key not in ('player','banker','tie') then raise exception 'Invalid bet spot.'; end if;
      v_total := v_total + v_val;
    end loop;
    v_amt := v_total;
  end if;
  if v_amt < 0.01 then raise exception 'Minimum bet is $0.01.'; end if;

  select * into p from profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found.'; end if;
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if p.balance < v_amt then raise exception 'Insufficient balance.'; end if;
  select * into s from seeds where user_id = v_uid for update;
  v_nonce := s.nonce;
  update seeds set nonce = nonce + 1 where user_id = v_uid;

  if p_game = 'dice' then
    t := (p_params->>'target')::float8; v_over := coalesce(p_params->>'mode', 'over') <> 'under';
    if t is null or (v_over and (t < 2 or t > 99.99)) or (not v_over and (t < 0.01 or t > 98)) then raise exception 'Invalid target.'; end if;
    c := floor((case when v_over then 100 - t else t end) * 100 + 0.5) / 100;
    v_mult := floor((99 / c) * 10000) / 10000;
    f := rd_float1(s.server_seed, s.client_seed, v_nonce); fs := array[f];
    res := floor(f * 10001) / 100;
    v_win := case when v_over then res > t else res < t end;
    d := jsonb_build_object('result', res, 'target', t, 'mode', case when v_over then 'over' else 'under' end);

  elsif p_game = 'limbo' then
    t := (p_params->>'target')::float8;
    if t is null or t < 1.01 or t > 1000000 then raise exception 'Invalid target.'; end if;
    v_mult := t;
    f := rd_float1(s.server_seed, s.client_seed, v_nonce); fs := array[f];
    res := greatest(1, floor((0.99 / greatest(f, 1e-8)) * 100) / 100);
    v_win := res >= t;
    d := jsonb_build_object('result', res, 'target', t);

  elsif p_game = 'plinko' then
    v_rows := (p_params->>'rows')::int; v_risk := p_params->>'risk';
    select value->(v_rows::text)->v_risk into v_tab from game_tables where key = 'plinko';
    if v_tab is null then raise exception 'Invalid rows or risk.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, v_rows);
    v_slot := 0; v_path := '';
    for i in 1 .. v_rows loop tmp := floor(fs[i] * 2)::int; v_slot := v_slot + tmp; v_path := v_path || tmp; end loop;
    v_mult := (v_tab->>v_slot)::float8; v_win := true;
    d := jsonb_build_object('result', v_mult, 'rows', v_rows, 'risk', v_risk, 'slot', v_slot, 'path', v_path);

  elsif p_game = 'keno' then
    v_risk := coalesce(p_params->>'risk', 'classic');
    select array_agg(x::int) into v_picks from (select distinct jsonb_array_elements_text(coalesce(p_params->'picks', '[]')) x) q;
    if v_picks is null or array_length(v_picks, 1) > 10 or exists(select 1 from unnest(v_picks) x where x < 1 or x > 40) then raise exception 'Pick 1 to 10 numbers between 1 and 40.'; end if;
    select value->v_risk->(array_length(v_picks, 1) - 1) into v_tab from game_tables where key = 'keno';
    if v_tab is null then raise exception 'Invalid risk.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 10);
    a := array(select generate_series(1, 40));
    for j in 0 .. 9 loop
      k := j + floor(fs[j + 1] * (40 - j))::int;
      tmp := a[j + 1]; a[j + 1] := a[k + 1]; a[k + 1] := tmp;
    end loop;
    v_drawn := a[1:10];
    select count(*) into v_hits from unnest(v_drawn) x where x = any(v_picks);
    v_mult := (v_tab->>v_hits)::float8; v_win := v_mult > 0;
    d := jsonb_build_object('result', v_hits, 'hits', v_hits, 'picks', array_length(v_picks, 1), 'drawn', to_jsonb(v_drawn), 'risk', v_risk, 'numbers', to_jsonb(v_picks));

  elsif p_game = 'wheel' then
    v_n := (p_params->>'segments')::int; v_risk := p_params->>'risk';
    if v_n not in (10, 20, 30, 40, 50) or v_risk not in ('low','medium','high') then raise exception 'Invalid segments or risk.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 1);
    v_slot := floor(fs[1] * v_n)::int;
    if v_risk = 'medium' then
      select (value->(v_n::text)->>v_slot)::float8 into v_mult from game_tables where key = 'wheel_medium';
    elsif v_risk = 'low' then
      v_mult := (array[1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0]::float8[])[(v_slot % 10) + 1];
    else
      v_mult := case when v_slot = v_n - 1 then floor(0.99::float8 * v_n * 100 + 0.5) / 100 else 0 end;
    end if;
    v_win := v_mult > 0;
    d := jsonb_build_object('result', v_mult, 'segment', v_slot, 'segments', v_n, 'risk', v_risk);

  elsif p_game = 'roulette' then
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 1);
    v_n := floor(fs[1] * 37)::int; v_pay := 0;
    for v_key, v_val in select key, round(value::text::numeric, 2) from jsonb_each(p_params->'bets') loop
      if (case
            when v_key like 'n:%' then substr(v_key, 3)::int = v_n
            when v_n = 0 then false
            when v_key = 'red' then v_n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
            when v_key = 'black' then not (v_n = any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]))
            when v_key = 'even' then v_n % 2 = 0
            when v_key = 'odd' then v_n % 2 = 1
            when v_key = 'low' then v_n <= 18
            when v_key = 'high' then v_n >= 19
            when v_key like 'doz:%' then ceil(v_n / 12.0)::int = substr(v_key, 5)::int
            when v_key like 'col:%' then ((v_n - 1) % 3) + 1 = substr(v_key, 5)::int
            else false end) then
        v_pay := v_pay + v_val * (case when v_key like 'n:%' then 36 when v_key like 'doz:%' or v_key like 'col:%' then 3 else 2 end);
      end if;
    end loop;
    v_win := v_pay > 0; v_mult := round(v_pay / v_amt, 4)::float8;
    d := jsonb_build_object('result', v_n, 'bets', p_params->'bets');

  elsif p_game = 'coinflip' then
    v_n := coalesce((p_params->>'flips')::int, 1); v_side := p_params->>'pick';
    if v_n < 1 or v_n > 10 or v_side not in ('heads', 'tails') then raise exception 'Invalid flips or side.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, v_n);
    v_res := array(select case when x < 0.5 then 'heads' else 'tails' end from unnest(fs) with ordinality u(x, o) order by o);
    v_hits := 0;
    while v_hits < v_n and v_res[v_hits + 1] = v_side loop v_hits := v_hits + 1; end loop;
    v_win := v_hits = v_n; v_mult := floor(0.99::float8 * power(2::float8, v_n) * 100) / 100;
    d := jsonb_build_object('result', array_to_string(v_res[1:least(v_n, v_hits + 1)], ','), 'pick', v_side, 'flips', v_n, 'hits', v_hits);

  elsif p_game = 'double' then
    -- 15 casas: 0 = branca (14×), 1–7 vermelhas (2×), 8–14 pretas (2×)
    v_side := p_params->>'color';
    if v_side is null or v_side not in ('red', 'black', 'white') then raise exception 'Pick a color.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 1);
    v_n := floor(fs[1] * 15)::int;
    v_key := case when v_n = 0 then 'white' when v_n <= 7 then 'red' else 'black' end;
    v_win := v_key = v_side; v_mult := case when v_side = 'white' then 14 else 2 end;
    d := jsonb_build_object('result', v_n, 'color', v_key, 'pick', v_side);

  elsif p_game = 'baccarat' then
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 6);
    v_cards := array(select floor(x * 52)::int from unnest(fs) with ordinality u(x, o) order by o);
    v_P := array[v_cards[1], v_cards[3]]; v_B := array[v_cards[2], v_cards[4]]; v_ci := 5; v_p3 := null;
    v_pt := (select sum(case when (x % 13) + 1 >= 10 then 0 else (x % 13) + 1 end) from unnest(v_P) x)::int % 10;
    v_bt := (select sum(case when (x % 13) + 1 >= 10 then 0 else (x % 13) + 1 end) from unnest(v_B) x)::int % 10;
    if v_pt < 8 and v_bt < 8 then
      if v_pt <= 5 then v_p3 := v_cards[v_ci]; v_ci := v_ci + 1; v_P := v_P || v_p3; end if;
      if v_p3 is null then v_draw := v_bt <= 5;
      else
        v_x := case when (v_p3 % 13) + 1 >= 10 then 0 else (v_p3 % 13) + 1 end;
        v_draw := v_bt <= 2 or (v_bt = 3 and v_x <> 8) or (v_bt = 4 and v_x between 2 and 7) or (v_bt = 5 and v_x between 4 and 7) or (v_bt = 6 and v_x in (6, 7));
      end if;
      if v_draw then v_B := v_B || v_cards[v_ci]; end if;
    end if;
    v_pt := (select sum(case when (x % 13) + 1 >= 10 then 0 else (x % 13) + 1 end) from unnest(v_P) x)::int % 10;
    v_bt := (select sum(case when (x % 13) + 1 >= 10 then 0 else (x % 13) + 1 end) from unnest(v_B) x)::int % 10;
    v_winner := case when v_pt > v_bt then 'player' when v_bt > v_pt then 'banker' else 'tie' end;
    v_pay := 0;
    for v_key, v_val in select key, round(value::text::numeric, 2) from jsonb_each(p_params->'bets') loop
      if v_key = v_winner then v_pay := v_pay + v_val * (case v_key when 'player' then 2 when 'banker' then 1.95 else 9 end);
      elsif v_winner = 'tie' and v_key <> 'tie' then v_pay := v_pay + v_val; end if;
    end loop;
    v_win := v_pay > 0; v_mult := round(v_pay / v_amt, 4)::float8;
    d := jsonb_build_object('winner', v_winner, 'p', v_pt, 'b', v_bt,
      'player', (select string_agg(rd_card_label(x), ' ' order by o) from unnest(v_P) with ordinality u(x, o)),
      'banker', (select string_agg(rd_card_label(x), ' ' order by o) from unnest(v_B) with ordinality u(x, o)),
      'bets', p_params->'bets');
  end if;

  -- Pagamento (com o limite de lucro por aposta, se o admin ligar)
  if not v_win then v_mult := 0; v_pay := 0;
  else
    select (value)::text::numeric into v_max from settings where key = 'max_profit';
    if coalesce(v_max, 0) > 0 and v_amt * (v_mult::numeric - 1) > v_max then
      v_mult := floor(((v_amt + v_max) / v_amt) * 100)::float8 / 100; v_pay := null;
    end if;
    v_pay := round(coalesce(v_pay, v_amt * v_mult::numeric), 2);
  end if;

  select coalesce((value)::text::numeric, 0.05) into v_rate from settings where key = 'rakeback_rate';
  update profiles set balance = balance - v_amt + v_pay, wagered = wagered + v_amt, profit = profit + v_pay - v_amt,
      bets_count = bets_count + 1, rakeback = rakeback + v_amt * rd_game_edge(p_game) / 100 * coalesce(v_rate, 0.05)
    where id = v_uid returning * into p;
  insert into bets(user_id, game, amount, multiplier, payout, client_seed, nonce, detail)
    values (v_uid, p_game, v_amt, round(v_mult::numeric, 4), v_pay, s.client_seed, v_nonce, d) returning * into v_bet;

  return jsonb_build_object(
    'bet', jsonb_build_object('id', v_bet.id, 'game', p_game, 'amount', v_amt, 'multiplier', v_bet.multiplier, 'payout', v_pay, 'created_at', v_bet.created_at, 'detail', d),
    'fs', to_jsonb(fs::text[]), 'nonce', v_nonce, 'client', s.client_seed,
    'profile', rd_profile_json(p.id));
end $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_coin text, p_network text, p_amount_usd numeric, p_address text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_lim numeric; v_kyc text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform set_config('rd.coin', upper(coalesce(p_coin, '')), true);
  if p_amount_usd <= 0 then raise exception 'invalid amount'; end if;
  select (value)::text::numeric into v_lim from settings where key = 'kyc_withdraw_limit';
  select kyc into v_kyc from profiles where id = auth.uid();
  if coalesce(v_lim, 0) > 0 and p_amount_usd > v_lim and v_kyc <> 'verified' then
    raise exception 'Withdrawals above $% require identity verification.', to_char(v_lim, 'FM999999990');
  end if;
  update profiles set balance = balance - round(p_amount_usd, 2)
    where id = auth.uid() and status = 'active' and balance >= round(p_amount_usd, 2);
  if not found then raise exception 'insufficient balance'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, address)
    values (auth.uid(), 'withdrawal', round(p_amount_usd, 2), p_coin, p_network, trim(p_address)) returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_credit_deposit(p_user uuid, p_amount numeric, p_coin text, p_network text, p_tx_hash text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform set_config('rd.coin', upper(coalesce(p_coin, '')), true);
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set balance = balance + v where id = p_user;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  insert into transactions(user_id, type, status, amount_usd, coin, network, tx_hash, decided_at, decided_by)
    values (p_user, 'deposit', 'completed', v, nullif(p_coin, ''), nullif(p_network, ''), nullif(trim(coalesce(p_tx_hash, '')), ''), now(), auth.uid()) returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'credit deposit', jsonb_build_object('user', p_user, 'usd', v, 'coin', p_coin, 'network', p_network, 'tx', p_tx_hash));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_decide_tx(p_id bigint, p_approve boolean, p_tx_hash text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_hold boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t transactions;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into t from transactions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'transaction not pending'; end if;
  perform set_config('rd.coin', upper(coalesce(t.coin, '')), true);
  if t.type = 'deposit' and p_approve then
    update profiles set balance = balance + t.amount_usd where id = t.user_id;
  elsif t.type = 'withdrawal' and not p_approve then
    if p_hold then update profiles set held = held + t.amount_usd where id = t.user_id;
    else update profiles set balance = balance + t.amount_usd where id = t.user_id; end if;
  end if;
  update transactions set status = case when p_approve then 'completed' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid(), tx_hash = coalesce(p_tx_hash, tx_hash),
    note = coalesce(p_note, note) || case when not p_approve and p_hold and t.type = 'withdrawal' then ' (on hold)' else '' end
    where id = p_id;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'approve ' else (case when p_hold then 'reject+hold ' else 'reject ' end) end || t.type, jsonb_build_object('tx', p_id, 'user', t.user_id, 'usd', t.amount_usd));
end $function$;

CREATE OR REPLACE FUNCTION public.tip_send(p_to text, p_amount numeric, p_public boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v numeric := round(coalesce(p_amount, 0), 2); me profiles; dest profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform set_config('rd.coin', (select active_coin from profiles where id = auth.uid()), true); -- gorjeta sai e chega na mesma moeda
  if v < 1 then raise exception 'Minimum tip is $1.'; end if;
  select * into dest from profiles where lower(username) = lower(trim(coalesce(p_to, '')));
  if not found then raise exception 'User not found.'; end if;
  if dest.id = auth.uid() then raise exception 'You can''t tip yourself.'; end if;
  if dest.status <> 'active' then raise exception 'This user can''t receive tips.'; end if;
  if exists(select 1 from transactions where user_id = auth.uid() and type = 'tip_out' and note like 'Tip to %' and created_at > now() - interval '3 seconds') then
    raise exception 'Slow down a little.';
  end if;
  update profiles set balance = balance - v where id = auth.uid() and status = 'active' and balance >= v returning * into me;
  if not found then raise exception 'Insufficient balance.'; end if;
  update profiles set balance = balance + v where id = dest.id;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values
    (me.id, 'tip_out', 'completed', -v, 'Tip to ' || dest.username, now()),
    (dest.id, 'tip_in', 'completed', v, 'Tip from ' || me.username, now());
  if p_public then
    insert into chat_messages(username, kind, text) values ('Tip', 'tip', me.username || ' tipped ' || dest.username || ' $' || to_char(v, 'FM999999990.00'));
  end if;
end $function$;

