import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {isBlogPost,isNewsPost} from '../src/lib/content.ts'
import {newestPosts} from '../src/lib/discovery.ts'

test('news listing eligibility does not break standalone readers or include courses',()=>{
 const article={id:159,kind:'lesson',course_id:null,published:true,published_at:'2026-11-01',news_eligible:false}
 assert.equal(isBlogPost(article),true)
 assert.equal(isNewsPost(article),false)
 assert.deepEqual(newestPosts([article,{...article,id:2,course_id:4,news_eligible:true},{...article,id:3,news_eligible:true}]).map(p=>p.id),[3])
})

test('database keeps course practice out of feed and delivery without altering direct links or progress',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261025215414_news_autopublishing.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 const reference=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/reference-posts.json',import.meta.url),'utf8')).posts[0]
 await db.exec(`insert into users(id) values(1);insert into courses(id,title) overriding system value values(1,'Paid');insert into lessons(id,title,body,published,course_id,published_at) overriding system value values(1,'Paid','Private',true,1,'2026-10-01'),(20,'Fresh','Actual news',true,null,'2026-11-01'),(21,'Story','Story body',true,null,'2026-11-01');update lessons set kind='story' where id=21;insert into settings(key,value) values('news_publishing','{"enabled":true,"chat_id":-100}');`)
 await db.query('insert into lessons(id,title,body,published,published_at) overriding system value values(159,$1,$2,true,$3)',[reference.title,reference.body,'2026-10-01'])
 await db.exec(`insert into progress(user_id,lesson_id) values(1,159);`)
 const original=(await db.query('select id,body,published,course_id from lessons where id=159')).rows[0]
 await db.exec(await readFile(new URL('../supabase/migrations/20261107104626_news_course_boundaries.sql',import.meta.url),'utf8'))
 assert.deepEqual((await db.query('select id,body,published,course_id from lessons where id=159')).rows[0],original)
 assert.equal((await db.query('select count(*)::int n from progress where lesson_id=159')).rows[0].n,1)
 assert.deepEqual((await db.query('select id from feed_cards order by id')).rows.map(r=>r.id),[1,20,21])
 assert.equal((await db.query('select body from feed_cards where id=1')).rows[0].body,null)
 assert.equal((await db.query('select body from feed_cards where id=21')).rows[0].body,'Story body')
 await db.exec('update lessons set news_eligible=true where id=159')
 assert.equal((await db.query('select news_eligible from lessons where id=159')).rows[0].news_eligible,false)
 await db.query('insert into lessons(id,title,body,published) overriding system value values(200,$1,$2,true)',[reference.title,reference.body])
 assert.equal((await db.query('select count(*)::int n from feed_cards where title=$1',[reference.title])).rows[0].n,0)
 assert.equal((await db.query('select claim_news_post(-100) item')).rows[0].item.lesson.id,20)
 await db.exec('set role anon')
 await assert.rejects(db.query('select claim_news_post(-100)'),/permission denied/)
})
