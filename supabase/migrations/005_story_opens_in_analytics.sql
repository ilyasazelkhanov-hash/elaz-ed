-- Сторис открываются из ленты без запроса урока, поэтому их открытия считаем по событию story_open.
create or replace function public.analytics_summary(p_days integer, p_tz integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
with
  cfg as (
    select make_interval(mins => p_tz) as off, ((now() + make_interval(mins => p_tz))::date) as today
  ),
  days as (
    select generate_series(cfg.today - (p_days - 1), cfg.today, interval '1 day')::date as d from cfg
  ),
  opens as (
    select distinct e.user_id, ((e.created_at + cfg.off)::date) as d
    from public.events e, cfg
    where e.name = 'open' and e.created_at > now() - interval '45 days'
  ),
  cohort as (
    select u.id, ((u.created_at + cfg.off)::date) as d from public.users u, cfg
  ),
  done as (
    select ((p.completed_at + cfg.off)::date) as d, count(*) as n
    from public.progress p
    join public.lessons l on l.id = p.lesson_id and l.kind = 'lesson', cfg
    group by 1
  ),
  series as (
    select
      days.d,
      (select count(*) from opens o where o.d = days.d) as active,
      (select count(*) from cohort c where c.d = days.d) as fresh,
      coalesce((select n from done where done.d = days.d), 0) as done
    from days
  ),
  lesson_stats as (
    select
      l.id, l.title, l.emoji, l.kind, l.likes,
      (select count(distinct e.user_id) from public.events e where e.name in ('lesson_open', 'story_open') and e.lesson_id = l.id) as opens,
      (select count(*) from public.progress p where p.lesson_id = l.id) as done,
      (select round(avg(p.score::numeric / p.total) * 100) from public.progress p where p.lesson_id = l.id and p.total > 0) as quiz,
      (select count(*) from public.events e where e.name = 'share' and e.lesson_id = l.id) as shares
    from public.lessons l
    where l.published
  )
select jsonb_build_object(
  'totals', (
    select jsonb_build_object(
      'users', (select count(*) from public.users),
      'subscribed', (select count(*) from public.users where subscribed),
      'new7', (select count(*) from cohort where d > cfg.today - 7),
      'dau', (select count(*) from opens where d = cfg.today),
      'wau', (select count(distinct user_id) from opens where d > cfg.today - 7),
      'mau', (select count(distinct user_id) from opens where d > cfg.today - 30)
    ) from cfg
  ),
  'series', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'active', active, 'fresh', fresh, 'done', done) order by d), '[]'::jsonb) from series),
  'funnel', jsonb_build_object(
    'opened', (select count(*) from public.users),
    'subscribed', (select count(*) from public.users where subscribed),
    'done1', (select count(*) from public.users where lessons_done >= 1),
    'done3', (select count(*) from public.users where lessons_done >= 3),
    'streak3', (select count(*) from public.users where best_streak >= 3)
  ),
  -- Возврат на N-й день: доля тех, кто пришёл d дней назад и открыл приложение ровно через N дней.
  'retention', (
    select jsonb_build_object(
      'd1n', (select count(*) from cohort c where c.d between cfg.today - 14 and cfg.today - 1),
      'd1', (select count(*) from cohort c where c.d between cfg.today - 14 and cfg.today - 1
              and exists (select 1 from opens o where o.user_id = c.id and o.d = c.d + 1)),
      'd7n', (select count(*) from cohort c where c.d between cfg.today - 30 and cfg.today - 7),
      'd7', (select count(*) from cohort c where c.d between cfg.today - 30 and cfg.today - 7
              and exists (select 1 from opens o where o.user_id = c.id and o.d = c.d + 7))
    ) from cfg
  ),
  'lessons', (select coalesce(jsonb_agg(to_jsonb(ls) order by ls.opens desc, ls.done desc), '[]'::jsonb) from lesson_stats ls),
  'shares', (
    select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'channel', s.channel, 'n', s.n) order by s.n desc), '[]'::jsonb)
    from (
      select coalesce(e.props ->> 'kind', '—') as kind, coalesce(e.props ->> 'channel', '—') as channel, count(*) as n
      from public.events e
      where e.name = 'share' and e.created_at > now() - interval '30 days'
      group by 1, 2
    ) s
  ),
  'invited', (select coalesce(sum(invited), 0) from public.users)
);
$$;
