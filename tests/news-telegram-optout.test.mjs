import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const sql=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')

test('a Mini App only post never enters the Telegram queue and does not block other news',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261025215414_news_autopublishing.sql','20261107104626_news_course_boundaries.sql'])await db.exec(await sql(file))
 await db.exec(`insert into settings(key,value) values('news_publishing','{"enabled":true,"chat_id":-100}') on conflict(key) do update set value=excluded.value;
  insert into lessons(id,title,body,published,published_at) overriding system value values
  (1,'Обычная старая','a',true,'2026-11-01'),(2,'Swarm','b',true,'2026-11-02'),(3,'Обычная новая','c',true,'2026-11-03');`)
 await db.exec(await sql('20261115130000_news_telegram_optout.sql'))
 const claim=async()=>(await db.query('select claim_news_post(-100) item')).rows[0].item
 const finish=(id,attempt)=>db.query("select finish_news_post(-100,$1,$2,'sent',$3,null,0)",[id,attempt,1000+id])
 const cool=()=>db.exec("update news_publications set attempted_at=now()-interval '10 seconds'")
 assert.deepEqual((await db.query('select id from lessons where not telegram_publish')).rows,[],'existing news keep Telegram delivery')
 await db.exec('update lessons set telegram_publish=false where id=2')
 // The post stays a regular news item of the app feed.
 assert.equal((await db.query('select count(*)::int n from feed_cards where id=2 and news_eligible')).rows[0].n,1)

 const [a,b]=await Promise.all([claim(),claim()])
 assert.equal([a,b].filter(Boolean).length,1,'two concurrent workers take one post');const first=a??b
 assert.equal(first.lesson.id,1);await finish(1,first.attempt_id);await cool()
 const second=await claim();assert.equal(second.lesson.id,3,'the opted-out post is skipped, the next one is not blocked')
 await finish(3,second.attempt_id);await cool()
 assert.equal(await claim(),null)
 assert.equal((await db.query('select count(*)::int n from news_publications where lesson_id=2')).rows[0].n,0)

 // Turning delivery back on is an explicit author decision and queues the post once.
 await db.exec('update lessons set telegram_publish=true where id=2')
 const late=await claim();assert.equal(late.lesson.id,2);await finish(2,late.attempt_id);await cool()
 await db.exec('update lessons set telegram_publish=false where id=2')
 assert.equal(await claim(),null)
 assert.equal((await db.query("select status from news_publications where lesson_id=2")).rows[0].status,'sent','a sent receipt is kept')
 await assert.rejects(db.exec('set role anon;select claim_news_post(-100)'),/permission denied/)
})

test('editor and API expose the opt-out without touching feed eligibility or the shared schedule',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8')
 const [api,editor,migration,worker]=await Promise.all(['supabase/functions/api/index.ts','src/screens/AdminEditor.tsx','supabase/migrations/20261115130000_news_telegram_optout.sql','supabase/functions/news-publisher/index.ts'].map(read))
 assert.match(api,/typeof input\.telegram_publish!=='boolean'\)throw new HttpError\(400,'bad_telegram_publish'\)/)
 assert.match(api,/les\.telegram_publish === false\) throw new HttpError\(400, 'miniapp_only'\)/)
 assert.match(editor,/Публиковать в канале/);assert.match(editor,/set\('telegram_publish', v\)/)
 assert.doesNotMatch(migration,/set news_eligible|cron\.unschedule|update public\.settings/)
 assert.match(worker,/claim_news_post/);assert.doesNotMatch(worker,/telegram_publish/,'the worker relies on the database claim, not on a second filter')
})
