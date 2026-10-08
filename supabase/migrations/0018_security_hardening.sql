-- =====================================================================
-- Segurança: o navegador só LÊ (onde as regras deixam) e só ESCREVE via funções do servidor.
-- Corrige: as views my_rounds/my_seeds aceitavam UPDATE/DELETE pelo navegador
-- (views rodam com o dono e ignoravam as regras de linha das tabelas).
-- =====================================================================
do $$ declare r record; begin
  for r in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
-- Tabelas e views criadas no futuro também nascem sem escrita pelo navegador
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
-- Funções novas não ficam abertas para visitantes sem login por padrão
alter default privileges in schema public revoke execute on functions from public, anon;
-- Funções que exigem login não precisam estar abertas a visitantes
revoke execute on function public.request_deposit(text, text, numeric, text), public.request_withdrawal(text, text, numeric, text), public.my_affiliate(), public.my_bonus_state() from anon, public;
grant execute on function public.request_deposit(text, text, numeric, text), public.request_withdrawal(text, text, numeric, text), public.my_affiliate(), public.my_bonus_state() to authenticated;
-- Views com barreira de segurança (o filtro do dono vem antes de qualquer outro)
alter view public.my_rounds set (security_barrier = true);
alter view public.my_seeds set (security_barrier = true);
