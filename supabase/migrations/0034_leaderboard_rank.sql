-- Leaderboard mensal: devolve também o progresso VIP (vip_xp) de cada jogador,
-- para o site mostrar o rank (Bronze, Gold 3...) ao lado do nome.
-- Muda o tipo de retorno, então precisa recriar a função.
drop function if exists public.leaderboard_month();
create function public.leaderboard_month()
returns table(username text, wagered numeric, vip_xp numeric) language sql stable security definer set search_path = public as $$
  select p.username, round(sum(b.amount), 2), round(max(p.vip_xp), 2) from bets b join profiles p on p.id = b.user_id
  where b.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  group by p.username order by 2 desc limit 50
$$;
grant execute on function public.leaderboard_month() to anon, authenticated;
