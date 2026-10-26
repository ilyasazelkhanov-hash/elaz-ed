import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,stat} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('training replaces only course lessons and preserves news, IDs and progress on repeat',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../content/ai-practice-2026-10-25/import.sql',import.meta.url),'utf8'))
 await db.exec(`insert into lessons(id,title,body) overriding system value values(256,'Как выбирать пару шрифтов для ролика','old'),(258,'Аниме-мотокросс: удержать персонажа в видео','old'); insert into settings(key,value) values('content_import:elaz-ed-2026-10-v1','{"lessons":{"feed-56":256,"feed-58":258}}')`)
 await db.exec(await readFile(new URL('../content/ai-practice-2026-10-25/revision.sql',import.meta.url),'utf8'))
 // Simulate the already deployed 13-lesson version, then upgrade it to 14.
 await db.exec(`do $$ declare cid bigint; lid bigint; k text; m jsonb:='{}'; begin
 select (value->>'course_id')::bigint into cid from settings where key='content_import:ai-practice-2026-10-25-v1';
 foreach k in array array['block-connections','block-music','block-opencode'] loop
 insert into lessons(title,body,course_id) values(k,'Previous course content',cid) returning id into lid;
 m:=m||jsonb_build_object(k,lid); end loop;
 insert into settings(key,value) values('content_revision:ai-practice-training-2026-10-26-v3',jsonb_build_object('course_id',cid,'lessons',m,'lesson_count',13)); end $$;`)
 const before=(await db.query('select id,title,body from lessons where course_id is null order by id')).rows
 const ids=(await db.query('select id from lessons where course_id is not null order by id')).rows
 await db.exec('insert into users(id,xp) values(123,500); insert into progress(user_id,lesson_id,xp_earned) values(123,57,100)')
 const sql=await readFile(new URL('../content/ai-practice-2026-10-25/training.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.deepEqual((await db.query('select id,title,body from lessons where course_id is null order by id')).rows,before)
 const afterIds=(await db.query('select id from lessons where course_id is not null order by id')).rows
 assert(ids.every(x=>afterIds.some(y=>y.id===x.id)))
 assert.equal(afterIds.length,14)
 assert.equal((await db.query('select lesson_id from progress where user_id=123')).rows[0].lesson_id,57)
 assert.equal((await db.query('select xp from users where id=123')).rows[0].xp,500)
 const lessons=(await db.query('select title,body,position,category from lessons where course_id is not null order by position')).rows
 assert.equal(lessons.length,14)
 assert.deepEqual(lessons.map(x=>x.position),Array.from({length:14},(_,i)=>i+1))
 const automation=lessons.filter(x=>x.category==='Модуль 4 · Автоматизация')
 assert.equal(automation.length,2)
 assert.match(automation[0].title,/ChatGPT, Claude и Gemini/)
 assert(automation[0].body.includes('/schedule'))
 assert(automation[0].body.includes('способ остановки'))
 assert(automation[1].body.includes('n8n'))
 assert.deepEqual([...new Set(lessons.map(x=>x.category))],['Модуль 1 · Знакомство с ИИ','Модуль 2 · Работа с текстом','Модуль 3 · Работа с медиа','Модуль 4 · Автоматизация','Модуль 5 · Вайбкодинг'])
 for(const l of lessons){
  assert(l.body.length>2200,l.title)
  for(const heading of ['Чему научишься','Как это работает','Какие инструменты выбрать','Бесплатно и платно','Первый запуск','Разобранный пример','Сделай по шагам','Самостоятельная работа','Критерии готовности','Проверь себя','Разбор ответа','Ссылки для практики'])assert(l.body.includes('## '+heading),`${l.title}: ${heading}`)
  assert(l.body.includes('![Схема урока]'))
 }
 assert(lessons.find(x=>x.title.includes('исследование')).body.includes('agent-reach channels'))
 assert(lessons.find(x=>x.title.includes('OpenBot')).body.includes('OpenBot'))
 assert(lessons.find(x=>x.title.includes('OpenCode')).body.includes('/connect'))
 assert(lessons.find(x=>x.title.includes('Музыка')).body.includes('Suno'))
 assert.equal(lessons.filter(x=>x.body.includes('.gif)')).length,3)
 }finally{await db.close()}
})
test('all educational pictures, animations and starter files are local deployable assets',async()=>{
 const p=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/training.json',import.meta.url),'utf8'))
 const assets=new Set(JSON.stringify(p).match(/\/learning\/ai-practice\/[a-z0-9.-]+/g))
 assert(assets.size>=20)
 for(const asset of assets){const file=new URL('../public'+asset,import.meta.url);assert((await stat(file)).size>50,asset);if(asset.endsWith('.gif'))assert((await readFile(file)).subarray(0,6).toString().startsWith('GIF89a'))}
})
