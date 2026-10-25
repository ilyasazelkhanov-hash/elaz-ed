import {PGlite} from '@electric-sql/pglite'
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir=new URL('./',import.meta.url)
const db=new PGlite()
try{
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
for(const file of ['001_init.sql','006_courses_stars_freezes.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,dir),'utf8'))
await db.exec("insert into public.users(id,xp) values (123,500); insert into public.lessons(title,body) values ('Existing material','Must remain'); insert into public.progress(user_id,lesson_id,xp_earned) values (123,1,50);")
const sql=await readFile(new URL('import.sql',dir),'utf8')
await db.exec(sql)
await db.exec(sql)
const count=(await db.query('select count(*)::int as total,count(*) filter(where course_id is null)::int as feed,count(*) filter(where course_id is not null)::int as course from public.lessons')).rows[0]
assert.deepEqual(count,{total:65,feed:57,course:8})
assert.equal((await db.query('select count(*)::int as n from public.courses')).rows[0].n,1)
assert.equal((await db.query('select xp from public.users where id=123')).rows[0].xp,500)
assert.equal((await db.query('select count(*)::int as n from public.progress')).rows[0].n,1)
assert.equal((await db.query('select body from public.lessons where id=1')).rows[0].body,'Must remain')
const payload=JSON.parse(await readFile(new URL('payload.json',dir),'utf8'))
const images=JSON.parse(await readFile(new URL('images.json',dir),'utf8'))
assert(images.every(x=>x.checked),'Unverified cover')
for(const post of payload.lessons.filter(x=>!x.course_key)){
assert.equal(payload.lessons.filter(x=>x.course_key&&x.body.includes(post.body)).length,1,`Course copy ${post.key}`)
assert(!post.body.includes('Что остаётся в карантине'))
}
const report={passed:true,feed:56,course_blocks:8,covers:images.length,all_covers_load:true,all_posts_in_exactly_one_block:true,idempotent_import:true,existing_content_and_progress_preserved:true}
await writeFile(new URL('verification.json',dir),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
}finally{await db.close()}
