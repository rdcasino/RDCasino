-- =====================================================================
-- Suporte ao vivo (estilo Shuffle) e tag do dono/equipe
-- Cada jogador tem uma conversa com a equipe; o admin responde em Suporte.
-- =====================================================================

-- ---------- Equipe: nomes que ganham a tag de diamante ----------
create or replace function public.public_staff()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.username), '{}') from admins a join profiles p on p.id = a.user_id
$$;
grant execute on function public.public_staff() to anon, authenticated;

-- ---------- Conversas ----------
create table if not exists public.support_threads (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  status       text not null default 'open' check (status in ('open', 'closed')),
  last_at      timestamptz not null default now(),
  last_text    text,
  unread_staff int not null default 0,
  unread_user  int not null default 0
);
create table if not exists public.support_messages (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  from_staff  boolean not null default false,
  staff_name  text,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists support_msg_user_idx on public.support_messages(user_id, id);
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists support_threads_read on public.support_threads;
create policy support_threads_read on public.support_threads for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists support_msg_read on public.support_messages;
create policy support_msg_read on public.support_messages for select using (user_id = auth.uid() or public.is_admin());
grant select on public.support_threads, public.support_messages to authenticated;

create or replace function public.support_send(p_text text)
returns bigint language plpgsql security definer set search_path = public as $$
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
end $$;
create or replace function public.support_seen()
returns void language sql security definer set search_path = public as $$
  update support_threads set unread_user = 0 where user_id = auth.uid()
$$;
create or replace function public.admin_support_reply(p_user uuid, p_text text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v text := trim(coalesce(p_text, '')); v_id bigint; v_name text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v = '' then raise exception 'Digite a mensagem.'; end if;
  select username into v_name from profiles where id = auth.uid();
  insert into support_messages(user_id, from_staff, staff_name, text) values (p_user, true, coalesce(v_name, 'RD Support'), left(v, 2000)) returning id into v_id;
  insert into support_threads(user_id, status, last_at, last_text, unread_user, unread_staff) values (p_user, 'open', now(), left(v, 140), 1, 0)
    on conflict (user_id) do update set last_at = now(), last_text = left(v, 140), unread_user = support_threads.unread_user + 1, unread_staff = 0;
  return v_id;
end $$;
create or replace function public.admin_support_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update support_threads set status = p_status, unread_staff = case when p_status = 'closed' then 0 else unread_staff end where user_id = p_user;
end $$;
create or replace function public.admin_support_seen(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update support_threads set unread_staff = 0 where user_id = p_user;
end $$;
revoke all on function public.support_send(text), public.support_seen(), public.admin_support_reply(uuid, text), public.admin_support_status(uuid, text), public.admin_support_seen(uuid) from public, anon;
grant execute on function public.support_send(text), public.support_seen(), public.admin_support_reply(uuid, text), public.admin_support_status(uuid, text), public.admin_support_seen(uuid) to authenticated;

-- Tempo real (respeita as regras de leitura: cada jogador só recebe a própria conversa)
do $$ begin
  begin alter publication supabase_realtime add table public.support_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.support_threads; exception when others then null; end;
end $$;
