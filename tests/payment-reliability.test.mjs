import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createClient, reset, state } from './api/fake-supabase.mjs'
import { accessFixtures } from './payment-access-fixtures.mjs'

const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const latest = () => migration('20261111231000_payment_reliability.sql')
async function database(t, upgrade = true) {
  const db = new PGlite(); t.after(() => db.close())
  await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;create role anon;create role authenticated;create role service_role bypassrls;`)
  for (const name of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261028090000_core_atomic_operations.sql','20261030030734_payment_purchase_intents.sql']) {
    await db.exec((await migration(name)).replace('create extension if not exists pgcrypto with schema extensions;', ''))
  }
  if (upgrade) await db.exec(await latest())
  await db.exec(`insert into users(id) values(1),(2),(3),(4),(5);insert into courses(title,published,price_stars) values('Course',true,100);insert into advent_rewards(title,doors,kind,payload) values('Prize',1,'course','{"course_id":1}');`)
  return db
}
const sqlRpc = db => async (name, args) => (await db.query(`select ${name}(${Object.keys(args).map((key, i) => key + '=>$' + (i + 1)).join(',')}) value`, Object.values(args))).rows[0].value

for (const backend of ['PostgreSQL', 'API fake']) test(`${backend}: common grant/payment/refund contract fixtures`, async t => {
  let rpc, readAccess
  if (backend === 'PostgreSQL') {
    const db = await database(t)
    rpc = sqlRpc(db)
    readAccess = async user => (await db.query('select user_id::int,source,manual_source from course_access where user_id=$1', [user])).rows
  } else {
    reset({ users: [1,2,3,4,5].map(id => ({ id })), courses: [{id:1,price_stars:100,published:true}], advent_rewards: [{id:1,kind:'course',payload:{course_id:1}}] })
    rpc = async (name,args) => { const result = await createClient().rpc(name,args); if(result.error)throw Error(result.error.message); return result.data }
    readAccess = async user => (state.tables.course_access ?? []).filter(a => a.user_id === user).map(({user_id,source,manual_source})=>({user_id,source,manual_source:manual_source??null}))
  }
  for (const [index, fixture] of accessFixtures.entries()) await t.test(fixture.name, async () => {
    for (const [name,args] of fixture.steps) await rpc(name,args)
    assert.deepEqual(await readAccess(index + 1), fixture.access)
  })
})

test('migration preserves known Advent access without inferring grants from mutable historical payloads', async t => {
  const db = await database(t, false)
  await db.exec(`insert into course_access(user_id,course_id,source,manual_source) values(1,1,'stars',null),(3,1,'advent',null),(4,1,'stars','admin');
    insert into reward_codes(code,user_id,reward_id) values('OLD-ONE',1,1),('OLD-TWO',2,1),('OLD-FOUR',4,1);
    insert into advent_rewards(title,doors,kind,payload) values('Malformed',1,'course','{"course_id":"1;drop table courses"}');
    insert into reward_codes(code,user_id,reward_id) values('INVALID',3,2);`)
  await db.exec(await latest())
  assert.deepEqual((await db.query('select user_id::int,manual_source from course_access order by user_id')).rows, [{user_id:1,manual_source:null},{user_id:3,manual_source:'advent'},{user_id:4,manual_source:'admin'}])
  assert.equal((await db.query('select count(*)::int n from reward_codes where granted_course_id is not null')).rows[0].n,0)
  // An operator-confirmed historical mapping repairs the hidden/deleted grants.
  await db.exec("update reward_codes set granted_course_id=1 where code in ('OLD-ONE','OLD-TWO');select grant_course_access(user_id,granted_course_id,'advent') from reward_codes where granted_course_id is not null;")
  assert.equal((await db.query("select count(*)::int n from course_access where manual_source='advent'")).rows[0].n,3)
})

test('durable manual refund claims are idempotent, fenced and keep access until confirmed', async t => {
  const db = await database(t), rpc = sqlRpc(db)
  await rpc('apply_star_payment',{p_user:1,p_course:1,p_stars:100,p_charge:'primary'})
  await rpc('apply_star_payment',{p_user:1,p_course:1,p_stars:100,p_charge:'extra'})
  await rpc('advent_grant',{p_user:2,p_reward:1})
  await db.exec("update advent_rewards set payload='{}' where id=1")
  assert.equal((await db.query('select granted_course_id::int from reward_codes where user_id=2')).rows[0].granted_course_id,1, 'new prize identity survives later reward edits')
  await db.exec('delete from course_access where user_id=2')
  const id = (await db.query("select id::int from payments where charge_id='primary'")).rows[0].id
  await rpc('queue_payment_refund',{p_payment:id}); await rpc('queue_payment_refund',{p_payment:id})
  assert.equal((await db.query("select count(*)::int n from payment_refund_jobs where charge_id='primary'")).rows[0].n,1)
  await rpc('apply_star_refund',{p_charge:'extra'})
  assert.equal((await db.query('select count(*)::int n from course_access')).rows[0].n,1, 'failed/pending primary refund must not let duplicate refund revoke access')
  const [job] = await rpc('claim_payment_refund',{p_charge:'primary'})
  assert.equal((await rpc('claim_payment_refund',{p_charge:'primary'})).length,0)
  assert.equal((await rpc('claim_payment_refunds',{p_limit:20})).length,0)
  assert.equal(await rpc('finish_payment_refund',{p_charge:'primary',p_lease:job.lease_token,p_ok:false,p_error:'network'}),true)
  assert.equal((await rpc('claim_payment_refund',{p_charge:'primary'})).length,0, 'manual retry respects backoff')
  await db.exec("update payment_refund_jobs set next_attempt_at=now()-interval '1 second' where charge_id='primary'")
  const [retry] = await rpc('claim_payment_refund',{p_charge:'primary'})
  assert.equal(await rpc('finish_payment_refund',{p_charge:'primary',p_lease:job.lease_token,p_ok:true,p_error:null}),false)
  assert.equal(await rpc('finish_payment_refund',{p_charge:'primary',p_lease:retry.lease_token,p_ok:true,p_error:null}),true)
  assert.equal((await db.query('select count(*)::int n from course_access')).rows[0].n,0)
  assert.equal((await rpc('queue_payment_refund',{p_payment:id})).refunded,true)
  await db.exec('set role authenticated')
  for(const [name,args] of [['queue_payment_refund',{p_payment:id}],['claim_payment_refund',{p_charge:'primary'}],['grant_course_access',{p_user:1,p_course:1,p_source:'advent'}]]) await assert.rejects(rpc(name,args),/permission denied/)
})
