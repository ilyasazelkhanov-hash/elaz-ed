import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('publishing queue is chronological, excludes courses/drafts and never reclaims sent or uncertain messages',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261025215414_news_autopublishing.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 await db.exec(`insert into public.settings(key,value) values ('news_publishing','{"enabled":true,"chat_id":-100123}');
 insert into public.courses(id,title) overriding system value values(1,'Course');
 insert into public.lessons(id,title,published,published_at,course_id) overriding system value values
 (1,'new',true,'2026-10-25',null),(2,'old',true,'2026-10-13',null),(3,'draft',false,'2026-10-01',null),(4,'course',true,'2026-10-01',1);`)
 const claim=async(chat=-100123)=>(await db.query('select public.claim_news_post($1) as item',[chat])).rows[0].item
 assert.equal(await claim(-999),null)
 const first=await claim();assert.equal(first.lesson.id,2)
 assert.equal(await claim(),null,'concurrent worker must not take the next item')
 await db.query("select public.finish_news_post($1,$2,$3,'failed',null,'telegram_429',120)",[-100123,2,first.attempt_id])
 await db.exec("update public.news_publications set attempted_at=now()-interval '10 seconds'")
 assert.equal(await claim(),null,'a delayed retry must not let a newer article pass')
 await db.exec("update public.news_publications set retry_at=now()-interval '1 second'")
 const retry=await claim();assert.equal(retry.lesson.id,2);assert.notEqual(retry.attempt_id,first.attempt_id)
 assert.equal((await db.query("select public.finish_news_post($1,$2,$3,'sent',123,null,0) as done",[-100123,2,first.attempt_id])).rows[0].done,false)
 await db.query("select public.finish_news_post($1,$2,$3,'sent',123,null,0)",[-100123,2,retry.attempt_id])
 assert.equal(await claim(),null,'enforce chat rate limit across workers')
 await db.exec("update public.news_publications set attempted_at=now()-interval '10 seconds'")
 const second=await claim();assert.equal(second.lesson.id,1)
 await db.query("select public.finish_news_post($1,$2,$3,'uncertain',null,'network',0)",[-100123,1,second.attempt_id])
 await db.exec("update public.news_publications set attempted_at=now()-interval '10 seconds'")
 assert.equal(await claim(),null,'ambiguous send blocks order without duplicating')
 await assert.rejects(db.exec("set role anon; select public.claim_news_post(-100123)"),/permission denied/)
 }finally{await db.close()}
})
