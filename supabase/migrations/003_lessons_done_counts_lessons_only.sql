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
