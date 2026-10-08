-- =====================================================================
-- Novos originais: Double (um clique, estilo Blaze), Soccer e Door (rodadas)
-- Tabelas de multiplicador iguais às do site (assets/js/app.js: SOCCER, DOOR)
-- =====================================================================
insert into public.game_tables(key, value) values
  ('soccer', '{"easy":{"block":1,"kicks":10,"mult":[1,1.22,1.53,1.91,2.39,2.99,3.73,4.67,5.84,7.3,9.12]},"medium":{"block":2,"kicks":10,"mult":[1,1.63,2.72,4.53,7.56,12.6,21,35,58.34,97.24,162.07]},"hard":{"block":3,"kicks":8,"mult":[1,2.45,6.12,15.31,38.28,95.7,239.25,598.14,1495.36]},"expert":{"block":4,"kicks":6,"mult":[1,4.9,24.5,122.5,612.5,3062.5,15312.5]}}'),
  ('door', '{"easy":{"doors":4,"bad":1,"mult":[1,1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05,17.4]},"medium":{"doors":3,"bad":1,"mult":[1,1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67,56.51]},"hard":{"doors":2,"bad":1,"mult":[1,1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76,1003.52]},"expert":{"doors":3,"bad":2,"mult":[1,2.94,8.82,26.46,79.38,238.14,714.42,2143.25,6429.78,19289.34,57868.02]}}')
on conflict (key) do update set value = excluded.value;

create or replace function public.rd_game_edge(p_game text)
returns numeric language sql immutable as $$
  select case p_game when 'blackjack' then 0.6 when 'tower' then 2 when 'chicken' then 2 when 'rps' then 2 when 'soccer' then 2 when 'door' then 2
                     when 'baccarat' then 1.1 when 'roulette' then 2.7 when 'double' then 6.67 else 1 end::numeric
$$;

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
    'profile', jsonb_build_object('balance', p.balance, 'wagered', p.wagered, 'profit', p.profit, 'bets', p.bets_count, 'rakeback', p.rakeback));
end $$;

