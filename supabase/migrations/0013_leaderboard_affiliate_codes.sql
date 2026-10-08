-- =====================================================================
-- Leaderboard do mês, afiliados (rev share 15%) e códigos promocionais
-- =====================================================================

-- ---------- Leaderboard: top 10 por valor apostado no mês (UTC) ----------
create or replace function public.leaderboard_month()
returns table(username text, wagered numeric) language sql stable security definer set search_path = public as $$
  select p.username, round(sum(b.amount), 2) from bets b join profiles p on p.id = b.user_id
  where b.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  group by p.username order by 2 desc limit 50
$$;
grant execute on function public.leaderboard_month() to anon, authenticated;

-- ---------- Afiliados ----------
-- NGR de cada indicado = (apostado − pago pelos jogos) − bônus que ele recebeu (bônus, rakeback, prêmio de nível)
-- Comissão = rev share × NGR total (se o total for negativo, não paga nada até voltar a ficar positivo)
alter table public.profiles add column if not exists aff_share numeric(5,2);
alter table public.profiles add column if not exists aff_paid numeric(18,2) not null default 0;
insert into public.settings(key, value) values ('aff_share', '15') on conflict (key) do nothing;

create or replace function public.rd_affiliate(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
end $$;
revoke all on function public.rd_affiliate(uuid) from public, anon, authenticated;

create or replace function public.my_affiliate()
returns jsonb language sql stable security definer set search_path = public as $$ select public.rd_affiliate(auth.uid()) $$;
grant execute on function public.my_affiliate() to authenticated;

create or replace function public.affiliate_collect()
returns numeric language plpgsql security definer set search_path = public as $$
declare a jsonb; v numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  perform 1 from profiles where id = auth.uid() for update;
  a := rd_affiliate(auth.uid()); v := (a->>'available')::numeric;
  if v < 1 then raise exception 'You need at least $1 to collect.'; end if;
  update profiles set balance = balance + v, aff_paid = aff_paid + v where id = auth.uid();
  insert into transactions(user_id, type, status, amount_usd, note, decided_at) values (auth.uid(), 'commission', 'completed', v, 'Affiliate commission', now());
  return v;
end $$;
revoke all on function public.affiliate_collect() from public, anon;
grant execute on function public.affiliate_collect() to authenticated;

create or replace function public.admin_set_aff_share(p_user uuid, p_share numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_share is not null and (p_share < 0 or p_share > 70) then raise exception 'Valor inválido.'; end if;
  update profiles set aff_share = p_share where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), 'affiliate share', jsonb_build_object('user', p_user, 'share', p_share));
end $$;
revoke all on function public.admin_set_aff_share(uuid, numeric) from public, anon;
grant execute on function public.admin_set_aff_share(uuid, numeric) to authenticated;

-- ---------- Códigos promocionais ----------
create table if not exists public.promo_codes (
  code        text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  amount      numeric(18,2) not null check (amount > 0),
  max_uses    int not null default 0,            -- 0 = sem limite
  uses        int not null default 0,
  min_wager   numeric(18,2) not null default 0,  -- apostado total mínimo para usar
  expires_at  timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid
);
create table if not exists public.promo_redemptions (
  code text references public.promo_codes(code) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric(18,2) not null,
  at timestamptz not null default now(),
  primary key (code, user_id)
);
create table if not exists public.promo_attempts (user_id uuid, at timestamptz not null default now());
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_attempts enable row level security;
drop policy if exists promo_admin on public.promo_codes;
create policy promo_admin on public.promo_codes for select using (public.is_admin());
drop policy if exists promo_red_read on public.promo_redemptions;
create policy promo_red_read on public.promo_redemptions for select using (user_id = auth.uid() or public.is_admin());
grant select on public.promo_codes, public.promo_redemptions to authenticated;

-- Resgatar: devolve {ok, amount} ou {error}; erros contam para o limite de 10 tentativas por hora
create or replace function public.redeem_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
end $$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

create or replace function public.admin_save_code(p_code text, p_amount numeric, p_max_uses int, p_min_wager numeric, p_hours int, p_active boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,24}$' then raise exception 'Código: 3 a 24 letras, números, - ou _.'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Valor inválido.'; end if;
  insert into promo_codes(code, amount, max_uses, min_wager, expires_at, active, created_by)
    values (v_code, round(p_amount, 2), greatest(coalesce(p_max_uses, 0), 0), greatest(coalesce(p_min_wager, 0), 0), case when coalesce(p_hours, 0) > 0 then now() + make_interval(hours => p_hours) end, coalesce(p_active, true), auth.uid())
  on conflict (code) do update set amount = excluded.amount, max_uses = excluded.max_uses, min_wager = excluded.min_wager, expires_at = excluded.expires_at, active = excluded.active;
  insert into audit_log(who, what, data) values (auth.uid(), 'promo code', jsonb_build_object('code', v_code, 'amount', p_amount, 'max_uses', p_max_uses, 'hours', p_hours, 'active', p_active));
end $$;
create or replace function public.admin_toggle_code(p_code text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update promo_codes set active = p_active where code = upper(p_code);
end $$;
revoke all on function public.admin_save_code(text, numeric, int, numeric, int, boolean), public.admin_toggle_code(text, boolean) from public, anon;
grant execute on function public.admin_save_code(text, numeric, int, numeric, int, boolean), public.admin_toggle_code(text, boolean) to authenticated;
