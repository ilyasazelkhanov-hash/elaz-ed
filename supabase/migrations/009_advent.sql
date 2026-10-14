-- Адвент-календарь: двери по дням, игры (квиз, скретч, аркада), коды наград и погашение на кассе.
-- Включается настройкой settings.advent (см. внизу). Пока enabled = false, приложение работает как раньше.

create extension if not exists pgcrypto with schema extensions;

-- Дверь календаря. day — номер дня от старта (1..60).
create table public.advent_doors (
  day integer primary key check (day between 1 and 60),
  kind text not null default 'quiz' check (kind in ('quiz', 'scratch', 'arcade', 'story')),
  title text not null,
  subtitle text not null default '',
  emoji text not null default '🎁',
  -- Текст, который открывается после двери (Markdown).
  body text not null default '',
  -- Квиз: [{q, options, correct, explain}] — правильные ответы клиенту до ответа не отдаются.
  quiz jsonb not null default '[]',
  -- Скретч: что под защитным слоем.
  prize text not null default '',
  -- Аркада: {seconds, cap} — длительность раунда и потолок засчитываемых очков.
  arcade jsonb not null default '{}',
  xp integer not null default 30 check (xp between 0 and 500),
  updated_at timestamptz not null default now()
);

-- Открытая дверь. Одна запись на человека и день: XP начисляется один раз.
create table public.advent_opens (
  user_id bigint not null references public.users (id) on delete cascade,
  day integer not null references public.advent_doors (day) on delete cascade,
  score integer not null default 0,
  total integer not null default 0,
  xp integer not null default 0,
  -- Открыта не в свой день, а позже: XP вполовину.
  late boolean not null default false,
  opened_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index advent_opens_day_idx on public.advent_opens (day);

-- Ступени наград: открыл doors дверей — получаешь код. stock — сколько кодов всего (null — без лимита).
create table public.advent_rewards (
  id bigint generated always as identity primary key,
  doors integer not null check (doors > 0),
  title text not null,
  description text not null default '',
  emoji text not null default '🎁',
  stock integer check (stock is null or stock >= 0),
  position integer not null default 0
);

-- Точка погашения (касса, филиал). PIN хранится как sha256('<id>:<pin>').
create table public.advent_points (
  id bigint generated always as identity primary key,
  name text not null,
  pin_hash text not null,
  fails integer not null default 0,
  locked_until timestamptz
);

-- Выданный код. Один код на человека и ступень.
create table public.reward_codes (
  code text primary key,
  user_id bigint not null references public.users (id) on delete cascade,
  reward_id bigint not null references public.advent_rewards (id) on delete cascade,
  status text not null default 'issued' check (status in ('issued', 'redeemed')),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  point_id bigint references public.advent_points (id) on delete set null,
  unique (user_id, reward_id)
);
create index reward_codes_reward_idx on public.reward_codes (reward_id, status);

alter table public.advent_doors enable row level security;
alter table public.advent_opens enable row level security;
alter table public.advent_rewards enable row level security;
alter table public.advent_points enable row level security;
alter table public.reward_codes enable row level security;

-- Открыть дверь: запись и XP — в одной транзакции. Возвращает, была ли запись новой, и сколько дверей открыто всего.
create function public.advent_open(p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer, p_late boolean)
returns table (inserted boolean, opened integer)
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.advent_opens (user_id, day, score, total, xp, late)
  values (p_user, p_day, p_score, p_total, p_xp, p_late)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.users set xp = xp + p_xp where id = p_user;
  end if;
  return query select n > 0, (select count(*)::integer from public.advent_opens o where o.user_id = p_user);
end;
$$;

-- Погасить код на точке. Повторное погашение невозможно: статус меняется только из issued.
create function public.redeem_code(p_code text, p_point bigint)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c public.reward_codes%rowtype;
  r public.advent_rewards%rowtype;
begin
  update public.reward_codes
    set status = 'redeemed', redeemed_at = now(), point_id = p_point
    where code = p_code and status = 'issued'
    returning * into c;
  if not found then
    select * into c from public.reward_codes where code = p_code;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    return jsonb_build_object('ok', false, 'error', 'already', 'redeemed_at', c.redeemed_at);
  end if;
  select * into r from public.advent_rewards where id = c.reward_id;
  return jsonb_build_object('ok', true, 'title', r.title, 'emoji', r.emoji);
end;
$$;

-- Сводка для админки: участники, открытия по дням, коды по ступеням и точкам.
create function public.advent_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
select jsonb_build_object(
  'participants', (select count(distinct user_id) from public.advent_opens),
  'opens', (select count(*) from public.advent_opens),
  'by_day', (
    select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'title', d.title, 'kind', d.kind,
      'opens', (select count(*) from public.advent_opens o where o.day = d.day),
      'late', (select count(*) from public.advent_opens o where o.day = d.day and o.late)) order by d.day), '[]'::jsonb)
    from public.advent_doors d
  ),
  'rewards', (
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'doors', r.doors, 'stock', r.stock,
      'issued', (select count(*) from public.reward_codes c where c.reward_id = r.id),
      'redeemed', (select count(*) from public.reward_codes c where c.reward_id = r.id and c.status = 'redeemed')) order by r.doors), '[]'::jsonb)
    from public.advent_rewards r
  ),
  'points', (
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name,
      'redeemed', (select count(*) from public.reward_codes c where c.point_id = p.id)) order by p.id), '[]'::jsonb)
    from public.advent_points p
  )
);
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Настройки календаря. start — первый день по часовому поясу tz (минуты от UTC, 300 = Алматы).
-- grace — сколько дней после последней двери ещё можно открыть пропущенные.
-- push_hour — во сколько по tz бот напоминает о новой двери (нужен cron, см. README).
insert into public.settings (key, value) values
  ('advent', '{"enabled": false, "title": "Адвент-календарь", "start": "2026-12-08", "days": 24, "tz": 300, "grace": 3, "push_hour": 10}'::jsonb),
  ('cron_key', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')))
on conflict (key) do nothing;
