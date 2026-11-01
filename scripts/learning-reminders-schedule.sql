-- Deployment step after the schema migration and API function are deployed.
-- Reuses the existing Vault secret og_api_url and settings.cron_key.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='og_api_url' and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/api$') then
  raise exception 'Configure Vault og_api_url with the verified project API URL';
 end if;
 if not exists(select 1 from public.settings where key='cron_key' and length(value #>> '{}')>0) then raise exception 'Configure settings.cron_key first';end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='og-learning-reminders';
select cron.schedule('og-learning-reminders','0 * * * *',
$job$select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='og_api_url')||'/learning_reminders',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select value #>> '{}' from public.settings where key='cron_key')),
 body:='{}'::jsonb,timeout_milliseconds:=100000
);$job$);
-- Stop scheduling: select cron.unschedule('og-learning-reminders');
