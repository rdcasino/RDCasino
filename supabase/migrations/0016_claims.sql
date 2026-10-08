-- =====================================================================
-- Resgates no servidor: rakeback instantâneo, prêmios de nível VIP e bônus
-- diário/semanal/mensal (mesmas regras de assets/js/data.js)
-- =====================================================================
insert into public.game_tables(key, value) values ('vip_tiers', '[{"name":"Bronze 1","wager":1000,"reward":2},{"name":"Bronze 2","wager":5000,"reward":10},{"name":"Bronze 3","wager":15000,"reward":30},{"name":"Bronze 4","wager":50000,"reward":100},{"name":"Silver 1","wager":100000,"reward":200},{"name":"Silver 2","wager":150000,"reward":300},{"name":"Silver 3","wager":200000,"reward":400},{"name":"Silver 4","wager":250000,"reward":500},{"name":"Gold 1","wager":300000,"reward":600},{"name":"Gold 2","wager":350000,"reward":700},{"name":"Gold 3","wager":400000,"reward":800},{"name":"Gold 4","wager":450000,"reward":900},{"name":"Jade 1","wager":500000,"reward":1000},{"name":"Jade 2","wager":600000,"reward":1200},{"name":"Jade 3","wager":700000,"reward":1400},{"name":"Jade 4","wager":800000,"reward":1600},{"name":"Jade 5","wager":900000,"reward":1800},{"name":"Sapphire 1","wager":1000000,"reward":2000},{"name":"Sapphire 2","wager":1500000,"reward":3000},{"name":"Emerald 1","wager":2000000,"reward":4000},{"name":"Emerald 2","wager":2500000,"reward":5000},{"name":"Ruby 1","wager":3000000,"reward":6000},{"name":"Ruby 2","wager":3500000,"reward":7000},{"name":"Obsidian 1","wager":4000000,"reward":8000},{"name":"Obsidian 2","wager":4500000,"reward":9000},{"name":"Amethyst 1","wager":5000000,"reward":10000},{"name":"Amethyst 2","wager":7500000,"reward":15000},{"name":"Amethyst 3","wager":10000000,"reward":20000}]'), ('bonuses', '{"daily":{"label":"Daily Bonus","rate":0.03,"hours":24,"minTier":"Bronze 2"},"weekly":{"label":"Weekly Bonus","rate":0.04,"hours":168,"minTier":"Silver 1"},"monthly":{"label":"Monthly Bonus","rate":0.05,"hours":720,"minTier":"Silver 1"}}') on conflict (key) do update set value = excluded.value;

alter table public.profiles add column if not exists bonus_claims jsonb not null default '{}';

-- Vantagem da casa gerada pelo jogador desde p_from (valor apostado × vantagem do jogo)
create or replace function public.rd_edge_since(p_uid uuid, p_from timestamptz)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount * rd_game_edge(game) / 100), 0) from bets where user_id = p_uid and created_at >= p_from
$$;

-- Estado dos bônus diário/semanal/mensal: {key, amount, status: locked|wait|ready|empty, availableAt}
create or replace function public.rd_bonus_state(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles; cfg jsonb; k text; c jsonb; need numeric; last timestamptz; period interval; amt numeric; st text; avail timestamptz; out jsonb := '[]';
begin
  select * into me from profiles where id = p_uid;
  select value into cfg from game_tables where key = 'bonuses';
  foreach k in array array['daily', 'weekly', 'monthly'] loop
    c := cfg->k;
    select (t->>'wager')::numeric into need from game_tables g, jsonb_array_elements(g.value) t where g.key = 'vip_tiers' and t->>'name' = c->>'minTier';
    period := make_interval(hours => (c->>'hours')::int);
    last := (me.bonus_claims->>k)::timestamptz; avail := null; amt := 0;
    if me.wagered < coalesce(need, 0) then st := 'locked';
    else
      amt := floor(rd_edge_since(p_uid, greatest(coalesce(last, '-infinity'::timestamptz), now() - period)) * (c->>'rate')::numeric * 100) / 100;
      if last is not null and last + period > now() then st := 'wait'; avail := last + period;
      elsif amt >= 0.01 then st := 'ready'; else st := 'empty'; end if;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('key', k, 'label', c->>'label', 'minTier', c->>'minTier', 'amount', amt, 'status', st, 'availableAt', avail));
  end loop;
  return out;
end $$;
revoke all on function public.rd_bonus_state(uuid), public.rd_edge_since(uuid, timestamptz) from public, anon, authenticated;
create or replace function public.my_bonus_state()
returns jsonb language sql stable security definer set search_path = public as $$ select public.rd_bonus_state(auth.uid()) $$;
grant execute on function public.my_bonus_state() to authenticated;

create or replace function public.claim_bonus(p_key text)
returns numeric language plpgsql security definer set search_path = public as $$
declare it jsonb; v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform 1 from profiles where id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Your account is suspended.'; end if;
  select e into it from jsonb_array_elements(rd_bonus_state(auth.uid())) e where e->>'key' = p_key;
  if it is null then raise exception 'Unknown bonus.'; end if;
  if it->>'status' = 'wait' then raise exception 'Not available yet.'; end if;
  if it->>'status' <> 'ready' then raise exception 'Nothing to claim yet.'; end if;
  v := (it->>'amount')::numeric;
  update profiles set balance = balance + v, bonus_claims = bonus_claims || jsonb_build_object(p_key, now()) where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'bonus', 'completed', v, it->>'label', now());
  return v;
end $$;

create or replace function public.claim_rakeback()
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select floor(rakeback * 100) / 100 into v from profiles where id = auth.uid() and status = 'active' for update;
  if v is null then raise exception 'Your account is suspended.'; end if;
  if v < 0.01 then raise exception 'Nothing to claim yet.'; end if;
  update profiles set balance = balance + v, rakeback = rakeback - v where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'rakeback', 'completed', v, 'Instant rakeback', now());
  return v;
end $$;

create or replace function public.claim_level(p_tier text)
returns numeric language plpgsql security definer set search_path = public as $$
declare t jsonb; me profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into me from profiles where id = auth.uid() for update;
  if me.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  select x into t from game_tables g, jsonb_array_elements(g.value) x where g.key = 'vip_tiers' and x->>'name' = p_tier;
  if t is null or me.wagered < (t->>'wager')::numeric or p_tier = any(me.claimed_tiers) then raise exception 'Not available.'; end if;
  update profiles set balance = balance + (t->>'reward')::numeric, claimed_tiers = array_append(claimed_tiers, p_tier) where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'level_reward', 'completed', (t->>'reward')::numeric, p_tier, now());
  return (t->>'reward')::numeric;
end $$;
revoke all on function public.claim_bonus(text), public.claim_rakeback(), public.claim_level(text) from public, anon;
grant execute on function public.claim_bonus(text), public.claim_rakeback(), public.claim_level(text) to authenticated;

-- ---------- Apostas recentes públicas (feed da home e "Recent plays" de cada jogo) ----------
create or replace function public.public_bets(p_limit int default 300)
returns table(id bigint, username text, game text, amount numeric, multiplier numeric, payout numeric, created_at timestamptz, detail jsonb)
language sql stable security definer set search_path = public as $$
  select b.id, p.username, b.game, b.amount, b.multiplier, b.payout, b.created_at, b.detail - 'client'
  from bets b join profiles p on p.id = b.user_id
  order by b.id desc limit least(greatest(coalesce(p_limit, 300), 1), 500)
$$;
grant execute on function public.public_bets(int) to anon, authenticated;
