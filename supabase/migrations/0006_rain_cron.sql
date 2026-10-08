-- Encerra e divide chuvas vencidas a cada minuto (pg_cron)
create extension if not exists pg_cron;
select cron.schedule('rain-settle', '* * * * *', $$select public.rain_settle()$$);
