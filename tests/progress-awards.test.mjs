import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('progress and achievement writes are atomic and recover historical missing awards', async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const name of ['001_init.sql','006_courses_stars_freezes.sql','20261016201213_ordinary_quiz_attempts.sql','20261030030610_atomic_progress_awards.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'))
 await db.exec("insert into users(id) values(1); insert into lessons(title,xp) values('Lesson',50);")
 const rpc=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
 await t.test('achievement failure rolls back XP and progress',async()=>{
  await db.exec("create function fail_award() returns trigger language plpgsql as $$begin if new.achievements<>old.achievements then raise exception 'award_failure';end if;return new;end$$;create trigger reject_award before update on users for each row execute function fail_award();")
  await assert.rejects(rpc('complete_lesson_awarded',[1,1,0,0,50,0]),/award_failure/)
  assert.equal((await db.query('select xp from users where id=1')).rows[0].xp,0)
  assert.equal((await db.query('select count(*)::int n from progress')).rows[0].n,0)
  await db.exec('drop trigger reject_award on users;')
 })
 await t.test('retry awards once and historical replay reconciles without XP',async()=>{
  const first=await rpc('complete_lesson_awarded',[1,1,0,0,50,0]);assert.equal(first.inserted,true);assert.ok(first.new_achievements.includes('first'))
  await db.exec("update users set achievements='{}';")
  const replay=await rpc('complete_lesson_awarded',[1,1,0,0,50,0]);assert.equal(replay.inserted,false);assert.ok(replay.new_achievements.includes('first'))
  assert.equal((await db.query('select xp from users where id=1')).rows[0].xp,50)
  assert.deepEqual((await rpc('complete_lesson_awarded',[1,1,0,0,50,0])).new_achievements,[])
 })
 await t.test('daily failure rolls back claim and retry repairs historical award',async()=>{
  await db.exec("update users set streak=2,last_claim=current_date-1;create trigger reject_award before update on users for each row execute function fail_award();")
  await assert.rejects(rpc('claim_daily_awarded',[1,new Date().toISOString().slice(0,10)]),/award_failure/)
  assert.equal((await db.query('select streak from users where id=1')).rows[0].streak,2)
  await db.exec('drop trigger reject_award on users;')
  const first=await rpc('claim_daily_awarded',[1,new Date().toISOString().slice(0,10)]);assert.ok(first.gained>0);assert.ok(first.new_achievements.includes('streak3'))
  await db.exec("update users set achievements='{}';")
  const replay=await rpc('claim_daily_awarded',[1,new Date().toISOString().slice(0,10)]);assert.equal(replay.gained,0);assert.ok(replay.new_achievements.includes('streak3'))
 })
 await t.test('new RPCs closed to public roles',async()=>{
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.complete_lesson_awarded(bigint,bigint,integer,integer,integer,integer)','execute') allowed",[role])).rows[0].allowed,false)
 })
})
