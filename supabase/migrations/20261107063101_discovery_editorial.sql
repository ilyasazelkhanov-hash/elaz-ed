-- Additive metadata and service-only reporting. Existing private lesson bodies stay private.
alter table public.lessons add column if not exists editorial jsonb;
alter table public.lessons add constraint lessons_editorial_object check (editorial is null or jsonb_typeof(editorial) = 'object');

create or replace view public.feed_cards with (security_invoker = true) as
select id, kind, title, subtitle, category, emoji, gradient, cover_url, minutes, xp,
 pinned, published, published_at, views, likes, jsonb_array_length(quiz) as quiz_count,
 (video_url is not null and video_url <> '') as has_video,
 case when kind = 'story' then body end as body, course_id, position, free_preview, editorial
from public.lessons;

insert into public.settings(key,value) values
 ('discovery_measurement_started_at',to_jsonb(now())),
 ('release_schema:og-roadmap-v1','{"editorial":true,"discovery_summary":true}'::jsonb)
on conflict(key) do nothing;

create function public.discovery_summary(p_now timestamptz default now())
returns jsonb language sql stable set search_path = '' as $$
with
 cfg as (select p_now as t, coalesce((select (value #>> '{}')::timestamptz from public.settings where key='discovery_measurement_started_at'),p_now) as started),
 ev as (select e.* from public.events e,cfg where e.created_at>=cfg.started and e.created_at<cfg.t and e.name in ('guide_open','guide_copy','guide_try','guide_feedback','lesson_open','discovery_open','course_view','course_preview','checkout_start','checkout_result')),
 reads as (
  select e.user_id,e.created_at from ev e where e.name='guide_open'
  union all
  select e.user_id,e.created_at from ev e join public.lessons l on l.id=e.lesson_id
   where e.name='lesson_open' and l.kind='lesson' and l.course_id is null
 ),
 tries as (select user_id,min(created_at) as first_at from ev where name='guide_try' group by user_id having min(created_at)>=(select t-interval '30 days' from cfg)),
 fresh as (select u.id,u.created_at from public.users u,cfg where u.created_at>=greatest(cfg.started,cfg.t-interval '30 days') and u.created_at<cfg.t),
 recent as (select e.* from ev e,cfg where e.created_at>=cfg.t-interval '30 days'),
 feedback as (select distinct on(user_id,props->>'guide_id') user_id,props from recent where name='guide_feedback' order by user_id,props->>'guide_id',created_at desc,id desc),
 weekly as (select r.user_id,count(distinct (r.created_at at time zone 'UTC')::date) as days from reads r,cfg where r.created_at>=cfg.t-interval '7 days' group by r.user_id),
 guides as (select e.props->>'guide_id' as id,
  count(distinct e.user_id) filter(where e.name='guide_open') as opened,
  count(distinct e.user_id) filter(where e.name='guide_copy') as copied,
  count(distinct e.user_id) filter(where e.name='guide_try') as tried
  from recent e where e.name in ('guide_open','guide_copy','guide_try') group by e.props->>'guide_id'),
 entry as (select distinct on(e.user_id) e.user_id,e.props->>'source' as source from ev e join fresh f on f.id=e.user_id where e.name='discovery_open' order by e.user_id,e.created_at,e.id),
 course_events as (select e.*, (e.props->>'course_id')::bigint as course_id from recent e where e.name in ('course_view','course_preview','checkout_start','checkout_result') and e.props->>'course_id' ~ '^[0-9]{1,15}$'),
 checkouts as (select user_id,course_id,min(created_at) as first_at from course_events where name='checkout_start' group by user_id,course_id),
 purchases as (select p.* from public.payments p,cfg where p.created_at>=cfg.t-interval '30 days' and p.created_at<cfg.t and p.course_id is not null),
 course_stats as (select c.id,c.title,
  (select count(distinct user_id) from course_events e where e.course_id=c.id and e.name='course_view') as viewed,
  (select count(distinct user_id) from course_events e where e.course_id=c.id and e.name='course_preview') as previewed,
  (select count(*) from checkouts x where x.course_id=c.id) as checkout_users,
  (select count(*) from checkouts x,cfg where x.course_id=c.id and x.first_at<=cfg.t-interval '7 days') as mature_checkout_users,
  (select count(*) from checkouts x,cfg where x.course_id=c.id and x.first_at<=cfg.t-interval '7 days' and exists(select 1 from purchases p where p.course_id=x.course_id and p.user_id=x.user_id and p.created_at>=x.first_at and p.created_at<x.first_at+interval '7 days' and p.refunded_at is null and not p.refund_pending)) as converted,
  (select count(distinct user_id) from purchases p where p.course_id=c.id and p.refunded_at is null and not p.refund_pending) as buyers,
  (select count(*) from purchases p where p.course_id=c.id and p.refunded_at is null and not p.refund_pending) as purchases,
  (select coalesce(sum(stars),0) from purchases p where p.course_id=c.id and p.refunded_at is null and not p.refund_pending) as stars,
  (select count(*) from purchases p where p.course_id=c.id and p.refunded_at is not null) as refunded,
  (select coalesce(sum(stars),0) from purchases p where p.course_id=c.id and p.refunded_at is not null) as refunded_stars,
  (select count(*) from purchases p where p.course_id=c.id and p.refund_pending and p.refunded_at is null) as refund_pending
 from public.courses c where c.published or exists(select 1 from purchases p where p.course_id=c.id))
select jsonb_build_object(
 'available',true,'as_of',cfg.t,'started_at',cfg.started,'window_days',30,
 'activation',jsonb_build_object(
  'eligible',(select count(*) from fresh f where f.created_at<=cfg.t-interval '7 days'),
  'attempted',(select count(*) from fresh f where f.created_at<=cfg.t-interval '7 days' and exists(select 1 from ev e where e.user_id=f.id and e.name='guide_try' and e.created_at>=f.created_at and e.created_at<f.created_at+interval '7 days')),
  'waiting',(select count(*) from fresh f where f.created_at>cfg.t-interval '7 days')),
 'return14',jsonb_build_object(
  'eligible',(select count(*) from tries x where x.first_at<=cfg.t-interval '14 days'),
  'returned',(select count(*) from tries x where x.first_at<=cfg.t-interval '14 days' and exists(select 1 from reads r where r.user_id=x.user_id and r.created_at>=x.first_at+interval '7 days' and r.created_at<x.first_at+interval '14 days')),
  'waiting',(select count(*) from tries x where x.first_at>cfg.t-interval '14 days')),
 'repeat7',jsonb_build_object('readers',(select count(*) from weekly),'repeated',(select count(*) from weekly where days>=2)),
 'feedback',jsonb_build_object('positive',(select count(*) from feedback where props->'useful'='true'::jsonb),'responses',(select count(*) from feedback)),
 'guides',(select coalesce(jsonb_agg(to_jsonb(g) order by g.opened desc,g.id),'[]'::jsonb) from guides g),
 'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (select coalesce(source,'direct') as source,count(*) as users from entry group by source) s),
 'courses',(select coalesce(jsonb_agg(to_jsonb(c) order by c.viewed desc,c.id),'[]'::jsonb) from course_stats c)
) from cfg;
$$;
revoke execute on function public.discovery_summary(timestamptz) from public,anon,authenticated;
grant execute on function public.discovery_summary(timestamptz) to service_role;
