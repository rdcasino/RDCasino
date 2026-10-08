-- =====================================================================
-- RDCasino — banco de dados (Supabase / Postgres)
-- Regra de ouro: o navegador NUNCA altera saldo. Saldo, apostas e
-- caixa só mudam por funções do servidor (Edge Functions com a chave
-- de serviço) ou pelas funções "security definer" abaixo.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Jogadores ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  country         text not null,
  ref_code        text unique not null,
  referred_by     uuid references public.profiles(id),
  status          text not null default 'active' check (status in ('active','suspended')),
  kyc             text not null default 'none' check (kyc in ('none','pending','verified','rejected')),
  balance         numeric(18,2) not null default 0 check (balance >= 0),
  wagered         numeric(18,2) not null default 0,
  profit          numeric(18,2) not null default 0,
  bets_count      bigint not null default 0,
  rakeback        numeric(18,6) not null default 0,
  claimed_tiers   text[] not null default '{}',
  note            text,
  created_at      timestamptz not null default now()
);

-- Quem é admin (o login do admin é uma conta normal do Supabase Auth + 2FA)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.admins where user_id = auth.uid()) $$;

-- Convites: só entra quem tem código (fase fechada com 50 pessoas)
create table public.invites (
  code        text primary key,
  note        text,
  created_at  timestamptz not null default now(),
  used_by     uuid references public.profiles(id),
  used_at     timestamptz
);

-- ---------- Provably fair ----------
-- server_seed nunca é lido pelo navegador: só o hash, até a troca de seed.
create table public.seeds (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  server_seed  text not null,
  server_hash  text not null,
  client_seed  text not null,
  nonce        bigint not null default 0,
  revealed     jsonb not null default '[]'
);

-- Rodadas em andamento (Mines, Hi-Lo, Crash, Blackjack, Tower, Chicken, RPS): uma por jogo
create table public.rounds (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  game        text not null,
  amount      numeric(18,2) not null,
  server_seed text not null,
  client_seed text not null,
  nonce       bigint not null,
  state       jsonb not null default '{}',
  started_at  timestamptz not null default now(),
  primary key (user_id, game)
);

create table public.bets (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id),
  game        text not null,
  amount      numeric(18,2) not null,
  multiplier  numeric(18,4) not null,
  payout      numeric(18,2) not null,
  client_seed text not null,
  nonce       bigint not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index bets_user_idx on public.bets(user_id, created_at desc);
create index bets_game_idx on public.bets(game, created_at desc);

-- ---------- Caixa (depósito e saque manuais, aprovados no admin) ----------
create table public.wallets (               -- endereços da casa mostrados no site
  id          serial primary key,
  coin        text not null,                -- USDT, BTC, ETH...
  network     text not null,                -- TRC20, ERC20, Bitcoin...
  address     text not null,
  memo        text,                         -- tag/memo exigido pela corretora, se houver
  min_deposit numeric(18,2) not null default 10,
  enabled     boolean not null default true,
  unique (coin, network)
);

create table public.transactions (
  id           bigserial primary key,
  user_id      uuid not null references public.profiles(id),
  type         text not null check (type in ('deposit','withdrawal','adjustment','bonus','rakeback','level_reward','commission','tip_in','tip_out')),
  status       text not null default 'pending' check (status in ('pending','completed','rejected')),
  amount_usd   numeric(18,2) not null,
  coin         text,
  network      text,
  amount_coin  numeric(28,10),
  tx_hash      text,                        -- hash enviado pelo jogador (depósito) ou pela casa (saque)
  address      text,                        -- endereço do jogador (saque)
  note         text,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id)
);
create unique index tx_hash_once on public.transactions(tx_hash) where type = 'deposit' and tx_hash is not null;
create index tx_user_idx on public.transactions(user_id, created_at desc);
create index tx_pending_idx on public.transactions(status, type) where status = 'pending';

create table public.settings (key text primary key, value jsonb not null);
insert into public.settings values
  ('min_deposit', '10'), ('max_profit', '0'), ('rakeback_rate', '0.05'), ('restricted_countries', '["Brazil","United States","United Kingdom","France","Netherlands","Spain","Australia"]');

create table public.audit_log (
  id bigserial primary key, at timestamptz not null default now(),
  who uuid, what text not null, data jsonb
);

-- ---------- Segurança (RLS) ----------
alter table public.profiles     enable row level security;
alter table public.admins       enable row level security;
alter table public.invites      enable row level security;
alter table public.seeds        enable row level security;
alter table public.rounds       enable row level security;
alter table public.bets         enable row level security;
alter table public.wallets      enable row level security;
alter table public.transactions enable row level security;
alter table public.settings     enable row level security;
alter table public.audit_log    enable row level security;

