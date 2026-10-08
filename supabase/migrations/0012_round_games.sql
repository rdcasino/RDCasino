-- =====================================================================
-- Jogos com rodada sorteados e jogados no servidor
-- (Mines, Tower, Chicken, Hi-Lo, Rock Paper Scissors, Crash, Blackjack)
-- O navegador só manda a jogada (abrir casa, pedir carta, sacar...). O banco
-- decide o resultado com a server seed, guarda o progresso e paga no fim.
-- Nada que revele o futuro (minas, carta escondida do dealer, ponto do
-- crash) sai do servidor antes da rodada acabar.
-- =====================================================================

-- ---------- Segurança: a tabela de rodadas tem a server seed; o navegador não pode ler ----------
revoke all on public.rounds from anon, authenticated;
revoke all on public.seeds from anon, authenticated;
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
  end loop;
end $$;
alter table public.rounds add column if not exists secret jsonb not null default '{}';
create or replace view public.my_rounds with (security_invoker = false) as
  select game, amount, client_seed, nonce, state, started_at from public.rounds where user_id = auth.uid();
grant select on public.my_rounds to authenticated;
insert into public.game_tables(key, value) values
  ('tower', '{"easy":{"tiles":4,"eggs":3,"mult":[1.31,1.74,2.32,3.1,4.13,5.51,7.34,9.79,13.05]},"medium":{"tiles":3,"eggs":2,"mult":[1.47,2.21,3.31,4.96,7.44,11.16,16.74,25.11,37.67]},"hard":{"tiles":2,"eggs":1,"mult":[1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76]},"expert":{"tiles":3,"eggs":1,"mult":[2.94,8.82,26.46,79.38,238.14,714.42,2143.26,6429.78,19289.34]},"master":{"tiles":4,"eggs":1,"mult":[3.92,15.68,62.72,250.88,1003.52,4014.08,16056.32,64225.28,256901.12]}}'),
  ('chicken', '{"easy":{"bones":1,"mult":[1,1.03,1.09,1.15,1.23,1.31,1.4,1.51,1.63,1.78,1.96,2.18,2.45,2.8,3.27,3.92,4.9,6.53,9.8,19.6]},"medium":{"bones":3,"mult":[1,1.15,1.37,1.64,2,2.46,3.07,3.91,5.08,6.77,9.31,13.3,19.95,31.92,55.86,111.72,279.3,1117.2]},"hard":{"bones":5,"mult":[1,1.31,1.77,2.46,3.48,5.06,7.59,11.81,19.18,32.89,60.29,120.59,271.32,723.52,2532.32,15193.92]},"expert":{"bones":10,"mult":[1,1.96,4.14,9.31,22.61,60.29,180.88,633.08,2743.35,16460.08,181060.88]}}')
on conflict (key) do update set value = excluded.value;

