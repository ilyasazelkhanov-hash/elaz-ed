-- Адвент: билеты «догнать» и призы разных видов.
-- Пропущенную дверь можно открыть только за билет. Билет дают проверяемые действия:
-- урок с квизом без ошибок, приглашённый друг, переход по ссылке из сторис, оплата звёздами.

-- Вид приза и его содержимое. promo — уникальный код с погашением на кассе (как раньше),
-- message — текст, link и video — ссылка, lesson и course — доступ к уроку или курсу.
alter table public.advent_rewards
  add column if not exists kind text not null default 'promo' check (kind in ('promo', 'message', 'link', 'video', 'lesson', 'course')),
  add column if not exists payload jsonb not null default '{}';

-- Курс может открыть приз календаря.
alter table public.course_access drop constraint if exists course_access_source_check;
alter table public.course_access add constraint course_access_source_check check (source in ('stars', 'admin', 'invites', 'advent'));

-- Отдельный урок закрытого курса, открытый призом — без доступа ко всему курсу.
create table if not exists public.lesson_access (
  user_id bigint not null references public.users (id) on delete cascade,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  source text not null default 'advent',
  granted_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_access enable row level security;

-- Оплата звёздами бывает за курс и за билет календаря.
alter table public.payments add column if not exists purpose text not null default 'course' check (purpose in ('course', 'catchup'));

-- Билеты. ref уникален: одно действие (друг, урок, оплата, переход из сторис) не даёт второй билет.
create table if not exists public.advent_tickets (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  source text not null check (source in ('quiz', 'invite', 'story', 'stars', 'admin')),
  ref text not null unique,
  created_at timestamptz not null default now(),
  used_day integer,
  used_at timestamptz,
  -- Звёзды за билет вернули, а билет не был потрачен.
  revoked_at timestamptz
);
create index if not exists advent_tickets_free_idx on public.advent_tickets (user_id) where used_at is null and revoked_at is null;
alter table public.advent_tickets enable row level security;

-- Открыть пропущенную дверь за билет. Билет, запись открытия и XP — в одной транзакции:
-- билет не списывается без открытия и дверь не открывается без билета.
create or replace function public.advent_open_late(p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer)
returns table (inserted boolean, opened integer, ticket boolean)
language plpgsql
set search_path = ''
as $$
declare
  t bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('advent:' || p_user::text, 0));
  if exists (select 1 from public.advent_opens where user_id = p_user and day = p_day) then
    return query select false, (select count(*)::integer from public.advent_opens o where o.user_id = p_user), true;
    return;
  end if;
  select id into t from public.advent_tickets
    where user_id = p_user and used_at is null and revoked_at is null
    order by id limit 1 for update;
  if t is null then
    return query select false, (select count(*)::integer from public.advent_opens o where o.user_id = p_user), false;
    return;
  end if;
  update public.advent_tickets set used_at = now(), used_day = p_day where id = t;
  insert into public.advent_opens (user_id, day, score, total, xp, late) values (p_user, p_day, p_score, p_total, p_xp, true);
  update public.users set xp = xp + p_xp where id = p_user;
  return query select true, (select count(*)::integer from public.advent_opens o where o.user_id = p_user), true;
end;
$$;

revoke execute on function public.advent_open_late(bigint, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.advent_open_late(bigint, integer, integer, integer, integer) to service_role;
