-- =====================================================================
-- Cadastro só com convite + criação automática do perfil
-- O site chama supabase.auth.signUp com:
--   options.data = { username, country, invite, ref }
-- O banco recusa a conta se o convite não for válido (antes de criar),
-- e cria o perfil + seeds de provably fair logo depois.
-- =====================================================================

alter table public.invites add column if not exists is_admin boolean not null default false;

-- Nome de usuário livre? (o site checa antes de mandar o cadastro)
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as
$$ select not exists(select 1 from profiles where lower(username) = lower(p_username)) $$;
grant execute on function public.username_available(text) to anon, authenticated;

-- 1) Antes de criar a conta: valida convite, nome de usuário, país e código de indicação
create or replace function public.before_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_inv invites;
  v_user text := trim(coalesce(m->>'username', ''));
  v_country text := trim(coalesce(m->>'country', ''));
  v_ref text := upper(trim(coalesce(m->>'ref', '')));
begin
  select * into v_inv from invites where code = upper(trim(coalesce(m->>'invite', ''))) and used_by is null;
  if not found then raise exception 'Invalid or already used invite code.'; end if;
  if v_user !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'Username: 3-16 letters, numbers or _.'; end if;
  if exists(select 1 from profiles where lower(username) = lower(v_user)) then raise exception 'This username is already taken.'; end if;
  if v_country = '' then raise exception 'Choose your country.'; end if;
  if exists(select 1 from settings s, jsonb_array_elements_text(s.value) c where s.key = 'restricted_countries' and lower(c) = lower(v_country)) then
    raise exception 'We can''t accept players from this country.';
  end if;
  if v_ref <> '' and not exists(select 1 from profiles where ref_code = v_ref) then raise exception 'Referral code not found.'; end if;
  return new;
end $$;

-- 2) Depois de criar a conta: perfil, seeds, convite usado, admin (se o convite for de admin)
create or replace function public.after_signup()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := upper(trim(coalesce(m->>'invite', '')));
  v_ref text := upper(trim(coalesce(m->>'ref', '')));
  v_refid uuid; v_admin boolean; v_server text; v_mycode text;
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
  update invites set used_by = new.id, used_at = now() where code = v_code returning is_admin into v_admin;
  if v_admin then insert into admins(user_id) values (new.id) on conflict do nothing; end if;
  insert into audit_log(who, what, data) values (new.id, 'signup', jsonb_build_object('username', m->>'username', 'invite', v_code));
  return new;
end $$;

drop trigger if exists rd_before_signup on auth.users;
create trigger rd_before_signup before insert on auth.users for each row execute function public.before_signup();
drop trigger if exists rd_after_signup on auth.users;
create trigger rd_after_signup after insert on auth.users for each row execute function public.after_signup();

-- Admin: gerar convites (códigos de 8 caracteres, fáceis de ditar)
create or replace function public.admin_create_invites(p_count int, p_note text default null)
returns setof text language plpgsql security definer set search_path = public, extensions as $$
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
end $$;
revoke all on function public.admin_create_invites(int, text) from public, anon;
grant execute on function public.admin_create_invites(int, text) to authenticated;

-- Admin: ler convites (com quem usou)
create or replace view public.invites_admin with (security_invoker = true) as
  select i.code, i.note, i.is_admin, i.created_at, i.used_at, p.username as used_by_username
  from invites i left join profiles p on p.id = i.used_by;
grant select on public.invites_admin to authenticated;

-- Admin: suspender/reativar e anotar
create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update profiles set status = p_status where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), 'set status', jsonb_build_object('user', p_user, 'status', p_status));
end $$;
create or replace function public.admin_set_note(p_user uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update profiles set note = p_note where id = p_user;
end $$;
revoke all on function public.admin_set_status(uuid, text), public.admin_set_note(uuid, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text), public.admin_set_note(uuid, text) to authenticated;

-- E-mail do jogador para o admin (fica em auth.users, que o navegador não lê)
create or replace function public.admin_player_emails()
returns table(id uuid, email text, last_sign_in timestamptz) language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query select u.id, u.email::text, u.last_sign_in_at from auth.users u;
end $$;
revoke all on function public.admin_player_emails() from public, anon;
grant execute on function public.admin_player_emails() to authenticated;
