begin;
do $course_price$
declare p jsonb := $elaz_course${"price_stars":250,"description":"Практический курс Elaz Ed о создании коротких роликов с агентом. Шесть модулей: подключаем инструменты, готовим проект, выстраиваем визуал, собираем первый выпуск, повторяем процесс и находим идеи.\n\nВ каждом уроке — объяснение, задание и проверка результата. Учебный проект: короткий ролик о выборе телефона под разные задачи. Можно использовать свою тему.\n\nВводный урок «Как агент собирает ролик» открыт всем. Остальные уроки открываются вместе с курсом — за звёзды Telegram. Достаточно одного агента с доступом к рабочей папке; дополнительные сервисы подключаются по необходимости.\n\nТексты курса подготовлены для Elaz Ed."}$elaz_course$::jsonb; marker record;
begin
  select key,value into strict marker from public.settings where key like 'content_import:%' and value ? 'course_id';
  update public.courses set price_stars=(p->>'price_stars')::integer,description=p->>'description',updated_at=now() where id=(marker.value->>'course_id')::bigint;
  if not found then raise exception 'Курс не найден'; end if;
end;
$course_price$;
commit;
select id,title,price_stars from public.courses order by id;
