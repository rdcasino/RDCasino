-- Cadastro aberto: o convite deixa de ser obrigatório.
-- Se a pessoa usar um código (ex.: convite de admin), ele precisa ser válido e é marcado como usado.
create or replace function public.before_signup()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

create or replace function public.after_signup()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
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
end $$;
