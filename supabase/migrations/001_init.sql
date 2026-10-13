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
