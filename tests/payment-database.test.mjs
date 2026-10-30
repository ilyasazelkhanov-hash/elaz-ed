import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('course purchase intent, duplicate refund queue and independent access grounds', async t => {
 const db = new PGlite(); t.after(()=>db.close())
 await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;`)
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261028090000_core_atomic_operations.sql']) await db.exec((await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto with schema extensions;',''))
 const migration = await readFile(new URL('../supabase/migrations/20261030030734_payment_purchase_intents.sql',import.meta.url),'utf8').catch(()=> '')
 if(migration) await db.exec(migration)
 const rpc=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
 await db.exec(`insert into users(id) values(1),(2),(3);insert into courses(title,published,price_stars) values('Course',true,100);`)
 await t.test('reuses intent and stored invoice, and atomically reserves checkout query',async()=>{
  const a=await rpc('course_purchase_intent',[1,1]);const b=await rpc('course_purchase_intent',[1,1]);assert.equal(a.payload,b.payload)
  await rpc('course_purchase_link',[1,a.payload,'https://t.me/invoice']);assert.equal((await rpc('course_purchase_intent',[1,1])).link,'https://t.me/invoice')
  assert.equal(await rpc('check_course_checkout',[1,a.payload,100,'q1']),true)
  assert.equal(await rpc('check_course_checkout',[1,a.payload,100,'q1']),true)
  assert.equal(await rpc('check_course_checkout',[1,'course:1:1',100,'q2']),false)
 })
 await t.test('second distinct charge is refunded durably without replacing first access',async()=>{
  assert.equal((await rpc('apply_star_payment',[1,1,100,'first'])).refund_pending,false)
  assert.equal((await rpc('apply_star_payment',[1,1,100,'second'])).refund_pending,true)
  await rpc('apply_star_payment',[1,1,100,'second'])
  assert.equal((await db.query('select count(*)::int n from payment_refund_jobs')).rows[0].n,1)
  const jobs=await rpc('claim_payment_refunds',[10]);assert.equal(jobs.length,1)
  assert.equal((await rpc('claim_payment_refunds',[10])).length,0)
  await rpc('finish_payment_refund',['second',jobs[0].lease_token,true,null])
  assert.equal((await db.query('select count(*)::int n from course_access where user_id=1')).rows[0].n,1)
  assert.equal((await db.query("select refunded_at is not null refunded from payments where charge_id='second'")).rows[0].refunded,true)
 })
 await t.test('manual grant after payment survives refund and repeated approval',async()=>{
  await rpc('apply_star_payment',[2,1,100,'manual-first']);await rpc('decide_course_request',[2,1,true]);await rpc('apply_star_refund',['manual-first'])
  assert.equal((await db.query('select source from course_access where user_id=2')).rows[0].source,'admin')
 })
 await t.test('legacy checkout validates live price and reserves one approval',async()=>{
  assert.equal(await rpc('check_course_checkout',[3,'course:1:3',99,'q3']),false)
  assert.equal(await rpc('check_course_checkout',[3,'course:1:3',100,'q3']),true)
  assert.equal(await rpc('check_course_checkout',[3,'course:1:3',100,'q4']),false)
 })
 await t.test('failed refunds back off, expired leases recover, and stale workers cannot finalize',async()=>{
  await rpc('apply_star_payment',[1,1,100,'retry-charge'])
  const first=(await rpc('claim_payment_refunds',[10]))[0]
  assert.equal(await rpc('finish_payment_refund',['retry-charge',first.lease_token,false,'network']),true)
  assert.equal((await rpc('claim_payment_refunds',[10])).length,0)
  await db.exec("update payment_refund_jobs set next_attempt_at=now()-interval '1 minute' where charge_id='retry-charge'")
  const second=(await rpc('claim_payment_refunds',[10]))[0]
  assert.notEqual(second.lease_token,first.lease_token)
  assert.equal(await rpc('finish_payment_refund',['retry-charge',first.lease_token,true,null]),false)
  await db.exec("update payment_refund_jobs set lease_until=now()-interval '1 minute' where charge_id='retry-charge'")
  const recovered=(await rpc('claim_payment_refunds',[10]))[0]
  assert.equal(recovered.attempts,3)
  assert.equal(await rpc('finish_payment_refund',['retry-charge',second.lease_token,true,null]),false)
  assert.equal(await rpc('finish_payment_refund',['retry-charge',recovered.lease_token,true,null]),true)
  assert.equal((await db.query('select count(*)::int n from course_access where user_id=1')).rows[0].n,1)
 })
 await t.test('new intent fulfillment resolves server course and rejects mismatched price',async()=>{
  await rpc('apply_star_refund',['first'])
  const intent=await rpc('course_purchase_intent',[1,1])
  await assert.rejects(rpc('apply_course_purchase',[1,intent.payload,1,'forged']),/Payment data mismatch/)
  const result=await rpc('apply_course_purchase',[1,intent.payload,100,'repurchase'])
  assert.equal(result.course_id,1);assert.equal(result.refund_pending,false)
  assert.equal((await rpc('apply_course_purchase',[1,intent.payload,100,'repurchase'])).duplicate,true)
 })
 await t.test('anonymous clients cannot invoke payment mutations or read intents',async()=>{
  await db.exec('set role anon')
  for(const [name,args] of [['grant_course_access',[3,1,'admin']],['course_purchase_intent',[3,1]],['course_purchase_link',[3,'x','x']],['check_course_checkout',[3,'x',100,'q']],['apply_course_purchase',[3,'x',100,'x']],['claim_payment_refunds',[1]],['finish_payment_refund',['x','00000000-0000-0000-0000-000000000000',true,null]]])await assert.rejects(rpc(name,args),/permission denied/)
  for(const table of ['course_purchase_intents','payment_refund_jobs'])await assert.rejects(db.query('select * from '+table),/permission denied/)
  await db.exec('reset role')
 })
})