create or replace function public.round_start(p_game text, p_amount numeric, p_params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions set extra_float_digits = 1 as $$
declare v_uid uuid := auth.uid(); v_amt numeric := round(coalesce(p_amount, 0), 2); p profiles; s seeds; st jsonb; r rounds; v_tab jsonb; t float8; v_r int; v_s int; res jsonb;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  if p_game not in ('mines','tower','chicken','hilo','rps','crash','blackjack','soccer','door') then raise exception 'Unknown game.'; end if;
  if v_amt < 0.01 then raise exception 'Minimum bet is $0.01.'; end if;
  select * into p from profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found.'; end if;
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if exists(select 1 from rounds where user_id = v_uid and game = p_game) then raise exception 'You already have a round open in this game.'; end if;
  if p.balance < v_amt then raise exception 'Insufficient balance.'; end if;

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
end $$;

create or replace function public.round_act(p_game text, p_action text, p_params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions set extra_float_digits = 1 as $$
declare
  v_uid uuid := auth.uid(); r rounds; st jsonb; fs float8[]; res jsonb; bet jsonb; v_tab jsonb;
  m int; k int; v_tile int; v_pos int[]; v_rev int[]; v_pick int; v_row int; v_tiles int; v_eggs int; c int; j int; x int; tmp int; a int[]; v_layout jsonb; v_rowsafe int[];
  v_steps int; v_bones int[]; v_cards jsonb; v_idx int; v_next int; v_nr int; v_ns int; v_cur int; v_p float8; v_ok boolean; v_mult float8;
  v_hand text; v_h text; v_res text; v_wins int; v_thr jsonb;
  f float8; v_crash float8; v_el float8; v_tg float8; v_ms float8; v_claim float8; KK float8 := 0.00015;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  select * into r from rounds where user_id = v_uid and game = p_game for update;
  if not found then raise exception 'No active round.'; end if;
  st := r.state;

  if p_game = 'blackjack' then
    res := rd_bj(r, p_action, p_params);

  elsif p_game = 'mines' then
    m := (st->>'m')::int;
    fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 24);
    v_pos := (rd_shuffle(fs, 25, 24))[1:m];
    v_rev := array(select (x2)::int from jsonb_array_elements_text(st->'revealed') x2);
    k := coalesce(array_length(v_rev, 1), 0);
    if p_action = 'reveal' then
      v_tile := (p_params->>'tile')::int;
      if v_tile is null or v_tile not between 0 and 24 or v_tile = any(v_rev) then raise exception 'Invalid tile.'; end if;
      v_rev := v_rev || v_tile; k := k + 1;
      if v_tile = any(v_pos) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('mines', m, 'revealed', to_jsonb(v_rev), 'minePos', to_jsonb(v_pos)));
        res := jsonb_build_object('mine', true, 'minePos', to_jsonb(v_pos), 'bet', bet);
      elsif k = 25 - m then
        bet := rd_round_settle(r, rd_mines_mult(k, m), true, jsonb_build_object('mines', m, 'revealed', to_jsonb(v_rev), 'minePos', to_jsonb(v_pos)));
        res := jsonb_build_object('mine', false, 'minePos', to_jsonb(v_pos), 'bet', bet);
      else
        st := jsonb_set(st, '{revealed}', to_jsonb(v_rev)); update rounds set state = st where user_id = v_uid and game = p_game;
        res := jsonb_build_object('mine', false, 'state', st);
      end if;
    elsif p_action = 'cashout' then
      if k = 0 then raise exception 'Reveal at least one tile first.'; end if;
      bet := rd_round_settle(r, rd_mines_mult(k, m), true, jsonb_build_object('mines', m, 'revealed', to_jsonb(v_rev), 'minePos', to_jsonb(v_pos)));
      res := jsonb_build_object('minePos', to_jsonb(v_pos), 'bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'tower' then
    select value->(st->>'level') into v_tab from game_tables where key = 'tower';
    v_tiles := (v_tab->>'tiles')::int; v_eggs := (v_tab->>'eggs')::int;
    fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 27);
    v_layout := '[]'::jsonb; c := 0;
    for v_row in 0 .. 8 loop
      a := array(select generate_series(0, v_tiles - 1));
      for j in 0 .. v_tiles - 2 loop x := j + floor(fs[c + 1] * (v_tiles - j))::int; c := c + 1; tmp := a[j + 1]; a[j + 1] := a[x + 1]; a[x + 1] := tmp; end loop;
      v_layout := v_layout || jsonb_build_array(to_jsonb(a[1:v_eggs]));
    end loop;
    v_rev := array(select (x2)::int from jsonb_array_elements_text(st->'picks') x2);
    k := coalesce(array_length(v_rev, 1), 0);
    if p_action = 'pick' then
      v_pick := (p_params->>'col')::int;
      if v_pick is null or v_pick not between 0 and v_tiles - 1 or k >= 9 then raise exception 'Invalid tile.'; end if;
      v_rowsafe := array(select (x2)::int from jsonb_array_elements_text(v_layout->k) x2);
      v_rev := v_rev || v_pick; k := k + 1;
      if not (v_pick = any(v_rowsafe)) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('level', st->>'level', 'picks', to_jsonb(v_rev), 'rows', k - 1));
        res := jsonb_build_object('safe', false, 'eggs', v_layout, 'bet', bet);
      elsif k = 9 then
        bet := rd_round_settle(r, (v_tab->'mult'->>(k - 1))::float8, true, jsonb_build_object('level', st->>'level', 'picks', to_jsonb(v_rev), 'rows', k));
        res := jsonb_build_object('safe', true, 'eggs', v_layout, 'bet', bet);
      else
        st := jsonb_set(st, '{picks}', to_jsonb(v_rev)); update rounds set state = st where user_id = v_uid and game = p_game;
        res := jsonb_build_object('safe', true, 'state', st);
      end if;
    elsif p_action = 'cashout' then
      if k = 0 then raise exception 'Pick at least one tile first.'; end if;
      bet := rd_round_settle(r, (v_tab->'mult'->>(k - 1))::float8, true, jsonb_build_object('level', st->>'level', 'picks', to_jsonb(v_rev), 'rows', k));
      res := jsonb_build_object('eggs', v_layout, 'bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'chicken' then
    select value->(st->>'diff') into v_tab from game_tables where key = 'chicken';
    fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 19);
    v_bones := (rd_shuffle(fs, 20, 19))[1:(v_tab->>'bones')::int];
    v_steps := (st->>'steps')::int;
    if p_action = 'go' then
      if v_steps >= jsonb_array_length(v_tab->'mult') - 1 then raise exception 'Invalid action.'; end if;
      v_steps := v_steps + 1;
      if (v_steps - 1) = any(v_bones) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('diff', st->>'diff', 'lanes', v_steps - 1, 'bones', to_jsonb(array(select b2 + 1 from unnest(v_bones) b2))));
        res := jsonb_build_object('dead', true, 'bones', to_jsonb(v_bones), 'bet', bet);
      elsif v_steps = jsonb_array_length(v_tab->'mult') - 1 then
        bet := rd_round_settle(r, (v_tab->'mult'->>v_steps)::float8, true, jsonb_build_object('diff', st->>'diff', 'lanes', v_steps, 'bones', to_jsonb(array(select b2 + 1 from unnest(v_bones) b2))));
        res := jsonb_build_object('dead', false, 'bones', to_jsonb(v_bones), 'bet', bet);
      else
        st := jsonb_set(st, '{steps}', to_jsonb(v_steps)); update rounds set state = st where user_id = v_uid and game = p_game;
        res := jsonb_build_object('dead', false, 'state', st);
      end if;
    elsif p_action = 'cashout' then
      if v_steps = 0 then raise exception 'Cross at least one lane first.'; end if;
      bet := rd_round_settle(r, (v_tab->'mult'->>v_steps)::float8, true, jsonb_build_object('diff', st->>'diff', 'lanes', v_steps, 'bones', to_jsonb(array(select b2 + 1 from unnest(v_bones) b2))));
      res := jsonb_build_object('bones', to_jsonb(v_bones), 'bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'soccer' then
    -- Chute nº k usa os números 4k…4k+3: embaralha os 5 alvos, os primeiros "block" são defendidos
    select value->(st->>'diff') into v_tab from game_tables where key = 'soccer';
    k := (st->>'goals')::int; m := (v_tab->>'block')::int;
    v_thr := st->'shots';
    if p_action = 'shoot' then
      v_tile := (p_params->>'zone')::int;
      if v_tile is null or v_tile not between 0 and 4 or k >= (v_tab->>'kicks')::int then raise exception 'Invalid shot.'; end if;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 4 * (k + 1));
      v_pos := (rd_shuffle(fs[4 * k + 1 : 4 * k + 4], 5, 4))[1:m];
      v_thr := v_thr || to_jsonb(v_tile);
      if v_tile = any(v_pos) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('diff', st->>'diff', 'goals', k, 'shots', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
        res := jsonb_build_object('goal', false, 'blocked', to_jsonb(v_pos), 'bet', bet);
      else
        k := k + 1;
        if k = (v_tab->>'kicks')::int then
          bet := rd_round_settle(r, (v_tab->'mult'->>k)::float8, true, jsonb_build_object('diff', st->>'diff', 'goals', k, 'shots', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
          res := jsonb_build_object('goal', true, 'blocked', to_jsonb(v_pos), 'bet', bet);
        else
          st := jsonb_build_object('diff', st->>'diff', 'goals', k, 'shots', v_thr); update rounds set state = st where user_id = v_uid and game = p_game;
          res := jsonb_build_object('goal', true, 'blocked', to_jsonb(v_pos), 'state', st);
        end if;
      end if;
    elsif p_action = 'cashout' then
      if k = 0 then raise exception 'Score at least one goal first.'; end if;
      bet := rd_round_settle(r, (v_tab->'mult'->>k)::float8, true, jsonb_build_object('diff', st->>'diff', 'goals', k, 'shots', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
      res := jsonb_build_object('bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'door' then
    -- Andar nº k usa os números 3k…3k+2: embaralha as portas, as primeiras "bad" são armadilha
    select value->(st->>'diff') into v_tab from game_tables where key = 'door';
    k := (st->>'level')::int; v_tiles := (v_tab->>'doors')::int; m := (v_tab->>'bad')::int;
    v_thr := st->'picks';
    if p_action = 'pick' then
      v_pick := (p_params->>'door')::int;
      if v_pick is null or v_pick not between 0 and v_tiles - 1 or k >= 10 then raise exception 'Invalid door.'; end if;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 3 * (k + 1));
      v_pos := (rd_shuffle(fs[3 * k + 1 : 3 * k + 3], v_tiles, v_tiles - 1))[1:m];
      v_thr := v_thr || to_jsonb(v_pick);
      if v_pick = any(v_pos) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('diff', st->>'diff', 'floors', k, 'picks', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
        res := jsonb_build_object('safe', false, 'bad', to_jsonb(v_pos), 'bet', bet);
      else
        k := k + 1;
        if k = 10 then
          bet := rd_round_settle(r, (v_tab->'mult'->>k)::float8, true, jsonb_build_object('diff', st->>'diff', 'floors', k, 'picks', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
          res := jsonb_build_object('safe', true, 'bad', to_jsonb(v_pos), 'bet', bet);
        else
          st := jsonb_build_object('diff', st->>'diff', 'level', k, 'picks', v_thr); update rounds set state = st where user_id = v_uid and game = p_game;
          res := jsonb_build_object('safe', true, 'bad', to_jsonb(v_pos), 'state', st);
        end if;
      end if;
    elsif p_action = 'cashout' then
      if k = 0 then raise exception 'Open at least one door first.'; end if;
      bet := rd_round_settle(r, (v_tab->'mult'->>k)::float8, true, jsonb_build_object('diff', st->>'diff', 'floors', k, 'picks', (select string_agg(x2, '') from jsonb_array_elements_text(v_thr) x2)));
      res := jsonb_build_object('bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'hilo' then
    v_cards := st->'cards'; v_mult := (st->>'mult')::float8;
    if p_action in ('up', 'down', 'skip') then
      v_idx := jsonb_array_length(v_cards);
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, v_idx);
      v_next := floor(fs[v_idx] * 52)::int; v_nr := (v_next % 13) + 1; v_ns := v_next / 13;
      v_cur := (v_cards->-1->>'rank')::int;
      if p_action = 'skip' then
        v_cards := v_cards || jsonb_build_array(jsonb_build_object('rank', v_nr, 'suit', v_ns, 'res', 'skip'));
        st := jsonb_build_object('cards', v_cards, 'mult', v_mult); update rounds set state = st where user_id = v_uid and game = p_game;
        res := jsonb_build_object('card', rd_cardj(v_next), 'ok', true, 'state', st);
      else
        if v_cur = 1 then
          if p_action = 'up' then v_p := 12::float8 / 13; v_ok := v_nr > 1; else v_p := 1::float8 / 13; v_ok := v_nr = 1; end if;
        elsif v_cur = 13 then
          if p_action = 'up' then v_p := 1::float8 / 13; v_ok := v_nr = 13; else v_p := 12::float8 / 13; v_ok := v_nr < 13; end if;
        else
          if p_action = 'up' then v_p := (14 - v_cur)::float8 / 13; v_ok := v_nr >= v_cur; else v_p := v_cur::float8 / 13; v_ok := v_nr <= v_cur; end if;
        end if;
        v_cards := v_cards || jsonb_build_array(jsonb_build_object('rank', v_nr, 'suit', v_ns, 'res', case when v_ok then 'good' else 'bad' end));
        if v_ok then
          v_mult := floor(v_mult * (0.99 / v_p) * 100) / 100;
          st := jsonb_build_object('cards', v_cards, 'mult', v_mult); update rounds set state = st where user_id = v_uid and game = p_game;
          res := jsonb_build_object('card', rd_cardj(v_next), 'ok', true, 'state', st);
        else
          bet := rd_round_settle(r, 0, false, jsonb_build_object(
            'cards', (select string_agg(rd_card_label(((e->>'rank')::int - 1) + (e->>'suit')::int * 13), ' ' order by o) from jsonb_array_elements(v_cards) with ordinality q(e, o)),
            'start', jsonb_build_object('rank', v_cards->0->'rank', 'suit', v_cards->0->'suit'), 'last', jsonb_build_object('rank', v_nr, 'suit', v_ns), 'mult', v_mult));
          res := jsonb_build_object('card', rd_cardj(v_next), 'ok', false, 'bet', bet);
        end if;
      end if;
    elsif p_action = 'cashout' then
      if v_mult <= 1 then raise exception 'Win at least one guess first.'; end if;
      bet := rd_round_settle(r, v_mult, true, jsonb_build_object(
        'cards', (select string_agg(rd_card_label(((e->>'rank')::int - 1) + (e->>'suit')::int * 13), ' ' order by o) from jsonb_array_elements(v_cards) with ordinality q(e, o)),
        'start', jsonb_build_object('rank', v_cards->0->'rank', 'suit', v_cards->0->'suit'), 'last', jsonb_build_object('rank', v_cards->-1->'rank', 'suit', v_cards->-1->'suit'), 'mult', rd_cap(r.amount, v_mult)));
      res := jsonb_build_object('bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'rps' then
    v_thr := st->'throws'; v_wins := (st->>'wins')::int;
    if p_action = 'throw' then
      v_hand := p_params->>'hand';
      if v_hand is null or v_hand not in ('rock', 'paper', 'scissors') or v_wins >= 10 then raise exception 'Invalid hand.'; end if;
      v_idx := jsonb_array_length(v_thr);
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, v_idx + 1);
      v_h := (array['rock', 'paper', 'scissors'])[floor(fs[v_idx + 1] * 3)::int + 1];
      v_res := case when v_hand = v_h then 'tie'
                    when (v_hand = 'rock' and v_h = 'scissors') or (v_hand = 'scissors' and v_h = 'paper') or (v_hand = 'paper' and v_h = 'rock') then 'win'
                    else 'lose' end;
      v_thr := v_thr || jsonb_build_array(jsonb_build_object('p', v_hand, 'h', v_h, 'r', v_res));
      if v_res = 'win' then v_wins := v_wins + 1; end if;
      if v_res = 'lose' then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('wins', v_wins, 'throws', (select string_agg(left(e->>'p', 1) || left(e->>'h', 1), ' ' order by o) from jsonb_array_elements(v_thr) with ordinality q(e, o))));
        res := jsonb_build_object('h', v_h, 'res', v_res, 'bet', bet);
      elsif v_wins = 10 then
        bet := rd_round_settle(r, floor(0.98 * power(2::float8, v_wins) * 100 + 0.5) / 100, true, jsonb_build_object('wins', v_wins, 'throws', (select string_agg(left(e->>'p', 1) || left(e->>'h', 1), ' ' order by o) from jsonb_array_elements(v_thr) with ordinality q(e, o))));
        res := jsonb_build_object('h', v_h, 'res', v_res, 'bet', bet);
      else
        st := jsonb_build_object('throws', v_thr, 'wins', v_wins); update rounds set state = st where user_id = v_uid and game = p_game;
        res := jsonb_build_object('h', v_h, 'res', v_res, 'state', st);
      end if;
    elsif p_action = 'cashout' then
      if v_wins = 0 then raise exception 'Win at least one throw first.'; end if;
      bet := rd_round_settle(r, floor(0.98 * power(2::float8, v_wins) * 100 + 0.5) / 100, true, jsonb_build_object('wins', v_wins, 'throws', (select string_agg(left(e->>'p', 1) || left(e->>'h', 1), ' ' order by o) from jsonb_array_elements(v_thr) with ordinality q(e, o))));
      res := jsonb_build_object('bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'crash' then
    -- O ponto do crash nunca sai daqui antes de a rodada acabar
    f := rd_float1(r.server_seed, r.client_seed, r.nonce);
    v_crash := greatest(1, floor((0.99 / greatest(f, 1e-8)) * 100) / 100);
    v_tg := (st->>'target')::float8;
    v_el := extract(epoch from (clock_timestamp() - r.started_at)) * 1000;
    if v_tg < v_crash and v_el >= ln(v_tg) / KK then
      bet := rd_round_settle(r, v_tg, true, jsonb_build_object('crash', v_crash, 'cashout', v_tg, 'target', v_tg));
      res := jsonb_build_object('done', true, 'crash', v_crash, 'cashout', v_tg, 'bet', bet);
    elsif v_el >= ln(v_crash) / KK then
      bet := rd_round_settle(r, 0, false, jsonb_build_object('crash', v_crash, 'target', v_tg));
      res := jsonb_build_object('done', true, 'crash', v_crash, 'bet', bet);
    elsif p_action = 'status' then
      res := jsonb_build_object('done', false, 'elapsed', v_el);
    elsif p_action = 'cashout' then
      v_ms := floor(exp(KK * v_el) * 100) / 100;
      v_claim := coalesce((p_params->>'m')::float8, v_ms);
      v_mult := least(v_claim, v_ms);
      if v_mult < 1.01 then raise exception 'Too early to cash out.'; end if;
      bet := rd_round_settle(r, v_mult, true, jsonb_build_object('crash', v_crash, 'cashout', rd_cap(r.amount, v_mult), 'target', v_tg));
      res := jsonb_build_object('done', true, 'crash', v_crash, 'cashout', v_mult, 'bet', bet);
    else raise exception 'Invalid action.'; end if;
  end if;

  return res || jsonb_build_object('profile', rd_profile_json(v_uid));
end $$;
