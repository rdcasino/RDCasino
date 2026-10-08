-- =====================================================================
-- Chat em tempo real + Chuva (Rain)
-- Chat: qualquer pessoa lê; só jogador logado e ativo escreve (1 msg a cada 2s, até 200 caracteres).
-- Chuva: um pote (da casa e/ou de jogadores) dividido igualmente entre quem
-- clicou "Participar" antes do tempo acabar. Para evitar contas falsas, só
-- participa quem já apostou um mínimo.
-- =====================================================================

create table if not exists public.chat_messages (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  username   text not null,
  kind       text not null default 'user' check (kind in ('user','system','rain')),
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_recent_idx on public.chat_messages(created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select using (true);
grant select on public.chat_messages to anon, authenticated;

create or replace function public.chat_send(p_text text)
returns bigint language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.chat_send(text) from public, anon;
grant execute on function public.chat_send(text) to authenticated;

-- ---------- Chuva ----------
create table if not exists public.rains (
  id            bigserial primary key,
  amount        numeric(18,2) not null default 0,     -- pote total (casa + jogadores)
  house_amount  numeric(18,2) not null default 0,
  participants  int not null default 0,
  min_wager     numeric(18,2) not null default 100,   -- apostado (total) para poder participar
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz not null,
  status        text not null default 'open' check (status in ('open','settled')),
  per_user      numeric(18,2),
  created_by    uuid,
  settled_at    timestamptz
);
create unique index if not exists one_open_rain on public.rains((status)) where status = 'open';
create table if not exists public.rain_entries (
  rain_id bigint references public.rains(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (rain_id, user_id)
);
create table if not exists public.rain_contributions (
  id bigserial primary key,
  rain_id bigint references public.rains(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now()
);
alter table public.rains enable row level security;
alter table public.rain_entries enable row level security;
alter table public.rain_contributions enable row level security;
drop policy if exists rains_read on public.rains;
create policy rains_read on public.rains for select using (true);
drop policy if exists rain_entries_read on public.rain_entries;
create policy rain_entries_read on public.rain_entries for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists rain_contrib_read on public.rain_contributions;
create policy rain_contrib_read on public.rain_contributions for select using (true);
grant select on public.rains, public.rain_contributions to anon, authenticated;
grant select on public.rain_entries to authenticated;

-- Admin começa uma chuva paga pela casa
create or replace function public.admin_start_rain(p_amount numeric, p_minutes int, p_min_wager numeric default 100)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  perform public.rain_settle();
  if exists(select 1 from rains where status = 'open') then raise exception 'There is already a rain running.'; end if;
  if p_amount <= 0 or p_minutes < 1 or p_minutes > 1440 then raise exception 'Invalid amount or duration.'; end if;
  insert into rains(amount, house_amount, min_wager, ends_at, created_by)
    values (round(p_amount, 2), round(p_amount, 2), greatest(p_min_wager, 0), now() + make_interval(mins => p_minutes), auth.uid()) returning id into v_id;
  insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'A $' || round(p_amount, 2) || ' rain started! Join in the next ' || p_minutes || ' min.');
  insert into audit_log(who, what, data) values (auth.uid(), 'start rain', jsonb_build_object('rain', v_id, 'usd', p_amount, 'minutes', p_minutes, 'min_wager', p_min_wager));
  return v_id;
end $$;

create or replace function public.rain_join()
returns void language plpgsql security definer set search_path = public as $$
declare r rains; p profiles;
begin
  if auth.uid() is null then raise exception 'Sign in to join the rain.'; end if;
  perform public.rain_settle();
  select * into r from rains where status = 'open' for update;
  if not found or r.ends_at <= now() then raise exception 'No rain running right now.'; end if;
  select * into p from profiles where id = auth.uid();
  if p.status <> 'active' then raise exception 'Your account is suspended.'; end if;
  if p.wagered < r.min_wager then raise exception 'Wager at least $% to join rains.', r.min_wager; end if;
  insert into rain_entries(rain_id, user_id) values (r.id, auth.uid()) on conflict do nothing;
  if found then update rains set participants = participants + 1 where id = r.id; end if;
end $$;

-- Jogador coloca dinheiro no pote (sai do saldo dele)
create or replace function public.rain_contribute(p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
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
end $$;

-- Encerra chuvas vencidas e divide o pote (idempotente; roda a cada minuto e também quando alguém interage)
create or replace function public.rain_settle()
returns void language plpgsql security definer set search_path = public as $$
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
      insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'Rain ended with no participants.');
      v_per := 0;
    end if;
    update rains set status = 'settled', per_user = v_per, settled_at = now() where id = r.id;
  end loop;
end $$;

revoke all on function public.admin_start_rain(numeric, int, numeric), public.rain_join(), public.rain_contribute(numeric) from public, anon;
grant execute on function public.admin_start_rain(numeric, int, numeric), public.rain_join(), public.rain_contribute(numeric) to authenticated;
grant execute on function public.rain_settle() to anon, authenticated;

-- Tempo real: o site recebe novas mensagens e mudanças da chuva na hora
do $$ begin
  begin alter publication supabase_realtime add table public.chat_messages; exception when others then null; end;
  begin alter publication supabase_realtime add table public.rains; exception when others then null; end;
end $$;
