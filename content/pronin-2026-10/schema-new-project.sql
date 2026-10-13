begin;
-- Elaz Ed: схема. Доступ к таблицам только у service role (RLS включён, политик нет).

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.users (
  id bigint primary key,
  first_name text not null default '',
  username text,
  photo_url text,
  xp integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  last_claim date,
  lessons_done integer not null default 0,
  invited integer not null default 0,
  referred_by bigint references public.users (id) on delete set null,
  ref_rewarded boolean not null default false,
  subscribed boolean not null default false,
  sub_checked_at timestamptz,
  is_admin boolean not null default false,
  achievements text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index users_xp_idx on public.users (xp desc);
create index users_referred_by_idx on public.users (referred_by);

create table public.lessons (
  id bigint generated always as identity primary key,
  kind text not null default 'lesson' check (kind in ('lesson', 'story')),
  title text not null,
  subtitle text not null default '',
  category text not null default 'Уроки',
  emoji text not null default '✨',
  gradient text not null default 'aurora',
  cover_url text,
  body text not null default '',
  video_url text,
  copy_text text,
  quiz jsonb not null default '[]',
  minutes integer not null default 3,
  xp integer not null default 50,
  pinned boolean not null default false,
  published boolean not null default false,
  published_at timestamptz,
  views integer not null default 0,
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_feed_idx on public.lessons (published, published_at desc);

create table public.progress (
  user_id bigint not null references public.users (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  xp_earned integer not null default 0,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index progress_lesson_idx on public.progress (lesson_id);

create table public.likes (
  user_id bigint not null references public.users (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index likes_lesson_idx on public.likes (lesson_id);

alter table public.settings enable row level security;
alter table public.users enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;
alter table public.likes enable row level security;

-- Урок засчитывается один раз: XP начисляется только при первой вставке.
create function public.complete_lesson(p_user bigint, p_lesson bigint, p_score integer, p_total integer, p_xp integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.progress (user_id, lesson_id, score, total, xp_earned)
  values (p_user, p_lesson, p_score, p_total, p_xp)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  update public.users
    set xp = xp + p_xp, lessons_done = lessons_done + 1
    where id = p_user;
  return true;
end;
$$;

-- Бонус дня: раз в локальные сутки, стрик растёт только если вчера тоже заходил.
create function public.claim_daily(p_user bigint, p_today date)
returns table (gained integer, new_streak integer)
language plpgsql
set search_path = ''
as $$
declare
  u public.users%rowtype;
  s integer;
  g integer;
begin
  select * into u from public.users where id = p_user for update;
  if not found then
    return query select 0, 0;
    return;
  end if;
  if u.last_claim is not null and u.last_claim >= p_today then
    return query select 0, u.streak;
    return;
  end if;
  if u.last_claim = p_today - 1 then
    s := u.streak + 1;
  else
    s := 1;
  end if;
  g := 10 + least(s, 7) * 5;
  update public.users
    set streak = s, best_streak = greatest(best_streak, s), last_claim = p_today, xp = xp + g
    where id = p_user;
  return query select g, s;
end;
$$;

create function public.toggle_like(p_user bigint, p_lesson bigint)
returns table (liked boolean, likes integer)
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
  total integer;
begin
  delete from public.likes l where l.user_id = p_user and l.lesson_id = p_lesson;
  get diagnostics removed = row_count;
  if removed = 0 then
    insert into public.likes (user_id, lesson_id) values (p_user, p_lesson) on conflict do nothing;
  end if;
  update public.lessons les
    set likes = (select count(*) from public.likes l where l.lesson_id = p_lesson)
    where les.id = p_lesson
    returning les.likes into total;
  return query select removed = 0, coalesce(total, 0);
end;
$$;

create function public.grant_achievements(p_user bigint, p_codes text[])
returns void
language sql
set search_path = ''
as $$
  update public.users
    set achievements = array(select distinct unnest(achievements || p_codes))
    where id = p_user;
$$;

-- Награда за приглашение: один раз, когда приглашённый прошёл проверку подписки.
create function public.reward_referral(p_user bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  ref bigint;
begin
  update public.users
    set ref_rewarded = true, xp = xp + 50
    where id = p_user and referred_by is not null and not ref_rewarded
    returning referred_by into ref;
  if ref is null then
    return null;
  end if;
  update public.users set xp = xp + 100, invited = invited + 1 where id = ref;
  return ref;
end;
$$;

create function public.bump_views(p_lesson bigint)
returns void
language sql
set search_path = ''
as $$
  update public.lessons set views = views + 1 where id = p_lesson;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;


-- Карточки ленты одним запросом: тело отдаём только у сторис, квиз и видео — флагами.
create view public.feed_cards with (security_invoker = true) as
select
  id, kind, title, subtitle, category, emoji, gradient, cover_url, minutes, xp,
  pinned, published, published_at, views, likes,
  jsonb_array_length(quiz) as quiz_count,
  (video_url is not null and video_url <> '') as has_video,
  case when kind = 'story' then body end as body
from public.lessons;

revoke all on public.feed_cards from anon, authenticated;
grant select on public.feed_cards to service_role;

insert into public.settings (key, value) values
  ('channel_invite', '"https://t.me/+k36WMjkFf6BmNDYy"'::jsonb),
  ('bot', '{"username": "elazart_bot"}'::jsonb);


-- Сторис дают XP, но в счётчик пройденных уроков не идут.
create or replace function public.complete_lesson(p_user bigint, p_lesson bigint, p_score integer, p_total integer, p_xp integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.progress (user_id, lesson_id, score, total, xp_earned)
  values (p_user, p_lesson, p_score, p_total, p_xp)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  update public.users
    set xp = xp + p_xp,
        lessons_done = lessons_done + (select case when l.kind = 'lesson' then 1 else 0 end from public.lessons l where l.id = p_lesson)
    where id = p_user;
  return true;
end;
$$;


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


-- Закрытые курсы: набор уроков, доступ за звёзды Telegram, по заявке или за приглашённых друзей.
-- Заодно: заморозка стрика и адреса приложения.

create table public.courses (
  id bigint generated always as identity primary key,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  emoji text not null default '🎓',
  gradient text not null default 'ocean',
  price_stars integer not null default 0 check (price_stars >= 0),
  -- Сколько друзей нужно привести, чтобы курс открылся бесплатно. 0 — механика выключена.
  invite_unlock integer not null default 0 check (invite_unlock >= 0),
  position integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons
  add column course_id bigint references public.courses (id) on delete set null,
  add column position integer not null default 0,
  add column free_preview boolean not null default false;
create index lessons_course_idx on public.lessons (course_id, position) where course_id is not null;

create table public.course_access (
  user_id bigint not null references public.users (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete cascade,
  source text not null check (source in ('stars', 'admin', 'invites')),
  granted_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create index course_access_course_idx on public.course_access (course_id);

create table public.access_requests (
  user_id bigint not null references public.users (id) on delete cascade,
  course_id bigint not null references public.courses (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (user_id, course_id)
);
create index access_requests_course_idx on public.access_requests (course_id, status);

-- Журнал оплат звёздами. charge_id уникален: повторное уведомление Telegram не выдаст доступ дважды.
create table public.payments (
  id bigint generated always as identity primary key,
  user_id bigint references public.users (id) on delete set null,
  course_id bigint references public.courses (id) on delete set null,
  stars integer not null,
  charge_id text not null unique,
  created_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id);
create index payments_course_idx on public.payments (course_id);

alter table public.courses enable row level security;
alter table public.course_access enable row level security;
alter table public.access_requests enable row level security;
alter table public.payments enable row level security;

create or replace view public.feed_cards with (security_invoker = true) as
select
  id, kind, title, subtitle, category, emoji, gradient, cover_url, minutes, xp,
  pinned, published, published_at, views, likes,
  jsonb_array_length(quiz) as quiz_count,
  (video_url is not null and video_url <> '') as has_video,
  case when kind = 'story' then body end as body,
  course_id, position, free_preview
from public.lessons;

-- Заморозка стрика: выдаётся за каждые 7 дней подряд (не больше двух) и спасает один пропущенный день.
alter table public.users add column freezes integer not null default 0;

drop function public.claim_daily(bigint, date);
create function public.claim_daily(p_user bigint, p_today date)
returns table (gained integer, new_streak integer, used_freeze boolean)
language plpgsql
set search_path = ''
as $$
declare
  u public.users%rowtype;
  s integer;
  f integer;
  g integer;
  froze boolean := false;
begin
  select * into u from public.users where id = p_user for update;
  if not found then
    return query select 0, 0, false;
    return;
  end if;
  if u.last_claim is not null and u.last_claim >= p_today then
    return query select 0, u.streak, false;
    return;
  end if;
  f := u.freezes;
  if u.last_claim = p_today - 1 then
    s := u.streak + 1;
  elsif u.last_claim = p_today - 2 and f > 0 then
    s := u.streak + 1;
    f := f - 1;
    froze := true;
  else
    s := 1;
  end if;
  if s % 7 = 0 and f < 2 then
    f := f + 1;
  end if;
  g := 10 + least(s, 7) * 5;
  update public.users
    set streak = s, best_streak = greatest(best_streak, s), last_claim = p_today, xp = xp + g, freezes = f
    where id = p_user;
  return query select g, s, froze;
end;
$$;

revoke execute on function public.claim_daily(bigint, date) from public, anon, authenticated;
grant execute on function public.claim_daily(bigint, date) to service_role;

insert into public.settings (key, value) values
  ('app_url', '"https://elaz-ed.vercel.app"'::jsonb),
  ('api_url', '"https://vllpxpmadouknwawpakm.supabase.co/functions/v1/api"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

update public.settings set value='"https://dcdepwdxvadhludnubis.supabase.co/functions/v1/api"'::jsonb where key='api_url';
commit;
