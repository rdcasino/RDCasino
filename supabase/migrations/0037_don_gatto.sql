-- Don Gatto (slot próprio, 6x5, clusters de 5+ com cascata). RTP alvo 96,5% em todos os modos; ganho máximo 5.000x a aposta.
--  * rd_gatto_buf: números do sorteio, mesma fórmula do play_bet (HMAC(server, client:nonce:cursor), 8 por cursor).
--  * rd_gatto: o motor (função pura). É a mesma lógica de assets/js/gatto-engine.js, número por número;
--    o cliente só anima o registro que o servidor devolve.
--  * slot_spin: cobra a aposta, roda o motor, paga e grava (igual ao play_bet).
--  Valores internos em "centavos de aposta": 100 = 1x. Células: 0..8 símbolos, 10 anel, 11 cofre, >=100 envelope (valor = código - 100).
--  Modos: base (1x), hunt (3x, cofre mais frequente), buy (100x, 10 giros grátis), super (300x, giros grátis começando em x5).

create or replace function public.rd_gatto_buf(p_server text, p_client text, p_nonce bigint, p_from int, p_blocks int)
returns float8[] language sql immutable set search_path = public, extensions as $$
  select array_agg(get_byte(x.h, i * 4)::float8 / 256 + get_byte(x.h, i * 4 + 1)::float8 / 65536 + get_byte(x.h, i * 4 + 2)::float8 / 16777216 + get_byte(x.h, i * 4 + 3)::float8 / 4294967296 order by r, i)
  from generate_series(p_from, p_from + p_blocks - 1) r
  cross join lateral (select hmac(convert_to(p_client || ':' || p_nonce || ':' || r, 'UTF8'), convert_to(p_server, 'UTF8'), 'sha256') as h) x
  cross join generate_series(0, 7) i
$$;
revoke all on function public.rd_gatto_buf(text, text, bigint, int, int) from public, anon, authenticated;

create or replace function public.rd_gatto(p_server text, p_client text, p_nonce bigint, p_mode text)
returns jsonb language plpgsql immutable set search_path = public, extensions as $$
declare
  CAP constant int := 500000;
  W constant int[] := '{15,15,14,14,10,9,7,5,3}'; WT constant int := 92;
  Q constant float8 := 0.14;
  PAY constant int[] := '{{60,80,100,130,160,200,250,330,500,650,1300},{60,80,100,130,160,200,250,330,500,650,1300},{80,100,120,160,200,240,320,400,600,800,1600},{80,100,120,160,200,240,320,400,600,800,1600},{100,130,160,200,260,320,420,530,800,1050,2100},{130,160,200,260,330,400,530,660,1000,1300,2600},{200,250,300,400,500,600,800,1000,1500,2000,4000},{260,330,400,530,660,800,1050,1300,2000,2600,5300},{400,500,600,800,1000,1200,1600,2000,3000,4000,8000}}';
  EV constant int[] := '{1,2,3,5,10,15,20,25,50,100}'; EW constant int[] := '{300,250,180,120,80,30,20,12,6,2}'; EWT constant int := 1000;
  LAD constant int[] := '{1,2,3,5,10}';
  buf float8[] := '{}'; blen int := 0; k int := 0;
  g int[]; g0 int[]; seen boolean[]; hit boolean[]; stk int[]; cl int[]; keep int[]; nw int[];
  vp float8; eP float8; eMax int; rP float8; reP float8;
  f1 float8; f2 float8; f3 float8; x float8;
  c int; r int; i int; j int; t int; a int; b int; s int; n int; p int; q2 int; cc int; rr int; v int;
  tot int := 0; m int := 0; fs boolean := false; phase int; left_ int := 0; done int := 0;
  sw int; pw int; rings int; es int; vaults int; pc int; ncl int;
  spins jsonb := '[]'; tt jsonb; cls jsonb; adds jsonb; kk jsonb; out_fs int := 0; m0 int := null;
