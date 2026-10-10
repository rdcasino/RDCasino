-- 0028: o valor que o jogador vê é o valor que ele recebe.
-- Os resgates (nível VIP, bônus diário/semanal/mensal, rakeback) recebem o valor mostrado na tela (p_expected).
--  * Nível e bônus: se o valor do servidor estiver diferente do mostrado, nada é pago e volta REWARD_CHANGED <valor>;
--    o site atualiza o card e o jogador resgata de novo já vendo o valor certo.
--  * Rakeback: paga exatamente o valor mostrado (se houver saldo de rakeback suficiente); o resto continua acumulando.
-- Sem p_expected (chamada antiga), o comportamento é o de antes.

drop function if exists public.claim_level(text);
create function public.claim_level(p_tier text, p_expected numeric default null)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare t jsonb; me profiles; v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into me from profiles where id = auth.uid() for update;
  if me.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  select x into t from game_tables g, jsonb_array_elements(g.value) x where g.key = 'vip_tiers' and x->>'name' = p_tier;
  if t is null or me.wagered < (t->>'wager')::numeric or p_tier = any(me.claimed_tiers) then raise exception 'Not available.'; end if;
  v := (t->>'reward')::numeric;
  if p_expected is not null and abs(v - p_expected) >= 0.005 then raise exception 'REWARD_CHANGED %', round(v, 2); end if;
  update profiles set balance = balance + v, claimed_tiers = array_append(claimed_tiers, p_tier) where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'level_reward', 'completed', v, p_tier, now());
  return v;
end $function$;

drop function if exists public.claim_bonus(text);
create function public.claim_bonus(p_key text, p_expected numeric default null)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare it jsonb; v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform 1 from profiles where id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Your account is suspended.'; end if;
  select e into it from jsonb_array_elements(rd_bonus_state(auth.uid())) e where e->>'key' = p_key;
  if it is null then raise exception 'Unknown bonus.'; end if;
  if it->>'status' = 'wait' then raise exception 'Not available yet.'; end if;
  if it->>'status' <> 'ready' then raise exception 'Nothing to claim yet.'; end if;
  v := (it->>'amount')::numeric;
  if p_expected is not null and abs(v - p_expected) >= 0.005 then raise exception 'REWARD_CHANGED %', round(v, 2); end if;
  update profiles set balance = balance + v, bonus_claims = bonus_claims || jsonb_build_object(p_key, now()) where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'bonus', 'completed', v, it->>'label', now());
  return v;
end $function$;

drop function if exists public.claim_rakeback();
create function public.claim_rakeback(p_expected numeric default null)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select floor(rakeback * 100) / 100 into v from profiles where id = auth.uid() and status = 'active' for update;
  if v is null then raise exception 'Your account is suspended.'; end if;
  if p_expected is not null then
    if p_expected > v + 0.004 then raise exception 'REWARD_CHANGED %', round(v, 2); end if;
    v := round(p_expected, 2);
  end if;
  if v < 0.01 then raise exception 'Nothing to claim yet.'; end if;
  update profiles set balance = balance + v, rakeback = rakeback - v where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'rakeback', 'completed', v, 'Instant rakeback', now());
  return v;
end $function$;

revoke all on function public.claim_level(text, numeric), public.claim_bonus(text, numeric), public.claim_rakeback(numeric) from public, anon;
grant execute on function public.claim_level(text, numeric), public.claim_bonus(text, numeric), public.claim_rakeback(numeric) to authenticated, service_role;
-- Comissão de afiliado: paga exatamente o valor mostrado (o restante continua disponível para o próximo resgate)
drop function if exists public.affiliate_collect();
create function public.affiliate_collect(p_expected numeric default null)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare a jsonb; v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform 1 from profiles where id = auth.uid() for update;
  a := rd_affiliate(auth.uid()); v := (a->>'available')::numeric;
  if p_expected is not null then
    if p_expected > v + 0.004 then raise exception 'REWARD_CHANGED %', round(v, 2); end if;
    v := round(p_expected, 2);
  end if;
  if v < 1 then raise exception 'You need at least $1 to collect.'; end if;
  update profiles set balance = balance + v, aff_paid = aff_paid + v where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'commission', 'completed', v, 'Affiliate commission', now());
  return v;
end $function$;
revoke all on function public.affiliate_collect(numeric) from public, anon;
grant execute on function public.affiliate_collect(numeric) to authenticated, service_role;
notify pgrst, 'reload schema';
