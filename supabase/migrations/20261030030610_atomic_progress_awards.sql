-- Existing secured quiz/daily operations and their awards commit together.
create function public.complete_lesson_awarded(p_user bigint,p_lesson bigint,p_score integer,p_total integer,p_xp integer,p_tz integer)
returns jsonb language plpgsql set search_path='' as $$
declare inserted boolean; u public.users%rowtype; p public.progress%rowtype; codes text[]:='{}'; fresh text[]; kind text;
begin
 select * into strict u from public.users where id=p_user for update;
 -- Historical receipts can be replayed even if the author's current quiz changed.
 if exists(select 1 from public.progress where user_id=p_user and lesson_id=p_lesson) then inserted:=false;
 else inserted:=public.complete_lesson(p_user,p_lesson,p_score,p_total,p_xp);end if;
 select * into strict u from public.users where id=p_user;
 select * into strict p from public.progress where user_id=p_user and lesson_id=p_lesson;
 select l.kind into kind from public.lessons l where l.id=p_lesson;
 if kind='lesson' then
  if u.lessons_done>=1 then codes:=codes||array['first'];end if;
  if u.lessons_done>=5 then codes:=codes||array['five'];end if;
  if u.lessons_done>=10 then codes:=codes||array['ten'];end if;
  if p.total>0 and p.score=p.total then codes:=codes||array['perfect'];end if;
  if extract(hour from (p.completed_at at time zone 'UTC')+make_interval(mins=>greatest(-720,least(840,coalesce(p_tz,0)))))<5 then codes:=codes||array['night'];end if;
 end if;
 select coalesce(array_agg(c),'{}') into fresh from unnest(codes) c where not c=any(u.achievements);
 if cardinality(fresh)>0 then perform public.grant_achievements(p_user,fresh);end if;
 return jsonb_build_object('inserted',inserted,'new_achievements',fresh);
end $$;

create function public.claim_daily_awarded(p_user bigint,p_today date)
returns jsonb language plpgsql set search_path='' as $$
declare r record; u public.users%rowtype; codes text[]:='{}'; fresh text[];
begin
 select * into strict u from public.users where id=p_user for update;
 select * into r from public.claim_daily(p_user,p_today);
 select * into strict u from public.users where id=p_user;
 if u.best_streak>=3 then codes:=codes||array['streak3'];end if;
 if u.best_streak>=7 then codes:=codes||array['streak7'];end if;
 if u.best_streak>=30 then codes:=codes||array['streak30'];end if;
 select coalesce(array_agg(c),'{}') into fresh from unnest(codes) c where not c=any(u.achievements);
 if cardinality(fresh)>0 then perform public.grant_achievements(p_user,fresh);end if;
 return jsonb_build_object('gained',r.gained,'new_streak',r.new_streak,'used_freeze',r.used_freeze,'new_achievements',fresh);
end $$;
revoke all on function public.complete_lesson_awarded(bigint,bigint,integer,integer,integer,integer),public.claim_daily_awarded(bigint,date) from public,anon,authenticated;
grant execute on function public.complete_lesson_awarded(bigint,bigint,integer,integer,integer,integer),public.claim_daily_awarded(bigint,date) to service_role;