begin
  if p_mode not in ('base', 'hunt', 'buy', 'super') then raise exception 'Invalid mode.'; end if;
  phase := case when p_mode in ('base', 'hunt') then 0 else 1 end;
  if phase = 1 then fs := true; m := case when p_mode = 'super' then 3 else 0 end; m0 := m; left_ := 10; end if;

  loop
    if phase = 1 then
      exit when left_ <= 0 or tot >= CAP;
      left_ := left_ - 1; done := done + 1;
    end if;
    if phase = 0 then
      vp := case when p_mode = 'hunt' then 0.1161 else 0.059 end; eP := 0.25; eMax := 3; rP := 0.084; reP := 0.02;
    else
      vp := 0.04; eP := 0.65; eMax := 4; rP := case when p_mode = 'super' then 0.4635 else 0.455 end; reP := 0.04;
    end if;

    -- ---------- grade nova ----------
    if k + 200 > blen then buf := buf || rd_gatto_buf(p_server, p_client, p_nonce, blen / 8, 32); blen := blen + 256; end if;
    g := array_fill(-1, array[30]);
    for c in 0 .. 5 loop
      for r in 0 .. 4 loop
        k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k];
        a := case when c > 0 and g[(c - 1) * 5 + r + 1] between 0 and 8 then g[(c - 1) * 5 + r + 1] else -1 end;
        b := case when r > 0 and g[c * 5 + r] between 0 and 8 then g[c * 5 + r] else -1 end;
        if f1 < Q and (a >= 0 or b >= 0) then
          s := case when a >= 0 and b >= 0 then (case when f2 < 0.5 then a else b end) when a >= 0 then a else b end;
        else
          x := f2 * WT; s := 8;
          for i in 1 .. 9 loop x := x - W[i]; if x < 0 then s := i - 1; exit; end if; end loop;
        end if;
        g[c * 5 + r + 1] := s;
      end loop;
    end loop;
    for c in 0 .. 5 loop
      k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k];
      if f1 < vp then g[c * 5 + floor(f2 * 5)::int + 1] := 11; end if;
    end loop;
    k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k];
    n := case when f1 < eP then 1 + floor(f2 * eMax)::int else 0 end;
    for j in 1 .. n loop
      for t in 0 .. 9 loop
        k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k];
        cc := floor(f1 * 6)::int; rr := floor(f2 * 5)::int;
        if g[cc * 5 + rr + 1] between 0 and 8 then
          k := k + 1; x := buf[k] * EWT; v := EV[10];
          for i in 1 .. 10 loop x := x - EW[i]; if x < 0 then v := EV[i]; exit; end if; end loop;
          g[cc * 5 + rr + 1] := 100 + v; exit;
        end if;
      end loop;
    end loop;
    if n > 0 then
      k := k + 1;
      if buf[k] < rP then
        for t in 0 .. 9 loop
          k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k];
          cc := floor(f1 * 6)::int; rr := floor(f2 * 5)::int;
          if g[cc * 5 + rr + 1] between 0 and 8 then g[cc * 5 + rr + 1] := 10; exit; end if;
        end loop;
      end if;
    end if;
    g0 := g; sw := 0; tt := '[]';

    -- ---------- cascata ----------
    while tot < CAP loop
      seen := array_fill(false, array[30]); hit := array_fill(false, array[30]); cls := '[]'; pw := 0; ncl := 0;
      for i in 0 .. 29 loop
        continue when seen[i + 1] or not (g[i + 1] between 0 and 8);
        s := g[i + 1]; stk := array[i]; cl := '{}'; seen[i + 1] := true;
        while coalesce(array_length(stk, 1), 0) > 0 loop
          p := stk[array_length(stk, 1)]; stk := stk[1:array_length(stk, 1) - 1]; cl := cl || p;
          c := p / 5; r := p % 5;
          foreach q2 in array array[case when r > 0 then p - 1 else -1 end, case when r < 4 then p + 1 else -1 end, case when c > 0 then p - 5 else -1 end, case when c < 5 then p + 5 else -1 end] loop
            if q2 >= 0 and not seen[q2 + 1] and g[q2 + 1] = s then seen[q2 + 1] := true; stk := stk || q2; end if;
          end loop;
        end loop;
        if array_length(cl, 1) >= 5 then
          cl := array(select u from unnest(cl) u order by u);
          v := PAY[s + 1][least(array_length(cl, 1), 15) - 4];
          cls := cls || jsonb_build_array(jsonb_build_object('s', s, 'c', to_jsonb(cl), 'p', v));
          pw := pw + v; ncl := ncl + 1;
          foreach q2 in array cl loop hit[q2 + 1] := true; end loop;
        end if;
      end loop;
      exit when ncl = 0;
      pw := least(pw, CAP - tot); tot := tot + pw; sw := sw + pw;
      if k + 100 > blen then buf := buf || rd_gatto_buf(p_server, p_client, p_nonce, blen / 8, 32); blen := blen + 256; end if;
      adds := '[]';
      for c in 0 .. 5 loop
        keep := '{}';
        for r in 0 .. 4 loop if not hit[c * 5 + r + 1] then keep := keep || g[c * 5 + r + 1]; end if; end loop;
        n := 5 - coalesce(array_length(keep, 1), 0); nw := '{}';
        for j in 1 .. n loop
          k := k + 1; f1 := buf[k]; k := k + 1; f2 := buf[k]; k := k + 1; f3 := buf[k];
          if f1 < reP then
            x := f3 * EWT; v := EV[10];
            for i in 1 .. 10 loop x := x - EW[i]; if x < 0 then v := EV[i]; exit; end if; end loop;
            nw := nw || (100 + v);
          else
            x := f2 * WT; s := 8;
            for i in 1 .. 9 loop x := x - W[i]; if x < 0 then s := i - 1; exit; end if; end loop;
            nw := nw || s;
          end if;
        end loop;
        keep := nw || keep;
        for r in 0 .. 4 loop g[c * 5 + r + 1] := keep[r + 1]; end loop;
        adds := adds || jsonb_build_array(to_jsonb(nw));
      end loop;
      tt := tt || jsonb_build_array(jsonb_build_object('c', cls, 'a', adds));
    end loop;

    -- ---------- coleta (anel recolhe os envelopes) e cofres ----------
    rings := 0; es := 0; vaults := 0; kk := null;
    for i in 1 .. 30 loop
      if g[i] = 10 then rings := rings + 1; elsif g[i] = 11 then vaults := vaults + 1; elsif g[i] >= 100 then es := es + g[i] - 100; end if;
    end loop;
    if rings > 0 and es > 0 and tot < CAP then
      pc := least(es * 100 * rings * LAD[m + 1], CAP - tot); tot := tot + pc; sw := sw + pc;
      kk := jsonb_build_object('r', rings, 'e', es, 'm', LAD[m + 1], 'p', pc);
      if fs and m < 4 then m := m + 1; end if;
    end if;
    spins := spins || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('g', to_jsonb(g0), 't', tt, 'w', sw, 'k', kk, 'v', vaults)));

    if phase = 0 then
      exit when vaults < 3 or tot >= CAP;
      phase := 1; fs := true; m := 0; m0 := 0; left_ := 10; done := 0; out_fs := 1;
    elsif vaults >= 3 and done + left_ < 50 then
      left_ := least(left_ + 5, 50 - done);
    end if;
  end loop;

  return jsonb_strip_nulls(jsonb_build_object('mode', p_mode, 's', spins, 'fs', out_fs, 'm0', m0, 'tot', tot, 'cap', tot >= CAP));
