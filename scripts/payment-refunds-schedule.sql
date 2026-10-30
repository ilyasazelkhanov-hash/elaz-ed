-- Deployment step only. Never applied by tests or the application.
-- In Vault create og_api_url = https://PROJECT.supabase.co/functions/v1/api
-- Keep the existing settings.cron_key configured before running this script.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='og_api_url' and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/api$') then
  raise exception 'Configure Vault og_api_url with the verified project API URL';
 end if;
 if not exists(select 1 from public.settings where key='cron_key' and length(value #>> '{}')>0) then raise exception 'Configure settings.cron_key first';end if;
end $$;
select cron.schedule('og-payment-refunds','* * * * *',
$job$select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='og_api_url')||'/payment_refunds',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select value #>> '{}' from public.settings where key='cron_key')),
 body:='{}'::jsonb,timeout_milliseconds:=100000
);$job$);
-- Stop scheduling if required: select cron.unschedule('og-payment-refunds');
-- Do not delete unfinished jobs: they remain the authoritative refund backlog.
