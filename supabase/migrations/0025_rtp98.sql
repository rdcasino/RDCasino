-- 0025: RTP de 98% nos originais, Blackjack mais justo para a casa, VIP no padrão de mercado
--
-- 1) Dice, Limbo, Crash, Mines, Hi-Lo, Coinflip, Wheel, Plinko, Keno, Roleta e Double passam a pagar 98%.
--    Tower, Chicken, Door, Soccer, RPS e Spill já eram 98%. Baccarat continua padrão (comissão de 5%).
-- 2) Blackjack: dealer compra no 17 macio (H17) e não pode dobrar depois de dividir.
--    Corrige brecha: o navegador podia chamar as ações internas 'deal' e 'peek' e reiniciar a mão
--    (via API), vendo a próxima carta antes de decidir.
-- 2b) Nenhum degrau de Tower, Chicken, Door ou Soccer e nenhuma tabela de Plinko/Keno/Wheel passa de 98,00%.
-- 3) VIP: prêmios de subida de nível ≈ 0,1% do valor apostado (antes chegavam a 2%).
--
-- As funções grandes são corrigidas a partir da versão ativa no banco (pg_get_functiondef):
-- se algum trecho esperado não existir, a migração para inteira e nada muda.

create or replace function public.rd_mines_mult(k int, m int)
returns float8 language plpgsql immutable as $$
declare x float8 := 0.98; i int;
begin for i in 0 .. k - 1 loop x := x * ((25 - i)::float8 / (25 - m - i)); end loop; return floor(x * 100) / 100; end $$;

create or replace function public.rd_game_edge(p_game text) returns numeric language sql immutable as $$
  select case p_game when 'blackjack' then 0.9 when 'baccarat' then 1.1 else 2 end::numeric
$$;

