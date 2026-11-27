-- Включение сезона ai-winter-2026 («Новогодний AI-адвент», 53 двери со дня запуска).
-- Выполнять вручную и только после: миграции 20261115120000_advent_seasons.sql, выпуска Edge Function api
-- с поддержкой сезонов и ai-winter-2026.seed.sql. Порядок и проверки: content/advent/README.md, раздел «Сезоны».
--
-- Что делает: сохраняет снимок настроек идущей кампании в advent_seasons (по нему строится архив) и переключает
-- settings.advent на новый сезон. Двери, открытия, билеты, призы и коды прежней кампании не меняются.
-- Что не делает: не создаёт призы (их задаёт владелец в админке) и не выдаёт билеты.
-- Способы и цена билета, пояс, grace и час пуша наследуются из прежних настроек.
begin;

do $$
declare
  previous_config jsonb;
  start_day date;
  offset_minutes integer;
begin
  select value into strict previous_config from public.settings where key = 'advent' for update;
  if public.advent_active_season() = 'ai-winter-2026' then return; end if;
  offset_minutes := coalesce((previous_config->>'tz')::integer, 300);
  if offset_minutes not between -840 and 840 then raise exception 'Недопустимый часовой пояс адвента'; end if;
  start_day := ((statement_timestamp() at time zone 'UTC') + make_interval(mins => offset_minutes))::date;

  if (select count(*) from public.advent_doors where season = 'ai-winter-2026') <> 53 then
    raise exception 'Двери сезона ai-winter-2026 не загружены: сначала выполните ai-winter-2026.seed.sql';
  end if;

insert into public.advent_seasons (id, config, archived_at)
select public.advent_active_season(), value, now()
from public.settings
where key = 'advent' and public.advent_active_season() <> 'ai-winter-2026'
on conflict (id) do update set config = excluded.config, archived_at = excluded.archived_at;

update public.settings
set value = value || '{"season": "ai-winter-2026", "enabled": true, "title": "Новогодний AI-адвент", "theme": "newyear", "days": 53}'::jsonb || jsonb_build_object('start', start_day)
where key = 'advent';

-- Курсор рассылки хранит номер дня. Номера дней нового сезона совпадают с прежними,
-- поэтому состояние сбрасывается: иначе пуш дня мог бы посчитаться уже отправленным.
update public.settings set value = '{}'::jsonb where key in ('advent_push_morning', 'advent_push_evening');

end $$;

commit;
