-- =====================================================================
-- Semanal e mensal com data fixa (horário de Brasília):
--   semanal → toda quinta-feira às 12:00, paga a vantagem da casa da semana fechada
--   mensal  → todo dia 1 às 12:00, paga a do mês fechado
-- Diário continua a cada 24h.
-- =====================================================================
create or replace function public.rd_edge_between(p_uid uuid, p_from timestamptz, p_to timestamptz)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount * rd_game_edge(game) / 100), 0) from bets where user_id = p_uid and created_at >= p_from and created_at < p_to
$$;
revoke all on function public.rd_edge_between(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Última liberação (<= agora), a anterior e a próxima
create or replace function public.rd_bonus_window(p_key text, out cur timestamptz, out prev timestamptz, out nxt timestamptz)
language plpgsql stable set search_path = public as $$
declare tz constant text := 'America/Sao_Paulo'; loc timestamp := now() at time zone tz; d timestamp;
begin
  if p_key = 'weekly' then
    d := date_trunc('week', loc) + interval '3 days 12 hours';     -- quinta 12:00
    if d > loc then d := d - interval '7 days'; end if;
    cur := d at time zone tz; prev := (d - interval '7 days') at time zone tz; nxt := (d + interval '7 days') at time zone tz;
  else
    d := date_trunc('month', loc) + interval '12 hours';           -- dia 1, 12:00
    if d > loc then d := d - interval '1 month'; end if;
    cur := d at time zone tz; prev := (d - interval '1 month') at time zone tz; nxt := (d + interval '1 month') at time zone tz;
  end if;
end $$;

create or replace function public.rd_bonus_state(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles; cfg jsonb; k text; c jsonb; need numeric; last timestamptz; period interval; amt numeric; st text; avail timestamptz; w record; out jsonb := '[]';
begin
  select * into me from profiles where id = p_uid;
  select value into cfg from game_tables where key = 'bonuses';
  foreach k in array array['daily', 'weekly', 'monthly'] loop
    c := cfg->k;
    select (t->>'wager')::numeric into need from game_tables g, jsonb_array_elements(g.value) t where g.key = 'vip_tiers' and t->>'name' = c->>'minTier';
    last := (me.bonus_claims->>k)::timestamptz; avail := null; amt := 0;
    if me.wagered < coalesce(need, 0) then st := 'locked';
    elsif k = 'daily' then
      period := make_interval(hours => (c->>'hours')::int);
      amt := floor(rd_edge_since(p_uid, greatest(coalesce(last, '-infinity'::timestamptz), now() - period)) * (c->>'rate')::numeric * 100) / 100;
      if last is not null and last + period > now() then st := 'wait'; avail := last + period;
      elsif amt >= 0.01 then st := 'ready'; else st := 'empty'; end if;
    else
      select * into w from rd_bonus_window(k);
      if last is not null and last >= w.cur then st := 'wait'; avail := w.nxt;
      else
        amt := floor(rd_edge_between(p_uid, greatest(coalesce(last, '-infinity'::timestamptz), w.prev), w.cur) * (c->>'rate')::numeric * 100) / 100;
        if amt >= 0.01 then st := 'ready'; else st := 'wait'; avail := w.nxt; amt := 0; end if;
      end if;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('key', k, 'label', c->>'label', 'minTier', c->>'minTier', 'amount', amt, 'status', st, 'availableAt', avail));
  end loop;
  return out;
end $$;
revoke all on function public.rd_bonus_state(uuid) from public, anon, authenticated;
