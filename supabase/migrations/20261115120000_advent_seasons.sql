-- Сезоны адвента. Аддитивное разделение кампаний: прежние двери, открытия, билеты, призы и коды
-- остаются на месте и получают метку 'legacy'. Новый сезон живёт в тех же таблицах под своим id,
-- поэтому день 1 нового сезона не переинтерпретирует день 1 прежнего календаря.
-- Ничего не удаляется и не пересчитывается: XP, выданные коды, доступы и погашения не меняются.
--
-- Порядок выпуска: эта миграция -> Edge Function api (она передаёт p_season) -> seed нового сезона ->
-- включение сезона в settings.advent. До включения активным остаётся 'legacy', и прежний API работает как раньше.

-- Реестр сезонов. config - снимок settings.advent на момент архивации: по нему показывается архив.
create table public.advent_seasons (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  config jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.advent_seasons enable row level security;
revoke all on table public.advent_seasons from public, anon, authenticated;
grant select, insert, update on public.advent_seasons to service_role;

insert into public.advent_seasons (id, config)
select 'legacy', coalesce((select value from public.settings where key = 'advent'), '{}'::jsonb)
on conflict (id) do nothing;

-- Активный сезон берётся из settings.advent.season; без него или с некорректным значением - 'legacy'.
create function public.advent_active_season()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case when value ->> 'season' ~ '^[a-z0-9][a-z0-9-]{0,39}$' then value ->> 'season' end
       from public.settings where key = 'advent'),
    'legacy');
$$;
revoke all on function public.advent_active_season() from public, anon, authenticated;
grant execute on function public.advent_active_season() to service_role;

-- Существующие строки помечаются константой 'legacy'. Затем значением по умолчанию становится активный сезон:
-- вставки без явного сезона (например, билет из функции оплаты звёздами) попадают в идущую кампанию.
alter table public.advent_doors add column season text not null default 'legacy';
alter table public.advent_opens add column season text not null default 'legacy';
alter table public.advent_rewards add column season text not null default 'legacy';
alter table public.advent_tickets add column season text not null default 'legacy';
alter table public.advent_doors alter column season set default public.advent_active_season();
alter table public.advent_opens alter column season set default public.advent_active_season();
alter table public.advent_rewards alter column season set default public.advent_active_season();
alter table public.advent_tickets alter column season set default public.advent_active_season();

-- Ключи: дверь уникальна внутри сезона, открытие - на человека, сезон и день.
alter table public.advent_opens drop constraint advent_opens_day_fkey;
alter table public.advent_opens drop constraint advent_opens_pkey;
alter table public.advent_doors drop constraint advent_doors_pkey;
alter table public.advent_doors add constraint advent_doors_pkey primary key (season, day);
alter table public.advent_opens add constraint advent_opens_pkey primary key (user_id, season, day);
alter table public.advent_opens add constraint advent_opens_door_fkey
  foreign key (season, day) references public.advent_doors (season, day) on delete cascade;

drop index if exists public.advent_opens_day_idx;
create index advent_opens_season_day_idx on public.advent_opens (season, day);
create index advent_rewards_season_idx on public.advent_rewards (season, doors, position);
drop index if exists public.advent_tickets_free_idx;
create index advent_tickets_free_idx on public.advent_tickets (user_id, season) where used_at is null and revoked_at is null;

-- Открыть дверь сезона: запись и XP в одной транзакции. Счётчик открытых дверей - только этого сезона,
-- поэтому призы «за N дверей» нового сезона не считают прежние открытия.
create function public.advent_open(p_season text, p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer, p_late boolean)
returns table (inserted boolean, opened integer)
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.advent_opens (user_id, season, day, score, total, xp, late)
  values (p_user, p_season, p_day, p_score, p_total, p_xp, p_late)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    update public.users set xp = xp + p_xp where id = p_user;
  end if;
  return query select n > 0, (select count(*)::integer from public.advent_opens o where o.user_id = p_user and o.season = p_season);
end;
$$;

