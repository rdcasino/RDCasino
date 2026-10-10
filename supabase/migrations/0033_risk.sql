-- 0033 · Antifraude: histórico de IP/aparelho por conta + regras que geram alertas para o admin (nunca bloqueiam ninguém)
-- Histórico de IP e aparelho por conta (para achar multicontas). Vem do login (auth.sessions), não do navegador.
create table if not exists public.login_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip text not null,
  ua text not null default '',
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  hits int not null default 1,
  primary key (user_id, ip, ua)
);
create index if not exists login_seen_ip_idx on public.login_seen(ip);
alter table public.login_seen enable row level security;
revoke all on public.login_seen from anon, authenticated;

create or replace function public.rd_login_seen() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.ip is null or new.user_id is null then return new; end if;
  insert into public.login_seen(user_id, ip, ua) values (new.user_id, host(new.ip), left(coalesce(new.user_agent, ''), 300))
    on conflict (user_id, ip, ua) do update set last_at = now(), hits = public.login_seen.hits + 1;
  return new;
exception when others then return new; -- nunca atrapalha o login
end $$;

drop trigger if exists rd_login_seen on auth.sessions;
create trigger rd_login_seen after insert or update of ip, refreshed_at on auth.sessions for each row execute function public.rd_login_seen();

insert into public.login_seen(user_id, ip, ua, first_at, last_at)
  select s.user_id, host(s.ip), left(coalesce(s.user_agent, ''), 300), min(s.created_at), max(coalesce(s.refreshed_at, s.updated_at, s.created_at))
  from auth.sessions s join public.profiles p on p.id = s.user_id where s.ip is not null group by 1, 2, 3