end $$;
revoke all on function public.rd_gatto(text, text, bigint, text) from public, anon, authenticated;

-- aposta máxima (aposta base, antes do multiplicador do modo)
insert into settings(key, value) values ('gatto_max_bet', '10'::jsonb) on conflict (key) do nothing;

create or replace function public.rd_game_edge(p_game text)
returns numeric language sql immutable as $$
  select case p_game when 'blackjack' then 0.9 when 'baccarat' then 1.1 when 'gatto' then 3.5 else 2 end::numeric
$$;

create or replace function public.slot_spin(p_game text, p_bet numeric, p_mode text default 'base')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_bet numeric := round(coalesce(p_bet, 0), 2);
  v_cost numeric; v_pay numeric; v_mult numeric; v_max numeric; v_maxbet numeric; v_rate numeric;
  p profiles; s seeds; v_nonce bigint; r jsonb; b bets;
begin
  if v_uid is null then raise exception 'Sign in to play.'; end if;
  if p_game <> 'gatto' then raise exception 'Unknown game.'; end if;
  if p_mode not in ('base', 'hunt', 'buy', 'super') then raise exception 'Invalid mode.'; end if;
  select coalesce((value)::text::numeric, 10) into v_maxbet from settings where key = 'gatto_max_bet';
  if v_bet < 0.1 then raise exception 'Minimum bet is $0.10.'; end if;
  if v_bet > coalesce(v_maxbet, 10) then raise exception 'Maximum bet is $%.', to_char(coalesce(v_maxbet, 10), 'FM999990.00'); end if;
  v_cost := v_bet * case p_mode when 'hunt' then 3 when 'buy' then 100 when 'super' then 300 else 1 end;

  select * into p from profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found.'; end if;
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if p.balance < v_cost then raise exception 'Insufficient balance.'; end if;
  perform rd_rg_check(v_uid, 'bet', v_cost);
  select * into s from seeds where user_id = v_uid for update;
  v_nonce := s.nonce;
  update seeds set nonce = nonce + 1 where user_id = v_uid;

  r := rd_gatto(s.server_seed, s.client_seed, v_nonce, p_mode);
  v_pay := round(v_bet * (r->>'tot')::numeric / 100, 2);
  -- limite de lucro por aposta (se o admin ligar), igual aos outros jogos
  select (value)::text::numeric into v_max from settings where key = 'max_profit';
  if coalesce(v_max, 0) > 0 and v_pay - v_cost > v_max then v_pay := v_cost + v_max; r := r || jsonb_build_object('limited', true); end if;
  v_mult := round(v_pay / v_cost, 4);

  select coalesce((value)::text::numeric, 0.05) into v_rate from settings where key = 'rakeback_rate';
  update profiles set balance = balance - v_cost + v_pay, wagered = wagered + v_cost, vip_xp = vip_xp + v_cost * rd_vip_weight(p_game), profit = profit + v_pay - v_cost,
      bets_count = bets_count + 1, rakeback = rakeback + v_cost * rd_game_edge(p_game) / 100 * coalesce(v_rate, 0.05)
    where id = v_uid returning * into p;
  r := r || jsonb_build_object('bet', v_bet);
  insert into bets(user_id, game, amount, multiplier, payout, client_seed, nonce, detail)
    values (v_uid, p_game, v_cost, v_mult, v_pay, s.client_seed, v_nonce, r) returning * into b;

  return jsonb_build_object(
    'bet', jsonb_build_object('id', b.id, 'game', p_game, 'amount', v_cost, 'multiplier', b.multiplier, 'payout', v_pay, 'created_at', b.created_at),
    'result', r, 'nonce', v_nonce, 'client', s.client_seed, 'profile', rd_profile_json(p.id));
end $$;
revoke all on function public.slot_spin(text, numeric, text) from public, anon;
grant execute on function public.slot_spin(text, numeric, text) to authenticated;
