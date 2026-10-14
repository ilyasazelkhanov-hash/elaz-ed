-- Адвент: как выдаётся приз.
-- threshold — за N открытых дверей (как раньше);
-- day       — открывшим дверь одного из дней day_from..day_to, пока не кончится лимит;
-- instant   — мгновенный выигрыш при открытии двери в окне дней: шанс подстраивается под темп,
--             чтобы весь лимит разошёлся к концу окна, а не в первый день;
-- draw      — розыгрыш после day_to: случайные победители среди открывших двери в окне,
--             каждая открытая дверь — один шанс.
alter table public.advent_rewards
  add column if not exists mode text not null default 'threshold' check (mode in ('threshold', 'day', 'instant', 'draw')),
  add column if not exists day_from integer check (day_from between 1 and 60),
  add column if not exists day_to integer check (day_to between 1 and 60),
  add column if not exists drawn_at timestamptz;

-- Случайное число в [0, 1) из криптографического генератора — для честного розыгрыша.
create or replace function public.advent_random()
returns double precision
language sql
volatile
set search_path = ''
as $$
  select (('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint)::double precision / 72057594037927936.0;
$$;

-- Выдать приз человеку. Лимит, повтор и сам код проверяются под блокировкой строки приза:
-- при любой гонке лишний приз не выпадет, а один человек не получит один приз дважды.
-- Возвращает код или null, если приз закончился или уже выдан этому человеку.
create or replace function public.advent_grant(p_user bigint, p_reward bigint)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.advent_rewards%rowtype;
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  i integer;
begin
  select * into r from public.advent_rewards where id = p_reward for update;
  if not found then
    return null;
  end if;
  if exists (select 1 from public.reward_codes where user_id = p_user and reward_id = p_reward) then
    return null;
  end if;
  if r.stock is not null and (select count(*) from public.reward_codes where reward_id = p_reward) >= r.stock then
    return null;
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := '';
    for i in 0..7 loop
      c := c || substr(abc, (get_byte(b, i) % length(abc)) + 1, 1);
    end loop;
    c := substr(c, 1, 4) || '-' || substr(c, 5, 4);
    exit when not exists (select 1 from public.reward_codes where code = c);
  end loop;
  insert into public.reward_codes (code, user_id, reward_id) values (c, p_user, p_reward);
  if r.kind = 'lesson' and (r.payload ->> 'lesson_id') is not null then
    insert into public.lesson_access (user_id, lesson_id, source) values (p_user, (r.payload ->> 'lesson_id')::bigint, 'advent') on conflict do nothing;
  end if;
  if r.kind = 'course' and (r.payload ->> 'course_id') is not null then
    insert into public.course_access (user_id, course_id, source) values (p_user, (r.payload ->> 'course_id')::bigint, 'advent') on conflict do nothing;
  end if;
  return c;
end;
$$;

-- Розыгрыш: победители среди открывших двери окна, шанс пропорционален числу открытых дверей.
-- Взвешенная выборка без повторов (ключ random^(1/вес)). Повторный вызов ничего не меняет.
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
      where o.day between coalesce(r.day_from, 1) and coalesce(r.day_to, 60)
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

revoke execute on function public.advent_random() from public, anon, authenticated;
revoke execute on function public.advent_grant(bigint, bigint) from public, anon, authenticated;
revoke execute on function public.advent_draw(bigint) from public, anon, authenticated;
grant execute on function public.advent_random() to service_role;
grant execute on function public.advent_grant(bigint, bigint) to service_role;
grant execute on function public.advent_draw(bigint) to service_role;
