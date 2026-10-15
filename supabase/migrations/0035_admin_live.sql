-- Admin "Ao vivo": acompanhar quem está jogando agora, só leitura, só para o admin.
--  * presence: último sinal de cada jogador logado (o site manda a cada ~45 s com a página atual).
--    Sem política de RLS: ninguém lê a tabela direto; só as funções abaixo.
--  * rd_seen(path): grava o sinal do próprio jogador (não devolve nada).
--  * admin_live(p_user): lista de quem está ativo, novos cadastros e, se p_user vier,
--    o detalhe da sessão (saldo, apostas da sessão, últimas transações).
--  Sessão = apostas desde a última pausa de mais de 30 min (olhando as últimas 12 h).

create table if not exists public.presence (
  user_id uuid primary key references auth.users on delete cascade,
  last_at timestamptz not null default now(),
  first_at timestamptz not null default now(),
  path text
);
alter table public.presence enable row level security;

create index if not exists bets_user_time on public.bets(user_id, created_at desc);
create index if not exists bets_time on public.bets(created_at desc);

create or replace function public.rd_seen(p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into presence(user_id, last_at, first_at, path) values (auth.uid(), now(), now(), left(coalesce(p_path, ''), 80))
  on conflict (user_id) do update set
    first_at = case when presence.last_at < now() - interval '30 minutes' then now() else presence.first_at end,
    last_at = now(), path = excluded.path;
end $$;
revoke all on function public.rd_seen(text) from public, anon;
grant execute on function public.rd_seen(text) to authenticated;

create or replace function public.rd_session_start(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  with b as (
    select created_at, lag(created_at) over (order by created_at) as prev
    from bets where user_id = p_user and created_at > now() - interval '12 hours'
  )
  select max(created_at) filter (where prev is null or created_at - prev > interval '30 minutes') from b
$$;
revoke all on function public.rd_session_start(uuid) from public, anon, authenticated;

create or replace function public.admin_live(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_active jsonb; v_new jsonb; v_detail jsonb; v_start timestamptz; p profiles;
begin
  if not is_admin() then raise exception 'not allowed'; end if;

  with ids as (
    select user_id from presence where last_at > now() - interval '3 minutes'
    union select distinct user_id from bets where created_at > now() - interval '10 minutes'
  ), s as (
    select i.user_id, rd_session_start(i.user_id) as st from ids i
  )
  select coalesce(jsonb_agg(x order by x->>'last' desc nulls last), '[]'::jsonb) into v_active from (
    select jsonb_build_object(
      'id', pr.id, 'username', pr.username, 'vip_xp', pr.vip_xp, 'balance', pr.balance, 'country', pr.country,
      'seen', ps.last_at, 'path', ps.path, 'online', ps.last_at > now() - interval '3 minutes',
      'since', least(coalesce(s.st, ps.first_at), coalesce(ps.first_at, s.st)),
      'game', (select b.game from bets b where b.user_id = pr.id order by b.created_at desc limit 1),
      'last', greatest(ps.last_at, (select max(b.created_at) from bets b where b.user_id = pr.id)),
      'net', coalesce((select round(sum(b.payout - b.amount), 2) from bets b where b.user_id = pr.id and s.st is not null and b.created_at >= s.st), 0),
      'bets', coalesce((select count(*) from bets b where b.user_id = pr.id and s.st is not null and b.created_at >= s.st), 0)
    ) as x
    from s join profiles pr on pr.id = s.user_id left join presence ps on ps.user_id = s.user_id
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', pr.id, 'username', pr.username, 'created_at', pr.created_at, 'country', pr.country, 'balance', pr.balance, 'bets', pr.bets_count,
      'deposits', coalesce((select round(sum(t.amount_usd), 2) from transactions t where t.user_id = pr.id and t.type = 'deposit' and t.status = 'completed'), 0),
      'seen', (select ps.last_at from presence ps where ps.user_id = pr.id)
    ) order by pr.created_at desc), '[]'::jsonb) into v_new
  from (select * from profiles where created_at > now() - interval '7 days' order by created_at desc limit 12) pr;

  if p_user is not null then
    select * into p from profiles where id = p_user;
    v_start := rd_session_start(p_user);
    select jsonb_build_object(
      'id', p.id, 'username', p.username, 'country', p.country, 'created_at', p.created_at, 'kyc', p.kyc, 'status', p.status,
      'balance', p.balance, 'held', p.held, 'vip_xp', p.vip_xp, 'wagered_total', p.wagered,
      'seen', (select ps.last_at from presence ps where ps.user_id = p_user),
      'path', (select ps.path from presence ps where ps.user_id = p_user),
      'session_start', v_start,
      'session', (select jsonb_build_object('bets', count(*), 'wagered', coalesce(round(sum(amount), 2), 0), 'net', coalesce(round(sum(payout - amount), 2), 0), 'max_bet', coalesce(max(amount), 0))
                  from bets where user_id = p_user and v_start is not null and created_at >= v_start),
      'feed', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'game', game, 'amount', amount, 'multiplier', multiplier, 'payout', payout, 'at', created_at) order by created_at desc), '[]'::jsonb)
               from (select * from bets where user_id = p_user order by created_at desc limit 60) b),
      'tx', (select coalesce(jsonb_agg(jsonb_build_object('type', type, 'status', status, 'amount', amount_usd, 'coin', coin, 'at', created_at) order by created_at desc), '[]'::jsonb)
             from (select * from transactions where user_id = p_user order by created_at desc limit 6) t)
    ) into v_detail;
  end if;

  return jsonb_build_object('active', v_active, 'new', v_new, 'player', v_detail, 'now', now());
end $$;
revoke all on function public.admin_live(uuid) from public, anon;
grant execute on function public.admin_live(uuid) to authenticated;
