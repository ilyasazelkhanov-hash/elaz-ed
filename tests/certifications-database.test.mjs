import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('certification seed is complete/idempotent, keeps progress/prizes, and closes direct public reads',async()=>{
 const db=new PGlite()
 try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const name of ['001_init.sql','006_courses_stars_freezes.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261026073331_certification_passport.sql']){
  let sql=await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
  if(/^(009|010|011)/.test(name))sql=sql.split(/\ncreate (?:or replace )?function /i)[0].replace(/create extension[^;]+;/gi,'')
  await db.exec(sql)
 }
 await db.exec("insert into public.users(id,xp) values(1,777); insert into public.advent_rewards(doors,title,stock,kind,payload) values(3,'Existing gift',2,'message','{}');insert into public.reward_codes(code,user_id,reward_id) values('ABCDEFGH',1,1);")
 const seed=await readFile(new URL('../content/ai-certifications/import.sql',import.meta.url),'utf8')
 await db.exec(seed)
 await db.exec("insert into public.certification_progress(user_id,certification_id,status) values(1,'r0323','received')")
 await db.exec(seed)
 assert.equal((await db.query('select count(*)::int n from public.ai_certifications')).rows[0].n,353)
 assert.equal((await db.query("select count(*)::int n from public.advent_rewards where kind='certification'")).rows[0].n,4)
 assert.equal((await db.query('select count(*)::int n from public.reward_codes')).rows[0].n,1)
 assert.equal((await db.query('select status from public.certification_progress where user_id=1')).rows[0].status,'received')
 assert.equal((await db.query('select xp from public.users where id=1')).rows[0].xp,777)
 await assert.rejects(db.exec('set role anon; select url from public.ai_certifications'),/permission denied/)
 await db.exec('reset role')
 await assert.rejects(db.exec('set role authenticated; select * from public.certification_progress'),/permission denied/)
 }finally{await db.close()}
})
