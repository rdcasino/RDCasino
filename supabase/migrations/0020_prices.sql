-- =====================================================================
-- Cotações das moedas (para o jogador ver o saldo em BTC, ETH, ...).
-- O servidor busca na CoinGecko a cada 2 minutos; o site só lê a tabela.
-- O saldo continua em dólar por dentro: a cotação só muda a exibição.
-- =====================================================================
create extension if not exists pg_net;

create table if not exists public.prices (coin text primary key, usd numeric not null, updated_at timestamptz not null default now());
alter table public.prices enable row level security;
drop policy if exists prices_read on public.prices;
create policy prices_read on public.prices for select using (true);
grant select on public.prices to anon, authenticated;
insert into public.prices(coin, usd) values ('USDT', 1), ('USDC', 1) on conflict do nothing;

create or replace function public.rd_prices_tick()
returns void language plpgsql security definer set search_path = public, net as $$
declare r record; j jsonb; m jsonb := '{"BTC":"bitcoin","ETH":"ethereum","USDT":"tether","USDC":"usd-coin","SOL":"solana","LTC":"litecoin","DOGE":"dogecoin","TRX":"tron","BNB":"binancecoin"}'; k text;
begin
  -- grava a resposta mais recente que chegou (a busca é assíncrona)
  select * into r from net._http_response where status_code = 200 and content like '{"%' order by created desc limit 1;
  if found then
    begin
      j := r.content::jsonb;
      for k in select jsonb_object_keys(m) loop
        if (j->(m->>k)->>'usd') is not null then
          insert into prices(coin, usd, updated_at) values (k, (j->(m->>k)->>'usd')::numeric, r.created)
          on conflict (coin) do update set usd = excluded.usd, updated_at = excluded.updated_at where prices.updated_at < excluded.updated_at;
        end if;
      end loop;
    exception when others then null;
    end;
  end if;
  perform net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin,solana,litecoin,dogecoin,tron,binancecoin&vs_currencies=usd');
end $$;
revoke all on function public.rd_prices_tick() from public, anon, authenticated;

select cron.unschedule('rd-prices') where exists (select 1 from cron.job where jobname = 'rd-prices');
select cron.schedule('rd-prices', '*/2 * * * *', 'select public.rd_prices_tick()');
select public.rd_prices_tick();
