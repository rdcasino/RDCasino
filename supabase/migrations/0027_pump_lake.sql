-- 0027: dois originais novos
--  * Pump: encher o balão (mesma matemática do Spill: 25 bombadas, 1/3/5/10 estouros escondidos, RTP 98%).
--  * Cross the Lake: 20 colunas de vitórias-régias. Em cada pulo o jogador escolhe a folha:
--      segura (96% de não afundar), média (80%) ou arriscada (59%).
--    Multiplicador = 0,98 ÷ chance acumulada de ter chegado até ali (RTP 98% em qualquer saque).
--    O número de cada pulo vem das seeds: pulo k usa o k-ésimo número de HMAC(server, client:nonce:cursor); afunda se número ≥ chance.
-- As funções grandes são corrigidas a partir da versão ativa no banco; se algum trecho não existir, nada muda.

do $mig$
declare src text; n text;
begin
  -- ---------- round_start ----------
  src := pg_get_functiondef('public.round_start(text,numeric,jsonb)'::regprocedure); n := src;
  if n not like '%''pump'',''lake''%' then
    n := regexp_replace(n, '''spill''\)(\s*then\s+raise\s+exception\s+''Unknown game\.'')', '''spill'',''pump'',''lake'')\1');
    n := regexp_replace(n, 'elsif\s+p_game\s*=\s*''spill''\s+then', 'elsif p_game in (''spill'', ''pump'') then');
    n := regexp_replace(n, '(elsif\s+p_game\s*=\s*''rps''\s+then)', 'elsif p_game = ''lake'' then
    st := jsonb_build_object(''steps'', 0, ''mult'', 0.98, ''path'', ''[]''::jsonb);
  \1');
  end if;
  if n not like '%''pump'',''lake''%' or n not like '%p_game in (''spill'', ''pump'')%' or n not like '%''mult'', 0.98, ''path''%' then
    raise exception 'round_start: trecho esperado não encontrado. Trecho atual: %', substr(src, greatest(strpos(src, '''spill''') - 200, 1), 400);
  end if;
  if n <> src then execute n; end if;

  -- ---------- round_act ----------
  src := pg_get_functiondef('public.round_act(text,text,jsonb)'::regprocedure); n := src;
  if n not like '%Cross the Lake%' then
    n := regexp_replace(n, 'elsif\s+p_game\s*=\s*''spill''\s+then', 'elsif p_game in (''spill'', ''pump'') then');
    n := regexp_replace(n, '(\n\s*elsif\s+p_game\s*=\s*''crash''\s+then)', '
  elsif p_game = ''lake'' then
    -- Cross the Lake: segura 96%, média 80%, arriscada 59%; multiplicador = 0,98 / chance acumulada
    v_steps := (st->>''steps'')::int; v_mult := (st->>''mult'')::float8;
    if p_action = ''jump'' then
      v_p := case p_params->>''pad'' when ''safe'' then 0.96 when ''mid'' then 0.8 when ''risky'' then 0.59 else null end;
      if v_p is null then raise exception ''Pick a lily pad.''; end if;
      if v_steps >= 20 then raise exception ''You crossed the lake. Cash out!''; end if;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, v_steps + 1);
      v_steps := v_steps + 1;
      if fs[v_steps] >= v_p then
        bet := rd_round_settle(r, 0, false, jsonb_build_object(''steps'', v_steps, ''sank'', v_steps, ''path'', coalesce(st->''path'', ''[]''::jsonb) || to_jsonb(p_params->>''pad'')));
        res := jsonb_build_object(''ok'', false, ''steps'', v_steps, ''roll'', fs[v_steps], ''bet'', bet);
      else
        v_mult := v_mult / v_p;
        st := jsonb_build_object(''steps'', v_steps, ''mult'', v_mult, ''path'', coalesce(st->''path'', ''[]''::jsonb) || to_jsonb(p_params->>''pad''));
        update rounds set state = st where user_id = v_uid and game = p_game;
        if v_steps = 20 then
          bet := rd_round_settle(r, floor(v_mult * 100 + 1e-9) / 100, true, jsonb_build_object(''steps'', v_steps, ''path'', st->''path''));
          res := jsonb_build_object(''ok'', true, ''steps'', v_steps, ''roll'', fs[v_steps], ''bet'', bet);
        else
          res := jsonb_build_object(''ok'', true, ''steps'', v_steps, ''roll'', fs[v_steps], ''state'', st);
        end if;
      end if;
    elsif p_action = ''cashout'' then
      if v_steps < 1 then raise exception ''Jump at least once first.''; end if;
      bet := rd_round_settle(r, floor(v_mult * 100 + 1e-9) / 100, true, jsonb_build_object(''steps'', v_steps, ''path'', st->''path''));
      res := jsonb_build_object(''bet'', bet);
    else raise exception ''Invalid action.''; end if;
\1');
  end if;
  if n not like '%Cross the Lake%' or n not like '%p_game in (''spill'', ''pump'')%' then
    raise exception 'round_act: trecho esperado não encontrado. Trecho atual: %', substr(src, greatest(strpos(src, '''crash''') - 200, 1), 400);
  end if;
  if n <> src then execute n; end if;
end $mig$;

create or replace function public.rd_game_edge(p_game text) returns numeric language sql immutable as $$
  select case p_game when 'blackjack' then 0.9 when 'baccarat' then 1.1 else 2 end::numeric
$$;

-- Sem limite de ganho por aposta (pedido do dono). 0 = sem limite.
-- ATENÇÃO: com isso um único acerto alto (ex.: Limbo 1.000.000×, Tower Master 256.901×) paga tudo o que o multiplicador manda.
-- Para voltar a ter limite, troque o 0 pelo valor máximo de lucro em dólar (ou ajuste no admin).
update public.settings set value = '0' where key = 'max_profit';
