-- 0031 · Jogo responsável: limites de depósito, perda e aposta (24h / 7 dias / 30 dias, janelas móveis),
-- pausa (1, 7 ou 30 dias) e autoexclusão (6 meses, 1 ano ou permanente).
-- Baixar um limite vale na hora; subir ou tirar só vale depois de 24h (padrão do mercado).
-- Pausa e autoexclusão não podem ser canceladas pelo jogador. Saque continua liberado.

create table if not exists public.rg_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  limits jsonb not null default '{}',
  pending jsonb not null default '{}',
  break_until timestamptz,
  excluded_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.rg_limits enable row level security;
drop policy if exists rg_self_read on public.rg_limits;
create policy rg_self_read on public.rg_limits for select using (auth.uid() = user_id);
revoke insert, update, delete on public.rg_limits from anon, authenticated;

create or replace function public.rd_rg_period(p text) returns interval language sql immutable as $$
  select case p when 'day' then interval '24 hours' when 'week' then interval '7 days' when 'month' then interval '30 days' end
$$;

-- aplica os aumentos/remoções que já cumpriram as 24h
create or replace function public.rd_rg_load(p_uid uuid) returns public.rg_limits
language plpgsql security definer set search_path to 'public' as $$
declare g rg_limits; k text; v jsonb; lim jsonb; pen jsonb; changed boolean := false;
begin
  select * into g from rg_limits where user_id = p_uid;
  if not found then return null; end if;
  lim := g.limits; pen := g.pending;
  for k, v in select key, value from jsonb_each(g.pending) loop
    if (v->>'at')::timestamptz <= now() then
      if v->'value' is null or jsonb_typeof(v->'value') = 'null' then lim := lim #- string_to_array(k, '.');
      else lim := jsonb_set(case when lim ? split_part(k, '.', 1) then lim else lim || jsonb_build_object(split_part(k, '.', 1), '{}'::jsonb) end, string_to_array(k, '.'), v->'value'); end if;
      pen := pen - k; changed := true;
    end if;
  end loop;
  if changed then update rg_limits set limits = lim, pending = pen, updated_at = now() where user_id = p_uid returning * into g; end if;
  return g;
end $$;

