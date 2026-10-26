import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('revision preserves IDs and progress, removes promotion, adds OpenBot and Agent Reach exactly once',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
 await db.exec(await readFile(new URL('../content/ai-practice-2026-10-25/import.sql',import.meta.url),'utf8'))
 await db.exec(`insert into lessons(id,title,body) overriding system value values(256,'Как выбирать пару шрифтов для ролика','https://x.com/AlbiaHossain/old'),(258,'Аниме-мотокросс: удержать персонажа в видео','https://x.com/TechieBySA/old'); insert into settings(key,value) values('content_import:elaz-ed-2026-10-v1','{"lessons":{"feed-56":256,"feed-58":258}}')`)
 await db.exec("insert into users(id,xp) values(123,500); insert into progress(user_id,lesson_id,xp_earned) values(123,1,25)")
 const sql=await readFile(new URL('../content/ai-practice-2026-10-25/revision.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,70)
 assert.equal((await db.query("select count(*)::int n from lessons where id in(256,258) and body like '%https://x.com/%'")).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from lessons where course_id is not null')).rows[0].n,10)
 assert.equal((await db.query('select xp from users where id=123')).rows[0].xp,500)
 assert.equal((await db.query('select lesson_id from progress where user_id=123')).rows[0].lesson_id,1)
 const p=(await db.query("select title,body,course_id from lessons where body like '%https://openbot.run/%' or body like '%https://github.com/Panniantong/Agent-Reach%'")).rows
 assert.equal(p.length,4)
 assert.equal(p.filter(x=>x.course_id).length,2)
 const bad=(await db.query("select id from lessons where body ~* 'denissexy|boris_again|Thalita Milan|bxYHcNgONjc'")).rows
 assert.equal(bad.length,0)
 }finally{await db.close()}
})
