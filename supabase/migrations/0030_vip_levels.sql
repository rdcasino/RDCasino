-- 0030: VIP novo — 8 famílias com 4 níveis cada (sem Obsidian), valores redondos em dólar.
--  * Progresso VIP (vip_xp) separado do total apostado: cada jogo conta com um peso
--    (game_tables.vip_weights: esportes 3x, slots e cassino ao vivo 1x, Dice e Limbo 0,75x, demais originais 1x).
--    O total apostado real (wagered) continua igual para leaderboard, rain, códigos e afiliados.
--  * Recompensa proporcional: o jogador tem direito à soma dos prêmios dos níveis alcançados; o resgate paga
--    só a diferença para o que já recebeu (level_paid). Nada é pago duas vezes, nem para quem resgatou na tabela antiga.
--  * Bônus diário (Bronze 3 = US$ 5 mil), semanal/mensal (Gold 2 = US$ 100 mil) e reload (Jade 2 = US$ 300 mil):
--    mesmos valores de desbloqueio de antes.

alter table public.profiles add column if not exists vip_xp numeric not null default 0;
alter table public.profiles add column if not exists level_paid numeric not null default 0;

insert into public.game_tables(key, value) values ('vip_weights', '{"default": 1, "dice": 0.75, "limbo": 0.75, "sports": 3, "slots": 1, "live": 1}')
  on conflict (key) do update set value = excluded.value;
insert into public.game_tables(key, value) values ('vip_tiers', $j$[{"name":"Bronze 1","wager":1000,"reward":2,"family":"bronze"},{"name":"Bronze 2","wager":2500,"reward":2,"family":"bronze"},{"name":"Bronze 3","wager":5000,"reward":3,"family":"bronze"},{"name":"Bronze 4","wager":10000,"reward":5,"family":"bronze"},{"name":"Silver 1","wager":15000,"reward":5,"family":"silver"},{"name":"Silver 2","wager":20000,"reward":5,"family":"silver"},{"name":"Silver 3","wager":30000,"reward":10,"family":"silver"},{"name":"Silver 4","wager":50000,"reward":20,"family":"silver"},{"name":"Gold 1","wager":75000,"reward":25,"family":"gold"},{"name":"Gold 2","wager":100000,"reward":25,"family":"gold"},{"name":"Gold 3","wager":150000,"reward":50,"family":"gold"},{"name":"Gold 4","wager":200000,"reward":50,"family":"gold"},{"name":"Jade 1","wager":250000,"reward":50,"family":"jade"},{"name":"Jade 2","wager":300000,"reward":50,"family":"jade"},{"name":"Jade 3","wager":400000,"reward":100,"family":"jade"},{"name":"Jade 4","wager":500000,"reward":100,"family":"jade"},{"name":"Sapphire 1","wager":600000,"reward":100,"family":"sapphire"},{"name":"Sapphire 2","wager":750000,"reward":150,"family":"sapphire"},{"name":"Sapphire 3","wager":1000000,"reward":250,"family":"sapphire"},{"name":"Sapphire 4","wager":1250000,"reward":250,"family":"sapphire"},{"name":"Emerald 1","wager":1500000,"reward":250,"family":"emerald"},{"name":"Emerald 2","wager":2000000,"reward":500,"family":"emerald"},{"name":"Emerald 3","wager":2500000,"reward":500,"family":"emerald"},{"name":"Emerald 4","wager":3000000,"reward":500,"family":"emerald"},{"name":"Ruby 1","wager":3500000,"reward":500,"family":"ruby"},{"name":"Ruby 2","wager":4000000,"reward":500,"family":"ruby"},{"name":"Ruby 3","wager":5000000,"reward":1000,"family":"ruby"},{"name":"Ruby 4","wager":6000000,"reward":1000,"family":"ruby"},{"name":"Amethyst 1","wager":7000000,"reward":1000,"family":"amethyst"},{"name":"Amethyst 2","wager":8000000,"reward":1000,"family":"amethyst"},{"name":"Amethyst 3","wager":9000000,"reward":1000,"family":"amethyst"},{"name":"Amethyst 4","wager":10000000,"reward":1000,"family":"amethyst"}]$j$::jsonb) on conflict (key) do update set value = excluded.value;
update public.game_tables set value = jsonb_set(jsonb_set(jsonb_set(value, '{daily,minTier}', '"Bronze 3"'), '{weekly,minTier}', '"Gold 2"'), '{monthly,minTier}', '"Gold 2"') where key = 'bonuses';

