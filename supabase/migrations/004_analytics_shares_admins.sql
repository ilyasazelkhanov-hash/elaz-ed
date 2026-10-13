-- Аналитика: журнал событий и сводка для админки. Картинки для сторис. Список админов.

create table public.events (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  name text not null,
  lesson_id bigint references public.lessons (id) on delete set null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_name_time_idx on public.events (name, created_at desc);
create index events_user_time_idx on public.events (user_id, created_at desc);
create index events_lesson_idx on public.events (lesson_id) where lesson_id is not null;
alter table public.events enable row level security;

-- Сводка за p_days дней. p_tz — смещение админа от UTC в минутах, чтобы «сегодня» совпадало с его календарём.
create function public.analytics_summary(p_days integer, p_tz integer)
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
      (select count(distinct e.user_id) from public.events e where e.name = 'lesson_open' and e.lesson_id = l.id) as opens,
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

revoke execute on function public.analytics_summary(integer, integer) from public, anon, authenticated;
grant execute on function public.analytics_summary(integer, integer) to service_role;

-- Публичное хранилище картинок для сторис: по одному файлу на вид карточки у каждого пользователя.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shares', 'shares', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Админы по @username. null — аккаунт ещё не входил; после первого входа сюда запишется его Telegram ID.
insert into public.settings (key, value)
values ('admins', '{"elazart": null, "elazartist": null}'::jsonb)
on conflict (key) do nothing;