do $mig$
declare src text; n text;
begin
  -- ---------- play_bet (jogos de um clique) ----------
  src := pg_get_functiondef('public.play_bet(text,numeric,jsonb)'::regprocedure); n := src;
  n := replace(n, 'floor((99 / c) * 10000) / 10000', 'floor((98 / c) * 10000) / 10000');
  n := replace(n, '(v_over and (t < 2 or t > 99.99)) or (not v_over and (t < 0.01 or t > 98))', '(v_over and (t < 3 or t > 99.99)) or (not v_over and (t < 0.01 or t > 97))');
  n := replace(n, 'floor((0.99 / greatest(f, 1e-8)) * 100) / 100', 'floor((0.98 / greatest(f, 1e-8)) * 100) / 100');
  n := replace(n, 'array[1.5, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0]', 'array[1.4, 1.2, 1.2, 1.2, 0, 1.2, 1.2, 1.2, 1.2, 0]');
  n := replace(n, 'floor(0.99::float8 * v_n * 100 + 0.5) / 100', 'floor(0.98::float8 * v_n * 100 + 0.5) / 100');
  n := replace(n, 'floor(0.99::float8 * power(2::float8, v_n) * 100) / 100', 'floor(0.98::float8 * power(2::float8, v_n) * 100) / 100');
  n := replace(n, 'then 36 when v_key like ''doz:%'' or v_key like ''col:%'' then 3 else 2 end', 'then 36.26 when v_key like ''doz:%'' or v_key like ''col:%'' then 3.0216 else 2.0144 end');
  n := replace(n, 'v_mult := case when v_side = ''white'' then 14 else 2 end', 'v_mult := case when v_side = ''white'' then 14.7 else 2.1 end');
  if n = src or n like '%99 / c%' or n like '%0.99 / greatest%' or n like '%0.99::float8%' or n like '%array[1.5, 1.2%' or n like '%then 36 when%' or n like '%then 14 else 2%' or n like '%t > 98))%' then
    raise exception 'play_bet: trecho esperado não encontrado';
  end if;
  execute n;

  -- ---------- round_act (Hi-Lo, Crash e o atalho do Blackjack) ----------
  src := pg_get_functiondef('public.round_act(text,text,jsonb)'::regprocedure); n := src;
  n := replace(n, 'floor(v_mult * (0.99 / v_p) * 100) / 100', 'floor(v_mult * (0.98 / v_p) * 100) / 100');
  n := replace(n, 'floor((0.99 / greatest(f, 1e-8)) * 100) / 100', 'floor((0.98 / greatest(f, 1e-8)) * 100) / 100');
  n := replace(n, 'res := rd_bj(r, p_action, p_params);', 'if p_action not in (''hit'', ''stand'', ''double'', ''split'', ''insurance'', ''view'') then raise exception ''Invalid action.''; end if;
    res := rd_bj(r, p_action, p_params);');
  if n like '%0.99 /%' or n not like '%''insurance'', ''view'') then raise%' then raise exception 'round_act: trecho esperado não encontrado'; end if;
  execute n;

  -- ---------- rd_bj (regras do Blackjack) ----------
  src := pg_get_functiondef('public.rd_bj(rounds,text,jsonb)'::regprocedure); n := src;
  if n not like '%rd_bj_soft(dl)) loop%' then
    n := regexp_replace(n, 'while\s+rd_bj_total\(dl\)\s*<\s*17\s+loop', 'while rd_bj_total(dl) < 17 or (rd_bj_total(dl) = 17 and rd_bj_soft(dl)) loop');
  end if;
  if n not like '%rd_bj_soft(dl)) loop%' then raise exception 'rd_bj: regra do 17 macio não encontrada. Trecho atual: %', substr(src, greatest(strpos(src, 'while') - 40, 1), 240); end if;
  if n not like '%double after a split%' then
    n := regexp_replace(n, '(if\s+p_action\s*=\s*''double''\s+then)', '\1' || chr(10) || '        if nh = 2 then raise exception ''You can''''t double after a split.''; end if;');
  end if;
  if n not like '%double after a split%' then raise exception 'rd_bj: regra de dobrar não encontrada. Trecho atual: %', substr(src, greatest(strpos(src, '''double''') - 120, 1), 300); end if;
  if n <> src then execute n; end if;
end $mig$;

-- ---------- Tabelas de pagamento (98%) e VIP ----------
update public.game_tables set value = '{"8":{"low":[5.5,1.95,1.1,1,0.5,1,1.1,1.95,5.5],"high":[29,4,1.45,0.3,0.2,0.3,1.45,4,29],"medium":[13,2.85,1.3,0.7,0.4,0.7,1.3,2.85,13]},"9":{"low":[5.3,1.75,1.6,1,0.7,0.7,1,1.6,1.75,5.3],"high":[42.5,6.75,2,0.6,0.2,0.2,0.6,2,6.75,42.5],"medium":[15.5,3.95,1.7,0.9,0.5,0.5,0.9,1.7,3.95,15.5]},"10":{"low":[8.75,2.5,1.4,1.1,1,0.5,1,1.1,1.4,2.5,8.75],"high":[76,9.45,3,0.9,0.3,0.2,0.3,0.9,3,9.45,76],"medium":[22,4.75,1.95,1.4,0.6,0.4,0.6,1.4,1.95,4.75,22]},"11":{"low":[8.0,2.85,1.9,1.25,1,0.7,0.7,1,1.25,1.9,2.85,8.0],"high":[108,14,5.2,1.4,0.4,0.2,0.2,0.4,1.4,5.2,14,108],"medium":[19.0,6,2.9,1.8,0.7,0.5,0.5,0.7,1.8,2.9,6,19.0]},"12":{"low":[10,2.7,1.35,1.4,1.1,1,0.5,1,1.1,1.4,1.35,2.7,10],"high":[169,23.0,7.95,2,0.7,0.2,0.2,0.2,0.7,2,7.95,23.0,169],"medium":[32.5,11,3.7,2,1.1,0.6,0.3,0.6,1.1,2,3.7,11,32.5]},"13":{"low":[8.1,3.6,3,1.9,1.15,0.9,0.7,0.7,0.9,1.15,1.9,3,3.6,8.1],"high":[257,36.0,11,3.9,1,0.2,0.2,0.2,0.2,1,3.9,11,36.0,257],"medium":[38.0,13,6,3,1.25,0.7,0.4,0.4,0.7,1.25,3,6,13,38.0]},"14":{"low":[7.05,4,1.8,1.2,1.3,1.1,1,0.5,1,1.1,1.3,1.2,1.8,4,7.05],"high":[414,52.0,18,4.95,1.9,0.3,0.2,0.2,0.2,0.3,1.9,4.95,18,52.0,414],"medium":[52.5,9.9,6.95,4,1.9,1,0.5,0.2,0.5,1,1.9,4,6.95,9.9,52.5]},"15":{"low":[10.0,8,3,1.65,1.5,1.1,1,0.7,0.7,1,1.1,1.5,1.65,3,8,10.0],"high":[611,83,27,7.65,3,0.5,0.2,0.2,0.2,0.2,0.5,3,7.65,27,83,611],"medium":[83.5,18,11,4.65,3,1.3,0.5,0.3,0.3,0.5,1.3,3,4.65,11,18,83.5]},"16":{"low":[16,8.65,2,1.4,1.4,1.2,1.1,1,0.45,1,1.1,1.2,1.4,1.4,2,8.65,16],"high":[1000,130,24.5,8.75,4,2,0.2,0.2,0.2,0.2,0.2,2,4,8.75,24.5,130,1000],"medium":[110,40.0,10,4.45,3,1.5,1,0.5,0.3,0.5,1,1.5,3,4.45,10,40.0,110]}}'::jsonb where key = 'plinko';
update public.game_tables set value = '{"low":[[0.69,1.85],[0,2,3.65],[0,1.1,1.32,25.96],[0,0,2.19,7.72,90],[0,0,1.5,4.11,13,295],[0,0,1.1,1.93,6.2,100,678],[0,0,1.1,1.6,3.5,14.84,200,700],[0,0,1.1,1.5,1.88,5.42,39,100,800],[0,0,1.1,1.3,1.63,2.38,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.62,3.5,13,50,250,1000]],"high":[[0,3.92],[0,0,16.98],[0,0,0,80.68],[0,0,0,9.77,259],[0,0,0,4.5,47.99,427],[0,0,0,0,10.58,350,710],[0,0,0,0,6.93,90,381,800],[0,0,0,0,5,19.28,270,600,900],[0,0,0,0,4,10.86,56,468,800,1000],[0,0,0,0,3.5,7.77,12.95,63,500,800,1000]],"medium":[[0.39,2.75],[0,1.79,5.05],[0,0,2.74,49.86],[0,0,1.68,9.91,100],[0,0,1.4,3.9,14,386],[0,0,0,3,8.98,176,710],[0,0,0,2,6.93,30,381,800],[0,0,0,2,3.88,10.98,67,400,900],[0,0,0,2,2.43,4.93,15,100,500,1000],[0,0,0,1.6,2,3.77,7,26,100,500,1000]],"classic":[[0,3.92],[0,1.9,4.32],[0,1,3.1,9.56],[0,0.8,1.8,4.76,22.43],[0,0.23,1.4,4.1,16.34,36],[0,0,0.97,3.68,7,16.48,40],[0,0,0.47,2.95,4.5,13.83,31,60],[0,0,0,2.2,4,12.23,22,55,70],[0,0,0,1.53,3,7.82,15,44,60,85],[0,0,0,1.4,2.18,4.5,8,16.86,50,80,100]]}'::jsonb where key = 'keno';
update public.game_tables set value = '{"easy":{"eggs":3,"mult":[1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05],"tiles":4},"hard":{"eggs":1,"mult":[1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76],"tiles":2},"expert":{"eggs":1,"mult":[2.94,8.82,26.46,79.38,238.14,714.42,2143.26,6429.78,19289.34],"tiles":3},"master":{"eggs":1,"mult":[3.92,15.68,62.72,250.88,1003.52,4014.08,16056.32,64225.28,256901.12],"tiles":4},"medium":{"eggs":2,"mult":[1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67],"tiles":3}}'::jsonb where key = 'tower';
update public.game_tables set value = '{"easy":{"mult":[1,1.03,1.08,1.15,1.22,1.3,1.4,1.5,1.63,1.78,1.96,2.17,2.45,2.8,3.26,3.92,4.9,6.53,9.8,19.6],"bones":1},"hard":{"mult":[1,1.3,1.77,2.45,3.47,5.05,7.58,11.8,19.18,32.88,60.29,120.58,271.32,723.52,2532.32,15193.92],"bones":5},"expert":{"mult":[1,1.96,4.13,9.31,22.61,60.29,180.88,633.08,2743.34,16460.08,181060.88],"bones":10},"medium":{"mult":[1,1.15,1.36,1.64,1.99,2.45,3.06,3.9,5.07,6.77,9.31,13.3,19.95,31.92,55.86,111.72,279.3,1117.2],"bones":3}}'::jsonb where key = 'chicken';
update public.game_tables set value = '{"easy":{"mult":[1,1.22,1.53,1.91,2.39,2.99,3.73,4.67,5.84,7.3,9.12],"block":1,"kicks":10},"hard":{"mult":[1,2.45,6.12,15.31,38.28,95.7,239.25,598.14,1495.36],"block":3,"kicks":8},"expert":{"mult":[1,4.9,24.5,122.5,612.5,3062.5,15312.5],"block":4,"kicks":6},"medium":{"mult":[1,1.63,2.72,4.53,7.56,12.6,21,35,58.34,97.24,162.07],"block":2,"kicks":10}}'::jsonb where key = 'soccer';
update public.game_tables set value = '{"easy":{"bad":1,"mult":[1,1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05,17.4],"doors":4},"hard":{"bad":1,"mult":[1,1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76,1003.52],"doors":2},"expert":{"bad":2,"mult":[1,2.94,8.82,26.46,79.38,238.14,714.42,2143.25,6429.78,19289.34,57868.02],"doors":3},"medium":{"bad":1,"mult":[1,1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67,56.51],"doors":3}}'::jsonb where key = 'door';
update public.game_tables set value = '{"10":[0,1.8,0,1.5,0,2,0,1.5,0,3],"20":[1.4,0,2,0,2,0,2,0,1.4,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.4,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,4.5,0,1.5,0,2,0,1.5,0]}'::jsonb where key = 'wheel_medium';
update public.game_tables set value = '[{"name":"Bronze 1","wager":1000,"reward":2},{"name":"Bronze 2","wager":5000,"reward":4},{"name":"Bronze 3","wager":15000,"reward":10},{"name":"Bronze 4","wager":50000,"reward":35},{"name":"Silver 1","wager":100000,"reward":50},{"name":"Silver 2","wager":150000,"reward":50},{"name":"Silver 3","wager":200000,"reward":50},{"name":"Silver 4","wager":250000,"reward":50},{"name":"Gold 1","wager":300000,"reward":50},{"name":"Gold 2","wager":350000,"reward":50},{"name":"Gold 3","wager":400000,"reward":50},{"name":"Gold 4","wager":450000,"reward":50},{"name":"Jade 1","wager":500000,"reward":50},{"name":"Jade 2","wager":600000,"reward":100},{"name":"Jade 3","wager":700000,"reward":100},{"name":"Jade 4","wager":800000,"reward":100},{"name":"Jade 5","wager":900000,"reward":100},{"name":"Sapphire 1","wager":1000000,"reward":100},{"name":"Sapphire 2","wager":1500000,"reward":500},{"name":"Emerald 1","wager":2000000,"reward":500},{"name":"Emerald 2","wager":2500000,"reward":500},{"name":"Ruby 1","wager":3000000,"reward":500},{"name":"Ruby 2","wager":3500000,"reward":500},{"name":"Obsidian 1","wager":4000000,"reward":500},{"name":"Obsidian 2","wager":4500000,"reward":500},{"name":"Amethyst 1","wager":5000000,"reward":500},{"name":"Amethyst 2","wager":7500000,"reward":2500},{"name":"Amethyst 3","wager":10000000,"reward":2500}]'::jsonb where key = 'vip_tiers';

-- ---------- Rain: só entra quem apostou o mínimo nos últimos 7 dias (antes: total da vida, mínimo 0) ----------
create or replace function public.rain_join()
returns void language plpgsql security definer set search_path = public as $$
declare r rains; p profiles; v_w numeric;
begin
  if auth.uid() is null then raise exception 'Sign in to join the rain.'; end if;
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
end $$;

update public.settings set value = jsonb_set(value, '{min_wager}', '5000') where key = 'rain_auto';
update public.rains set min_wager = 5000 where status = 'open' and auto;