-- Jogador: lê só o que é dele. Ninguém escreve direto (só funções do servidor).
create policy own_profile on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy own_rounds  on public.rounds   for select using (user_id = auth.uid() or public.is_admin());
create policy own_tx      on public.transactions for select using (user_id = auth.uid() or public.is_admin());
create policy bets_read   on public.bets     for select using (true);   -- feed público de apostas (sem dados sensíveis)
create policy wallets_read on public.wallets for select using (enabled or public.is_admin());
create policy settings_read on public.settings for select using (true);
create policy admin_only_invites on public.invites for select using (public.is_admin());
create policy admin_only_audit on public.audit_log for select using (public.is_admin());
-- seeds: o jogador vê hash, client seed, nonce e seeds já reveladas — nunca a server seed atual
create or replace view public.my_seeds with (security_invoker = false) as
  select user_id, server_hash, client_seed, nonce, revealed from public.seeds where user_id = auth.uid();
grant select on public.my_seeds to authenticated;

-- ---------- Funções do jogador ----------
-- Pedido de depósito: o jogador informa moeda, rede, valor e hash da transação; o admin confere e aprova.
create or replace function public.request_deposit(p_coin text, p_network text, p_amount_usd numeric, p_tx_hash text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_min numeric; v_id bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select greatest(min_deposit, (select (value)::text::numeric from settings where key = 'min_deposit'))
    into v_min from wallets where coin = p_coin and network = p_network and enabled;
  if v_min is null then raise exception 'coin/network not accepted'; end if;
  if p_amount_usd < v_min then raise exception 'minimum deposit is %', v_min; end if;
  if coalesce(trim(p_tx_hash), '') = '' then raise exception 'transaction hash required'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, tx_hash)
    values (auth.uid(), 'deposit', round(p_amount_usd, 2), p_coin, p_network, trim(p_tx_hash)) returning id into v_id;
  return v_id;
end $$;

-- Pedido de saque: o valor sai do saldo na hora (fica reservado); se o admin rejeitar, volta.
create or replace function public.request_withdrawal(p_coin text, p_network text, p_amount_usd numeric, p_address text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_amount_usd <= 0 then raise exception 'invalid amount'; end if;
  update profiles set balance = balance - round(p_amount_usd, 2)
    where id = auth.uid() and status = 'active' and balance >= round(p_amount_usd, 2);
  if not found then raise exception 'insufficient balance'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, address)
    values (auth.uid(), 'withdrawal', round(p_amount_usd, 2), p_coin, p_network, trim(p_address)) returning id into v_id;
  return v_id;
end $$;

-- ---------- Funções do admin ----------
create or replace function public.admin_decide_tx(p_id bigint, p_approve boolean, p_tx_hash text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t transactions;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into t from transactions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'transaction not pending'; end if;
  if t.type = 'deposit' and p_approve then
    update profiles set balance = balance + t.amount_usd where id = t.user_id;
  elsif t.type = 'withdrawal' and not p_approve then
    update profiles set balance = balance + t.amount_usd where id = t.user_id;   -- devolve o valor reservado
  end if;
  update transactions set status = case when p_approve then 'completed' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid(), tx_hash = coalesce(p_tx_hash, tx_hash), note = coalesce(p_note, note)
    where id = p_id;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'approve ' else 'reject ' end || t.type, jsonb_build_object('tx', p_id, 'user', t.user_id, 'usd', t.amount_usd));
end $$;

create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update profiles set balance = balance + round(p_amount, 2) where id = p_user and balance + round(p_amount, 2) >= 0;
  if not found then raise exception 'balance would go negative'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by)
    values (p_user, 'adjustment', 'completed', round(p_amount, 2), p_reason, now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), 'adjust balance', jsonb_build_object('user', p_user, 'usd', p_amount, 'reason', p_reason));
end $$;

revoke all on function public.admin_decide_tx, public.admin_adjust_balance from public, anon;
grant execute on function public.request_deposit, public.request_withdrawal, public.admin_decide_tx, public.admin_adjust_balance to authenticated;

-- As apostas são feitas pela Edge Function "play" (supabase/functions/play), que usa a chave de
-- serviço, sorteia com HMAC-SHA256(server_seed, client_seed:nonce[:cursor]) e grava saldo + aposta
-- numa única transação. Detalhes em docs/backend.md.
