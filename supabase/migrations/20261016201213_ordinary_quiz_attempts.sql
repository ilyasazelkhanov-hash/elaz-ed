-- Ordinary lesson quizzes: private immutable question snapshot, ordered answers,
-- one reward attempt per member/lesson. Practice is available only after progress.
create table public.lesson_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  practice boolean not null default false,
  quiz jsonb not null check (jsonb_typeof(quiz) = 'array' and jsonb_array_length(quiz) between 1 and 10),
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  feedback jsonb not null default '[]' check (jsonb_typeof(feedback) = 'array'),
  score integer not null default 0,
  bonus integer not null default 0,
  combo integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index lesson_quiz_reward_once on public.lesson_quiz_attempts(user_id, lesson_id) where not practice;
create index lesson_quiz_practice_resume on public.lesson_quiz_attempts(user_id, lesson_id, created_at desc) where practice;
alter table public.lesson_quiz_attempts enable row level security;
revoke all on public.lesson_quiz_attempts from public, anon, authenticated;
grant all on public.lesson_quiz_attempts to service_role;

-- Caller is the authenticated edge handler. Never accept quiz snapshots from a client.
create function public.start_lesson_quiz(p_user bigint, p_lesson bigint)
returns jsonb language plpgsql set search_path = '' as $$
declare a public.lesson_quiz_attempts%rowtype; q jsonb; pract boolean;
begin
  perform 1 from public.users where id = p_user for update;
  if not found then raise exception 'quiz_not_found'; end if;
  select quiz into q from public.lessons where id = p_lesson;
  if q is null or jsonb_typeof(q) <> 'array' or jsonb_array_length(q) not between 1 and 10 then
    raise exception 'quiz_not_found';
  end if;
  pract := exists(select 1 from public.progress where user_id = p_user and lesson_id = p_lesson);
  select * into a from public.lesson_quiz_attempts
    where user_id = p_user and lesson_id = p_lesson and practice = pract
      and (not pract or completed_at is null)
    order by created_at desc limit 1;
  if not found then
    insert into public.lesson_quiz_attempts(user_id, lesson_id, practice, quiz)
      values (p_user, p_lesson, pract, q) returning * into a;
  end if;
  -- This private RPC result is filtered by the edge handler before returning.
  return to_jsonb(a);
end $$;

create function public.answer_lesson_quiz(p_user bigint, p_attempt uuid, p_index integer, p_answer integer)
returns jsonb language plpgsql set search_path = '' as $$
declare a public.lesson_quiz_attempts%rowtype; q jsonb; n integer; hit boolean;
  next_combo integer; gain integer; receipt jsonb;
begin
  select * into a from public.lesson_quiz_attempts where id = p_attempt and user_id = p_user for update;
  if not found then raise exception 'quiz_not_found'; end if;
  n := jsonb_array_length(a.answers);
  if p_index is null or p_index < 0 or p_index >= jsonb_array_length(a.quiz) then raise exception 'quiz_answer_invalid'; end if;
  q := a.quiz -> p_index;
  if p_answer is null or p_answer < 0 or p_answer >= jsonb_array_length(q -> 'options') then raise exception 'quiz_answer_invalid'; end if;
  if p_index < n then
    if (a.answers ->> p_index)::integer <> p_answer then raise exception 'quiz_answer_locked'; end if;
    return a.feedback -> p_index;
  end if;
  if p_index <> n then raise exception 'quiz_sequence'; end if;
  hit := p_answer = (q ->> 'correct')::integer;
  next_combo := case when hit then a.combo + 1 else 0 end;
  gain := case when hit then 10 + 5 * least(next_combo - 1, 2) else 0 end;
  receipt := jsonb_build_object('attemptId', a.id, 'index', p_index, 'answer', p_answer,
    'correct', hit, 'correctIndex', (q ->> 'correct')::integer, 'explain', coalesce(q ->> 'explain', ''),
    'done', n + 1 = jsonb_array_length(a.quiz), 'score', a.score + case when hit then 1 else 0 end,
    'bonus', a.bonus + gain, 'combo', next_combo, 'gained', gain);
  update public.lesson_quiz_attempts set answers = a.answers || to_jsonb(p_answer),
    feedback = a.feedback || jsonb_build_array(receipt), score = a.score + case when hit then 1 else 0 end,
    bonus = a.bonus + gain, combo = next_combo,
    completed_at = case when n + 1 = jsonb_array_length(a.quiz) then now() else null end
    where id = a.id;
  return receipt;
end $$;

-- Also secure old edge versions calling this RPC directly with client scores.
create or replace function public.complete_lesson(p_user bigint, p_lesson bigint, p_score integer, p_total integer, p_xp integer)
returns boolean language plpgsql set search_path = '' as $$
declare inserted integer; l public.lessons%rowtype; a public.lesson_quiz_attempts%rowtype;
  secured_score integer := 0; secured_total integer := 0; secured_bonus integer := 0;
begin
  select * into l from public.lessons where id = p_lesson;
  if not found then raise exception 'quiz_not_found'; end if;
  -- A quiz removed after an attempt started still cannot discard the locked result.
  select * into a from public.lesson_quiz_attempts
    where user_id = p_user and lesson_id = p_lesson and not practice for update;
  if found then
    if a.completed_at is null or jsonb_array_length(a.answers) <> jsonb_array_length(a.quiz) then raise exception 'quiz_required'; end if;
    secured_score := a.score; secured_total := jsonb_array_length(a.quiz); secured_bonus := a.bonus;
  elsif jsonb_array_length(l.quiz) > 0 then raise exception 'quiz_required';
  end if;
  if p_score is distinct from secured_score or p_total is distinct from secured_total or p_xp is distinct from l.xp + secured_bonus then
    raise exception 'quiz_answers_mismatch';
  end if;
  insert into public.progress(user_id, lesson_id, score, total, xp_earned)
    values (p_user, p_lesson, secured_score, secured_total, l.xp + secured_bonus) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  update public.users set xp = xp + l.xp + secured_bonus,
    lessons_done = lessons_done + case when l.kind = 'lesson' then 1 else 0 end where id = p_user;
  return true;
end $$;

revoke execute on function public.start_lesson_quiz(bigint,bigint) from public, anon, authenticated;
revoke execute on function public.answer_lesson_quiz(bigint,uuid,integer,integer) from public, anon, authenticated;
revoke execute on function public.complete_lesson(bigint,bigint,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.start_lesson_quiz(bigint,bigint) to service_role;
grant execute on function public.answer_lesson_quiz(bigint,uuid,integer,integer) to service_role;
grant execute on function public.complete_lesson(bigint,bigint,integer,integer,integer) to service_role;
