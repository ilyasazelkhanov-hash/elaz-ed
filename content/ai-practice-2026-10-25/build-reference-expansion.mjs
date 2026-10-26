import {readFile,writeFile} from 'node:fs/promises'
import {labs,renderLab} from './training-labs.mjs'
const dir=new URL('./',import.meta.url)
const training=JSON.parse(await readFile(new URL('training.json',dir),'utf8'))
const selected=[
 ['block-1','Как выбрать ИИ-инструмент и не утонуть в каталогах','🧭','Выбор инструментов'],
 ['block-2','Gemini Notebook: исследование по своим документам','📚','Исследования'],
 ['block-3','ИИ-отчёт по таблице: сначала контрольные числа','📊','Текст и данные'],
 ['block-4','Gamma 5: от брифа к проверяемой презентации','🖼️','Презентации'],
 ['block-5','Descript: одна запись, клип, субтитры и пост','🎬','Видео'],
 ['block-native-automation','Claude Desktop: поручение с готовыми файлами','🗂️','Автоматизация'],
 ['block-8','Автоматизация для бизнеса: карта процесса до запуска','🔁','Автоматизация'],
 ['block-opencode','OpenCode: как принять работу агента, а не только макет','🛠️','Вайбкодинг'],
]
const posts=selected.map(([key,title,emoji,category],i)=>{
 const l=labs[key],course=training.lessons.find(x=>x.key===key)
 let body=renderLab(key,'https://elaz-ed.vercel.app').replace(/^## Дополнительная практика: [^\n]+\n\n/,'')
 body='Проверено по публичным официальным страницам на 26 октября 2026. Доступ и лимиты зависят от аккаунта.\n\n'+body+'\nПолная практика с объяснением, схемами и проверкой — в курсе «ИИ с нуля», в разделе «'+course.category+'». Это разбор применения, а не обещание автоматического результата.'
 return {key:'reference-'+key,title,emoji,category,subtitle:l.explain.slice(0,185),body,cover_url:course.cover_url,minutes:6,xp:50,position:i+1}
})
const batch='content_import:reference-practice-2026-10-26-v1'
const payload={batch,checked_at:'2026-10-26',posts}
await writeFile(new URL('reference-posts.json',dir),JSON.stringify(payload,null,2)+'\n')
await writeFile(new URL('reference-posts.sql',dir),`begin;
select pg_advisory_xact_lock(hashtext('${batch}'));
do $reference$
declare p jsonb:=$payload$${JSON.stringify(payload)}$payload$::jsonb; m jsonb; l jsonb; lid bigint; i int:=0;
begin
select value->'lessons' into m from public.settings where key=p->>'batch';
m:=coalesce(m,'{}'::jsonb);
for l in select value from jsonb_array_elements(p->'posts') loop
 lid:=(m->>(l->>'key'))::bigint;
 if lid is null then
  insert into public.lessons(kind,title,subtitle,category,emoji,gradient,cover_url,body,minutes,xp,pinned,published,published_at,course_id,position,free_preview,quiz)
  values('lesson',l->>'title',l->>'subtitle',l->>'category',l->>'emoji','aurora',l->>'cover_url',l->>'body',6,50,false,true,now()+i*interval '1 second',null,(l->>'position')::int,true,'[]'::jsonb) returning id into lid;
  m:=m||jsonb_build_object(l->>'key',lid);
 end if;
 if not exists(select 1 from public.lessons where id=lid and course_id is null and title=l->>'title') then raise exception 'Reference post mismatch %',lid; end if;
 i:=i+1;
end loop;
insert into public.settings(key,value) values(p->>'batch',jsonb_build_object('lessons',m,'count',8,'checked_at',p->>'checked_at')) on conflict(key) do update set value=excluded.value;
end; $reference$;
commit;
select value from public.settings where key='${batch}';
`)
console.log(JSON.stringify({posts:posts.length,labs:Object.keys(labs).length}))

