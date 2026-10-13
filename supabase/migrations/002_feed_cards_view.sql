-- Карточки ленты одним запросом: тело отдаём только у сторис, квиз и видео — флагами.
create view public.feed_cards with (security_invoker = true) as
select
  id, kind, title, subtitle, category, emoji, gradient, cover_url, minutes, xp,
  pinned, published, published_at, views, likes,
  jsonb_array_length(quiz) as quiz_count,
  (video_url is not null and video_url <> '') as has_video,
  case when kind = 'story' then body end as body
from public.lessons;

revoke all on public.feed_cards from anon, authenticated;
grant select on public.feed_cards to service_role;

insert into public.settings (key, value) values
  ('channel_invite', '"https://t.me/+k36WMjkFf6BmNDYy"'::jsonb),
  ('bot', '{"username": "elazart_bot"}'::jsonb);
