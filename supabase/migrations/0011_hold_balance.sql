-- =====================================================================
-- Saldo retido: o admin pode travar dinheiro (suspeita de bug/fraude) em vez de só devolver
--   reter     → sai do saldo e vai para "retido" (o jogador vê, mas não usa)
--   liberar   → volta do retido para o saldo
--   confiscar → some do retido (fica só na auditoria)
-- =====================================================================
alter table public.profiles add column if not exists held numeric(18,2) not null default 0 check (held >= 0);

create or replace function public.admin_hold(p_user uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set balance = balance - v, held = held + v where id = p_user and balance >= v;
  if not found then raise exception 'O jogador não tem esse saldo disponível.'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by) values (p_user, 'adjustment', 'completed', -v, 'On hold: ' || coalesce(p_reason, ''), now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), 'hold balance', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $$;

create or replace function public.admin_release(p_user uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set held = held - v, balance = balance + v where id = p_user and held >= v;
  if not found then raise exception 'Valor maior que o retido.'; end if;
  insert into transactions(user_id, type, status, amount_usd, note, decided_at, decided_by) values (p_user, 'adjustment', 'completed', v, 'Released: ' || coalesce(p_reason, ''), now(), auth.uid());
  insert into audit_log(who, what, data) values (auth.uid(), 'release hold', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $$;

create or replace function public.admin_confiscate(p_user uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Escreva o motivo.'; end if;
  update profiles set held = held - v where id = p_user and held >= v;
  if not found then raise exception 'Valor maior que o retido.'; end if;
  insert into audit_log(who, what, data) values (auth.uid(), 'confiscate', jsonb_build_object('user', p_user, 'usd', v, 'reason', p_reason));
end $$;

-- Rejeitar saque: devolve para o saldo (padrão) ou retém (p_hold = true)
drop function if exists public.admin_decide_tx(bigint, boolean, text, text);
create or replace function public.admin_decide_tx(p_id bigint, p_approve boolean, p_tx_hash text default null, p_note text default null, p_hold boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare t transactions;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select * into t from transactions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'transaction not pending'; end if;
  if t.type = 'deposit' and p_approve then
    update profiles set balance = balance + t.amount_usd where id = t.user_id;
  elsif t.type = 'withdrawal' and not p_approve then
    if p_hold then update profiles set held = held + t.amount_usd where id = t.user_id;
    else update profiles set balance = balance + t.amount_usd where id = t.user_id; end if;
  end if;
  update transactions set status = case when p_approve then 'completed' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid(), tx_hash = coalesce(p_tx_hash, tx_hash),
    note = coalesce(p_note, note) || case when not p_approve and p_hold and t.type = 'withdrawal' then ' (on hold)' else '' end
    where id = p_id;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'approve ' else (case when p_hold then 'reject+hold ' else 'reject ' end) end || t.type, jsonb_build_object('tx', p_id, 'user', t.user_id, 'usd', t.amount_usd));
end $$;

revoke all on function public.admin_hold(uuid, numeric, text), public.admin_release(uuid, numeric, text), public.admin_confiscate(uuid, numeric, text), public.admin_decide_tx(bigint, boolean, text, text, boolean) from public, anon;
grant execute on function public.admin_hold(uuid, numeric, text), public.admin_release(uuid, numeric, text), public.admin_confiscate(uuid, numeric, text), public.admin_decide_tx(bigint, boolean, text, text, boolean) to authenticated;
