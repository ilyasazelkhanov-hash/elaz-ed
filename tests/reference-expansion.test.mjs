import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const content=new URL('../content/ai-practice-2026-10-25/',import.meta.url)
test('reference news import is repeatable and preserves existing content and progress',async()=>{
 const db=new PGlite()
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for(const f of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
  await db.exec("insert into lessons(title,body) values('Keep existing','Original'); insert into users(id,xp) values(42,100); insert into progress(user_id,lesson_id,xp_earned) values(42,1,100)")
  const sql=await readFile(new URL('reference-posts.sql',content),'utf8')
  await db.exec(sql);await db.exec(sql)
  const rows=(await db.query('select * from lessons order by id')).rows
  assert.equal(rows.length,9);assert.equal(rows[0].body,'Original')
  assert(rows.slice(1).every(x=>x.course_id===null&&x.published&&x.free_preview))
  assert(rows.slice(1).every((x,i,a)=>!i||new Date(x.published_at)>=new Date(a[i-1].published_at)))
  assert.equal((await db.query('select * from progress')).rows.length,1)
  assert.equal((await db.query('select xp from users where id=42')).rows[0].xp,100)
 }finally{await db.close()}
})
test('adaptation has practical outputs, current GUI routes and transparent source coverage',async()=>{
 const p=JSON.parse(await readFile(new URL('training.json',content),'utf8'))
 assert.equal(p.lessons.length,14)
 assert.equal(p.lessons.filter(x=>x.body.includes('## Дополнительная практика:')).length,10)
 assert(p.lessons.find(x=>x.key==='block-2').body.includes('Gemini Notebook'))
 assert(p.lessons.find(x=>x.key==='block-4').body.includes('mode picker'))
 assert(p.lessons.find(x=>x.key==='block-native-automation').body.includes('Trusted folders'))
 const audit=JSON.parse(await readFile(new URL('reference-audit.json',content),'utf8'))
 assert.equal(audit.sources.length,11)
 assert(audit.sources.filter(x=>x.url.includes('youtube')).every(x=>x.access.includes('no transcripts')))
 const posts=JSON.parse(await readFile(new URL('reference-posts.json',content),'utf8')).posts
 assert.equal(posts.length,8)
 assert(posts.every(x=>x.body.includes('### Запрос для этой задачи')&&x.body.includes('### Что сохранить и проверить')&&x.cover_url.startsWith('https://elaz-ed.vercel.app/learning/')))
})