create or replace function public.rd_rg_until(t timestamptz) returns text language sql immutable as $$
  select case when t = 'infinity'::timestamptz then 'permanently' else 'until ' || to_char(t at time zone 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC' end
$$;

-- chamada no começo de cada aposta, depósito, gorjeta, rain e código
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
        select coalesce(sum(amount_usd), 0) into used from transactions where user_id = p_uid and type = 'deposit' and status in ('pending', 'completed') and created_at > now() - rd_rg_period(per);
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
      if k = 'deposit' then select coalesce(sum(amount_usd), 0) into v from transactions where user_id = p_uid and type = 'deposit' and status in ('pending', 'completed') and created_at > now() - rd_rg_period(per);
      elsif k = 'loss' then select coalesce(sum(amount - payout), 0) into v from bets where user_id = p_uid and created_at > now() - rd_rg_period(per);
      else select coalesce(sum(amount), 0) into v from bets where user_id = p_uid and created_at > now() - rd_rg_period(per); end if;
      used := jsonb_set(case when used ? k then used else used || jsonb_build_object(k, '{}'::jsonb) end, array[k, per], to_jsonb(round(greatest(v, 0), 2)));
    end loop;
  end loop;
  return jsonb_build_object('limits', coalesce(g.limits, '{}'), 'pending', coalesce(g.pending, '{}'), 'used', used,
    'break_until', case when g.break_until > now() then g.break_until end,
    'excluded_until', case when g.excluded_until > now() then g.excluded_until end);
end $$;

create or replace function public.my_rg() returns jsonb language sql security definer set search_path to 'public' as $$
  select public.rd_rg_json(auth.uid())
$$;

create or replace function public.rg_set_limit(p_kind text, p_period text, p_value numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); g rg_limits; cur numeric; v numeric := case when p_value is null then null else round(p_value, 2) end; key text;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if p_kind not in ('deposit', 'loss', 'wager') or p_period not in ('day', 'week', 'month') then raise exception 'Invalid limit.'; end if;
  if v is not null and (v < 1 or v > 10000000) then raise exception 'Limit must be between $1 and $10,000,000.'; end if;
  insert into rg_limits(user_id) values (v_uid) on conflict (user_id) do nothing;
  g := rd_rg_load(v_uid);
  key := p_kind || '.' || p_period;
  cur := (g.limits->p_kind->>p_period)::numeric;
  if v is not null and (cur is null or v <= cur) then
    -- mais restritivo: vale na hora e cancela aumento pendente
    update rg_limits set limits = jsonb_set(case when limits ? p_kind then limits else limits || jsonb_build_object(p_kind, '{}'::jsonb) end, array[p_kind, p_period], to_jsonb(v)),
      pending = pending - key, updated_at = now() where user_id = v_uid;
  elsif cur is null and v is null then
    update rg_limits set pending = pending - key, updated_at = now() where user_id = v_uid;
  else
    -- mais permissivo (subir ou tirar): só depois de 24h
    update rg_limits set pending = pending || jsonb_build_object(key, jsonb_build_object('value', to_jsonb(v), 'at', now() + interval '24 hours')), updated_at = now() where user_id = v_uid;
  end if;
  return rd_rg_json(v_uid);
end $$;

create or replace function public.rg_take_break(p_days int) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if p_days not in (1, 7, 30) then raise exception 'Choose 1, 7 or 30 days.'; end if;
  insert into rg_limits(user_id, break_until) values (v_uid, now() + make_interval(days => p_days))
    on conflict (user_id) do update set break_until = greatest(coalesce(rg_limits.break_until, now()), now() + make_interval(days => p_days)), updated_at = now();
  return rd_rg_json(v_uid);
end $$;

create or replace function public.rg_self_exclude(p_months int) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); t timestamptz;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  if p_months not in (6, 12, 0) then raise exception 'Choose 6 months, 1 year or permanent.'; end if;
  t := case when p_months = 0 then 'infinity'::timestamptz else now() + make_interval(months => p_months) end;
  insert into rg_limits(user_id, excluded_until) values (v_uid, t)
    on conflict (user_id) do update set excluded_until = greatest(coalesce(rg_limits.excluded_until, now()), t), updated_at = now();
  return rd_rg_json(v_uid);
end $$;

