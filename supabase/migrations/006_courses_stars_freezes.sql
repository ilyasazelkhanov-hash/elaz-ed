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
