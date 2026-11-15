-- Новость только для Mini App. telegram_publish=false оставляет публикацию в ленте и блоге,
-- но очередь Telegram её не берёт. Остальные новости по-прежнему выходят в Mini App и в канале:
-- общий cron не отключается, news_eligible не меняется (он скрыл бы новость из ленты).
begin;

alter table public.lessons add column if not exists telegram_publish boolean not null default true;

create or replace function public.claim_news_post(p_chat bigint) returns jsonb
language plpgsql set search_path='' as $$
declare cfg jsonb; item public.lessons; prior public.news_publications; token uuid;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('news:'||p_chat::text,0)) then return null; end if;
 select value into cfg from public.settings where key='news_publishing';
 if cfg is null or coalesce((cfg->>'enabled')::boolean,false)=false or (cfg->>'chat_id')::bigint is distinct from p_chat then return null; end if;
 -- Unknown delivery after a crash must be reconciled, never blindly resent.
 update public.news_publications set status='uncertain',error_code='worker_interrupted'
 where chat_id=p_chat and status='sending' and attempted_at<now()-interval '2 minutes';
 if exists(select 1 from public.news_publications where chat_id=p_chat and status in ('sending','uncertain')) then return null; end if;
 if exists(select 1 from public.news_publications where chat_id=p_chat and attempted_at>now()-interval '5 seconds') then return null; end if;
 -- Строка блокируется до конца транзакции: отметка «только Mini App», поставленная параллельно,
 -- либо уже видна здесь, либо дождётся записи о начатой отправке.
 select l.* into item from public.lessons l
 where l.published and l.kind='lesson' and l.course_id is null and l.news_eligible and l.telegram_publish
 and not exists(select 1 from public.news_publications n where n.chat_id=p_chat and n.lesson_id=l.id and n.status='sent')
 order by coalesce(l.published_at,l.created_at),l.id limit 1 for update of l;
 if item.id is null then return null; end if;
 select * into prior from public.news_publications where chat_id=p_chat and lesson_id=item.id;
 if prior.retry_at>now() then return null; end if;
 insert into public.news_publications(chat_id,lesson_id,status) values(p_chat,item.id,'sending')
 on conflict(chat_id,lesson_id) do update set status='sending',attempt_id=gen_random_uuid(),attempts=news_publications.attempts+1,attempted_at=now(),retry_at=null,error_code=null
 returning attempt_id into token;
 return jsonb_build_object('lesson',to_jsonb(item),'attempt_id',token);
end $$;

revoke all on function public.claim_news_post(bigint) from public,anon,authenticated;
grant execute on function public.claim_news_post(bigint) to service_role;
commit;
