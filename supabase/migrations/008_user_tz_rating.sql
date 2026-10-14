-- Часовой пояс человека хранится на сервере: бонус дня больше нельзя забрать повторно сменой пояса в запросе.
-- Пояс меняется не чаще раза в 20 часов (см. syncTz в Edge Function).
alter table public.users
  add column tz integer check (tz between -720 and 840),
  add column tz_at timestamptz;

-- Рейтинг и место в нём считаются только среди подписчиков.
create index users_subscribed_xp_idx on public.users (xp desc) where subscribed;