on conflict (user_id, ip, ua) do nothing;
-- Regras antifraude: só geram ALERTAS para o admin revisar. Nada aqui bloqueia, suspende ou retém alguém.
-- severidade: 3 = alta, 2 = média, 1 = baixa. "key" identifica o alerta para o admin marcar como revisado.
create table if not exists public.risk_reviews (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  reviewed_by uuid,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.risk_reviews enable row level security;
revoke all on public.risk_reviews from anon, authenticated;

create or replace function public.rd_risk_flags() returns table(user_id uuid, rule text, sev int, key text, title text, detail text)
language sql stable security definer set search_path to 'public' as $$
  with
  dep as (select t.user_id, sum(t.amount_usd) d from transactions t where t.type = 'deposit' and t.status = 'completed' group by 1),
  free as (select t.user_id, sum(t.amount_usd) f from transactions t where t.type in ('bonus', 'rakeback', 'level_reward', 'commission', 'tip_in') and t.status = 'completed' group by 1),
  wd as (select t.user_id, count(*) filter (where t.status = 'pending') pend, count(*) filter (where t.created_at > now() - interval '24 hours') day24, sum(t.amount_usd) filter (where t.status = 'pending') pend_usd from transactions t where t.type = 'withdrawal' group by 1),
  ipshare as (
    select a.user_id, b.user_id other, a.ip, (a.ua = b.ua and a.ua <> '') same_device
    from login_seen a join login_seen b on a.ip = b.ip and a.user_id <> b.user_id
    where a.last_at > now() - interval '60 days' and b.last_at > now() - interval '60 days'
  ),
  addr as (
    select t.user_id, t.address, count(distinct t2.user_id) n, string_agg(distinct p2.username, ', ') others
    from transactions t join transactions t2 on t2.type = 'withdrawal' and lower(t2.address) = lower(t.address) and t2.user_id <> t.user_id
    join profiles p2 on p2.id = t2.user_id
    where t.type = 'withdrawal' and coalesce(t.address, '') <> '' group by 1, 2
  )
  -- 1) mesmo aparelho (IP + navegador iguais) em contas diferentes
  select s.user_id, 'same_device', 3, 'dev:' || string_agg(distinct s.other::text, ',' order by s.other::text),
    'Same device as other accounts', 'Same IP and browser as: ' || string_agg(distinct p.username, ', ')
  from ipshare s join profiles p on p.id = s.other where s.same_device group by s.user_id
  union all
  -- 2) mesmo IP (sem ser o mesmo aparelho): pode ser casa/rede compartilhada, revisar com calma
  select s.user_id, 'shared_ip', 2, 'ip:' || string_agg(distinct s.other::text, ',' order by s.other::text),
    'Shared IP with other accounts', 'Same IP (' || min(s.ip) || ') as: ' || string_agg(distinct p.username, ', ')
  from ipshare s join profiles p on p.id = s.other
  where not exists (select 1 from ipshare x where x.user_id = s.user_id and x.other = s.other and x.same_device) group by s.user_id
  union all
  -- 3) mesmo endereço de saque em contas diferentes
  select a.user_id, 'shared_address', 3, 'addr:' || lower(a.address), 'Withdrawal address used by other accounts',
    'Address ' || left(a.address, 10) || '… also used by: ' || a.others from addr a
  union all
  -- 4) autoindicação: indicado com o mesmo IP ou carteira do afiliado
  select p.id, 'self_referral', 3, 'ref:' || p.referred_by, 'Possible self-referral',
    'Shares IP or withdrawal address with referrer ' || r.username
  from profiles p join profiles r on r.id = p.referred_by
  where exists (select 1 from ipshare s where s.user_id = p.id and s.other = p.referred_by)
     or exists (select 1 from transactions a join transactions b on lower(a.address) = lower(b.address) where a.user_id = p.id and b.user_id = p.referred_by and a.type = 'withdrawal' and b.type = 'withdrawal' and coalesce(a.address, '') <> '')
  union all
  -- 5) quer sacar tendo apostado menos do que depositou
  select p.id, 'low_wager', 2, 'lw:' || floor(coalesce(dep.d, 0)), 'Withdrawing with little play',
    'Wagered ' || to_char(p.wagered, 'FM$999,999,990.00') || ' vs deposited ' || to_char(dep.d, 'FM$999,999,990.00')
  from profiles p join dep on dep.user_id = p.id join wd on wd.user_id = p.id
  where wd.pend > 0 and p.wagered < dep.d
  union all
  -- 6) recebeu mais em bônus/rain/códigos/gorjetas do que depositou e pede saque
  select p.id, 'bonus_heavy', case when coalesce(dep.d, 0) = 0 then 3 else 2 end, 'bh:' || floor(free.f / 50), 'Bonus-heavy account',
    'Free money ' || to_char(free.f, 'FM$999,999,990.00') || ' (bonus, rain, codes, tips) vs deposits ' || to_char(coalesce(dep.d, 0), 'FM$999,999,990.00')
  from profiles p join free on free.user_id = p.id join wd on wd.user_id = p.id left join dep on dep.user_id = p.id
  where wd.pend > 0 and free.f >= 20 and free.f > coalesce(dep.d, 0)
  union all
  -- 7) contas do mesmo IP entrando na mesma rain
  select e.user_id, 'rain_multi', 3, 'rain:' || max(e.rain_id), 'Multiple accounts in the same rain',
    'Joined ' || count(distinct e.rain_id) || ' rain(s) together with: ' || string_agg(distinct p.username, ', ')
  from rain_entries e join rain_entries e2 on e2.rain_id = e.rain_id and e2.user_id <> e.user_id
  join ipshare s on s.user_id = e.user_id and s.other = e2.user_id join profiles p on p.id = e2.user_id
  group by e.user_id
  union all
  -- 8) recebe gorjeta de muitas contas (funil)
  select t.user_id, 'tip_funnel', 2, 'tip:' || count(distinct t.note), 'Receiving tips from many accounts',
    count(distinct t.note) || ' different senders in 7 days, ' || to_char(sum(t.amount_usd), 'FM$999,999,990.00') || ' total'
  from transactions t where t.type = 'tip_in' and t.created_at > now() - interval '7 days' group by t.user_id having count(distinct t.note) >= 3
  union all
  -- 9) mesmo nome + data de nascimento no KYC em outra conta
  select k.user_id, 'kyc_duplicate', 3, 'kyc:' || k2.user_id, 'Same identity on another account',
    'KYC name and birth date match ' || p2.username
  from kyc_submissions k join kyc_submissions k2 on k2.user_id <> k.user_id and lower(k2.first_name) = lower(k.first_name) and lower(k2.last_name) = lower(k.last_name) and k2.dob = k.dob
  join profiles p2 on p2.id = k2.user_id
  union all
  -- 10) conta com menos de 48h pedindo saque
  select p.id, 'new_account', 1, 'new', 'New account withdrawing', 'Account created ' || to_char(p.created_at at time zone 'UTC', 'Mon DD HH24:MI') || ' UTC'
  from profiles p join wd on wd.user_id = p.id where wd.pend > 0 and p.created_at > now() - interval '48 hours'
  union all
  -- 11) ganho muito acima do depositado (pode ser sorte; vale olhar o histórico)
  select p.id, 'big_win', 1, 'win:' || floor(p.profit / 500), 'Unusual win', 'Profit ' || to_char(p.profit, 'FM$999,999,990.00') || ' vs deposits ' || to_char(coalesce(dep.d, 0), 'FM$999,999,990.00')
  from profiles p left join dep on dep.user_id = p.id where p.profit > 500 and p.profit > 20 * greatest(coalesce(dep.d, 0), 1)
  union all
  -- 12) tentativa em massa de códigos promocionais
  select a.user_id, 'code_bruteforce', 2, 'codes:' || to_char(now(), 'YYYYMMDD'), 'Guessing promo codes', count(*) || ' wrong code attempts in 24 hours'
  from promo_attempts a where a.at > now() - interval '24 hours' group by a.user_id having count(*) >= 15
  union all
  -- 13) muitos pedidos de saque em 24h
  select wd.user_id, 'many_withdrawals', 1, 'wd:' || to_char(now(), 'YYYYMMDD'), 'Many withdrawal requests', wd.day24 || ' requests in 24 hours'
  from wd where wd.day24 >= 4
