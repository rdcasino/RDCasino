-- =====================================================================
-- Provably fair: trocar a seed (revela a server seed antiga) e
-- configurações do site salvas no servidor (admin)
-- =====================================================================

-- ---------- Trocar seeds: a server seed atual é revelada para conferir as apostas ----------
create or replace function public.rotate_seed(p_client text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s seeds; v_server text := encode(gen_random_bytes(32), 'hex'); v_client text := nullif(left(trim(coalesce(p_client, '')), 64), '');
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists(select 1 from rounds where user_id = auth.uid()) then raise exception 'Finish your open rounds before rotating seeds.'; end if;
  select * into s from seeds where user_id = auth.uid() for update;
  update seeds set
    revealed = (jsonb_build_array(jsonb_build_object('server', s.server_seed, 'client', s.client_seed, 'lastNonce', s.nonce - 1, 'at', now())) || coalesce(s.revealed, '[]'::jsonb)) - 20,
    server_seed = v_server, server_hash = encode(digest(v_server, 'sha256'), 'hex'),
    client_seed = coalesce(v_client, encode(gen_random_bytes(8), 'hex')), nonce = 0
  where user_id = auth.uid() returning * into s;
  return jsonb_build_object('hash', s.server_hash, 'client', s.client_seed, 'nonce', s.nonce, 'revealed', s.revealed);
end $$;
revoke all on function public.rotate_seed(text) from public, anon;
grant execute on function public.rotate_seed(text) to authenticated;

-- ---------- Configurações do site (o admin muda, todo mundo lê) ----------
insert into public.settings(key, value) values ('site', '{}'), ('games', '{}') on conflict (key) do nothing;
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_key not in ('max_profit', 'restricted_countries', 'site', 'games', 'promotions') then raise exception 'Configuração desconhecida.'; end if;
  insert into settings(key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value;
  insert into audit_log(who, what, data) values (auth.uid(), 'setting ' || p_key, p_value);
end $$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;
