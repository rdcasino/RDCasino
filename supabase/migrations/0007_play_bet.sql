-- =====================================================================
-- Jogos de um clique sorteados no servidor
-- (Dice, Limbo, Plinko, Keno, Wheel, Roulette, Coinflip, Baccarat)
-- O navegador manda só o jogo, o valor e as escolhas. O banco:
--   1) confere saldo e trava a conta do jogador durante a aposta;
--   2) sorteia com a server seed (que o navegador nunca vê);
--   3) calcula o multiplicador com as mesmas tabelas e fórmulas do site;
--   4) grava saldo + aposta numa transação só.
-- Os números sorteados voltam para o site animar e continuam verificáveis
-- na página Provably Fair depois da troca de seed.
-- =====================================================================

create table if not exists public.game_tables (key text primary key, value jsonb not null);
alter table public.game_tables enable row level security;
drop policy if exists game_tables_read on public.game_tables;
create policy game_tables_read on public.game_tables for select using (true);
insert into public.game_tables(key, value) values
  ('plinko', '{"8":{"low":[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],"medium":[13,3,1.3,0.7,0.4,0.7,1.3,3,13],"high":[29,4,1.5,0.3,0.2,0.3,1.5,4,29]},"9":{"low":[5.6,2,1.6,1,0.7,0.7,1,1.6,2,5.6],"medium":[18,4,1.7,0.9,0.5,0.5,0.9,1.7,4,18],"high":[43,7,2,0.6,0.2,0.2,0.6,2,7,43]},"10":{"low":[8.9,3,1.4,1.1,1,0.5,1,1.1,1.4,3,8.9],"medium":[22,5,2,1.4,0.6,0.4,0.6,1.4,2,5,22],"high":[76,10,3,0.9,0.3,0.2,0.3,0.9,3,10,76]},"11":{"low":[8.4,3,1.9,1.3,1,0.7,0.7,1,1.3,1.9,3,8.4],"medium":[24,6,3,1.8,0.7,0.5,0.5,0.7,1.8,3,6,24],"high":[120,14,5.2,1.4,0.4,0.2,0.2,0.4,1.4,5.2,14,120]},"12":{"low":[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],"medium":[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],"high":[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170]},"13":{"low":[8.1,4,3,1.9,1.2,0.9,0.7,0.7,0.9,1.2,1.9,3,4,8.1],"medium":[43,13,6,3,1.3,0.7,0.4,0.4,0.7,1.3,3,6,13,43],"high":[260,37,11,4,1,0.2,0.2,0.2,0.2,1,4,11,37,260]},"14":{"low":[7.1,4,1.9,1.4,1.3,1.1,1,0.5,1,1.1,1.3,1.4,1.9,4,7.1],"medium":[58,15,7,4,1.9,1,0.5,0.2,0.5,1,1.9,4,7,15,58],"high":[420,56,18,5,1.9,0.3,0.2,0.2,0.2,0.3,1.9,5,18,56,420]},"15":{"low":[15,8,3,2,1.5,1.1,1,0.7,0.7,1,1.1,1.5,2,3,8,15],"medium":[88,18,11,5,3,1.3,0.5,0.3,0.3,0.5,1.3,3,5,11,18,88],"high":[620,83,27,8,3,0.5,0.2,0.2,0.2,0.2,0.5,3,8,27,83,620]},"16":{"low":[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16],"medium":[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110],"high":[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}}'),
  ('keno', '{"classic":[[0,3.96],[0,1.9,4.5],[0,1,3.1,10.4],[0,0.8,1.8,5,22.5],[0,0.25,1.4,4.1,16.5,36],[0,0,1,3.68,7,16.5,40],[0,0,0.47,3,4.5,14,31,60],[0,0,0,2.2,4,13,22,55,70],[0,0,0,1.55,3,8,15,44,60,85],[0,0,0,1.4,2.25,4.5,8,17,50,80,100]],"low":[[0.7,1.85],[0,2,3.8],[0,1.1,1.38,26],[0,0,2.2,7.9,90],[0,0,1.5,4.2,13,300],[0,0,1.1,2,6.2,100,700],[0,0,1.1,1.6,3.5,15,225,700],[0,0,1.1,1.5,2,5.5,39,100,800],[0,0,1.1,1.3,1.7,2.5,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.8,3.5,13,50,250,1000]],"medium":[[0.4,2.75],[0,1.8,5.1],[0,0,2.8,50],[0,0,1.7,10,100],[0,0,1.4,4,14,390],[0,0,0,3,9,180,710],[0,0,0,2,7,30,400,800],[0,0,0,2,4,11,67,400,900],[0,0,0,2,2.5,5,15,100,500,1000],[0,0,0,1.6,2,4,7,26,100,500,1000]],"high":[[0,3.96],[0,0,17.1],[0,0,0,81.5],[0,0,0,10,259],[0,0,0,4.5,48,450],[0,0,0,0,11,350,710],[0,0,0,0,7,90,400,800],[0,0,0,0,5,20,270,600,900],[0,0,0,0,4,11,56,500,800,1000],[0,0,0,0,3.5,8,13,63,500,800,1000]]}'),
  ('wheel_medium', '{"10":[0,1.9,0,1.5,0,2,0,1.5,0,3],"20":[1.5,0,2,0,2,0,2,0,1.5,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.7,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.6,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,5,0,1.5,0,2,0,1.5,0]}')
