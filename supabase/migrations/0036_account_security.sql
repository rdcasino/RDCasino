-- 0036: segurança da conta do jogador (opcional).
-- 1) 2FA (TOTP do Supabase Auth): quem ligou o 2FA só consegue sacar ou mandar gorjeta com a sessão confirmada
--    pelo código (aal2). A regra fica no servidor: chamar a API direto com a senha roubada não adianta.
-- 2) E-mail verificado: o cadastro continua sem confirmação (mailer_autoconfirm); o jogador pode verificar depois
--    com um código enviado ao e-mail. mark_email_verified só aceita sessão aberta por esse código (amr otp/magiclink)
--    nos últimos 15 minutos.

alter table public.profiles add column if not exists email_verified_at timestamptz;

create or replace function public.rd_mfa_guard()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and new.user_id = auth.uid()
     and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2'
     and exists(select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified') then
    raise exception 'Enter your 2FA code to continue.';
  end if;
  return new;
end $function$;
revoke all on function public.rd_mfa_guard() from public, anon, authenticated;

drop trigger if exists rd_mfa_guard on public.transactions;
create trigger rd_mfa_guard before insert on public.transactions
  for each row when (new.type in ('withdrawal', 'tip_out')) execute function public.rd_mfa_guard();

create or replace function public.mark_email_verified()
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare ok boolean;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'Sign in first.'); end if;
  select exists(
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
     where a->>'method' in ('otp', 'magiclink')
       and to_timestamp(coalesce((a->>'timestamp')::bigint, 0)) > now() - interval '15 minutes') into ok;
  if not ok then return jsonb_build_object('error', 'Enter the code we sent to your email first.'); end if;
  update profiles set email_verified_at = coalesce(email_verified_at, now()) where id = auth.uid();
  return jsonb_build_object('ok', true);
end $function$;
revoke all on function public.mark_email_verified() from public, anon;
grant execute on function public.mark_email_verified() to authenticated, service_role;
notify pgrst, 'reload schema';
