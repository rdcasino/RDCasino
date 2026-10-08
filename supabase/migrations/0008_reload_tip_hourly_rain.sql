-- =====================================================================
-- VIP Reload dado pelo admin, Tip entre jogadores e Chuva automática de hora em hora
-- =====================================================================

-- ---------- VIP Reload: só existe quando o admin dá ----------
-- O jogador resgata "per_claim" uma vez a cada "interval_hours", até "claims" vezes.
create table if not exists public.vip_reloads (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  per_claim      numeric(18,2) not null check (per_claim > 0),
  claims         int not null check (claims between 1 and 365),
  used           int not null default 0,
  interval_hours int not null default 24 check (interval_hours between 1 and 720),
  note           text,
  status         text not null default 'active' check (status in ('active','done','cancelled')),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  last_claim_at  timestamptz
);
create unique index if not exists one_active_reload on public.vip_reloads(user_id) where status = 'active';
alter table public.vip_reloads enable row level security;
drop policy if exists own_reload on public.vip_reloads;
create policy own_reload on public.vip_reloads for select using (user_id = auth.uid() or public.is_admin());
grant select on public.vip_reloads to authenticated;

create or replace function public.admin_grant_reload(p_user uuid, p_per numeric, p_claims int, p_hours int default 24, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if round(p_per, 2) <= 0 or p_claims < 1 or p_claims > 365 or p_hours < 1 or p_hours > 720 then raise exception 'Valores inválidos.'; end if;
  update vip_reloads set status = 'cancelled' where user_id = p_user and status = 'active';
  insert into vip_reloads(user_id, per_claim, claims, interval_hours, note, created_by)
    values (p_user, round(p_per, 2), p_claims, p_hours, p_note, auth.uid()) returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'grant vip reload', jsonb_build_object('user', p_user, 'per_claim', p_per, 'claims', p_claims, 'hours', p_hours));
  return v_id;
end $$;

create or replace function public.admin_cancel_reload(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update vip_reloads set status = 'cancelled' where user_id = p_user and status = 'active';
  insert into audit_log(who, what, data) values (auth.uid(), 'cancel vip reload', jsonb_build_object('user', p_user));
end $$;

create or replace function public.claim_reload()
returns numeric language plpgsql security definer set search_path = public as $$
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
end $$;

-- ---------- Tip (gorjeta) entre jogadores ----------
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind in ('user','system','rain','tip'));

create or replace function public.tip_send(p_to text, p_amount numeric, p_public boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric := round(coalesce(p_amount, 0), 2); me profiles; dest profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
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
end $$;
revoke all on function public.admin_grant_reload(uuid, numeric, int, int, text), public.admin_cancel_reload(uuid), public.claim_reload(), public.tip_send(text, numeric, boolean) from public, anon;
grant execute on function public.admin_grant_reload(uuid, numeric, int, int, text), public.admin_cancel_reload(uuid), public.claim_reload(), public.tip_send(text, numeric, boolean) to authenticated;

-- ---------- Chuva automática de hora em hora ----------
-- Sempre tem uma chuva aberta, que acaba na virada da hora. O pote começa com o
-- valor da casa (configurável no admin) e os jogadores podem aumentar.
alter table public.rains add column if not exists auto boolean not null default false;
insert into public.settings(key, value) values ('rain_auto', '{"enabled": true, "amount": 1, "min_wager": 10}')
  on conflict (key) do nothing;

-- Chuva automática sem ninguém: encerra em silêncio (sem mensagem no chat a cada hora)
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
      if not r.auto then insert into chat_messages(username, kind, text) values ('Rain', 'rain', 'Rain ended with no participants.'); end if;
      v_per := 0;
    end if;
    update rains set status = 'settled', per_user = v_per, settled_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public.rain_auto_tick()
returns void language plpgsql security definer set search_path = public as $$
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
end $$;
grant execute on function public.rain_auto_tick() to anon, authenticated;

create or replace function public.admin_set_rain_auto(p_enabled boolean, p_amount numeric, p_min_wager numeric)
returns void language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.admin_set_rain_auto(boolean, numeric, numeric) from public, anon;
grant execute on function public.admin_set_rain_auto(boolean, numeric, numeric) to authenticated;

-- Admin "Começar chuva": se já tem uma aberta (a automática), o valor entra no pote dela
create or replace function public.admin_start_rain(p_amount numeric, p_minutes int, p_min_wager numeric default 100)
returns bigint language plpgsql security definer set search_path = public as $$
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
end $$;

-- O relógio (pg_cron) passa a fechar a chuva vencida e abrir a próxima, a cada minuto
do $$ begin
  perform cron.unschedule('rain-settle');
exception when others then null; end $$;
select cron.schedule('rain-settle', '* * * * *', $$select public.rain_auto_tick()$$);
select public.rain_auto_tick();
