import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {tools} from './tools.mjs'
import {guides} from './guides.mjs'
import {prompts} from './prompts.mjs'
import {course,courseLessons} from './course.mjs'

const dir=fileURLToPath(new URL('.',import.meta.url))
const batch='content_import:elaz-ed-2026-10-v1'
const storage='https://dcdepwdxvadhludnubis.supabase.co/storage/v1/object/public/learning-content/'
const assets=JSON.parse(await readFile(new URL('./assets-manifest.json',import.meta.url),'utf8'))
const assetUrls=new Map(assets.filter(x=>!x.error).map(x=>[x.url,storage+x.name]))
const gradients=['aurora','sunset','mint','ocean','candy','lime']
const emoji={Дизайн:'🎨',Прочее:'🧰',Промпты:'💬',Нейронки:'🤖',Маркетинг:'📣',Закон:'⚖️',Безопасность:'🛡️',Продукт:'💡',Видео:'🎬'}
const feed=[...tools,...guides,...prompts].sort((a,b)=>a.source_index-b.source_index)
if(feed.length!==64 || guides.length!==15 || prompts.length!==7 || tools.length!==42)throw Error('Неполный каталог')
for(let i=1;i<=64;i++)if(feed[i-1].source_index!==i)throw Error(`Пропущена карточка ${i}`)
if(courseLessons.length!==20)throw Error('Неполный курс')
const lessons=[...feed,...courseLessons].map((x,i)=>({
  ...x,subtitle:x.subtitle.slice(0,200),kind:'lesson',emoji:emoji[x.category]??'✨',gradient:gradients[i%gradients.length],
  video_url:x.video_url??null,pinned:false,position:x.position??x.source_index,
  free_preview:x.free_preview??false,course_key:x.course_key??null,
}))
for(const item of lessons){
  item.cover_url=assetUrls.get(item.cover_url)??item.cover_url
  if(item.key==='feed-58')item.video_url=storage+'seedance.mp4'
  if(item.course_key){
    item.quiz=item.quiz.map(q=>{
      const shift=item.position%q.options.length
      return {...q,options:[...q.options.slice(shift),...q.options.slice(0,shift)],correct:(q.correct-shift+q.options.length)%q.options.length}
    })
  }
}
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
const payload={batch,date:'2026-10-13',publisher:'Elaz Ed',rights_confirmed:true,
  course,lessons,notes:[
    'Каталог: 42 карточки, 15 гайдов и 7 промптов.',
    'Курс: 20 текстовых уроков в шести модулях, с практикой и квизами.',
    'Цены и статистика требуют проверки на дату использования.',
    '50 файлов находятся в собственном Supabase Storage: 48 изображений, ролик и архив слайдов.',
    'Ресурсы и примеры доступны по полным ссылкам.',
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
  values(c->>'title',c->>'subtitle',c->>'description',c->>'emoji',c->>'gradient',(c->>'price_stars')::integer,(c->>'invite_unlock')::integer,(c->>'position')::integer,true)
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
const updateSql=`begin;
do $content_update$
declare p jsonb := $elaz_content$${json}$elaz_content$::jsonb; marker record; l jsonb; lesson_id_current bigint;
begin
  select key,value into strict marker from public.settings where key like 'content_import:%' and value @> '{"course_id":1,"feed_count":64,"course_lesson_count":20}'::jsonb;
  if (select count(*) from jsonb_each(marker.value->'lessons')) <> 84 then raise exception 'Некорректный пакет'; end if;
  update public.courses set description=p->'course'->>'description',updated_at=now() where id=(marker.value->>'course_id')::bigint;
  for l in select value from jsonb_array_elements(p->'lessons') loop
    lesson_id_current=(marker.value->'lessons'->>(l->>'key'))::bigint;
    if lesson_id_current is null then raise exception 'Нет материала %',l->>'key'; end if;
    update public.lessons set title=l->>'title',subtitle=l->>'subtitle',body=l->>'body',copy_text=l->>'copy_text',cover_url=l->>'cover_url',video_url=l->>'video_url',updated_at=now() where id=lesson_id_current;
    if not found then raise exception 'Материал % отсутствует',lesson_id_current; end if;
  end loop;
  update public.settings set key='${batch}',updated_at=now() where key=marker.key;
end;
$content_update$;
commit;
select count(*) as total,count(*) filter(where course_id is null) as feed,count(*) filter(where course_id is not null) as course from public.lessons;
`
await writeFile(new URL('update-existing.sql',import.meta.url),updateSql)
// Цена и описание курса для уже работающего проекта. Запускается один раз; дальше цену меняет автор в админке.
const courseJson=JSON.stringify({price_stars:course.price_stars,description:course.description})
if(courseJson.includes('$elaz_course$'))throw Error('Конфликт SQL-разделителя')
const priceSql=`begin;
do $course_price$
declare p jsonb := $elaz_course$${courseJson}$elaz_course$::jsonb; marker record;
begin
  select key,value into strict marker from public.settings where key like 'content_import:%' and value ? 'course_id';
  update public.courses set price_stars=(p->>'price_stars')::integer,description=p->>'description',updated_at=now() where id=(marker.value->>'course_id')::bigint;
  if not found then raise exception 'Курс не найден'; end if;
end;
$course_price$;
commit;
select id,title,price_stars from public.courses order by id;
`
await writeFile(new URL('course-price.sql',import.meta.url),priceSql)
console.log(JSON.stringify({feed:feed.length,tools:tools.length,guides:guides.length,prompts:prompts.length,courseLessons:courseLessons.length,total:lessons.length,characters:lessons.reduce((n,x)=>n+x.body.length,0),sqlBytes:Buffer.byteLength(sql)}))
