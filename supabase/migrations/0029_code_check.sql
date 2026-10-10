-- 0029: o botão "Redeem" fica azul só quando o código digitado existe e ainda pode ser usado.
-- Proteção contra quem tenta descobrir códigos: só logado, no máximo 60 consultas por hora por jogador
-- (separado do limite de 10 tentativas erradas de resgate), e a resposta é só sim/não.
create table if not exists public.promo_checks (user_id uuid not null, at timestamptz not null default now());
create index if not exists promo_checks_user_at on public.promo_checks (user_id, at);
alter table public.promo_checks enable row level security;

create or replace function public.code_check(p_code text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null or length(v_code) < 3 then return false; end if;
  if (select count(*) from promo_checks where user_id = auth.uid() and at > now() - interval '1 hour') >= 60 then return null; end if;
  insert into promo_checks(user_id) values (auth.uid());
  delete from promo_checks where at < now() - interval '1 day';
  return exists(select 1 from promo_codes c where c.code = v_code and c.active and (c.expires_at is null or c.expires_at > now()) and (c.max_uses = 0 or c.uses < c.max_uses))
     and not exists(select 1 from promo_redemptions r where r.code = v_code and r.user_id = auth.uid());
end $function$;
revoke all on function public.code_check(text) from public, anon;
grant execute on function public.code_check(text) to authenticated, service_role;
notify pgrst, 'reload schema';
