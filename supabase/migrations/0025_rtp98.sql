-- 0025: RTP de 98% nos originais, Blackjack mais justo para a casa, VIP no padrão de mercado
--
-- 1) Dice, Limbo, Crash, Mines, Hi-Lo, Coinflip, Wheel, Plinko, Keno, Roleta e Double passam a pagar 98%.
--    Tower, Chicken, Door, Soccer, RPS e Spill já eram 98%. Baccarat continua padrão (comissão de 5%).
-- 2) Blackjack: dealer compra no 17 macio (H17) e não pode dobrar depois de dividir.
--    Corrige brecha: o navegador podia chamar as ações internas 'deal' e 'peek' e reiniciar a mão
--    (via API), vendo a próxima carta antes de decidir.
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
  n := replace(n, 'while rd_bj_total(dl) < 17 loop', 'while rd_bj_total(dl) < 17 or (rd_bj_total(dl) = 17 and rd_bj_soft(dl)) loop');
  n := replace(n, '      if p_action = ''double'' then
', '      if p_action = ''double'' then
        if nh = 2 then raise exception ''You can''''t double after a split.''; end if;
');
  if n not like '%rd_bj_soft(dl)) loop%' or n not like '%double after a split%' then raise exception 'rd_bj: trecho esperado não encontrado'; end if;
  execute n;
end $mig$;

-- ---------- Tabelas de pagamento (98%) e VIP ----------
update public.game_tables set value = '{"8":{"low":[5.55,1.95,1.1,1,0.5,1,1.1,1.95,5.55],"high":[29,4,1.45,0.3,0.2,0.3,1.45,4,29],"medium":[13,2.85,1.3,0.7,0.4,0.7,1.3,2.85,13]},"9":{"low":[5.35,1.75,1.6,1,0.7,0.7,1,1.6,1.75,5.35],"high":[43,6.7,2,0.6,0.2,0.2,0.6,2,6.7,43],"medium":[16.0,3.9,1.7,0.9,0.5,0.5,0.9,1.7,3.9,16.0]},"10":{"low":[8.75,2.5,1.4,1.1,1,0.5,1,1.1,1.4,2.5,8.75],"high":[76,9.45,3,0.9,0.3,0.2,0.3,0.9,3,9.45,76],"medium":[22,4.75,1.95,1.4,0.6,0.4,0.6,1.4,1.95,4.75,22]},"11":{"low":[8.0,2.85,1.9,1.25,1,0.7,0.7,1,1.25,1.9,2.85,8.0],"high":[108,14,5.2,1.4,0.4,0.2,0.2,0.4,1.4,5.2,14,108],"medium":[19.0,6,2.9,1.8,0.7,0.5,0.5,0.7,1.8,2.9,6,19.0]},"12":{"low":[9.75,3,1.3,1.4,1.1,1,0.5,1,1.1,1.4,1.3,3,9.75],"high":[167,24,7.8,2,0.7,0.2,0.2,0.2,0.7,2,7.8,24,167],"medium":[32.5,11,3.7,2,1.1,0.6,0.3,0.6,1.1,2,3.7,11,32.5]},"13":{"low":[8.1,3.6,3,1.9,1.15,0.9,0.7,0.7,0.9,1.15,1.9,3,3.6,8.1],"high":[248,34.5,11,4,1,0.2,0.2,0.2,0.2,1,4,11,34.5,248],"medium":[38.0,13,6,3,1.25,0.7,0.4,0.4,0.7,1.25,3,6,13,38.0]},"14":{"low":[7.1,4,1.8,1.2,1.3,1.1,1,0.5,1,1.1,1.3,1.2,1.8,4,7.1],"high":[417,50.5,18,5,1.9,0.3,0.2,0.2,0.2,0.3,1.9,5,18,50.5,417],"medium":[58,10.5,7,3.95,1.9,1,0.5,0.2,0.5,1,1.9,3.95,7,10.5,58]},"15":{"low":[15,7.7,3,1.65,1.5,1.1,1,0.7,0.7,1,1.1,1.5,1.65,3,7.7,15],"high":[611,83,27,7.65,3,0.5,0.2,0.2,0.2,0.2,0.5,3,7.65,27,83,611],"medium":[88,15.5,9.8,5,3,1.3,0.5,0.3,0.3,0.5,1.3,3,5,9.8,15.5,88]},"16":{"low":[10.5,9,2,1.4,1.4,1.2,1.1,1,0.45,1,1.1,1.2,1.4,1.4,2,9,10.5],"high":[1000,130,24.5,8.75,4,2,0.2,0.2,0.2,0.2,0.2,2,4,8.75,24.5,130,1000],"medium":[108,41,10,5,3,1.5,1,0.5,0.25,0.5,1,1.5,3,5,10,41,108]}}'::jsonb where key = 'plinko';
update public.game_tables set value = '{"low":[[0.69,1.85],[0,1.99,3.72],[0,1.1,1.33,25.85],[0,0,2.2,7.67,89.93],[0,0,1.5,4.12,13,293],[0,0,1.07,2,6.2,100,692],[0,0,1.09,1.6,3.37,15,225,700],[0,0,1.1,1.5,1.88,5.42,39,100,800],[0,0,1.1,1.28,1.65,2.5,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.62,3.5,13,50,250,1000]],"high":[[0,3.92],[0,0,16.99],[0,0,0,80.69],[0,0,0,9.77,259],[0,0,0,4.47,48,433],[0,0,0,0,10.58,350,710],[0,0,0,0,6.79,90,400,800],[0,0,0,0,5,19.28,270,600,900],[0,0,0,0,4,10.86,56,468,800,1000],[0,0,0,0,3.5,7.77,12.95,63,500,800,1000]],"medium":[[0.39,2.75],[0,1.8,4.99],[0,0,2.75,49.75],[0,0,1.68,9.91,100],[0,0,1.4,3.91,14,384],[0,0,0,3,8.65,180,710],[0,0,0,2,6.79,30,400,800],[0,0,0,2,3.88,10.98,67,400,900],[0,0,0,2,2.43,4.93,15,100,500,1000],[0,0,0,1.6,2,3.77,7,26,100,500,1000]],"classic":[[0,3.92],[0,1.9,4.32],[0,0.98,3.09,10.4],[0,0.78,1.8,5,22.19],[0,0.23,1.4,4.1,16.34,36],[0,0,0.97,3.68,7,16.5,40],[0,0,0.47,2.95,4.5,13.83,31,60],[0,0,0,2.16,4,12.9,22,55,70],[0,0,0,1.53,3,7.82,15,44,60,85],[0,0,0,1.4,2.18,4.5,7.99,17,50,80,100]]}'::jsonb where key = 'keno';
update public.game_tables set value = '{"10":[0,1.8,0,1.5,0,2,0,1.5,0,3],"20":[1.4,0,2,0,2,0,2,0,1.4,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.4,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,4.5,0,1.5,0,2,0,1.5,0]}'::jsonb where key = 'wheel_medium';
update public.game_tables set value = '[{"name":"Bronze 1","wager":1000,"reward":2},{"name":"Bronze 2","wager":5000,"reward":4},{"name":"Bronze 3","wager":15000,"reward":10},{"name":"Bronze 4","wager":50000,"reward":35},{"name":"Silver 1","wager":100000,"reward":50},{"name":"Silver 2","wager":150000,"reward":50},{"name":"Silver 3","wager":200000,"reward":50},{"name":"Silver 4","wager":250000,"reward":50},{"name":"Gold 1","wager":300000,"reward":50},{"name":"Gold 2","wager":350000,"reward":50},{"name":"Gold 3","wager":400000,"reward":50},{"name":"Gold 4","wager":450000,"reward":50},{"name":"Jade 1","wager":500000,"reward":50},{"name":"Jade 2","wager":600000,"reward":100},{"name":"Jade 3","wager":700000,"reward":100},{"name":"Jade 4","wager":800000,"reward":100},{"name":"Jade 5","wager":900000,"reward":100},{"name":"Sapphire 1","wager":1000000,"reward":100},{"name":"Sapphire 2","wager":1500000,"reward":500},{"name":"Emerald 1","wager":2000000,"reward":500},{"name":"Emerald 2","wager":2500000,"reward":500},{"name":"Ruby 1","wager":3000000,"reward":500},{"name":"Ruby 2","wager":3500000,"reward":500},{"name":"Obsidian 1","wager":4000000,"reward":500},{"name":"Obsidian 2","wager":4500000,"reward":500},{"name":"Amethyst 1","wager":5000000,"reward":500},{"name":"Amethyst 2","wager":7500000,"reward":2500},{"name":"Amethyst 3","wager":10000000,"reward":2500}]'::jsonb where key = 'vip_tiers';
