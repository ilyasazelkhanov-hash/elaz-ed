-- Explicit eligibility keeps course practice out of discovery without deleting old links.
begin;
alter table public.lessons add column if not exists news_eligible boolean not null default true;
alter table public.lessons add column if not exists editorial jsonb;

create or replace function public.enforce_news_eligibility() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.course_id is not null or (new.kind='lesson' and md5(new.body) in ('c2e5ad8dd64469df44efbd050d287cba','e20cb6ad706303a6f19b14eb5c442509','0b69fc060203475a2f1bc1ca9262ff29','8004595e4826be22c3f734866adba631','9163660ed60ffdaacf3bb2432979562a','6df607f4078890c8bf402a20e09ac1f0','e1183a2cda48d11331972f091708d238','b22d8e70dac2ea8859c5fe845c30ce65')) then new.news_eligible:=false; end if;
 return new;
end $$;
revoke all on function public.enforce_news_eligibility() from public,anon,authenticated;
grant execute on function public.enforce_news_eligibility() to service_role;
drop trigger if exists lessons_news_eligibility on public.lessons;
create trigger lessons_news_eligibility before insert or update of body,course_id,news_eligible on public.lessons for each row execute function public.enforce_news_eligibility();

update public.lessons set news_eligible=false where kind='lesson' and course_id is null and news_eligible and md5(body) in ('c2e5ad8dd64469df44efbd050d287cba','e20cb6ad706303a6f19b14eb5c442509','0b69fc060203475a2f1bc1ca9262ff29','8004595e4826be22c3f734866adba631','9163660ed60ffdaacf3bb2432979562a','6df607f4078890c8bf402a20e09ac1f0','e1183a2cda48d11331972f091708d238','b22d8e70dac2ea8859c5fe845c30ce65');
insert into public.settings(key,value) values('news_policy:course-practice-2026-11-07',jsonb_build_object('checked_at',now(),'source','reference-practice-2026-10-26-v1','excluded',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from public.lessons where kind='lesson' and course_id is null and not news_eligible and md5(body) in ('c2e5ad8dd64469df44efbd050d287cba','e20cb6ad706303a6f19b14eb5c442509','0b69fc060203475a2f1bc1ca9262ff29','8004595e4826be22c3f734866adba631','9163660ed60ffdaacf3bb2432979562a','6df607f4078890c8bf402a20e09ac1f0','e1183a2cda48d11331972f091708d238','b22d8e70dac2ea8859c5fe845c30ce65')))) on conflict(key) do update set value=excluded.value;

create or replace view public.feed_cards with (security_invoker=true) as
select id,kind,title,subtitle,category,emoji,gradient,cover_url,minutes,xp,
 pinned,published,published_at,views,likes,jsonb_array_length(quiz) as quiz_count,
 (video_url is not null and video_url<>'') as has_video,
 case when kind='story' then body end as body,course_id,position,free_preview,editorial,news_eligible
from public.lessons where kind='story' or course_id is not null or news_eligible;

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
 select l.* into item from public.lessons l
 where l.published and l.kind='lesson' and l.course_id is null and l.news_eligible
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


revoke all on function public.claim_news_post(bigint) from public,anon,authenticated;
grant execute on function public.claim_news_post(bigint) to service_role;
commit;