create or replace function public.rd_vip_weight(p_game text) returns numeric language sql stable set search_path to 'public' as $f$
  select coalesce((select (value->>p_game)::numeric from game_tables where key = 'vip_weights'), (select (value->>'default')::numeric from game_tables where key = 'vip_weights'), 1)
$f$;

-- direito acumulado: soma dos prêmios dos níveis com wager <= xp
create or replace function public.rd_vip_entitled(p_xp numeric) returns numeric language sql stable set search_path to 'public' as $f$
  select coalesce(sum((x->>'reward')::numeric), 0) from game_tables g, jsonb_array_elements(g.value) x where g.key = 'vip_tiers' and (x->>'wager')::numeric <= p_xp
$f$;

-- progresso de quem já jogou: refeito a partir do histórico de apostas, com os pesos
update public.profiles p set vip_xp = coalesce((select sum(b.amount * rd_vip_weight(b.game)) from bets b where b.user_id = p.id), 0),
  level_paid = coalesce((select sum(t.amount_usd) from transactions t where t.user_id = p.id and t.type = 'level_reward' and t.status = 'completed'), 0);

do $mig$
declare src text; n text;
begin
  src := pg_get_functiondef('public.play_bet(text,numeric,jsonb)'::regprocedure);
  n := replace(src, 'wagered = wagered + v_amt,', 'wagered = wagered + v_amt, vip_xp = vip_xp + v_amt * rd_vip_weight(p_game),');
  if n = src and src not like '%rd_vip_weight%' then raise exception 'play_bet: trecho não encontrado'; end if;
  if n <> src then execute n; end if;
  src := pg_get_functiondef('public.rd_round_settle'::regproc);
  n := replace(src, 'wagered = wagered + r.amount,', 'wagered = wagered + r.amount, vip_xp = vip_xp + r.amount * rd_vip_weight(r.game),');
  if n = src and src not like '%rd_vip_weight%' then raise exception 'rd_round_settle: trecho não encontrado'; end if;
  if n <> src then execute n; end if;
  src := pg_get_functiondef('public.rd_bonus_state(uuid)'::regprocedure);
  n := replace(src, 'if me.wagered < coalesce(need, 0) then', 'if me.vip_xp < coalesce(need, 0) then');
  if n = src and src not like '%me.vip_xp%' then raise exception 'rd_bonus_state: trecho não encontrado'; end if;
  if n <> src then execute n; end if;
end $mig$;

create or replace function public.rd_profile_json(p_uid uuid) returns jsonb language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object('balance', balance, 'total', balance, 'wallet', wallet, 'coin', active_coin,
    'wagered', wagered, 'profit', profit, 'bets', bets_count, 'rakeback', rakeback, 'held', held, 'vip_xp', vip_xp, 'level_paid', level_paid) from profiles where id = p_uid
$f$;

-- resgate do VIP: paga a diferença entre o direito acumulado e o que já foi pago (valor mostrado = p_expected)
drop function if exists public.claim_level(text, numeric);
create function public.claim_level(p_tier text default null, p_expected numeric default null)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare me profiles; v numeric; top text; names text[];
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into me from profiles where id = auth.uid() for update;
  if me.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  v := round(rd_vip_entitled(me.vip_xp) - me.level_paid, 2);
  if v < 0.01 then raise exception 'Nothing to claim yet.'; end if;
  if p_expected is not null and abs(v - p_expected) >= 0.005 then raise exception 'REWARD_CHANGED %', v; end if;
  select array_agg(x->>'name' order by (x->>'wager')::numeric), (array_agg(x->>'name' order by (x->>'wager')::numeric desc))[1] into names, top
    from game_tables g, jsonb_array_elements(g.value) x where g.key = 'vip_tiers' and (x->>'wager')::numeric <= me.vip_xp;
  update profiles set balance = balance + v, level_paid = level_paid + v, claimed_tiers = coalesce(names, '{}') where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'level_reward', 'completed', v, coalesce(top, 'VIP'), now());
  return v;
end $function$;
revoke all on function public.claim_level(text, numeric) from public, anon;
grant execute on function public.claim_level(text, numeric) to authenticated, service_role;
notify pgrst, 'reload schema';
