-- Ajuste de saldo pelo admin com tipo (ajuste ou bônus) e aprovação de depósitos/saques já existe em admin_decide_tx.
drop function if exists public.admin_adjust_balance(uuid, numeric, text);
create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text, p_type text default 'adjustment')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_type not in ('adjustment', 'bonus') then raise exception 'invalid type'; end if;
  update profiles set balance = balance + round(p_amount, 2) where id = p_user and balance + round(p_amount, 2) >= 0;
  if not found then raise exception 'balance would go negative'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by)
    values (p_user, p_type, 'completed', round(p_amount, 2), p_reason, now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), p_type, jsonb_build_object('user', p_user, 'usd', p_amount, 'reason', p_reason));
end $$;
revoke all on function public.admin_adjust_balance(uuid, numeric, text, text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric, text, text) to authenticated;
