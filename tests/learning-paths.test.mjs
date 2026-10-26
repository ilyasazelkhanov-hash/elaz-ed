import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,stat} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const root=new URL('../content/ai-practice-2026-10-25/',import.meta.url)
async function fixture(){
 const db=new PGlite()
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql','20261025215414_news_autopublishing.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('import.sql',root),'utf8'))
 await db.exec(`insert into lessons(id,title,body) overriding system value values(256,'Как выбирать пару шрифтов для ролика','old'),(258,'Аниме-мотокросс: удержать персонажа в видео','old'); insert into settings(key,value) values('content_import:elaz-ed-2026-10-v1','{"lessons":{"feed-56":256,"feed-58":258}}')`)
 for(const f of ['revision.sql','training.sql'])await db.exec(await readFile(new URL(f,root),'utf8'))
 return db
}
test('five courses preserve old lesson IDs, completions, XP, access and news; repeated split is stable',async()=>{
 const db=await fixture()
 try{
  const cid=(await db.query("select (value->>'course_id')::int as id from settings where key='content_revision:ai-practice-training-2026-10-26-v3'")).rows[0].id
  const ids=(await db.query('select id from lessons where course_id=$1 order by id',[cid])).rows.map(x=>x.id)
  const news=(await db.query('select id,title,body from lessons where course_id is null order by id')).rows
  const moved=(await db.query("select (value->'lessons'->>'block-2')::int as id from settings where key='content_revision:ai-practice-training-2026-10-26-v3'")).rows[0].id
  await db.query('update courses set invite_unlock=7 where id=$1',[cid])
  await db.query('insert into users(id,xp) values(42,500);')
  await db.query('insert into progress(user_id,lesson_id,xp_earned) values(42,$1,100)',[moved])
  await db.query("insert into course_access(user_id,course_id,source) values(42,$1,'admin')",[cid])
  await db.exec('insert into users(id,xp) values(43,0)')
  await db.query("insert into course_access(user_id,course_id,source) values(43,$1,'stars')",[cid])
  await db.exec('insert into users(id,xp) values(45,100)')
  await db.query('insert into progress(user_id,lesson_id,xp_earned) values(45,$1,100)',[moved])
  await db.exec("insert into settings(key,value) values('news_publishing','{\"enabled\":true,\"chat_id\":-100123}'); insert into news_publications(chat_id,lesson_id,status,message_id,sent_at,attempted_at) select -100123,id,'sent',id,now(),now()-interval '10 seconds' from lessons where course_id is null")
  const sql=await readFile(new URL('paths.sql',root),'utf8')
  await db.exec(sql)
  const after=(await db.query('select id,course_id,position from lessons where course_id is not null order by id')).rows
  await db.exec('insert into users(id,xp) values(44,0)')
  await db.query("insert into course_access(user_id,course_id,source) values(44,$1,'admin')",[cid])
  await db.exec(sql)
  assert.deepEqual((await db.query('select id,course_id,position from lessons where course_id is not null order by id')).rows,after)
  assert.equal(after.length,30);assert(ids.every(id=>after.some(x=>x.id===id)))
  assert.equal((await db.query('select * from courses where published')).rows.length,5)
  for(const c of (await db.query('select id from courses')).rows){
   const rows=(await db.query('select position from lessons where course_id=$1 order by position',[c.id])).rows
   assert.deepEqual(rows.map(x=>x.position),[1,2,3,4,5,6])
  }
  assert.notEqual(after.find(x=>x.id===moved).course_id,cid)
  assert.equal((await db.query('select lesson_id from progress where user_id=42')).rows[0].lesson_id,moved)
  assert.equal((await db.query('select xp from users where id=42')).rows[0].xp,500)
  assert.equal((await db.query('select * from course_access where user_id=42')).rows.length,5)
  assert.equal((await db.query('select * from course_access where user_id=43')).rows.length,1,'star payments must stay one revocable grant')
  assert.equal((await db.query('select * from course_access where user_id=44')).rows.length,1,'new individual grants must not spread on repeat import')
  assert.equal((await db.query('select * from course_access where user_id=45')).rows.length,1,'existing learner keeps the course containing their completed lesson')
  const access=(await db.query('select course_id from course_access where user_id=45')).rows[0].course_id
  assert.equal(access,after.find(x=>x.id===moved).course_id)
  assert.equal((await db.query('select count(*)::int as n from lessons where course_id is not null and free_preview')).rows[0].n,5)
  assert((await db.query('select price_stars from courses')).rows.every(c=>c.price_stars===250))
  assert((await db.query('select invite_unlock from courses')).rows.every(c=>c.invite_unlock===0))
  assert.deepEqual((await db.query('select id,title,body from lessons where course_id is null order by id')).rows,news)
  assert.equal((await db.query('select claim_news_post(-100123) as item')).rows[0].item,null)
 }finally{await db.close()}
})
test('a corrupted mapping cannot turn a news post into a course lesson and rolls back course creation',async()=>{
 const db=await fixture()
 try{
  const cid=(await db.query("select (value->>'course_id')::int as id from settings where key='content_revision:ai-practice-training-2026-10-26-v3'")).rows[0].id
  const news=(await db.query('select id,body from lessons where course_id is null order by id limit 1')).rows[0]
  await db.query("insert into settings(key,value) values('content_revision:ai-practice-paths-2026-10-26-v4',jsonb_build_object('courses',jsonb_build_object('foundations',$1::int),'lessons',jsonb_build_object('foundations-context',$2::int)))",[cid,news.id])
  await assert.rejects(db.exec(await readFile(new URL('paths.sql',root),'utf8')),/Lesson outside paths/)
  await db.exec('rollback')
  assert.equal((await db.query('select count(*)::int as n from courses')).rows[0].n,1)
  assert.equal((await db.query('select body from lessons where id=$1',[news.id])).rows[0].body,news.body)
 }finally{await db.close()}
})
test('every course includes guided lessons, visible result, advanced extension and deployable visuals',async()=>{
 const p=JSON.parse(await readFile(new URL('paths.json',root),'utf8'))
 assert.equal(p.courses.length,5)
 assert.deepEqual(p.courses.map(c=>c.key),['foundations','text','media','coding','automation'])
 assert.equal(p.courses.flatMap(c=>c.lessons).filter(l=>l.legacy).length,14)
 for(const c of p.courses){
  assert.equal(c.lessons.length,6)
  assert(c.lessons.some(l=>l.body.includes('```lesson-animation')),c.key)
  for(const l of c.lessons){
   for(const text of ['Если ты новичок','Если уже работаешь с ИИ','Для продвинутых:','Куда нажать / что ввести','Что должно появиться','Критерии готовности'])assert(l.body.includes(text),l.key+': '+text)
   assert(!l.body.includes('undefined'))
   const assets=new Set(l.body.match(/\/learning\/ai-practice\/[a-zA-Z0-9./-]+\.(?:png|webp|jpg|svg|zip|md|csv|json|html)/g))
   for(const asset of assets)assert((await stat(new URL('../public'+asset,import.meta.url))).size>50,asset)
  }
 }
 assert.equal(p.courses[4].lessons[0].key,'block-native-automation')
 assert(p.courses[3].lessons.some(l=>l.title.includes('OpenCode')))
 const final=p.courses[3].lessons.at(-1)
 assert.equal(final.key,'block-agent-reach')
 assert(final.legacy)
 assert(final.title.includes('рабочая страница'))
 assert(!final.body.includes('ролик понятен без звука'))
 assert(p.courses[3].lessons[1].body.includes('OpenCode для этого урока ещё не нужен'))
})
