-- =====================================================================
-- Câmbio para mostrar o saldo em outras moedas (BRL, ARS, CAD, EUR...).
-- O saldo continua em dólar; isto só muda a exibição. Gravado como coin = 'FX:BRL' etc.
-- (valor = quantos BRL valem 1 dólar, via USDT na CoinGecko)
-- =====================================================================
create or replace function public.rd_prices_tick()
returns void language plpgsql security definer set search_path = public, net as $$
declare r record; j jsonb; m jsonb := '{"BTC":"bitcoin","ETH":"ethereum","USDT":"tether","USDC":"usd-coin","SOL":"solana","LTC":"litecoin","DOGE":"dogecoin","TRX":"tron","BNB":"binancecoin"}'; k text; usd numeric;
  fx text[] := array['brl','ars','cad','eur','gbp','mxn','clp','cop','pen','aud','jpy','inr','try','php'];
begin
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
      usd := (j->'tether'->>'usd')::numeric;
      if usd > 0 then
        foreach k in array fx loop
          if (j->'tether'->>k) is not null then
            insert into prices(coin, usd, updated_at) values ('FX:' || upper(k), round((j->'tether'->>k)::numeric / usd, 6), r.created)
            on conflict (coin) do update set usd = excluded.usd, updated_at = excluded.updated_at where prices.updated_at < excluded.updated_at;
          end if;
        end loop;
      end if;
    exception when others then null;
    end;
  end if;
  perform net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,usd-coin,solana,litecoin,dogecoin,tron,binancecoin&vs_currencies=usd,' || array_to_string(fx, ','));
end $$;
revoke all on function public.rd_prices_tick() from public, anon, authenticated;
select public.rd_prices_tick();
