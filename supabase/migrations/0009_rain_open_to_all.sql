-- Chuva de hora em hora: $1 da casa e qualquer jogador logado pode entrar (sem apostado mínimo)
update public.settings set value = '{"enabled": true, "amount": 1, "min_wager": 0}' where key = 'rain_auto';
update public.rains set min_wager = 0 where status = 'open' and auto;
