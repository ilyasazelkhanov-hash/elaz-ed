-- OG CRE8R² production. Run only after /news-publisher mode=inspect confirms
-- the destination, and news_publishing contains its verified numeric chat_id.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
do $$
begin
 if not exists(select 1 from public.settings where key='news_publishing' and value->>'enabled'='true' and value->>'chat_id' is not null)
 then raise exception 'Configure and verify news_publishing before scheduling'; end if;
 if not exists(select 1 from public.settings where key='cron_key' and length(value #>> '{}')>0)
 then raise exception 'cron_key is required'; end if;
end $$;
select cron.schedule('og-news-autopublish','* * * * *',
$job$select net.http_post(
 url:='https://dcdepwdxvadhludnubis.supabase.co/functions/v1/news-publisher',
 headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select value #>> '{}' from public.settings where key='cron_key')),
 body:='{}'::jsonb,timeout_milliseconds:=120000
) where exists(select 1 from public.settings where key='news_publishing' and value->>'enabled'='true');$job$);