-- Пропущенная дверь за билет. Билет должен принадлежать тому же сезону: неиспользованные билеты
-- закрытой кампании не переносятся (после её закрытия ими и раньше нельзя было воспользоваться).
create function public.advent_open_late(p_season text, p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer)
returns table (inserted boolean, opened integer, ticket boolean)
language plpgsql
set search_path = ''
as $$
declare
  t bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('advent:' || p_user::text, 0));
  if exists (select 1 from public.advent_opens where user_id = p_user and season = p_season and day = p_day) then
    return query select false, (select count(*)::integer from public.advent_opens o where o.user_id = p_user and o.season = p_season), true;
    return;
  end if;
  select id into t from public.advent_tickets
    where user_id = p_user and season = p_season and used_at is null and revoked_at is null
    order by id limit 1 for update;
  if t is null then
    return query select false, (select count(*)::integer from public.advent_opens o where o.user_id = p_user and o.season = p_season), false;
    return;
  end if;
  update public.advent_tickets set used_at = now(), used_day = p_day where id = t;
  insert into public.advent_opens (user_id, season, day, score, total, xp, late) values (p_user, p_season, p_day, p_score, p_total, p_xp, true);
  update public.users set xp = xp + p_xp where id = p_user;
  return query select true, (select count(*)::integer from public.advent_opens o where o.user_id = p_user and o.season = p_season), true;
end;
$$;

-- Прежние сигнатуры сохраняются для уже развёрнутого API и работают с активным сезоном.
create or replace function public.advent_open(p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer, p_late boolean)
returns table (inserted boolean, opened integer)
language sql
set search_path = ''
as $$
  select * from public.advent_open(public.advent_active_season(), p_user, p_day, p_score, p_total, p_xp, p_late);
$$;

create or replace function public.advent_open_late(p_user bigint, p_day integer, p_score integer, p_total integer, p_xp integer)
returns table (inserted boolean, opened integer, ticket boolean)
language sql
set search_path = ''
as $$
  select * from public.advent_open_late(public.advent_active_season(), p_user, p_day, p_score, p_total, p_xp);
$$;

-- Розыгрыш: участники - открывшие двери окна в сезоне самого приза.
create or replace function public.advent_draw(p_reward bigint)
returns table (winner_id bigint, winner_code text)
language plpgsql
set search_path = ''
as $$
declare
  r public.advent_rewards%rowtype;
  slots integer;
  w record;
  c text;
begin
  select * into r from public.advent_rewards where id = p_reward for update;
  if not found or r.mode <> 'draw' or r.drawn_at is not null then
    return;
  end if;
  slots := coalesce(r.stock, 1) - (select count(*) from public.reward_codes rc where rc.reward_id = p_reward);
  for w in
    select e.uid
    from (
      select o.user_id as uid, count(*) as n
      from public.advent_opens o
      where o.season = r.season
        and o.day between coalesce(r.day_from, 1) and coalesce(r.day_to, 60)
        and not exists (select 1 from public.reward_codes rc where rc.reward_id = p_reward and rc.user_id = o.user_id)
      group by o.user_id
    ) e
    order by power(public.advent_random() + 1e-12, 1.0 / e.n) desc
    limit greatest(slots, 0)
  loop
    c := public.advent_grant(w.uid, p_reward);
    if c is not null then
      winner_id := w.uid;
      winner_code := c;
      return next;
    end if;
  end loop;
  update public.advent_rewards set drawn_at = now() where id = p_reward;
end;
$$;

-- Сводка для админки по одному сезону.
create function public.advent_summary(p_season text)
returns jsonb
language sql
stable
set search_path = ''
as $$
select jsonb_build_object(
  'participants', (select count(distinct user_id) from public.advent_opens where season = p_season),
  'opens', (select count(*) from public.advent_opens where season = p_season),
  'by_day', (
    select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'title', d.title, 'kind', d.kind,
      'opens', (select count(*) from public.advent_opens o where o.season = d.season and o.day = d.day),
      'late', (select count(*) from public.advent_opens o where o.season = d.season and o.day = d.day and o.late)) order by d.day), '[]'::jsonb)
    from public.advent_doors d where d.season = p_season
  ),
  'rewards', (
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'doors', r.doors, 'stock', r.stock,
      'issued', (select count(*) from public.reward_codes c where c.reward_id = r.id),
      'redeemed', (select count(*) from public.reward_codes c where c.reward_id = r.id and c.status = 'redeemed')) order by r.doors), '[]'::jsonb)
    from public.advent_rewards r where r.season = p_season
  ),
  'points', (
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name,
      'redeemed', (select count(*) from public.reward_codes c join public.advent_rewards r on r.id = c.reward_id
                   where c.point_id = p.id and r.season = p_season)) order by p.id), '[]'::jsonb)
    from public.advent_points p
  )
);
$$;

create or replace function public.advent_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.advent_summary(public.advent_active_season());
$$;

revoke all on function public.advent_open(text, bigint, integer, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.advent_open_late(text, bigint, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.advent_summary(text) from public, anon, authenticated;
grant execute on function public.advent_open(text, bigint, integer, integer, integer, integer, boolean) to service_role;
grant execute on function public.advent_open_late(text, bigint, integer, integer, integer, integer) to service_role;
grant execute on function public.advent_summary(text) to service_role;
