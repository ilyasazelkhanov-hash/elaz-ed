import test from 'node:test'
import assert from 'node:assert/strict'
import {copyFile,mkdtemp,readFile,rm} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {tmpdir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {PGlite} from '@electric-sql/pglite'
const content=new URL('../content/ai-practice-2026-10-25/',import.meta.url)

test('regenerating reference policy retains the archived authored editions when course labs change',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'og-reference-policy-'))
 try{
  for(const file of ['build-reference-expansion.mjs','training-labs.mjs','training.json','reference-posts.json'])await copyFile(new URL(file,content),join(folder,file))
  const before=JSON.parse(await readFile(join(folder,'reference-posts.json'),'utf8'))
  await promisify(execFile)(process.execPath,[join(folder,'build-reference-expansion.mjs')])
  const after=JSON.parse(await readFile(join(folder,'reference-posts.json'),'utf8'))
  assert.deepEqual(after,before,'news policy regeneration must not rewrite historical public article editions')
 }finally{
  assert.equal(resolve(dirname(folder)),resolve(tmpdir()))
  await rm(folder,{recursive:true,force:true})
 }
})
test('course-derived references stay out of news on new and repeat imports without losing links or progress',async()=>{
 const db=new PGlite()
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for(const f of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
  await db.exec('alter table lessons add column news_eligible boolean not null default true')
  await db.exec("insert into lessons(title,body,published) values('Keep existing','Original',true); insert into users(id,xp) values(42,100); insert into progress(user_id,lesson_id,xp_earned) values(42,1,100)")
  const sql=await readFile(new URL('reference-posts.sql',content),'utf8')
  await db.exec(sql)
  const before=(await db.query('select id,title,body,published,published_at,course_id from lessons order by id')).rows
  await db.exec('insert into progress(user_id,lesson_id,xp_earned) values(42,2,0); insert into likes(user_id,lesson_id) values(42,2); update lessons set news_eligible=true where id>1')
  await db.exec(sql);await db.exec(sql)
  const rows=(await db.query('select * from lessons order by id')).rows
  assert.equal(rows.length,9);assert.equal(rows[0].body,'Original')
  assert(rows.slice(1).every(x=>x.course_id===null&&x.published&&x.free_preview))
  assert(rows.slice(1).every(x=>x.news_eligible===false),'course practice must not reenter news when its import is rerun')
  assert.equal(rows[0].news_eligible,true,'unrelated free articles remain eligible')
  assert.deepEqual((await db.query('select id,title,body,published,published_at,course_id from lessons order by id')).rows,before)
  assert.deepEqual((await db.query('select id from lessons where published and course_id is null and news_eligible order by id')).rows,[{id:1}])
  assert(rows.slice(1).every((x,i,a)=>!i||new Date(x.published_at)>=new Date(a[i-1].published_at)))
  assert.equal((await db.query('select * from progress')).rows.length,2)
  assert.equal((await db.query('select lesson_id from likes where user_id=42')).rows[0].lesson_id,2)
  assert.equal((await db.query('select xp from users where id=42')).rows[0].xp,100)
 }finally{await db.close()}
})

test('authored reference practice carries explicit provenance and cannot be imported as news',async()=>{
 const posts=JSON.parse(await readFile(new URL('reference-posts.json',content),'utf8')).posts
 for(const post of posts){
  assert.equal(post.news_eligible,false,post.key)
  assert.deepEqual(post.provenance,{role:'course_practice',source_pack:'ai-practice-2026-10-25',source_file:'training-labs.mjs',source_lesson_key:post.key.replace(/^reference-/, '')})
 }
 const db=new PGlite()
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for(const f of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
  await db.exec('alter table lessons add column news_eligible boolean not null default true')
  const sql=await readFile(new URL('reference-posts.sql',content),'utf8')
  await assert.rejects(db.exec(sql.replaceAll('"news_eligible":false','"news_eligible":true')),/Course practice cannot be imported as news/)
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
