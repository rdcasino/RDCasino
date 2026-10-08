-- =====================================================================
-- Volta para UM saldo na tela: o jogador aposta e saca usando o total.
-- A carteira por moeda (profiles.wallet) continua registrando de qual cripto veio cada valor
-- (depósito em BTC entra em BTC; saque em BTC sai primeiro de BTC e completa com as outras).
-- =====================================================================
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
    -- falta nesta moeda: completa com as outras (o saldo total já foi conferido pela função que chamou)
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

create or replace function public.rd_profile_json(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('balance', balance, 'total', balance, 'wallet', wallet, 'coin', active_coin,
    'wagered', wagered, 'profit', profit, 'bets', bets_count, 'rakeback', rakeback, 'held', held) from profiles where id = p_uid
$$;