on conflict (key) do update set value = excluded.value;

-- ---------- Números do provably fair (iguais ao site) ----------
-- Um número: HMAC_SHA256(server, client:nonce) — Dice, Limbo e Crash
create or replace function public.rd_float1(p_server text, p_client text, p_nonce bigint)
returns float8 language plpgsql immutable set search_path = public, extensions as $$
declare h bytea := hmac(convert_to(p_client || ':' || p_nonce, 'UTF8'), convert_to(p_server, 'UTF8'), 'sha256');
begin
  return get_byte(h, 0)::float8 / 256 + get_byte(h, 1)::float8 / 65536 + get_byte(h, 2)::float8 / 16777216 + get_byte(h, 3)::float8 / 4294967296;
end $$;

-- Vários números: HMAC_SHA256(server, client:nonce:cursor), 8 números por cursor
create or replace function public.rd_floats(p_server text, p_client text, p_nonce bigint, p_count int)
returns float8[] language plpgsql immutable set search_path = public, extensions as $$
declare v float8[] := '{}'; h bytea; r int; i int;
begin
  for r in 0 .. ((p_count + 7) / 8) - 1 loop
    h := hmac(convert_to(p_client || ':' || p_nonce || ':' || r, 'UTF8'), convert_to(p_server, 'UTF8'), 'sha256');
    for i in 0 .. 7 loop
      exit when coalesce(array_length(v, 1), 0) >= p_count;
      v := v || (get_byte(h, i * 4)::float8 / 256 + get_byte(h, i * 4 + 1)::float8 / 65536 + get_byte(h, i * 4 + 2)::float8 / 16777216 + get_byte(h, i * 4 + 3)::float8 / 4294967296);
    end loop;
  end loop;
  return v;
end $$;

create or replace function public.rd_game_edge(p_game text)
returns numeric language sql immutable as $$
  select case p_game when 'blackjack' then 0.6 when 'tower' then 2 when 'chicken' then 2 when 'rps' then 2
                     when 'baccarat' then 1.1 when 'roulette' then 2.7 else 1 end::numeric
$$;

-- Carta: floor(n × 52) → valor 1..13 (A..K) e naipe 0..3
create or replace function public.rd_card_label(p_i int)
returns text language sql immutable as $$
  select (array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[(p_i % 13) + 1] || (array['♠','♥','♦','♣'])[(p_i / 13) + 1]
$$;

-- ---------- Aposta de um clique ----------
create or replace function public.play_bet(p_game text, p_amount numeric, p_params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions set extra_float_digits = 1 as $$
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
  if p_game not in ('dice','limbo','plinko','keno','wheel','roulette','coinflip','baccarat') then raise exception 'Unknown game.'; end if;

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
    'profile', jsonb_build_object('balance', p.balance, 'wagered', p.wagered, 'profit', p.profit, 'bets', p.bets_count, 'rakeback', p.rakeback));
end $$;
revoke all on function public.play_bet(text, numeric, jsonb) from public, anon;
grant execute on function public.play_bet(text, numeric, jsonb) to authenticated;
revoke all on function public.rd_float1(text, text, bigint), public.rd_floats(text, text, bigint, int) from public, anon, authenticated;