$$;

-- lista para o admin: um item por jogador com os alertas ainda não revisados (ou todos, se pedir)
create or replace function public.admin_risk(p_user uuid default null, p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  return coalesce((
    select jsonb_agg(x order by x.score desc, x.username) from (
      select f.user_id, p.username, sum(f.sev) score, max(f.sev) top,
        jsonb_agg(jsonb_build_object('rule', f.rule, 'sev', f.sev, 'key', f.key, 'title', f.title, 'detail', f.detail, 'reviewed', r.key is not null) order by f.sev desc) flags
      from rd_risk_flags() f join profiles p on p.id = f.user_id
      left join risk_reviews r on r.user_id = f.user_id and r.key = f.key
      where (p_user is null or f.user_id = p_user) and (p_all or r.key is null)
      group by f.user_id, p.username
    ) x), '[]'::jsonb);
end $$;

-- marcar um alerta como revisado (some da lista até mudar; ex.: novos IPs ou outro endereço)
create or replace function public.admin_risk_review(p_user uuid, p_key text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  insert into risk_reviews(user_id, key, reviewed_by) values (p_user, p_key, auth.uid()) on conflict (user_id, key) do update set reviewed_by = auth.uid(), reviewed_at = now();
  insert into audit_log(who, what, data) values (auth.uid(), 'risk reviewed', jsonb_build_object('user', p_user, 'key', p_key));
end $$;

revoke all on function public.rd_risk_flags() from public, anon, authenticated;
grant execute on function public.admin_risk(uuid, boolean), public.admin_risk_review(uuid, text) to authenticated;
