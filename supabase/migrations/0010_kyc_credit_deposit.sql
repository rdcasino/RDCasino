-- =====================================================================
-- KYC de verdade (dados + documentos num cofre privado) e crédito manual de depósito
-- =====================================================================

-- ---------- Cofre de documentos (privado): cada jogador só escreve na própria pasta ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists kyc_upload_own on storage.objects;
create policy kyc_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists kyc_read_own_or_admin on storage.objects;
create policy kyc_read_own_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Envios de KYC ----------
create table if not exists public.kyc_submissions (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  dob         date not null,
  country     text not null,
  address     text not null,
  city        text not null,
  postal      text,
  doc_type    text not null check (doc_type in ('passport','id_card','driver_license')),
  files       jsonb not null default '{}',      -- { front, back, selfie, address } = caminhos no cofre
  status      text not null default 'pending' check (status in ('pending','verified','rejected')),
  reason      text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists kyc_user_idx on public.kyc_submissions(user_id, created_at desc);
alter table public.kyc_submissions enable row level security;
drop policy if exists kyc_own on public.kyc_submissions;
create policy kyc_own on public.kyc_submissions for select using (user_id = auth.uid() or public.is_admin());
grant select on public.kyc_submissions to authenticated;

create or replace function public.kyc_submit(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_k text; v_files jsonb := coalesce(p->'files', '{}'); v_doc text := p->>'doc_type'; cur text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select kyc into cur from profiles where id = auth.uid();
  if cur = 'pending' then raise exception 'Your documents are already under review.'; end if;
  if cur = 'verified' then raise exception 'You are already verified.'; end if;
  if coalesce(trim(p->>'first_name'), '') = '' or coalesce(trim(p->>'last_name'), '') = '' then raise exception 'Fill in your full name.'; end if;
  if (p->>'dob')::date > (current_date - interval '18 years') then raise exception 'You must be 18 or older.'; end if;
  if coalesce(trim(p->>'address'), '') = '' or coalesce(trim(p->>'city'), '') = '' then raise exception 'Fill in your address.'; end if;
  if v_doc not in ('passport','id_card','driver_license') then raise exception 'Choose a document type.'; end if;
  -- arquivos obrigatórios; todos precisam estar na pasta do próprio jogador
  foreach v_k in array (case when v_doc = 'passport' then array['front','selfie','address'] else array['front','back','selfie','address'] end) loop
    if coalesce(v_files->>v_k, '') = '' then raise exception 'Upload all the requested files.'; end if;
  end loop;
  for v_k in select jsonb_object_keys(v_files) loop
    if split_part(v_files->>v_k, '/', 1) <> auth.uid()::text then raise exception 'Invalid file.'; end if;
  end loop;
  insert into kyc_submissions(user_id, first_name, last_name, dob, country, address, city, postal, doc_type, files)
    values (auth.uid(), trim(p->>'first_name'), trim(p->>'last_name'), (p->>'dob')::date, coalesce(nullif(trim(p->>'country'), ''), '-'),
            trim(p->>'address'), trim(p->>'city'), nullif(trim(p->>'postal'), ''), v_doc, v_files) returning id into v_id;
  update profiles set kyc = 'pending' where id = auth.uid();
  insert into audit_log(who, what, data) values (auth.uid(), 'kyc submit', jsonb_build_object('submission', v_id));
  return v_id;
end $$;

create or replace function public.admin_kyc_decide(p_user uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update kyc_submissions set status = case when p_approve then 'verified' else 'rejected' end, reason = p_reason, reviewed_at = now(), reviewed_by = auth.uid()
    where id = (select id from kyc_submissions where user_id = p_user order by created_at desc limit 1);
  update profiles set kyc = case when p_approve then 'verified' else 'rejected' end where id = p_user;
  insert into audit_log(who, what, data) values (auth.uid(), case when p_approve then 'kyc approve' else 'kyc reject' end, jsonb_build_object('user', p_user, 'reason', p_reason));
end $$;

-- ---------- Saque acima do limite exige KYC aprovado ----------
insert into public.settings(key, value) values ('kyc_withdraw_limit', '2000') on conflict (key) do nothing;
create or replace function public.request_withdrawal(p_coin text, p_network text, p_amount_usd numeric, p_address text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_lim numeric; v_kyc text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_amount_usd <= 0 then raise exception 'invalid amount'; end if;
  select (value)::text::numeric into v_lim from settings where key = 'kyc_withdraw_limit';
  select kyc into v_kyc from profiles where id = auth.uid();
  if coalesce(v_lim, 0) > 0 and p_amount_usd > v_lim and v_kyc <> 'verified' then
    raise exception 'Withdrawals above $% require identity verification.', to_char(v_lim, 'FM999999990');
  end if;
  update profiles set balance = balance - round(p_amount_usd, 2)
    where id = auth.uid() and status = 'active' and balance >= round(p_amount_usd, 2);
  if not found then raise exception 'insufficient balance'; end if;
  insert into transactions(user_id, type, amount_usd, coin, network, address)
    values (auth.uid(), 'withdrawal', round(p_amount_usd, 2), p_coin, p_network, trim(p_address)) returning id into v_id;
  return v_id;
end $$;

-- ---------- Admin credita um depósito que viu chegar na corretora ----------
create or replace function public.admin_credit_deposit(p_user uuid, p_amount numeric, p_coin text, p_network text, p_tx_hash text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v numeric := round(p_amount, 2);
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if v <= 0 then raise exception 'Valor inválido.'; end if;
  update profiles set balance = balance + v where id = p_user;
  if not found then raise exception 'Jogador não encontrado.'; end if;
  insert into transactions(user_id, type, status, amount_usd, coin, network, tx_hash, decided_at, decided_by)
    values (p_user, 'deposit', 'completed', v, nullif(p_coin, ''), nullif(p_network, ''), nullif(trim(coalesce(p_tx_hash, '')), ''), now(), auth.uid()) returning id into v_id;
  insert into audit_log(who, what, data) values (auth.uid(), 'credit deposit', jsonb_build_object('user', p_user, 'usd', v, 'coin', p_coin, 'network', p_network, 'tx', p_tx_hash));
  return v_id;
end $$;

revoke all on function public.kyc_submit(jsonb), public.admin_kyc_decide(uuid, boolean, text), public.admin_credit_deposit(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.kyc_submit(jsonb), public.admin_kyc_decide(uuid, boolean, text), public.admin_credit_deposit(uuid, numeric, text, text, text) to authenticated;
