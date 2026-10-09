-- 0026: Provably fair no padrão Shuffle/Stake — "próxima seed do servidor" já comprometida.
-- O jogador vê o hash da seed atual E o hash da próxima. Ao trocar o par, a próxima vira a atual
-- (a que ele já viu o hash) e uma nova próxima é sorteada. A seed atual é revelada como antes.

alter table public.seeds add column if not exists next_server_seed text;
alter table public.seeds add column if not exists next_server_hash text;

create or replace function public.rd_seed_next() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.next_server_seed is null then new.next_server_seed := encode(gen_random_bytes(32), 'hex'); end if;
  if tg_op = 'INSERT' or new.next_server_seed is distinct from old.next_server_seed then
    new.next_server_hash := encode(digest(new.next_server_seed, 'sha256'), 'hex');
  end if;
  return new;
end $$;
drop trigger if exists rd_seed_next on public.seeds;
create trigger rd_seed_next before insert or update on public.seeds for each row execute function public.rd_seed_next();

update public.seeds set next_server_hash = null where next_server_seed is null; -- o gatilho sorteia a próxima seed

create or replace view public.my_seeds with (security_invoker = false, security_barrier = true) as
  select user_id, server_hash, client_seed, nonce, revealed, next_server_hash from public.seeds where user_id = auth.uid();
grant select on public.my_seeds to authenticated;

create or replace function public.rotate_seed(p_client text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s seeds; v_client text := nullif(left(trim(coalesce(p_client, '')), 64), '');
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists(select 1 from rounds where user_id = auth.uid()) then raise exception 'Finish your open rounds before rotating seeds.'; end if;
  select * into s from seeds where user_id = auth.uid() for update;
  update seeds set
    revealed = (jsonb_build_array(jsonb_build_object('server', s.server_seed, 'client', s.client_seed, 'lastNonce', s.nonce - 1, 'at', now())) || coalesce(s.revealed, '[]'::jsonb)) - 20,
    server_seed = coalesce(s.next_server_seed, encode(gen_random_bytes(32), 'hex')),
    server_hash = encode(digest(coalesce(s.next_server_seed, encode(gen_random_bytes(32), 'hex')), 'sha256'), 'hex'),
    next_server_seed = encode(gen_random_bytes(32), 'hex'),
    client_seed = coalesce(v_client, encode(gen_random_bytes(8), 'hex')), nonce = 0
  where user_id = auth.uid() returning * into s;
  return jsonb_build_object('hash', s.server_hash, 'next', s.next_server_hash, 'client', s.client_seed, 'nonce', s.nonce, 'revealed', s.revealed);
end $$;
revoke all on function public.rotate_seed(text) from public, anon;
grant execute on function public.rotate_seed(text) to authenticated;