-- admin: ver o estado de um jogador
create or replace function public.admin_rg(p_user uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'not allowed'; end if;
  return rd_rg_json(p_user);
end $$;

revoke all on function public.rd_rg_load(uuid), public.rd_rg_check(uuid, text, numeric), public.rd_rg_json(uuid) from public, anon, authenticated;
grant execute on function public.my_rg(), public.rg_set_limit(text, text, numeric), public.rg_take_break(int), public.rg_self_exclude(int), public.admin_rg(uuid) to authenticated;

-- Cada aposta, depósito, gorjeta, rain e código passa pela checagem de jogo responsável
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
  perform rd_rg_check(v_uid, 'bet', v_amt);
  select * into s from seeds where user_id = v_uid for update;
  v_nonce := s.nonce;
  update seeds set nonce = nonce + 1 where user_id = v_uid;

  if p_game = 'dice' then
    t := (p_params->>'target')::float8; v_over := coalesce(p_params->>'mode', 'over') <> 'under';
    if t is null or (v_over and (t < 3 or t > 99.99)) or (not v_over and (t < 0.01 or t > 97)) then raise exception 'Invalid target.'; end if;
    c := floor((case when v_over then 100 - t else t end) * 100 + 0.5) / 100;
    v_mult := floor((98 / c) * 10000) / 10000;
    f := rd_float1(s.server_seed, s.client_seed, v_nonce); fs := array[f];
    res := floor(f * 10001) / 100;
    v_win := case when v_over then res > t else res < t end;
    d := jsonb_build_object('result', res, 'target', t, 'mode', case when v_over then 'over' else 'under' end);

  elsif p_game = 'limbo' then
    t := (p_params->>'target')::float8;
    if t is null or t < 1.01 or t > 1000000 then raise exception 'Invalid target.'; end if;
    v_mult := t;
    f := rd_float1(s.server_seed, s.client_seed, v_nonce); fs := array[f];
    res := greatest(1, floor((0.98 / greatest(f, 1e-8)) * 100) / 100);
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
      v_mult := (array[1.4, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0]::float8[])[(v_slot % 10) + 1];
    else
      v_mult := case when v_slot = v_n - 1 then floor(0.98::float8 * v_n * 100 + 0.5) / 100 else 0 end;
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
        v_pay := v_pay + v_val * (case when v_key like 'n:%' then 36.26 when v_key like 'doz:%' or v_key like 'col:%' then 3.0216 else 2.0144 end);
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
    v_win := v_hits = v_n; v_mult := floor(0.98::float8 * power(2::float8, v_n) * 100) / 100;
    d := jsonb_build_object('result', array_to_string(v_res[1:least(v_n, v_hits + 1)], ','), 'pick', v_side, 'flips', v_n, 'hits', v_hits);

  elsif p_game = 'double' then
    -- 15 casas: 0 = branca (14×), 1–7 vermelhas (2×), 8–14 pretas (2×)
    v_side := p_params->>'color';
    if v_side is null or v_side not in ('red', 'black', 'white') then raise exception 'Pick a color.'; end if;
    fs := rd_floats(s.server_seed, s.client_seed, v_nonce, 1);
    v_n := floor(fs[1] * 15)::int;
    v_key := case when v_n = 0 then 'white' when v_n <= 7 then 'red' else 'black' end;
    v_win := v_key = v_side; v_mult := case when v_side = 'white' then 14.7 else 2.1 end;
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
  update profiles set balance = balance - v_amt + v_pay, wagered = wagered + v_amt, vip_xp = vip_xp + v_amt * rd_vip_weight(p_game), profit = profit + v_pay - v_amt,
      bets_count = bets_count + 1, rakeback = rakeback + v_amt * rd_game_edge(p_game) / 100 * coalesce(v_rate, 0.05)
    where id = v_uid returning * into p;
  insert into bets(user_id, game, amount, multiplier, payout, client_seed, nonce, detail)
    values (v_uid, p_game, v_amt, round(v_mult::numeric, 4), v_pay, s.client_seed, v_nonce, d) returning * into v_bet;

  return jsonb_build_object(
    'bet', jsonb_build_object('id', v_bet.id, 'game', p_game, 'amount', v_amt, 'multiplier', v_bet.multiplier, 'payout', v_pay, 'created_at', v_bet.created_at, 'detail', d),
    'fs', to_jsonb(fs::text[]), 'nonce', v_nonce, 'client', s.client_seed,
    'profile', rd_profile_json(p.id));
end $function$;

CREATE OR REPLACE FUNCTION public.round_start(p_game text, p_amount numeric, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET extra_float_digits TO '1'
AS $function$
declare v_uid uuid := auth.uid(); v_amt numeric := round(coalesce(p_amount, 0), 2); p profiles; s seeds; st jsonb; r rounds; v_tab jsonb; t float8; v_r int; v_s int; res jsonb;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  if p_game not in ('mines','tower','chicken','hilo','rps','crash','blackjack','soccer','door','spill','pump','lake') then raise exception 'Unknown game.'; end if;
  if v_amt < 0.01 then raise exception 'Minimum bet is $0.01.'; end if;
  select * into p from profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found.'; end if;
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if exists(select 1 from rounds where user_id = v_uid and game = p_game) then raise exception 'You already have a round open in this game.'; end if;
  if p.balance < v_amt then raise exception 'Insufficient balance.'; end if;
  perform rd_rg_check(v_uid, 'bet', v_amt);

  if p_game = 'mines' then
    if coalesce((p_params->>'m')::int, 0) not between 1 and 24 then raise exception 'Choose 1 to 24 mines.'; end if;
    st := jsonb_build_object('m', (p_params->>'m')::int, 'revealed', '[]'::jsonb);
  elsif p_game = 'tower' then
    select value->(p_params->>'level') into v_tab from game_tables where key = 'tower';
    if v_tab is null then raise exception 'Invalid level.'; end if;
    st := jsonb_build_object('level', p_params->>'level', 'picks', '[]'::jsonb);
  elsif p_game = 'chicken' then
    select value->(p_params->>'diff') into v_tab from game_tables where key = 'chicken';
    if v_tab is null then raise exception 'Invalid difficulty.'; end if;
    st := jsonb_build_object('diff', p_params->>'diff', 'steps', 0);
  elsif p_game in ('soccer', 'door') then
    select value->(p_params->>'diff') into v_tab from game_tables where key = p_game;
    if v_tab is null then raise exception 'Invalid difficulty.'; end if;
    st := case when p_game = 'soccer' then jsonb_build_object('diff', p_params->>'diff', 'goals', 0, 'shots', '[]'::jsonb)
               else jsonb_build_object('diff', p_params->>'diff', 'level', 0, 'picks', '[]'::jsonb) end;
  elsif p_game = 'hilo' then
    v_r := coalesce((p_params->'start'->>'rank')::int, 7); v_s := coalesce((p_params->'start'->>'suit')::int, 0);
    if v_r not between 1 and 13 or v_s not between 0 and 3 then raise exception 'Invalid card.'; end if;
    st := jsonb_build_object('cards', jsonb_build_array(jsonb_build_object('rank', v_r, 'suit', v_s)), 'mult', 1);
  elsif p_game in ('spill', 'pump') then
    if coalesce(p_params->>'diff', '') not in ('low','medium','high','degen') then raise exception 'Invalid difficulty.'; end if;
    st := jsonb_build_object('diff', p_params->>'diff', 'steps', 0);
  elsif p_game = 'lake' then
    st := jsonb_build_object('steps', 0, 'mult', 0.98, 'path', '[]'::jsonb);
  elsif p_game = 'rps' then
    st := jsonb_build_object('throws', '[]'::jsonb, 'wins', 0);
  elsif p_game = 'crash' then
    t := (p_params->>'target')::float8;
    if t is null or t < 1.01 or t > 1000000 then raise exception 'Invalid target.'; end if;
    st := jsonb_build_object('target', t);
  else
    st := '{}'::jsonb;
  end if;

  select * into s from seeds where user_id = v_uid for update;
  update seeds set nonce = nonce + 1 where user_id = v_uid;
  update profiles set balance = balance - v_amt where id = v_uid;
  insert into rounds(user_id, game, amount, server_seed, client_seed, nonce, state, started_at)
    values (v_uid, p_game, v_amt, s.server_seed, s.client_seed, s.nonce, st, clock_timestamp()) returning * into r;
  if p_game = 'blackjack' then res := rd_bj(r, 'deal', '{}'); else res := jsonb_build_object('state', st); end if;
  return res || jsonb_build_object('round', jsonb_build_object('game', p_game, 'amount', v_amt, 'nonce', s.nonce, 'client', s.client_seed, 'started', r.started_at), 'profile', rd_profile_json(v_uid));
end $function$;

CREATE OR REPLACE FUNCTION public.request_deposit(p_coin text, p_network text, p_amount_usd numeric, p_tx_hash text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_min numeric; v_id bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform rd_rg_check(auth.uid(), 'deposit', round(coalesce(p_amount_usd, 0), 2));
  select greatest(min_deposit, (select (value)::text::numeric from settings where key = 'min_deposit'))
    into v_min from wallets where coin = p_coin and network = p_network and enabled;
  if v_min is null then raise exception 'coin/network not accepted'; end if;
  if p_amount_usd < v_min then raise exception 'minimum deposit is %', v_min; end if;
  if coalesce(trim(p_tx_hash), '') = '' then raise exception 'transaction hash required'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, tx_hash)
    values (auth.uid(), 'deposit', round(p_amount_usd, 2), p_coin, p_network, trim(p_tx_hash)) returning id into v_id;
  return v_id;
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
  perform rd_rg_check(auth.uid(), 'social', 0);
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

CREATE OR REPLACE FUNCTION public.rain_join()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r rains; p profiles; v_w numeric;
begin
  if auth.uid() is null then raise exception 'Sign in to join the rain.'; end if;
  perform rd_rg_check(auth.uid(), 'social', 0);
  perform public.rain_settle();
  select * into r from rains where status = 'open' for update;
  if not found or r.ends_at <= now() then raise exception 'No rain running right now.'; end if;
  select * into p from profiles where id = auth.uid();
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if r.min_wager > 0 then
    select coalesce(sum(amount), 0) into v_w from bets where user_id = auth.uid() and created_at > now() - interval '7 days';
    if v_w < r.min_wager then
      raise exception 'Wager at least $% in the last 7 days to join the rain (you have $%).', to_char(r.min_wager, 'FM999,999,990'), to_char(v_w, 'FM999,999,990.00');
    end if;
  end if;
  insert into rain_entries(rain_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  if found then update rains set participants = participants + 1 where id = r.id; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.rain_contribute(p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r rains; v_name text; v numeric := round(p_amount, 2);
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform rd_rg_check(auth.uid(), 'social', 0);
  if v < 1 then raise exception 'Minimum is $1.'; end if;
  select * into r from rains where status = 'open' for update;
  if not found or r.ends_at <= now() then raise exception 'No rain running right now.'; end if;
  update profiles set balance = balance - v where id = auth.uid() and status = 'active' and balance >= v returning username into v_name;
  if not found then raise exception 'Insufficient balance.'; end if;
  update rains set amount = amount + v where id = r.id;
  insert into rain_contributions(rain_id, user_id, amount) values (r.id, auth.uid(), v);
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'tip_out', 'completed', -v, 'Rain contribution', now());
  insert into chat_messages(username, kind, text) values ('Rain', 'rain', v_name || ' added $' || v || ' to the rain!');
end $function$;

CREATE OR REPLACE FUNCTION public.redeem_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c promo_codes; me profiles; v_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then return jsonb_build_object('error', 'Sign in first.'); end if;
  begin perform rd_rg_check(auth.uid(), 'social', 0); exception when others then return jsonb_build_object('error', sqlerrm); end;
  if (select count(*) from promo_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('error', 'Too many attempts. Try again in an hour.');
  end if;
  select * into me from profiles where id = auth.uid() for update;
  if me.status <> 'active' then return jsonb_build_object('error', 'Your account is suspended.'); end if;
  if exists(select 1 from promo_redemptions where code = v_code and user_id = auth.uid()) then return jsonb_build_object('error', 'You already used this code.'); end if;
  select * into c from promo_codes where code = v_code for update;
  if not found or not c.active or (c.expires_at is not null and c.expires_at < now()) or (c.max_uses > 0 and c.uses >= c.max_uses) then
    insert into promo_attempts(user_id) values (auth.uid());
    return jsonb_build_object('error', case when found and c.max_uses > 0 and c.uses >= c.max_uses then 'This code has been fully claimed.' when found and c.expires_at < now() then 'This code has expired.' else 'Invalid code.' end);
  end if;
  if exists(select 1 from promo_redemptions where code = v_code and user_id = auth.uid()) then return jsonb_build_object('error', 'You already used this code.'); end if;
  if me.wagered < c.min_wager then return jsonb_build_object('error', 'Wager at least $' || to_char(c.min_wager, 'FM999999990') || ' in total to use this code.'); end if;
  insert into promo_redemptions(code, user_id, amount) values (v_code, auth.uid(), c.amount);
  update promo_codes set uses = uses + 1 where code = v_code;
  update profiles set balance = balance + c.amount where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'bonus', 'completed', c.amount, 'Code ' || v_code, now());
  return jsonb_build_object('ok', true, 'amount', c.amount);
end $function$;
