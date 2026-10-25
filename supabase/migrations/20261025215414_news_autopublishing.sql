-- Durable, strictly ordered publications. Only the service worker can operate it.
begin;
create table public.news_publications (
 chat_id bigint not null,
 lesson_id bigint not null references public.lessons(id) on delete cascade,
 status text not null check(status in ('sending','sent','failed','uncertain')),
 attempt_id uuid not null default gen_random_uuid(),
 attempts integer not null default 1,
 attempted_at timestamptz not null default now(),
 retry_at timestamptz,
 message_id bigint,
 sent_at timestamptz,
 error_code text,
 primary key(chat_id,lesson_id)
);
alter table public.news_publications enable row level security;
revoke all on public.news_publications from public,anon,authenticated;
grant select,insert,update on public.news_publications to service_role;

create function public.claim_news_post(p_chat bigint) returns jsonb
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
 select l.* into item from public.lessons l
 where l.published and l.kind='lesson' and l.course_id is null
 and not exists(select 1 from public.news_publications n where n.chat_id=p_chat and n.lesson_id=l.id and n.status='sent')
 order by coalesce(l.published_at,l.created_at),l.id limit 1;
 if item.id is null then return null; end if;
 select * into prior from public.news_publications where chat_id=p_chat and lesson_id=item.id;
 if prior.retry_at>now() then return null; end if;
 insert into public.news_publications(chat_id,lesson_id,status) values(p_chat,item.id,'sending')
 on conflict(chat_id,lesson_id) do update set status='sending',attempt_id=gen_random_uuid(),attempts=news_publications.attempts+1,attempted_at=now(),retry_at=null,error_code=null
 returning attempt_id into token;
 return jsonb_build_object('lesson',to_jsonb(item),'attempt_id',token);
end $$;

create function public.finish_news_post(p_chat bigint,p_lesson bigint,p_attempt uuid,p_status text,p_message bigint,p_error text,p_retry integer) returns boolean
language plpgsql set search_path='' as $$
begin
 if p_status not in ('sent','failed','uncertain') or (p_status='sent' and p_message is null) then raise exception 'invalid_delivery_result'; end if;
 update public.news_publications set status=p_status,message_id=p_message,
 sent_at=case when p_status='sent' then now() end,error_code=left(p_error,120),
 retry_at=case when p_status='failed' then now()+greatest(10,least(coalesce(p_retry,60),86400))*interval '1 second' end
 where chat_id=p_chat and lesson_id=p_lesson and attempt_id=p_attempt and status='sending';
 return found;
end $$;
revoke all on function public.claim_news_post(bigint) from public,anon,authenticated;
revoke all on function public.finish_news_post(bigint,bigint,uuid,text,bigint,text,integer) from public,anon,authenticated;
grant execute on function public.claim_news_post(bigint) to service_role;
grant execute on function public.finish_news_post(bigint,bigint,uuid,text,bigint,text,integer) to service_role;
commit;