-- ---------- Ajudantes ----------
create or replace function public.rd_profile_json(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('balance', balance, 'wagered', wagered, 'profit', profit, 'bets', bets_count, 'rakeback', rakeback, 'held', held) from profiles where id = p_uid
$$;

-- Limite de lucro por aposta (configurado no admin; 0 = sem limite)
create or replace function public.rd_cap(p_amount numeric, p_mult float8)
returns float8 language plpgsql stable security definer set search_path = public as $$
declare v_max numeric;
begin
  select (value)::text::numeric into v_max from settings where key = 'max_profit';
  if coalesce(v_max, 0) > 0 and p_amount * (p_mult::numeric - 1) > v_max then return floor(((p_amount + v_max) / p_amount) * 100)::float8 / 100; end if;
  return p_mult;
end $$;

-- Fisher–Yates de 0..n-1 com os k primeiros números (igual ao site)
create or replace function public.rd_shuffle(fs float8[], n int, k int)
returns int[] language plpgsql immutable as $$
declare a int[] := array(select generate_series(0, n - 1)); j int; x int; t int;
begin
  for j in 0 .. k - 1 loop x := j + floor(fs[j + 1] * (n - j))::int; t := a[j + 1]; a[j + 1] := a[x + 1]; a[x + 1] := t; end loop;
  return a;
end $$;

create or replace function public.rd_cardj(p_i int)
returns jsonb language sql immutable as $$ select jsonb_build_object('rank', (p_i % 13) + 1, 'suit', p_i / 13) $$;

-- Liquida a rodada: paga, grava a aposta e apaga a rodada
create or replace function public.rd_round_settle(r rounds, p_mult float8, p_win boolean, p_detail jsonb, p_payout numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_mult float8 := 0; v_pay numeric := 0; v_rate numeric; b bets; capped float8;
begin
  if p_win then
    capped := rd_cap(r.amount, p_mult); v_mult := capped;
    v_pay := case when p_payout is not null and capped = p_mult then round(p_payout, 2) else round(r.amount * capped::numeric, 2) end;
  end if;
  select coalesce((value)::text::numeric, 0.02) into v_rate from settings where key = 'rakeback_rate';
  update profiles set balance = balance + v_pay, wagered = wagered + r.amount, profit = profit + v_pay - r.amount, bets_count = bets_count + 1,
      rakeback = rakeback + r.amount * rd_game_edge(r.game) / 100 * coalesce(v_rate, 0.02)
    where id = r.user_id;
  insert into bets(user_id, game, amount, multiplier, payout, client_seed, nonce, detail)
    values (r.user_id, r.game, r.amount, round(v_mult::numeric, 4), v_pay, r.client_seed, r.nonce, p_detail) returning * into b;
  delete from rounds where user_id = r.user_id and game = r.game;
  return jsonb_build_object('id', b.id, 'game', b.game, 'amount', b.amount, 'multiplier', b.multiplier, 'payout', b.payout, 'created_at', b.created_at, 'detail', p_detail);
end $$;

create or replace function public.rd_mines_mult(k int, m int)
returns float8 language plpgsql immutable as $$
declare x float8 := 0.99; i int;
begin for i in 0 .. k - 1 loop x := x * ((25 - i)::float8 / (25 - m - i)); end loop; return floor(x * 100) / 100; end $$;

-- ---------- Começar uma rodada ----------
create or replace function public.round_start(p_game text, p_amount numeric, p_params jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions set extra_float_digits = 1 as $$
declare v_uid uuid := auth.uid(); v_amt numeric := round(coalesce(p_amount, 0), 2); p profiles; s seeds; st jsonb; r rounds; v_tab jsonb; t float8; v_r int; v_s int; res jsonb;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  if p_game not in ('mines','tower','chicken','hilo','rps','crash','blackjack') then raise exception 'Unknown game.'; end if;
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

-- ---------- Jogada numa rodada aberta ----------
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

-- ---------- Blackjack (regras iguais ao site: 3:2, dealer para no 17, seguro 2:1, split 1×, double em 2 cartas) ----------
-- Cartas = floor(número × 52), baralho infinito, na ordem do cursor. A carta escondida do dealer
-- fica só em rounds.secret até o fim.
create or replace function public.rd_bj_total(cs int[])
returns int language plpgsql immutable as $$
declare t int := 0; aces int := 0; c int; rk int;
begin
  if cs is null or cardinality(cs) = 0 then return 0; end if;
  foreach c in array cs loop rk := (c % 13) + 1; t := t + case when rk = 1 then 11 when rk > 10 then 10 else rk end; if rk = 1 then aces := aces + 1; end if; end loop;
  while t > 21 and aces > 0 loop t := t - 10; aces := aces - 1; end loop;
  return t;
end $$;
create or replace function public.rd_bj_soft(cs int[])
returns boolean language plpgsql immutable as $$
declare t int := 0; aces int := 0; c int; rk int;
begin
  if cs is null or cardinality(cs) = 0 then return false; end if;
  foreach c in array cs loop rk := (c % 13) + 1; t := t + case when rk = 1 then 11 when rk > 10 then 10 else rk end; if rk = 1 then aces := aces + 1; end if; end loop;
  while t > 21 and aces > 0 loop t := t - 10; aces := aces - 1; end loop;
  return aces > 0;
end $$;
create or replace function public.rd_bj_val(c int)
returns int language sql immutable as $$ select case when (c % 13) + 1 = 1 then 11 when (c % 13) + 1 > 10 then 10 else (c % 13) + 1 end $$;
create or replace function public.rd_cardsj(cs int[])
returns jsonb language sql immutable as $$ select coalesce(jsonb_agg(public.rd_cardj(c) order by o), '[]'::jsonb) from unnest(cs) with ordinality u(c, o) $$;

create or replace function public.rd_bj(r rounds, p_action text, p_params jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  s jsonb := r.secret; cur int; dl int[]; h1 int[]; h2 int[]; b1 numeric; b2 numeric; d1 boolean; d2 boolean; nh int; act int;
  ins text; insbet numeric := 0; fs float8[]; nc int[]; cost numeric; aces boolean; v int; dv int;
  v_nat boolean; dealerbj boolean; total numeric := 0; pay numeric; res1 text; res2 text; v_amount numeric; outcome text; bet jsonb; i int; done boolean := false; drew int;
begin
  if p_action = 'deal' then
    fs := rd_floats(r.server_seed, r.client_seed, r.nonce, 4);
    nc := array(select floor(x * 52)::int from unnest(fs) with ordinality u(x, o) order by o);
    cur := 4; h1 := array[nc[1], nc[3]]; h2 := '{}'::int[]; dl := array[nc[2], nc[4]]; b1 := r.amount; b2 := 0; nh := 1; d1 := false; d2 := false; act := 1; ins := null; insbet := 0;
  else
    cur := (s->>'cursor')::int; dl := array(select (x)::int from jsonb_array_elements_text(s->'dealer') x);
    h1 := array(select (x)::int from jsonb_array_elements_text(s->'h1') x); h2 := array(select (x)::int from jsonb_array_elements_text(coalesce(s->'h2', '[]')) x);
    b1 := (s->>'b1')::numeric; b2 := coalesce((s->>'b2')::numeric, 0); d1 := (s->>'d1')::boolean; d2 := coalesce((s->>'d2')::boolean, false);
    nh := (s->>'nh')::int; act := (s->>'act')::int; ins := s->>'ins'; insbet := coalesce((s->>'insbet')::numeric, 0);
  end if;

  -- 1) ações do jogador
  if p_action = 'deal' then
    if (dl[1] % 13) + 1 = 1 then ins := 'offer'; else p_action := 'peek'; end if;
  elsif p_action = 'insurance' then
    if ins is distinct from 'offer' then raise exception 'Insurance is not available.'; end if;
    if coalesce((p_params->>'take')::boolean, false) then
      cost := round(b1 * 50) / 100;
      update profiles set balance = balance - cost where id = r.user_id and balance >= cost;
      if not found then raise exception 'Insufficient balance.'; end if;
      insbet := cost; ins := 'taken'; update rounds set amount = amount + cost where user_id = r.user_id and game = r.game; r.amount := r.amount + cost;
    else ins := 'declined'; end if;
    p_action := 'peek';
  elsif p_action in ('hit', 'stand', 'double', 'split') then
    if ins = 'offer' then raise exception 'Answer the insurance first.'; end if;
    if p_action = 'stand' then
      if act = 1 then d1 := true; else d2 := true; end if;
    elsif p_action = 'split' then
      if nh <> 1 or array_length(h1, 1) <> 2 or rd_bj_val(h1[1]) <> rd_bj_val(h1[2]) then raise exception 'You can''t split this hand.'; end if;
      update profiles set balance = balance - b1 where id = r.user_id and balance >= b1;
      if not found then raise exception 'Insufficient balance.'; end if;
      update rounds set amount = amount + b1 where user_id = r.user_id and game = r.game; r.amount := r.amount + b1;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, cur + 2); aces := (h1[1] % 13) + 1 = 1;
      h2 := array[h1[2], floor(fs[cur + 2] * 52)::int]; h1 := array[h1[1], floor(fs[cur + 1] * 52)::int]; cur := cur + 2;
      b2 := b1; nh := 2; d1 := aces; d2 := aces; act := 1;
      if rd_bj_total(h1) = 21 then d1 := true; end if;
      if rd_bj_total(h2) = 21 then d2 := true; end if;
    else
      if p_action = 'double' then
        if (act = 1 and array_length(h1, 1) <> 2) or (act = 2 and array_length(h2, 1) <> 2) then raise exception 'You can only double on two cards.'; end if;
        cost := case when act = 1 then b1 else b2 end;
        update profiles set balance = balance - cost where id = r.user_id and balance >= cost;
        if not found then raise exception 'Insufficient balance.'; end if;
        update rounds set amount = amount + cost where user_id = r.user_id and game = r.game; r.amount := r.amount + cost;
        if act = 1 then b1 := b1 * 2; else b2 := b2 * 2; end if;
      end if;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, cur + 1); drew := floor(fs[cur + 1] * 52)::int; cur := cur + 1;
      if act = 1 then h1 := h1 || drew; v := rd_bj_total(h1); if p_action = 'double' or v >= 21 then d1 := true; end if;
      else h2 := h2 || drew; v := rd_bj_total(h2); if p_action = 'double' or v >= 21 then d2 := true; end if; end if;
    end if;
    -- próxima mão / vez do dealer
    if act = 1 and d1 and nh = 2 then act := 2; end if;
    if (act = 1 and d1) or (act = 2 and d2) then
      if not (rd_bj_total(h1) > 21 and (nh = 1 or rd_bj_total(h2) > 21)) then
        while rd_bj_total(dl) < 17 loop
          fs := rd_floats(r.server_seed, r.client_seed, r.nonce, cur + 1); dl := dl || floor(fs[cur + 1] * 52)::int; cur := cur + 1;
        end loop;
      end if;
      done := true;
    end if;
  elsif p_action not in ('peek', 'view') then raise exception 'Invalid action.';
  end if;

  -- 2) espiada do dealer (blackjack v_nat)
  if p_action = 'peek' then
    v := rd_bj_total(h1); dv := rd_bj_total(dl);
    if v = 21 or (dv = 21 and ((dl[1] % 13) + 1 = 1 or rd_bj_val(dl[1]) = 10)) then done := true;
    elsif ins = 'taken' then ins := 'lost'; end if;
  end if;

  -- 3) fim: paga
  if done then
    dv := rd_bj_total(dl);
    v_nat := nh = 1 and array_length(h1, 1) = 2 and rd_bj_total(h1) = 21;
    dealerbj := array_length(dl, 1) = 2 and dv = 21;
    for i in 1 .. nh loop
      v := rd_bj_total(case when i = 1 then h1 else h2 end);
      cost := case when i = 1 then b1 else b2 end;
      if v > 21 then pay := 0; outcome := 'lose';
      elsif v_nat and not dealerbj then pay := cost * 2.5; outcome := 'win';
      elsif dealerbj and not v_nat then pay := 0; outcome := 'lose';
      elsif dv > 21 or v > dv then pay := cost * 2; outcome := 'win';
      elsif v = dv then pay := cost; outcome := 'push';
      else pay := 0; outcome := 'lose'; end if;
      total := total + pay; if i = 1 then res1 := outcome; else res2 := outcome; end if;
    end loop;
    if insbet > 0 and dealerbj then total := total + insbet * 3; end if;
    v_amount := b1 + b2 + insbet;
    outcome := case when v_nat and not dealerbj then 'Blackjack' when insbet > 0 and dealerbj then 'Insured' when total > v_amount then 'Win' when total = v_amount then 'Push' else 'Lose' end;
    r.amount := v_amount;
    bet := rd_round_settle(r, round(total / v_amount, 4)::float8, total > 0, jsonb_strip_nulls(jsonb_build_object('outcome', outcome,
      'player', rd_bj_total(h1)::text || case when nh = 2 then '/' || rd_bj_total(h2) else '' end, 'dealer', dv, 'insurance', nullif(insbet, 0))), total);
  else
    s := jsonb_build_object('cursor', cur, 'dealer', to_jsonb(dl), 'h1', to_jsonb(h1), 'h2', to_jsonb(h2), 'b1', b1, 'b2', b2, 'd1', d1, 'd2', d2, 'nh', nh, 'act', act, 'ins', ins, 'insbet', insbet);
    update rounds set secret = s, state = jsonb_build_object('started', true) where user_id = r.user_id and game = r.game;
  end if;

  -- 4) o que o navegador pode ver (a carta escondida só no fim)
  return jsonb_build_object(
    'over', done,
    'dealer', case when done then rd_cardsj(dl) else rd_cardsj(dl[1:1]) end,
    'dealerTotal', case when done then rd_bj_total(dl) else null end,
    'hands', (select jsonb_agg(h order by o) from (
      select 1 o, jsonb_build_object('cards', rd_cardsj(h1), 'bet', b1, 'done', d1, 'res', res1, 'total', rd_bj_total(h1), 'soft', rd_bj_soft(h1)) h
      union all select 2, jsonb_build_object('cards', rd_cardsj(h2), 'bet', b2, 'done', d2, 'res', res2, 'total', rd_bj_total(h2), 'soft', rd_bj_soft(h2)) where nh = 2) q),
    'active', act - 1, 'ins', ins, 'insBet', insbet, 'amount', r.amount, 'bet', bet);
end $$;

revoke all on function public.round_start(text, numeric, jsonb), public.round_act(text, text, jsonb) from public, anon;
grant execute on function public.round_start(text, numeric, jsonb), public.round_act(text, text, jsonb) to authenticated;
revoke all on function public.rd_round_settle(rounds, float8, boolean, jsonb, numeric), public.rd_bj(rounds, text, jsonb), public.rd_cap(numeric, float8), public.rd_profile_json(uuid) from public, anon, authenticated;
