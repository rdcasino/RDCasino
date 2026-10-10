-- Cópia de segurança da lógica do servidor em 2026-10-10 (depois das migrações 0028 e 0029).
-- Contém: todas as funções do schema public e as tabelas de configuração dos jogos (game_tables).
-- Não contém dados de jogadores nem chaves. Serve para comparar ou restaurar uma função; não rode o arquivo inteiro sem revisar.

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text, p_type text DEFAULT 'adjustment'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_type not in ('adjustment', 'bonus') then raise exception 'invalid type'; end if;
  update profiles set balance = balance + round(p_amount, 2) where id = p_user and balance + round(p_amount, 2) >= 0;
  if not found then raise exception 'balance would go negative'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by)
    values (p_user, p_type, 'completed', round(p_amount, 2), p_reason, now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), p_type, jsonb_build_object('user', p_user, 'usd', p_amount, 'reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_reload(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update vip_reloads set status = 'cancelled' where user_id = p_user and status = 'active';
  insert into audit_log(who, what, data) values (auth.uid(), 'cancel vip reload', jsonb_build_object('user', p_user));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_confiscate(p_user uuid, p_amount numeric, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Escreva o motivo.'; end if;
  update profiles set held = held - v where id = p_user and held >= v;
  if not found then raise exception 'Valor maior que o retido.'; end if;
  insert into audit_log(who, what, data) values (auth.uid(), 'confiscate', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_create_invites(p_count integer, p_note text DEFAULT NULL::text)
 RETURNS SETOF text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare i int; v text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  for i in 1..least(greatest(p_count, 1), 200) loop
    loop
      v := 'RD' || upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1Il', ''), 1, 6));
      exit when length(v) = 8 and not exists(select 1 from invites where code = v);
    end loop;
    insert into invites(code, note) values (v, p_note);
    return next v;
  end loop;
  insert into audit_log(who, what, data) values (auth.uid(), 'create invites', jsonb_build_object('count', p_count, 'note', p_note));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_credit_deposit(p_user uuid, p_amount numeric, p_coin text, p_network text, p_tx_hash text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform set_config('rd.coin', upper(coalesce(p_coin, '')), true);
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set balance = balance + v where id = p_user;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  insert into transactions(user_id, type, status, amount_usd, coin, network, tx_hash, decided_at, decided_by)
    values (p_user, 'deposit', 'completed', v, nullif(p_coin, ''), nullif(p_network, ''), nullif(trim(coalesce(p_tx_hash, '')), ''), now(), auth.uid()) returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'credit deposit', jsonb_build_object('user', p_user, 'usd', v, 'coin', p_coin, 'network', p_network, 'tx', p_tx_hash));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_decide_tx(p_id bigint, p_approve boolean, p_tx_hash text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_hold boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t transactions;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into t from transactions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'transaction not pending'; end if;
  perform set_config('rd.coin', upper(coalesce(t.coin, '')), true);
  if t.type = 'deposit' and p_approve then
    update profiles set balance = balance + t.amount_usd where id = t.user_id;
  elsif t.type = 'withdrawal' and not p_approve then
    if p_hold then update profiles set held = held + t.amount_usd where id = t.user_id;
    else update profiles set balance = balance + t.amount_usd where id = t.user_id; end if;
  end if;
  update transactions set status = case when p_approve then 'completed' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid(), tx_hash = coalesce(p_tx_hash, tx_hash),
    note = coalesce(p_note, note) || case when not p_approve and p_hold and t.type = 'withdrawal' then ' (on hold)' else '' end
    where id = p_id;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'approve ' else (case when p_hold then 'reject+hold ' else 'reject ' end) end || t.type, jsonb_build_object('tx', p_id, 'user', t.user_id, 'usd', t.amount_usd));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_grant_reload(p_user uuid, p_per numeric, p_claims integer, p_hours integer DEFAULT 24, p_note text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if round(p_per, 2) <= 0 or p_claims < 1 or p_claims > 365 or p_hours < 1 or p_hours > 720 then raise exception 'Valores inválidos.'; end if;
  update vip_reloads set status = 'cancelled' where user_id = p_user and status = 'active';
  insert into vip_reloads(user_id, per_claim, claims, interval_hours, note, created_by)
    values (p_user, round(p_per, 2), p_claims, p_hours, p_note, auth.uid()) returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'grant vip reload', jsonb_build_object('user', p_user, 'per_claim', p_per, 'claims', p_claims, 'hours', p_hours));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_hold(p_user uuid, p_amount numeric, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set balance = balance - v, held = held + v where id = p_user and balance >= v;
  if not found then raise exception 'O jogador não tem esse saldo disponível.'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by) values (p_user, 'adjustment', 'completed', -v, 'On hold: ' || coalesce(p_reason, ''), now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), 'hold balance', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_kyc_decide(p_user uuid, p_approve boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update kyc_submissions set status = case when p_approve then 'verified' else 'rejected' end, reason = p_reason, reviewed_at = now(), reviewed_by = auth.uid()
    where id = (select id from kyc_submissions where user_id = p_user order by created_at desc limit 1);
  update profiles set kyc = case when p_approve then 'verified' else 'rejected' end where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'kyc approve' else 'kyc reject' end, jsonb_build_object('user', p_user, 'reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_player_emails()
 RETURNS TABLE(id uuid, email text, last_sign_in timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query select u.id, u.email::text, u.last_sign_in_at from auth.users u;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_release(p_user uuid, p_amount numeric, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set held = held - v, balance = balance + v where id = p_user and held >= v;
  if not found then raise exception 'Valor maior que o retido.'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by) values (p_user, 'adjustment', 'completed', v, 'Released: ' || coalesce(p_reason, ''), now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), 'release hold', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_save_code(p_code text, p_amount numeric, p_max_uses integer, p_min_wager numeric, p_hours integer, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,24}$' then raise exception 'Código: 3 a 24 letras, números, - ou _.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Valor inválido.'; end if;
  insert into promo_codes(code, amount, max_uses, min_wager, expires_at, active, created_by)
    values (v_code, round(p_amount, 2), greatest(coalesce(p_max_uses, 0), 0), greatest(coalesce(p_min_wager, 0), 0), case when coalesce(p_hours, 0) > 0 then now() + make_interval(hours => p_hours) end, coalesce(p_active, true), auth.uid())
  on conflict (code) do update set amount = excluded.amount, max_uses = excluded.max_uses, min_wager = excluded.min_wager, expires_at = excluded.expires_at, active = excluded.active;
  insert into audit_log(who, what, data) values (auth.uid(), 'promo code', jsonb_build_object('code', v_code, 'amount', p_amount, 'max_uses', p_max_uses, 'hours', p_hours, 'active', p_active));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_aff_share(p_user uuid, p_share numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_share is not null and (p_share < 0 or p_share > 70) then raise exception 'Valor inválido.'; end if;
  update profiles set aff_share = p_share where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), 'affiliate share', jsonb_build_object('user', p_user, 'share', p_share));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_note(p_user uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update profiles set note = p_note where id = p_user;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_rain_auto(p_enabled boolean, p_amount numeric, p_min_wager numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_amount < 0 or p_min_wager < 0 then raise exception 'Valores inválidos.'; end if;
  insert into settings(key, value) values ('rain_auto', jsonb_build_object('enabled', p_enabled, 'amount', round(p_amount, 2), 'min_wager', p_min_wager))
    on conflict (key) do update set value = excluded.value;
  insert into audit_log(who, what, data) values (auth.uid(), 'rain auto', jsonb_build_object('enabled', p_enabled, 'amount', p_amount, 'min_wager', p_min_wager));
  -- vale já para a chuva automática aberta (pote da casa e apostado mínimo)
  update rains set amount = amount - house_amount + round(p_amount, 2), house_amount = round(p_amount, 2), min_wager = p_min_wager
    where status = 'open' and auto;
  if p_enabled then perform public.rain_auto_tick(); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_key not in ('max_profit', 'restricted_countries', 'site', 'games', 'promotions') then raise exception 'Configuração desconhecida.'; end if;
  insert into settings(key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value;
  insert into audit_log(who, what, data) values (auth.uid(), 'setting ' || p_key, p_value);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_status(p_user uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update profiles set status = p_status where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), 'set status', jsonb_build_object('user', p_user, 'status', p_status));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_start_rain(p_amount numeric, p_minutes integer, p_min_wager numeric DEFAULT 100)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public.rain_settle();
  if p_amount <= 0 then raise exception 'Invalid amount.'; end if;
  select id into v_id from rains where status = 'open' for update;
  if found then
    update rains set amount = amount + round(p_amount, 2), house_amount = house_amount + round(p_amount, 2) where id = v_id;
    insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'The house added $' || to_char(round(p_amount, 2), 'FM999999990.00') || ' to the rain!');
  else
    if p_minutes < 1 or p_minutes > 1440 then raise exception 'Invalid duration.'; end if;
    insert into rains(amount, house_amount, min_wager, ends_at, created_by)
      values (round(p_amount, 2), round(p_amount, 2), greatest(p_min_wager, 0), now() + make_interval(mins => p_minutes), auth.uid()) returning id into v_id;
    insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'A $' || round(p_amount, 2) || ' rain started! Join in the next ' || p_minutes || ' min.');
  end if;
  insert into audit_log(who, what, data) values (auth.uid(), 'start rain', jsonb_build_object('rain', v_id, 'usd', p_amount, 'minutes', p_minutes, 'min_wager', p_min_wager));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_support_reply(p_user uuid, p_text text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v text := trim(coalesce(p_text, '')); v_id bigint; v_name text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v = '' then raise exception 'Digite a mensagem.'; end if;
  select username into v_name from profiles where id = auth.uid();
  insert into support_messages(user_id, from_staff, staff_name, text) values (p_user, true, coalesce(v_name, 'RD Support'), left(v, 2000)) returning id into v_id;
  insert into support_threads(user_id, status, last_at, last_text, unread_user, unread_staff) values (p_user, 'open', now(), left(v, 140), 1, 0)
    on conflict (user_id) do update set last_at = now(), last_text = left(v, 140), unread_user = support_threads.unread_user + 1, unread_staff = 0;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_support_seen(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update support_threads set unread_staff = 0 where user_id = p_user;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_support_status(p_user uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update support_threads set status = p_status, unread_staff = case when p_status = 'closed' then 0 else unread_staff end where user_id = p_user;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_code(p_code text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update promo_codes set active = p_active where code = upper(p_code);
end $function$;

CREATE OR REPLACE FUNCTION public.affiliate_collect(p_expected numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.after_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(trim(coalesce(m->>'invite', '')));
  v_ref text := upper(trim(coalesce(m->>'ref', '')));
  v_refid uuid; v_admin boolean := false; v_server text; v_mycode text;
begin
  select id into v_refid from profiles where ref_code = v_ref and v_ref <> '';
  loop
    v_mycode := upper(substr(regexp_replace(trim(m->>'username'), '[^A-Za-z0-9]', '', 'g'), 1, 6)) || lpad((floor(random() * 1000))::int::text, 3, '0');
    exit when not exists(select 1 from profiles where ref_code = v_mycode);
  end loop;
  insert into profiles(id, username, country, ref_code, referred_by)
    values (new.id, trim(m->>'username'), trim(m->>'country'), v_mycode, v_refid);
  v_server := encode(gen_random_bytes(32), 'hex');
  insert into seeds(user_id, server_seed, server_hash, client_seed, nonce)
    values (new.id, v_server, encode(digest(v_server, 'sha256'), 'hex'), encode(gen_random_bytes(8), 'hex'), 0);
  if v_code <> '' then
    update invites set used_by = new.id, used_at = now() where code = v_code returning is_admin into v_admin;
    if coalesce(v_admin, false) then insert into admins(user_id) values (new.id) on conflict do nothing; end if;
  end if;
  insert into audit_log(who, what, data) values (new.id, 'signup', jsonb_build_object('username', m->>'username', 'invite', nullif(v_code, '')));
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.before_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(trim(coalesce(m->>'invite', '')));
  v_user text := trim(coalesce(m->>'username', ''));
  v_country text := trim(coalesce(m->>'country', ''));
  v_ref text := upper(trim(coalesce(m->>'ref', '')));
begin
  if v_code <> '' and not exists(select 1 from invites where code = v_code and used_by is null) then
    raise exception 'Invalid or already used invite code.';
  end if;
  if v_user !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'Username: 3-16 letters, numbers or _.'; end if;
  if exists(select 1 from profiles where lower(username) = lower(v_user)) then raise exception 'This username is already taken.'; end if;
  if v_country = '' then raise exception 'Choose your country.'; end if;
  if exists(select 1 from settings s, jsonb_array_elements_text(s.value) c where s.key = 'restricted_countries' and lower(c) = lower(v_country)) then
    raise exception 'We can''t accept players from this country.';
  end if;
  if v_ref <> '' and not exists(select 1 from profiles where ref_code = v_ref) then raise exception 'Referral code not found.'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.chat_send(p_text text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_name text; v_status text; v_id bigint; v_text text := trim(coalesce(p_text, ''));
begin
  if auth.uid() is null then raise exception 'Sign in to chat.'; end if;
  select username, status into v_name, v_status from profiles where id = auth.uid();
  if v_name is null then raise exception 'Profile not found.'; end if;
  if v_status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if v_text = '' then raise exception 'Type a message.'; end if;
  if length(v_text) > 200 then raise exception 'Max 200 characters.'; end if;
  if exists(select 1 from chat_messages where user_id = auth.uid() and created_at > now() - interval '2 seconds') then
    raise exception 'Slow down a little.';
  end if;
  insert into chat_messages(user_id, username, text) values (auth.uid(), v_name, v_text) returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.claim_bonus(p_key text, p_expected numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.claim_level(p_tier text, p_expected numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.claim_rakeback(p_expected numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.claim_reload()
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r vip_reloads;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into r from vip_reloads where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'No VIP Reload available.'; end if;
  if r.last_claim_at is not null and r.last_claim_at + make_interval(hours => r.interval_hours) > now() then raise exception 'Not available yet.'; end if;
  update profiles set balance = balance + r.per_claim where id = auth.uid() and status = 'active';
  if not found then raise exception 'Your account is suspended.'; end if;
  update vip_reloads set used = used + 1, last_claim_at = now(), status = case when used + 1 >= claims then 'done' else 'active' end where id = r.id;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'bonus', 'completed', r.per_claim, 'VIP Reload', now());
  return r.per_claim;
end $function$;

CREATE OR REPLACE FUNCTION public.code_check(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null or length(v_code) < 3 then return false; end if;
  if (select count(*) from promo_checks where user_id = auth.uid() and at > now() - interval '1 hour') >= 60 then return null; end if;
  insert into promo_checks(user_id) values (auth.uid());
  delete from promo_checks where at < now() - interval '1 day';
  return exists(select 1 from promo_codes c where c.code = v_code and c.active and (c.expires_at is null or c.expires_at > now()) and (c.max_uses = 0 or c.uses < c.max_uses))
     and not exists(select 1 from promo_redemptions r where r.code = v_code and r.user_id = auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists(select 1 from public.admins where user_id = auth.uid()) $function$;

CREATE OR REPLACE FUNCTION public.kyc_submit(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_k text; v_files jsonb := coalesce(p->'files', '{}'); v_doc text := p->>'doc_type'; cur text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select kyc into cur from profiles where id = auth.uid();
  if cur = 'pending' then raise exception 'Your documents are already under review.'; end if;
  if cur = 'verified' then raise exception 'You are already verified.'; end if;
  if coalesce(trim(p->>'first_name'), '') = '' or coalesce(trim(p->>'last_name'), '') = '' then raise exception 'Fill in your full name.'; end if;
  if (p->>'dob')::date > (current_date - interval '18 years') then raise exception 'You must be 18 or older.'; end if;
  if coalesce(trim(p->>'address'), '') = '' or coalesce(trim(p->>'city'), '') = '' then raise exception 'Fill in your address.'; end if;
  if v_doc not in ('passport','id_card','driver_license') then raise exception 'Choose a document type.'; end if;
  -- arquivos obrigatórios; todos precisam estar na pasta do próprio jogador
  foreach v_k in array (case when v_doc = 'passport' then array['front','selfie','address'] else array['front','back','selfie','address'] end) loop
    if coalesce(v_files->>v_k, '') = '' then raise exception 'Upload all the requested files.'; end if;
  end loop;
  for v_k in select jsonb_object_keys(v_files) loop
    if split_part(v_files->>v_k, '/', 1) <> auth.uid()::text then raise exception 'Invalid file.'; end if;
  end loop;
  insert into kyc_submissions(user_id, first_name, last_name, dob, country, address, city, postal, doc_type, files)
    values (auth.uid(), trim(p->>'first_name'), trim(p->>'last_name'), (p->>'dob')::date, coalesce(nullif(trim(p->>'country'), ''), '-'),
            trim(p->>'address'), trim(p->>'city'), nullif(trim(p->>'postal'), ''), v_doc, v_files) returning id into v_id;
  update profiles set kyc = 'pending' where id = auth.uid();
  insert into audit_log(who, what, data) values (auth.uid(), 'kyc submit', jsonb_build_object('submission', v_id));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.leaderboard_month()
 RETURNS TABLE(username text, wagered numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.username, round(sum(b.amount), 2) from bets b join profiles p on p.id = b.user_id
  where b.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  group by p.username order by 2 desc limit 50
$function$;

CREATE OR REPLACE FUNCTION public.my_affiliate()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.rd_affiliate(auth.uid()) $function$;

CREATE OR REPLACE FUNCTION public.my_bonus_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select public.rd_bonus_state(auth.uid()) $function$;

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
  update profiles set balance = balance - v_amt + v_pay, wagered = wagered + v_amt, profit = profit + v_pay - v_amt,
      bets_count = bets_count + 1, rakeback = rakeback + v_amt * rd_game_edge(p_game) / 100 * coalesce(v_rate, 0.05)
    where id = v_uid returning * into p;
  insert into bets(user_id, game, amount, multiplier, payout, client_seed, nonce, detail)
    values (v_uid, p_game, v_amt, round(v_mult::numeric, 4), v_pay, s.client_seed, v_nonce, d) returning * into v_bet;

  return jsonb_build_object(
    'bet', jsonb_build_object('id', v_bet.id, 'game', p_game, 'amount', v_amt, 'multiplier', v_bet.multiplier, 'payout', v_pay, 'created_at', v_bet.created_at, 'detail', d),
    'fs', to_jsonb(fs::text[]), 'nonce', v_nonce, 'client', s.client_seed,
    'profile', rd_profile_json(p.id));
end $function$;

CREATE OR REPLACE FUNCTION public.public_bets(p_limit integer DEFAULT 300)
 RETURNS TABLE(id bigint, username text, game text, amount numeric, multiplier numeric, payout numeric, created_at timestamp with time zone, detail jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, p.username, b.game, b.amount, b.multiplier, b.payout, b.created_at, b.detail - 'client'
  from bets b join profiles p on p.id = b.user_id
  order by b.id desc limit least(greatest(coalesce(p_limit, 300), 1), 500)
$function$;

CREATE OR REPLACE FUNCTION public.public_staff()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(p.username), '{}') from admins a join profiles p on p.id = a.user_id
$function$;

CREATE OR REPLACE FUNCTION public.rain_auto_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c jsonb;
begin
  perform public.rain_settle();
  select value into c from settings where key = 'rain_auto';
  if c is null or not coalesce((c->>'enabled')::boolean, false) then return; end if;
  if exists(select 1 from rains where status = 'open') then return; end if;
  insert into rains(amount, house_amount, min_wager, ends_at, auto)
    values (round(coalesce((c->>'amount')::numeric, 0), 2), round(coalesce((c->>'amount')::numeric, 0), 2), coalesce((c->>'min_wager')::numeric, 0),
            date_trunc('hour', now()) + interval '1 hour', true)
  on conflict do nothing;
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

CREATE OR REPLACE FUNCTION public.rain_join()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.rain_settle()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r rains; v_per numeric; e record; c record;
begin
  for r in select * from rains where status = 'open' and ends_at <= now() for update skip locked loop
    if r.participants > 0 then
      v_per := floor(r.amount / r.participants * 100) / 100;
      for e in select user_id from rain_entries where rain_id = r.id loop
        update profiles set balance = balance + v_per where id = e.user_id;
        insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (e.user_id, 'bonus', 'completed', v_per, 'Rain', now());
      end loop;
      insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'Rain over! $' || to_char(r.amount, 'FM999999990.00') || ' split between ' || r.participants || ' players: $' || to_char(v_per, 'FM999999990.00') || ' each.');
    else
      -- ninguém participou: devolve o que jogadores colocaram
      for c in select user_id, sum(amount) s from rain_contributions where rain_id = r.id group by user_id loop
        update profiles set balance = balance + c.s where id = c.user_id;
        insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (c.user_id, 'adjustment', 'completed', c.s, 'Rain refund', now());
      end loop;
      if not r.auto then insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'Rain ended with no participants.'); end if;
      v_per := 0;
    end if;
    update rains set status = 'settled', per_user = v_per, settled_at = now() where id = r.id;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_affiliate(p_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me profiles; v_share numeric; v_rows jsonb; v_ngr numeric; v_comm numeric;
begin
  select * into me from profiles where id = p_uid;
  v_share := coalesce(me.aff_share, (select (value)::text::numeric from settings where key = 'aff_share'), 15);
  with refs as (
    select p.id, p.username, p.created_at, p.wagered,
      coalesce((select sum(b.amount - b.payout) from bets b where b.user_id = p.id), 0) as ggr,
      coalesce((select sum(t.amount_usd) from transactions t where t.user_id = p.id and t.status = 'completed' and t.type in ('bonus','rakeback','level_reward')), 0) as bonus,
      coalesce((select sum(t.amount_usd) from transactions t where t.user_id = p.id and t.status = 'completed' and t.type = 'deposit'), 0) as deposits
    from profiles p where p.referred_by = p_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object('user', username, 'joined', created_at, 'wagered', wagered, 'deposits', deposits, 'ggr', round(ggr, 2), 'bonus', round(bonus, 2),
           'ngr', round(ggr - bonus, 2), 'commission', round(greatest(0, ggr - bonus) * v_share / 100, 2)) order by (ggr - bonus) desc), '[]'::jsonb),
         coalesce(round(sum(ggr - bonus), 2), 0)
    into v_rows, v_ngr from refs;
  v_comm := round(greatest(0, v_ngr) * v_share / 100, 2);
  return jsonb_build_object('code', me.ref_code, 'share', v_share, 'custom', me.aff_share is not null, 'referrals', v_rows, 'ngr', v_ngr,
    'commission', v_comm, 'paid', me.aff_paid, 'available', greatest(0, v_comm - me.aff_paid));
end $function$;

CREATE OR REPLACE FUNCTION public.rd_bj(r rounds, p_action text, p_params jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
        if nh = 2 then raise exception 'You can''t double after a split.'; end if;
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
        while rd_bj_total(dl) < 17 or (rd_bj_total(dl) = 17 and rd_bj_soft(dl)) loop
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
end $function$;

CREATE OR REPLACE FUNCTION public.rd_bj_soft(cs integer[])
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare t int := 0; aces int := 0; c int; rk int;
begin
  if cs is null or cardinality(cs) = 0 then return false; end if;
  foreach c in array cs loop rk := (c % 13) + 1; t := t + case when rk = 1 then 11 when rk > 10 then 10 else rk end; if rk = 1 then aces := aces + 1; end if; end loop;
  while t > 21 and aces > 0 loop t := t - 10; aces := aces - 1; end loop;
  return aces > 0;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_bj_total(cs integer[])
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare t int := 0; aces int := 0; c int; rk int;
begin
  if cs is null or cardinality(cs) = 0 then return 0; end if;
  foreach c in array cs loop rk := (c % 13) + 1; t := t + case when rk = 1 then 11 when rk > 10 then 10 else rk end; if rk = 1 then aces := aces + 1; end if; end loop;
  while t > 21 and aces > 0 loop t := t - 10; aces := aces - 1; end loop;
  return t;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_bj_val(c integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$ select case when (c % 13) + 1 = 1 then 11 when (c % 13) + 1 > 10 then 10 else (c % 13) + 1 end $function$;

CREATE OR REPLACE FUNCTION public.rd_bonus_state(p_uid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me profiles; cfg jsonb; k text; c jsonb; need numeric; last timestamptz; period interval; amt numeric; st text; avail timestamptz; w record; out jsonb := '[]';
begin
  select * into me from profiles where id = p_uid;
  select value into cfg from game_tables where key = 'bonuses';
  foreach k in array array['daily', 'weekly', 'monthly'] loop
    c := cfg->k;
    select (t->>'wager')::numeric into need from game_tables g, jsonb_array_elements(g.value) t where g.key = 'vip_tiers' and t->>'name' = c->>'minTier';
    last := (me.bonus_claims->>k)::timestamptz; avail := null; amt := 0;
    if me.wagered < coalesce(need, 0) then st := 'locked';
    elsif k = 'daily' then
      period := make_interval(hours => (c->>'hours')::int);
      amt := floor(rd_edge_since(p_uid, greatest(coalesce(last, '-infinity'::timestamptz), now() - period)) * (c->>'rate')::numeric * 100) / 100;
      if last is not null and last + period > now() then st := 'wait'; avail := last + period;
      elsif amt >= 0.01 then st := 'ready'; else st := 'empty'; end if;
    else
      select * into w from rd_bonus_window(k);
      if last is not null and last >= w.cur then st := 'wait'; avail := w.nxt;
      else
        amt := floor(rd_edge_between(p_uid, greatest(coalesce(last, '-infinity'::timestamptz), w.prev), w.cur) * (c->>'rate')::numeric * 100) / 100;
        if amt >= 0.01 then st := 'ready'; else st := 'wait'; avail := w.nxt; amt := 0; end if;
      end if;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('key', k, 'label', c->>'label', 'minTier', c->>'minTier', 'amount', amt, 'status', st, 'availableAt', avail));
  end loop;
  return out;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_bonus_window(p_key text, OUT cur timestamp with time zone, OUT prev timestamp with time zone, OUT nxt timestamp with time zone)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare tz constant text := 'America/Sao_Paulo'; loc timestamp := now() at time zone tz; d timestamp;
begin
  if p_key = 'weekly' then
    d := date_trunc('week', loc) + interval '3 days 12 hours';     -- quinta 12:00
    if d > loc then d := d - interval '7 days'; end if;
    cur := d at time zone tz; prev := (d - interval '7 days') at time zone tz; nxt := (d + interval '7 days') at time zone tz;
  else
    d := date_trunc('month', loc) + interval '12 hours';           -- dia 1, 12:00
    if d > loc then d := d - interval '1 month'; end if;
    cur := d at time zone tz; prev := (d - interval '1 month') at time zone tz; nxt := (d + interval '1 month') at time zone tz;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_cap(p_amount numeric, p_mult double precision)
 RETURNS double precision
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_max numeric;
begin
  select (value)::text::numeric into v_max from settings where key = 'max_profit';
  if coalesce(v_max, 0) > 0 and p_amount * (p_mult::numeric - 1) > v_max then return floor(((p_amount + v_max) / p_amount) * 100)::float8 / 100; end if;
  return p_mult;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_card_label(p_i integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (array['A','2','3','4','5','6','7','8','9','10','J','Q','K'])[(p_i % 13) + 1] || (array['♠','♥','♦','♣'])[(p_i / 13) + 1]
$function$;

CREATE OR REPLACE FUNCTION public.rd_cardj(p_i integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$ select jsonb_build_object('rank', (p_i % 13) + 1, 'suit', p_i / 13) $function$;

CREATE OR REPLACE FUNCTION public.rd_cardsj(cs integer[])
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$ select coalesce(jsonb_agg(public.rd_cardj(c) order by o), '[]'::jsonb) from unnest(cs) with ordinality u(c, o) $function$;

CREATE OR REPLACE FUNCTION public.rd_edge_between(p_uid uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(amount * rd_game_edge(game) / 100), 0) from bets where user_id = p_uid and created_at >= p_from and created_at < p_to
$function$;

CREATE OR REPLACE FUNCTION public.rd_edge_since(p_uid uuid, p_from timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(amount * rd_game_edge(game) / 100), 0) from bets where user_id = p_uid and created_at >= p_from
$function$;

CREATE OR REPLACE FUNCTION public.rd_float1(p_server text, p_client text, p_nonce bigint)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
declare h bytea := hmac(convert_to(p_client || ':' || p_nonce, 'UTF8'), convert_to(p_server, 'UTF8'), 'sha256');
begin
  return get_byte(h, 0)::float8 / 256 + get_byte(h, 1)::float8 / 65536 + get_byte(h, 2)::float8 / 16777216 + get_byte(h, 3)::float8 / 4294967296;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_floats(p_server text, p_client text, p_nonce bigint, p_count integer)
 RETURNS double precision[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.rd_game_edge(p_game text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_game when 'blackjack' then 0.9 when 'baccarat' then 1.1 else 2 end::numeric
$function$;

CREATE OR REPLACE FUNCTION public.rd_mines_mult(k integer, m integer)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare x float8 := 0.98; i int;
begin for i in 0 .. k - 1 loop x := x * ((25 - i)::float8 / (25 - m - i)); end loop; return floor(x * 100) / 100; end $function$;

CREATE OR REPLACE FUNCTION public.rd_prices_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
declare r record; j jsonb; m jsonb := '{"BTC":"bitcoin","ETH":"ethereum","USDT":"tether","USDC":"usd-coin","SOL":"solana","LTC":"litecoin","DOGE":"dogecoin","TRX":"tron","BNB":"binancecoin"}'; k text; usd numeric;
  fx text[] := array['brl','ars','cad','eur','gbp','mxn','clp','cop','pen','aud','jpy','inr','try','php'];
begin
  select * into r from net._http_response where status_code = 200 and content like '{"%' order by created desc limit 1;
  if found then
    begin
      j := r.content::jsonb;
      for k in select jsonb_object_keys(m) loop
        if (j->(m->>k)->>'usd') is not null then
          insert into prices(coin, usd, updated_at) values (k, (j->(m->>k)->>'usd')::numeric, r.created)
          on conflict (coin) do update set usd = excluded.usd, updated_at = excluded.updated_at where prices.updated_at < excluded.updated_at;
        end if;
      end loop;
      usd := (j->'tether'->>'usd')::numeric;
      if usd > 0 then
        foreach k in array fx loop
          if (j->'tether'->>k) is not null then
            insert into prices(coin, usd, updated_at) values ('FX:' || upper(k), round((j->'tether'->>k)::numeric / usd, 6), r.created)
            on conflict (coin) do update set usd = excluded.usd, updated_at = excluded.updated_at where prices.updated_at < excluded.updated_at;
          end if;
        end loop;
      end if;
    exception when others then null;
    end;
  end if;
  perform net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin,solana,litecoin,dogecoin,tron,binancecoin&vs_currencies=usd,' || array_to_string(fx, ','));
end $function$;

CREATE OR REPLACE FUNCTION public.rd_profile_json(p_uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('balance', balance, 'total', balance, 'wallet', wallet, 'coin', active_coin,
    'wagered', wagered, 'profit', profit, 'bets', bets_count, 'rakeback', rakeback, 'held', held) from profiles where id = p_uid
$function$;

CREATE OR REPLACE FUNCTION public.rd_round_settle(r rounds, p_mult double precision, p_win boolean, p_detail jsonb, p_payout numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.rd_seed_next()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if new.next_server_seed is null then new.next_server_seed := encode(gen_random_bytes(32), 'hex'); end if;
  if tg_op = 'INSERT' or new.next_server_seed is distinct from old.next_server_seed then
    new.next_server_hash := encode(digest(new.next_server_seed, 'sha256'), 'hex');
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_shuffle(fs double precision[], n integer, k integer)
 RETURNS integer[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare a int[] := array(select generate_series(0, n - 1)); j int; x int; t int;
begin
  for j in 0 .. k - 1 loop x := j + floor(fs[j + 1] * (n - j))::int; t := a[j + 1]; a[j + 1] := a[x + 1]; a[x + 1] := t; end loop;
  return a;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_spill_mult(p_bad integer, p_steps integer)
 RETURNS double precision
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare s float8 := 1; i int;
begin
  for i in 0 .. p_bad - 1 loop s := s * (25 - p_steps - i)::float8 / (25 - i); end loop;
  if s <= 0 then return 0; end if;
  return floor(0.98 / s * 100) / 100;
end $function$;

CREATE OR REPLACE FUNCTION public.rd_wallet_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare d numeric; c text; w jsonb; cur numeric; need numeric; k text; v numeric; total numeric;
begin
  if tg_op = 'INSERT' then
    if new.wallet = '{}' and new.balance <> 0 then new.wallet := jsonb_build_object(new.active_coin, new.balance); end if;
    return new;
  end if;
  d := new.balance - old.balance;
  if d = 0 then return new; end if;
  c := upper(coalesce(nullif(current_setting('rd.coin', true), ''), new.active_coin));
  w := coalesce(new.wallet, '{}');
  cur := coalesce((w->>c)::numeric, 0);
  if d < 0 and cur + d < -0.004 then
    -- falta nesta moeda: completa com as outras (o saldo total já foi conferido pela função que chamou)
    need := -(cur + d); w := w || jsonb_build_object(c, 0);
    for k, v in select key, value::text::numeric from jsonb_each(w) where key <> c order by value::text::numeric desc loop
      exit when need <= 0;
      w := w || jsonb_build_object(k, round(v - least(v, need), 2)); need := need - least(v, need);
    end loop;
  else
    w := w || jsonb_build_object(c, round(cur + d, 2));
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}') into w from jsonb_each(w) where abs(value::text::numeric) >= 0.005 or key = new.active_coin;
  select coalesce(sum(value::text::numeric), 0) into total from jsonb_each(w);
  if abs(total - new.balance) >= 0.005 then w := w || jsonb_build_object(new.active_coin, round(coalesce((w->>new.active_coin)::numeric, 0) + new.balance - total, 2)); end if;
  new.wallet := w;
  return new;
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

CREATE OR REPLACE FUNCTION public.request_deposit(p_coin text, p_network text, p_amount_usd numeric, p_tx_hash text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_min numeric; v_id bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select greatest(min_deposit, (select (value)::text::numeric from settings where key = 'min_deposit'))
    into v_min from wallets where coin = p_coin and network = p_network and enabled;
  if v_min is null then raise exception 'coin/network not accepted'; end if;
  if p_amount_usd < v_min then raise exception 'minimum deposit is %', v_min; end if;
  if coalesce(trim(p_tx_hash), '') = '' then raise exception 'transaction hash required'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, tx_hash)
    values (auth.uid(), 'deposit', round(p_amount_usd, 2), p_coin, p_network, trim(p_tx_hash)) returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_coin text, p_network text, p_amount_usd numeric, p_address text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; v_lim numeric; v_kyc text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform set_config('rd.coin', upper(coalesce(p_coin, '')), true);
  if p_amount_usd <= 0 then raise exception 'invalid amount'; end if;
  select (value)::text::numeric into v_lim from settings where key = 'kyc_withdraw_limit';
  select kyc into v_kyc from profiles where id = auth.uid();
  if coalesce(v_lim, 0) > 0 and p_amount_usd > v_lim and v_kyc <> 'verified' then
    raise exception 'Withdrawals above $% require identity verification.', to_char(v_lim, 'FM999999990');
  end if;
  update profiles set balance = balance - round(p_amount_usd, 2)
    where id = auth.uid() and status = 'active' and balance >= round(p_amount_usd, 2);
  if not found then raise exception 'insufficient balance'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, address)
    values (auth.uid(), 'withdrawal', round(p_amount_usd, 2), p_coin, p_network, trim(p_address)) returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.rotate_seed(p_client text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare s seeds; v_client text := nullif(left(trim(coalesce(p_client, '')), 64), '');
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists(select 1 from rounds where user_id = auth.uid()) then raise exception 'Finish your open rounds before rotating seeds.'; end if;
  select * into s from seeds where user_id = auth.uid() for update;
  update seeds set
    revealed = (jsonb_build_array(jsonb_build_object('server', s.server_seed, 'client', s.client_seed, 'lastNonce', s.nonce - 1, 'at', now())) || coalesce(s.revealed, '[]'::jsonb)) - 20,
    server_seed = coalesce(s.next_server_seed, encode(gen_random_bytes(32), 'hex')),
    server_hash = encode(digest(coalesce(s.next_server_seed, encode(gen_random_bytes(32), 'hex')), 'sha256'), 'hex'),
    next_server_seed = encode(gen_random_bytes(32), 'hex'),
    client_seed = coalesce(v_client, encode(gen_random_bytes(8), 'hex')), nonce = 0
  where user_id = auth.uid() returning * into s;
  return jsonb_build_object('hash', s.server_hash, 'next', s.next_server_hash, 'client', s.client_seed, 'nonce', s.nonce, 'revealed', s.revealed);
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
    if p_action not in ('hit', 'stand', 'double', 'split', 'insurance', 'view') then raise exception 'Invalid action.'; end if;
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
          v_mult := floor(v_mult * (0.98 / v_p) * 100) / 100;
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

  elsif p_game in ('spill', 'pump') then
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
  elsif p_game = 'lake' then
    -- Cross the Lake: segura 96%, média 80%, arriscada 59%; multiplicador = 0,98 / chance acumulada
    v_steps := (st->>'steps')::int; v_mult := (st->>'mult')::float8;
    if p_action = 'jump' then
      v_p := case p_params->>'pad' when 'safe' then 0.96 when 'mid' then 0.8 when 'risky' then 0.59 else null end;
      if v_p is null then raise exception 'Pick a lily pad.'; end if;
      if v_steps >= 20 then raise exception 'You crossed the lake. Cash out!'; end if;
      fs := rd_floats(r.server_seed, r.client_seed, r.nonce, v_steps + 1);
      v_steps := v_steps + 1;
      if fs[v_steps] >= v_p then
        bet := rd_round_settle(r, 0, false, jsonb_build_object('steps', v_steps, 'sank', v_steps, 'path', coalesce(st->'path', '[]'::jsonb) || to_jsonb(p_params->>'pad')));
        res := jsonb_build_object('ok', false, 'steps', v_steps, 'roll', fs[v_steps], 'bet', bet);
      else
        v_mult := v_mult / v_p;
        st := jsonb_build_object('steps', v_steps, 'mult', v_mult, 'path', coalesce(st->'path', '[]'::jsonb) || to_jsonb(p_params->>'pad'));
        update rounds set state = st where user_id = v_uid and game = p_game;
        if v_steps = 20 then
          bet := rd_round_settle(r, floor(v_mult * 100 + 1e-9) / 100, true, jsonb_build_object('steps', v_steps, 'path', st->'path'));
          res := jsonb_build_object('ok', true, 'steps', v_steps, 'roll', fs[v_steps], 'bet', bet);
        else
          res := jsonb_build_object('ok', true, 'steps', v_steps, 'roll', fs[v_steps], 'state', st);
        end if;
      end if;
    elsif p_action = 'cashout' then
      if v_steps < 1 then raise exception 'Jump at least once first.'; end if;
      bet := rd_round_settle(r, floor(v_mult * 100 + 1e-9) / 100, true, jsonb_build_object('steps', v_steps, 'path', st->'path'));
      res := jsonb_build_object('bet', bet);
    else raise exception 'Invalid action.'; end if;

  elsif p_game = 'crash' then
    -- O ponto do crash nunca sai daqui antes de a rodada acabar
    f := rd_float1(r.server_seed, r.client_seed, r.nonce);
    v_crash := greatest(1, floor((0.98 / greatest(f, 1e-8)) * 100) / 100);
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

CREATE OR REPLACE FUNCTION public.set_active_coin(p_coin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text := upper(trim(coalesce(p_coin, '')));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if c <> all(array['USDT','USDC','BTC','ETH','SOL','LTC','DOGE','TRX']) then raise exception 'Unknown coin.'; end if;
  if exists(select 1 from rounds where user_id = auth.uid()) then raise exception 'Finish your open game first.'; end if;
  update profiles set active_coin = c where id = auth.uid();
  return public.rd_profile_json(auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION public.support_seen()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update support_threads set unread_user = 0 where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.support_send(p_text text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v text := trim(coalesce(p_text, '')); v_id bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to chat with us.'; end if;
  if v = '' then raise exception 'Type a message.'; end if;
  if length(v) > 1000 then raise exception 'Max 1000 characters.'; end if;
  if (select count(*) from support_messages where user_id = auth.uid() and not from_staff and created_at > now() - interval '1 minute') >= 15 then raise exception 'Slow down a little.'; end if;
  insert into support_messages(user_id, text) values (auth.uid(), v) returning id into v_id;
  insert into support_threads(user_id, status, last_at, last_text, unread_staff) values (auth.uid(), 'open', now(), left(v, 140), 1)
    on conflict (user_id) do update set status = 'open', last_at = now(), last_text = left(v, 140), unread_staff = support_threads.unread_staff + 1;
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

CREATE OR REPLACE FUNCTION public.username_available(p_username text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select not exists(select 1 from profiles where lower(username) = lower(p_username)) $function$;

-- game_tables
insert into game_tables(key, value) values ('bonuses', $j${"daily":{"rate":0.03,"hours":24,"label":"Daily Bonus","minTier":"Bronze 2"},"weekly":{"rate":0.04,"hours":168,"label":"Weekly Bonus","minTier":"Silver 1"},"monthly":{"rate":0.05,"hours":720,"label":"Monthly Bonus","minTier":"Silver 1"}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('chicken', $j${"easy":{"mult":[1,1.03,1.08,1.15,1.22,1.3,1.4,1.5,1.63,1.78,1.96,2.17,2.45,2.8,3.26,3.92,4.9,6.53,9.8,19.6],"bones":1},"hard":{"mult":[1,1.3,1.77,2.45,3.47,5.05,7.58,11.8,19.18,32.88,60.29,120.58,271.32,723.52,2532.32,15193.92],"bones":5},"expert":{"mult":[1,1.96,4.13,9.31,22.61,60.29,180.88,633.08,2743.34,16460.08,181060.88],"bones":10},"medium":{"mult":[1,1.15,1.36,1.64,1.99,2.45,3.06,3.9,5.07,6.77,9.31,13.3,19.95,31.92,55.86,111.72,279.3,1117.2],"bones":3}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('door', $j${"easy":{"bad":1,"mult":[1,1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05,17.4],"doors":4},"hard":{"bad":1,"mult":[1,1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76,1003.52],"doors":2},"expert":{"bad":2,"mult":[1,2.94,8.82,26.46,79.38,238.14,714.42,2143.25,6429.78,19289.34,57868.02],"doors":3},"medium":{"bad":1,"mult":[1,1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67,56.51],"doors":3}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('keno', $j${"low":[[0.69,1.85],[0,2,3.65],[0,1.1,1.32,25.96],[0,0,2.19,7.72,90],[0,0,1.5,4.11,13,295],[0,0,1.1,1.93,6.2,100,678],[0,0,1.1,1.6,3.5,14.84,200,700],[0,0,1.1,1.5,1.88,5.42,39,100,800],[0,0,1.1,1.3,1.63,2.38,7.5,50,250,1000],[0,0,1.1,1.2,1.3,1.62,3.5,13,50,250,1000]],"high":[[0,3.92],[0,0,16.98],[0,0,0,80.68],[0,0,0,9.77,259],[0,0,0,4.5,47.99,427],[0,0,0,0,10.58,350,710],[0,0,0,0,6.93,90,381,800],[0,0,0,0,5,19.28,270,600,900],[0,0,0,0,4,10.86,56,468,800,1000],[0,0,0,0,3.5,7.77,12.95,63,500,800,1000]],"medium":[[0.39,2.75],[0,1.79,5.05],[0,0,2.74,49.86],[0,0,1.68,9.91,100],[0,0,1.4,3.9,14,386],[0,0,0,3,8.98,176,710],[0,0,0,2,6.93,30,381,800],[0,0,0,2,3.88,10.98,67,400,900],[0,0,0,2,2.43,4.93,15,100,500,1000],[0,0,0,1.6,2,3.77,7,26,100,500,1000]],"classic":[[0,3.92],[0,1.9,4.32],[0,1,3.1,9.56],[0,0.8,1.8,4.76,22.43],[0,0.23,1.4,4.1,16.34,36],[0,0,0.97,3.68,7,16.48,40],[0,0,0.47,2.95,4.5,13.83,31,60],[0,0,0,2.2,4,12.23,22,55,70],[0,0,0,1.53,3,7.82,15,44,60,85],[0,0,0,1.4,2.18,4.5,8,16.86,50,80,100]]}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('plinko', $j${"8":{"low":[5.5,1.95,1.1,1,0.5,1,1.1,1.95,5.5],"high":[29,4,1.45,0.3,0.2,0.3,1.45,4,29],"medium":[13,2.85,1.3,0.7,0.4,0.7,1.3,2.85,13]},"9":{"low":[5.3,1.75,1.6,1,0.7,0.7,1,1.6,1.75,5.3],"high":[42.5,6.75,2,0.6,0.2,0.2,0.6,2,6.75,42.5],"medium":[15.5,3.95,1.7,0.9,0.5,0.5,0.9,1.7,3.95,15.5]},"10":{"low":[8.75,2.5,1.4,1.1,1,0.5,1,1.1,1.4,2.5,8.75],"high":[76,9.45,3,0.9,0.3,0.2,0.3,0.9,3,9.45,76],"medium":[22,4.75,1.95,1.4,0.6,0.4,0.6,1.4,1.95,4.75,22]},"11":{"low":[8,2.85,1.9,1.25,1,0.7,0.7,1,1.25,1.9,2.85,8],"high":[108,14,5.2,1.4,0.4,0.2,0.2,0.4,1.4,5.2,14,108],"medium":[19,6,2.9,1.8,0.7,0.5,0.5,0.7,1.8,2.9,6,19]},"12":{"low":[10,2.7,1.35,1.4,1.1,1,0.5,1,1.1,1.4,1.35,2.7,10],"high":[169,23,7.95,2,0.7,0.2,0.2,0.2,0.7,2,7.95,23,169],"medium":[32.5,11,3.7,2,1.1,0.6,0.3,0.6,1.1,2,3.7,11,32.5]},"13":{"low":[8.1,3.6,3,1.9,1.15,0.9,0.7,0.7,0.9,1.15,1.9,3,3.6,8.1],"high":[257,36,11,3.9,1,0.2,0.2,0.2,0.2,1,3.9,11,36,257],"medium":[38,13,6,3,1.25,0.7,0.4,0.4,0.7,1.25,3,6,13,38]},"14":{"low":[7.05,4,1.8,1.2,1.3,1.1,1,0.5,1,1.1,1.3,1.2,1.8,4,7.05],"high":[414,52,18,4.95,1.9,0.3,0.2,0.2,0.2,0.3,1.9,4.95,18,52,414],"medium":[52.5,9.9,6.95,4,1.9,1,0.5,0.2,0.5,1,1.9,4,6.95,9.9,52.5]},"15":{"low":[10,8,3,1.65,1.5,1.1,1,0.7,0.7,1,1.1,1.5,1.65,3,8,10],"high":[611,83,27,7.65,3,0.5,0.2,0.2,0.2,0.2,0.5,3,7.65,27,83,611],"medium":[83.5,18,11,4.65,3,1.3,0.5,0.3,0.3,0.5,1.3,3,4.65,11,18,83.5]},"16":{"low":[16,8.65,2,1.4,1.4,1.2,1.1,1,0.45,1,1.1,1.2,1.4,1.4,2,8.65,16],"high":[1000,130,24.5,8.75,4,2,0.2,0.2,0.2,0.2,0.2,2,4,8.75,24.5,130,1000],"medium":[110,40,10,4.45,3,1.5,1,0.5,0.3,0.5,1,1.5,3,4.45,10,40,110]}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('soccer', $j${"easy":{"mult":[1,1.22,1.53,1.91,2.39,2.99,3.73,4.67,5.84,7.3,9.12],"block":1,"kicks":10},"hard":{"mult":[1,2.45,6.12,15.31,38.28,95.7,239.25,598.14,1495.36],"block":3,"kicks":8},"expert":{"mult":[1,4.9,24.5,122.5,612.5,3062.5,15312.5],"block":4,"kicks":6},"medium":{"mult":[1,1.63,2.72,4.53,7.56,12.6,21,35,58.34,97.24,162.07],"block":2,"kicks":10}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('tower', $j${"easy":{"eggs":3,"mult":[1.3,1.74,2.32,3.09,4.12,5.5,7.34,9.78,13.05],"tiles":4},"hard":{"eggs":1,"mult":[1.96,3.92,7.84,15.68,31.36,62.72,125.44,250.88,501.76],"tiles":2},"expert":{"eggs":1,"mult":[2.94,8.82,26.46,79.38,238.14,714.42,2143.26,6429.78,19289.34],"tiles":3},"master":{"eggs":1,"mult":[3.92,15.68,62.72,250.88,1003.52,4014.08,16056.32,64225.28,256901.12],"tiles":4},"medium":{"eggs":2,"mult":[1.47,2.2,3.3,4.96,7.44,11.16,16.74,25.11,37.67],"tiles":3}}$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('vip_tiers', $j$[{"name":"Bronze 1","wager":1000,"reward":2},{"name":"Bronze 2","wager":5000,"reward":4},{"name":"Bronze 3","wager":15000,"reward":10},{"name":"Bronze 4","wager":50000,"reward":35},{"name":"Silver 1","wager":100000,"reward":50},{"name":"Silver 2","wager":150000,"reward":50},{"name":"Silver 3","wager":200000,"reward":50},{"name":"Silver 4","wager":250000,"reward":50},{"name":"Gold 1","wager":300000,"reward":50},{"name":"Gold 2","wager":350000,"reward":50},{"name":"Gold 3","wager":400000,"reward":50},{"name":"Gold 4","wager":450000,"reward":50},{"name":"Jade 1","wager":500000,"reward":50},{"name":"Jade 2","wager":600000,"reward":100},{"name":"Jade 3","wager":700000,"reward":100},{"name":"Jade 4","wager":800000,"reward":100},{"name":"Jade 5","wager":900000,"reward":100},{"name":"Sapphire 1","wager":1000000,"reward":100},{"name":"Sapphire 2","wager":1500000,"reward":500},{"name":"Emerald 1","wager":2000000,"reward":500},{"name":"Emerald 2","wager":2500000,"reward":500},{"name":"Ruby 1","wager":3000000,"reward":500},{"name":"Ruby 2","wager":3500000,"reward":500},{"name":"Obsidian 1","wager":4000000,"reward":500},{"name":"Obsidian 2","wager":4500000,"reward":500},{"name":"Amethyst 1","wager":5000000,"reward":500},{"name":"Amethyst 2","wager":7500000,"reward":2500},{"name":"Amethyst 3","wager":10000000,"reward":2500}]$j$::jsonb) on conflict (key) do update set value = excluded.value;
insert into game_tables(key, value) values ('wheel_medium', $j${"10":[0,1.8,0,1.5,0,2,0,1.5,0,3],"20":[1.4,0,2,0,2,0,2,0,1.4,0,3,0,1.8,0,2,0,2,0,2,0],"30":[1.5,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.4,0,4,0,1.5,0,2,0],"40":[2,0,3,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,2,0,1.2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0],"50":[2,0,1.5,0,2,0,1.5,0,3,0,1.5,0,1.5,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,2,0,2,0,1.5,0,3,0,1.5,0,2,0,1.5,0,1.5,0,4.5,0,1.5,0,2,0,1.5,0]}$j$::jsonb) on conflict (key) do update set value = excluded.value;
