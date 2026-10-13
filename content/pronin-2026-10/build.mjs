import {mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {tools} from './tools.mjs'
import {guides} from './guides.mjs'
import {prompts} from './prompts.mjs'
import {course,courseLessons} from './course.mjs'

const dir=fileURLToPath(new URL('.',import.meta.url))
const batch='content_import:pronin-2026-10-v1'
const gradients=['aurora','sunset','mint','ocean','candy','lime']
const emoji={Дизайн:'🎨',Прочее:'🧰',Промпты:'💬',Нейронки:'🤖',Маркетинг:'📣',Закон:'⚖️',Безопасность:'🛡️',Продукт:'💡',Видео:'🎬'}
const feed=[...tools,...guides,...prompts].sort((a,b)=>a.source_index-b.source_index)
if(feed.length!==64 || guides.length!==15 || prompts.length!==7 || tools.length!==42)throw Error('Неполный каталог')
for(let i=1;i<=64;i++)if(feed[i-1].source_index!==i)throw Error(`Пропущена карточка ${i}`)
if(courseLessons.length!==20)throw Error('Неполный курс')
const lessons=[...feed,...courseLessons].map((x,i)=>({
  ...x,kind:'lesson',emoji:emoji[x.category]??'✨',gradient:gradients[i%gradients.length],
  video_url:x.video_url??null,pinned:false,position:x.position??x.source_index,
  free_preview:x.free_preview??false,course_key:x.course_key??null,
}))
for(const item of lessons){
  if(!item.title.trim()||!item.body.trim()||item.body.length<200)throw Error(`Пустой материал: ${item.key}`)
  if(item.title.length>120)throw Error(`Слишком длинный заголовок: ${item.key}`)
  if(item.source_type==='guide'&&item.body.length<(item.source_index===51?1200:2000))throw Error(`Слишком короткий гайд: ${item.key}`)
  if(item.source_type==='prompt'&& !item.copy_text)throw Error(`Нет текста копирования: ${item.key}`)
  if(/tgWebAppData|auth_date|query_id|sk-live-/u.test(item.body))throw Error(`Служебные данные: ${item.key}`)
  for(const q of item.quiz){if(q.correct<0||q.correct>=q.options.length)throw Error(`Ошибка квиза: ${item.key}`)}
}
if(new Set(lessons.map(x=>x.key)).size!==84)throw Error('Повтор ключа')
if(new Set(lessons.map(x=>x.title)).size!==84)throw Error('Повтор заголовка')
const payload={batch,date:'2026-10-13',source:'https://t.me/proninhere_bot',rights_confirmed:true,
  course,lessons,notes:[
    '42 карточки, 15 гайдов, 7 промптов адаптированы по доступному содержимому Telegram.',
    '19 закрытых уроков написаны самостоятельно по программе; вводный адаптирован.',
    'Цены и статистика исходных статей не объявлены актуальными без проверки.',
    'Частный MCP, пресеты, платные паки и доступ к чужому чату не воспроизводятся.',
    'Иллюстрации используют публичные URL источника; исходные файлы не экспортированы.',
    'Две кнопки X и ссылка Foresight не раскрыли полный URL: используются ссылка на источник и домен разработчика.',
  ]}
await mkdir(dir,{recursive:true})
await writeFile(new URL('payload.json',import.meta.url),JSON.stringify(payload,null,2)+'\n')
const json=JSON.stringify({course,lessons})
if(json.includes('$elaz_content$'))throw Error('Конфликт SQL-разделителя')
const sql=`-- Пакет ${batch}: только вставки. Существующие уроки и прогресс сохраняются.
begin;
select pg_advisory_xact_lock(hashtext('${batch}'));
do $elaz_import$
declare
  p jsonb := $elaz_content$${json}$elaz_content$::jsonb;
  c jsonb;
  l jsonb;
  course_id_new bigint;
  lesson_id_new bigint;
  mapping jsonb := '{}'::jsonb;
  import_time timestamptz := now();
begin
  if exists(select 1 from public.settings where key='${batch}') then
    raise notice 'Пакет уже импортирован';
    return;
  end if;
  c := p->'course';
  insert into public.courses(title,subtitle,description,emoji,gradient,price_stars,invite_unlock,position,published)
  values(c->>'title',c->>'subtitle',c->>'description',c->>'emoji',c->>'gradient',0,0,0,true)
  returning id into course_id_new;
  for l in select value from jsonb_array_elements(p->'lessons') loop
    insert into public.lessons(kind,title,subtitle,category,emoji,gradient,cover_url,body,video_url,copy_text,quiz,minutes,xp,pinned,published,published_at,course_id,position,free_preview)
    values('lesson',l->>'title',l->>'subtitle',l->>'category',l->>'emoji',l->>'gradient',l->>'cover_url',l->>'body',l->>'video_url',l->>'copy_text',l->'quiz',(l->>'minutes')::integer,(l->>'xp')::integer,false,(l->>'published')::boolean,
      case when (l->>'published')::boolean then import_time - coalesce((l->>'source_index')::integer,0)*interval '1 second' end,
      case when l->>'course_key' is not null then course_id_new else null end,(l->>'position')::integer,(l->>'free_preview')::boolean)
    returning id into lesson_id_new;
    mapping := mapping || jsonb_build_object(l->>'key',lesson_id_new);
  end loop;
  insert into public.settings(key,value)
  values('${batch}',jsonb_build_object('date','2026-10-13','course_id',course_id_new,'lessons',mapping,'feed_count',64,'course_lesson_count',20,'authored_closed_lessons',19));
end;
$elaz_import$;
commit;
select value from public.settings where key='${batch}';
`
await writeFile(new URL('import.sql',import.meta.url),sql)
console.log(JSON.stringify({feed:feed.length,tools:tools.length,guides:guides.length,prompts:prompts.length,courseLessons:courseLessons.length,total:lessons.length,characters:lessons.reduce((n,x)=>n+x.body.length,0),sqlBytes:Buffer.byteLength(sql)}))
