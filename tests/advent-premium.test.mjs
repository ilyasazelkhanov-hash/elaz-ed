import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {doors,rewards,offers,telegramPosts} from '../content/advent/premium-2026-10-26/catalog.mjs'
test('premium content has distinct tasks, honest offer conditions and Telegram-only posts',()=>{
 assert.equal(new Set(doors.map(x=>x.title)).size,24)
 assert.equal(offers.length,5);assert.equal(telegramPosts.length,6)
 assert(offers.every(x=>x.url.startsWith('https://')&&x.eligibility))
 assert(rewards.every(x=>x.kind==='lesson'||x.payload.text.length>1500))
 assert(telegramPosts.every(x=>x.text.length<=3800&&x.text.includes('#ТолькоВКанале')))
})
test('premium import preserves opened doors, issued rewards, course prizes and feed, and is idempotent',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const name of ['001_init.sql','006_courses_stars_freezes.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql']){
  let sql=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
  if(name.startsWith('009')||name.startsWith('010')||name.startsWith('011'))sql=sql.split(/\ncreate (?:or replace )?function /i)[0].replace(/create extension[^;]+;/gi,'')
  await db.exec(sql)
 }
 await db.exec(`insert into public.users(id,xp) values(1,123);
 insert into public.courses(id,title) overriding system value values(1,'Ролики с ИИ: от идеи до MP4');
 insert into public.lessons(title,course_id,free_preview) values('Собираем и правим сториборд',1,false);
 insert into public.settings(key,value) values('advent','{"start":"2026-10-18","enabled":true}');
 insert into public.advent_doors(day,title,body,kind,prize) select i,'Original '||i,'Preserve '||i,'scratch','Old prize' from generate_series(1,24)i;
 insert into public.advent_opens(user_id,day,xp) values(1,1,40),(1,2,40),(1,7,40);
 insert into public.advent_rewards(id,doors,title,kind,payload,stock,mode) overriding system value values
 (9,3,'Old pack','message','{"text":"Old text"}',null,'threshold'),(10,7,'Lesson','lesson','{"lesson_id":65}',null,'threshold'),
 (11,1,'Instant course','course','{"course_id":1}',2,'instant'),(12,1,'Course draw','course','{"course_id":1}',3,'draw');
 select setval(pg_get_serial_sequence('public.advent_rewards','id'),12);
 insert into public.reward_codes(code,user_id,reward_id) values('ABCDEFGH',1,9),('ABCDEFGJ',1,11);`)
 const sql=await readFile(new URL('../content/advent/premium-2026-10-26/import.sql',import.meta.url),'utf8')
 await db.exec(sql);await db.exec(sql)
 assert.equal((await db.query('select count(*)::int n from public.advent_rewards')).rows[0].n,14)
 assert.equal((await db.query('select count(*)::int n from public.reward_codes')).rows[0].n,2)
 assert.equal((await db.query('select count(*)::int n from public.lessons')).rows[0].n,1)
 assert.equal((await db.query("select count(*)::int n from public.advent_doors where body like 'Preserve %'")).rows[0].n,3)
 assert.equal((await db.query('select stock from public.advent_rewards where id=11')).rows[0].stock,2)
 assert.equal((await db.query("select value->>'start' start from public.settings where key='advent'")).rows[0].start,'2026-10-18')
 assert.equal((await db.query('select xp from public.users where id=1')).rows[0].xp,123)
 }finally{await db.close()}
})
