alter table public.users
  add column learning_goal smallint not null default 3 check (learning_goal between 1 and 7),
  add column learning_reminders boolean not null default false,
  add column learning_reminder_day smallint not null default 0 check (learning_reminder_day between 0 and 6),
  add column learning_reminder_hour smallint not null default 18 check (learning_reminder_hour between 8 and 21),
  add column learning_timezone text not null default 'UTC',
  add column learning_reminder_week date,
  add column learning_reminder_claimed_at timestamptz;

create index users_learning_reminders_idx
  on public.users (learning_reminder_day, learning_reminder_hour, learning_timezone)
  where learning_reminders;
