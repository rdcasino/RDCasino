-- =====================================================================
-- Novo original: Spill (estilo Pump). Rodada no servidor, provably fair.
--   25 enchidas de 4%. Low 1 · Medium 3 · High 5 · Degen 10 posições que derramam.
--   Posições: embaralhamento Fisher–Yates das 25 com 24 números das seeds (igual ao Mines).
--   Multiplicador após k enchidas = floor(0,98 / [C(25-k, bad) / C(25, bad)] × 100) / 100.
-- =====================================================================
create or replace function public.rd_spill_mult(p_bad int, p_steps int)
returns float8 language plpgsql immutable as $$
declare s float8 := 1; i int;
begin
  for i in 0 .. p_bad - 1 loop s := s * (25 - p_steps - i)::float8 / (25 - i); end loop;
  if s <= 0 then return 0; end if;
  return floor(0.98 / s * 100) / 100;
end $$;

CREATE OR REPLACE FUNCTION public.rd_game_edge(p_game text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_game when 'blackjack' then 0.6 when 'tower' then 2 when 'chicken' then 2 when 'rps' then 2 when 'soccer' then 2 when 'door' then 2 when 'spill' then 2
                     when 'baccarat' then 1.1 when 'roulette' then 2.7 when 'double' then 6.67 else 1 end::numeric
$function$;

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
  if p_game not in ('mines','tower','chicken','hilo','rps','crash','blackjack','soccer','door','spill') then raise exception 'Unknown game.'; end if;
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
  elsif p_game = 'spill' then
    if coalesce(p_params->>'diff', '') not in ('low','medium','high','degen') then raise exception 'Invalid difficulty.'; end if;
    st := jsonb_build_object('diff', p_params->>'diff', 'steps', 0);
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

CREATE OR REPLACE FUNCTION public.round_act(p_game text, p_action text, p_params jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
 SET extra_float_digits TO '1'
AS $function$
declare
  v_uid uuid := auth.uid(); r rounds; st jsonb; fs float8[]; res jsonb; bet jsonb; v_tab jsonb;
  m int; k int; v_tile int; v_pos int[]; v_rev int[]; v_pick int; v_row int; v_tiles int; v_eggs int; c int; j int; x int; tmp int; a int[]; v_layout jsonb; v_rowsafe int[];
  v_steps int; v_bones int[]; v_cards jsonb; v_idx int; v_next int; v_nr int; v_ns int; v_cur int; v_p float8; v_ok boolean; v_mult float8;
  v_hand text; v_h text; v_res text; v_wins int; v_thr jsonb;
  v_bad int; v_surv float8;
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

  elsif p_game = 'spill' then
    -- Spill (igual ao Pump): 25 enchidas de 4%; "bad" posições escondidas derramam (embaralhamento das seeds, como o Mines).
    -- Multiplicador da enchida k = 0,98 / chance de sobreviver k enchidas (RTP 98%).
    v_bad := case st->>'diff' when 'low' then 1 when 'medium' then 3 when 'high' then 5 else 10 end;
    v_steps := (st->>'steps')::int;
    fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 24);
    v_pos := (rd_shuffle(fs, 25, 24))[1:v_bad];
    if p_action = 'pour' then
      if v_steps >= 25 - v_bad then raise exception 'The cup is full. Cash out!'; end if;
      v_steps := v_steps + 1;
      if (v_steps - 1) = any(v_pos) then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('diff', st->>'diff', 'steps', v_steps, 'spill', v_steps, 'bad', to_jsonb(v_pos)));
        res := jsonb_build_object('ok', false, 'steps', v_steps, 'bad', to_jsonb(v_pos), 'bet', bet);
      else
        st := jsonb_build_object('diff', st->>'diff', 'steps', v_steps);
        update rounds set state = st where user_id = v_uid and game = p_game;
        if v_steps = 25 - v_bad then
          v_mult := rd_spill_mult(v_bad, v_steps);
          bet := rd_round_settle(r, v_mult, true, jsonb_build_object('diff', st->>'diff', 'steps', v_steps, 'bad', to_jsonb(v_pos)));
          res := jsonb_build_object('ok', true, 'steps', v_steps, 'bad', to_jsonb(v_pos), 'bet', bet);
        else
          res := jsonb_build_object('ok', true, 'steps', v_steps, 'state', st);
        end if;
      end if;
    elsif p_action = 'cashout' then
      if v_steps < 1 then raise exception 'Pour at least once first.'; end if;
      v_mult := rd_spill_mult(v_bad, v_steps);
      bet := rd_round_settle(r, v_mult, true, jsonb_build_object('diff', st->>'diff', 'steps', v_steps, 'bad', to_jsonb(v_pos)));
      res := jsonb_build_object('bet', bet, 'bad', to_jsonb(v_pos));
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
end $function$;
