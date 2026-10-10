-- 0035: Challenges (desafios). O admin cria "acerte X× no jogo Y com aposta mínima Z" com prêmio e número de vagas.
-- O prêmio cai sozinho: um gatilho na tabela bets confere cada aposta ganha no mesmo instante em que ela é gravada
-- (mesma transação do play_bet / rd_round_settle). Cada jogador ganha cada desafio uma vez; as vagas são
-- disputadas com trava na linha do desafio, então nunca passa do número de ganhadores.
-- O prêmio entra como transação 'bonus' (nota "Challenge: ...") para continuar contando nos relatórios,
-- no antifraude (bônus maior que depósitos) e no afiliado como os outros bônus.

create table if not exists public.challenges (
  id          bigserial primary key,
  game        text not null,
  title       text not null default '',
  min_mult    numeric(18,2) not null check (min_mult > 1),
  min_bet     numeric(18,2) not null default 0 check (min_bet >= 0),
  prize       numeric(18,2) not null check (prize > 0),
  max_winners int not null default 1 check (max_winners > 0),
  winners     int not null default 0,
  active      boolean not null default true,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid
);
create index if not exists challenges_open_idx on public.challenges (game) where active;

create table if not exists public.challenge_winners (
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  bet_id       bigint,
  multiplier   numeric(18,4) not null,
  amount       numeric(18,2) not null,
  prize        numeric(18,2) not null,
  created_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- só funções do servidor leem/gravam (mesma regra da 0018)
alter table public.challenges enable row level security;
alter table public.challenge_winners enable row level security;
revoke all on public.challenges, public.challenge_winners from anon, authenticated;

-- Confere a aposta recém-gravada contra os desafios abertos do jogo
create or replace function public.rd_challenge_check()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare c challenges; cc challenges;
begin
  for c in
    select * from challenges
     where active and game = new.game and winners < max_winners
       and starts_at <= now() and (ends_at is null or ends_at > now())
       and new.multiplier >= min_mult and new.amount >= min_bet
     order by id
  loop
    select * into cc from challenges where id = c.id for update;  -- disputa da vaga
    continue when not cc.active or cc.winners >= cc.max_winners;
    continue when exists(select 1 from challenge_winners w where w.challenge_id = cc.id and w.user_id = new.user_id);
    insert into challenge_winners(challenge_id, user_id, bet_id, multiplier, amount, prize)
      values (cc.id, new.user_id, new.id, new.multiplier, new.amount, cc.prize);
    update challenges set winners = winners + 1 where id = cc.id;
    update profiles set balance = balance + cc.prize where id = new.user_id;
    insert into transactions(user_id, type, status, amount_usd, note, decided_at)
      values (new.user_id, 'bonus', 'completed', cc.prize,
              'Challenge: ' || coalesce(nullif(cc.title, ''), rtrim(rtrim(cc.min_mult::text, '0'), '.') || 'x on ' || cc.game), now());
  end loop;
  return null;
end $function$;

drop trigger if exists rd_challenge_check on public.bets;
create trigger rd_challenge_check after insert on public.bets
  for each row when (new.payout > 0 and new.multiplier > 1) execute function public.rd_challenge_check();

-- Lista para o site: desafios abertos + os encerrados nos últimos 7 dias, com os ganhadores
create or replace function public.public_challenges()
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x.open desc, x.id desc), '[]'::jsonb) from (
    select c.id, c.game, c.title, c.min_mult, c.min_bet, c.prize, c.max_winners, c.winners, c.starts_at, c.ends_at,
           (c.active and c.winners < c.max_winners and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())) as open,
           exists(select 1 from challenge_winners w where w.challenge_id = c.id and w.user_id = auth.uid()) as mine,
           coalesce((select jsonb_agg(jsonb_build_object('user', p.username, 'mult', w.multiplier, 'amount', w.amount, 'at', w.created_at) order by w.created_at)
                       from challenge_winners w join profiles p on p.id = w.user_id where w.challenge_id = c.id), '[]'::jsonb) as list
      from challenges c
     where c.starts_at <= now()
       and ((c.active and c.winners < c.max_winners and (c.ends_at is null or c.ends_at > now()))
            or coalesce((select max(w.created_at) from challenge_winners w where w.challenge_id = c.id), c.ends_at, c.created_at) > now() - interval '7 days')
       and (c.active or c.winners > 0)
  ) x
$function$;
grant execute on function public.public_challenges() to anon, authenticated, service_role;

-- Admin: todos, com custo pago
create or replace function public.admin_challenges()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'game', c.game, 'title', c.title, 'min_mult', c.min_mult, 'min_bet', c.min_bet, 'prize', c.prize,
      'max_winners', c.max_winners, 'winners', c.winners, 'active', c.active, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'created_at', c.created_at,
      'list', coalesce((select jsonb_agg(jsonb_build_object('user', p.username, 'mult', w.multiplier, 'amount', w.amount, 'at', w.created_at) order by w.created_at)
                          from challenge_winners w join profiles p on p.id = w.user_id where w.challenge_id = c.id), '[]'::jsonb))
    order by c.id desc) from challenges c), '[]'::jsonb);
end $function$;

create or replace function public.admin_save_challenge(p jsonb)
 returns bigint language plpgsql security definer set search_path to 'public'
as $function$
declare v_id bigint; v_game text := lower(trim(coalesce(p->>'game', ''))); v_hours int := coalesce((p->>'hours')::int, 0);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v_game !~ '^[a-z0-9_-]{2,40}$' then raise exception 'Jogo inválido.'; end if;
  if coalesce((p->>'min_mult')::numeric, 0) <= 1 then raise exception 'Multiplicador precisa ser maior que 1×.'; end if;
  if coalesce((p->>'prize')::numeric, 0) <= 0 then raise exception 'Prêmio inválido.'; end if;
  if coalesce((p->>'max_winners')::int, 0) <= 0 then raise exception 'Número de ganhadores inválido.'; end if;
  insert into challenges(game, title, min_mult, min_bet, prize, max_winners, ends_at, created_by)
    values (v_game, left(trim(coalesce(p->>'title', '')), 80), round((p->>'min_mult')::numeric, 2), round(greatest(coalesce((p->>'min_bet')::numeric, 0), 0), 2),
            round((p->>'prize')::numeric, 2), (p->>'max_winners')::int, case when v_hours > 0 then now() + make_interval(hours => v_hours) end, auth.uid())
    returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'challenge', p || jsonb_build_object('id', v_id));
  return v_id;
end $function$;

create or replace function public.admin_toggle_challenge(p_id bigint, p_active boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update challenges set active = coalesce(p_active, false) where id = p_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'challenge toggle', jsonb_build_object('id', p_id, 'active', p_active));
end $function$;

revoke all on function public.rd_challenge_check() from public, anon, authenticated;
revoke all on function public.admin_challenges(), public.admin_save_challenge(jsonb), public.admin_toggle_challenge(bigint, boolean) from public, anon;
grant execute on function public.admin_challenges(), public.admin_save_challenge(jsonb), public.admin_toggle_challenge(bigint, boolean) to authenticated, service_role;
notify pgrst, 'reload schema';
