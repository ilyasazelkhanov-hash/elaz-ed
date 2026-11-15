import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

const CHAIN=['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql','20261018170000_ai_academy_files.sql','20261028090000_core_atomic_operations.sql']
const SEASONS='20261115120000_advent_seasons.sql'
const sql=async name=>(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto with schema extensions;','')
const NEW='ai-winter-2026'

test('advent seasons are additive on real PostgreSQL functions',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;`)
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const f of CHAIN)await db.exec(await sql(f))
 const one=async(q,p=[])=>(await db.query(q,p)).rows[0]
 const n=async(q,p=[])=>(await one(`select count(*)::int n from ${q}`,p)).n
 // A finished legacy campaign with opens, an unused ticket, a threshold prize and an issued code.
 await db.exec(`insert into users(id,xp) values(1,100),(2,0),(3,0);
  update settings set value='{"enabled":true,"title":"Creator Vault","start":"2026-10-18","days":24,"tz":300,"grace":3}' where key='advent';
  insert into advent_doors(day,title,kind,body) select i,'Old '||i,'story','Old body '||i from generate_series(1,24)i;
  insert into advent_opens(user_id,day,xp) values(1,1,30),(1,2,30),(1,3,30),(2,1,30);
  insert into advent_tickets(user_id,source,ref) values(1,'admin','admin:1:legacy');
  insert into advent_rewards(doors,title) values(3,'Old pack');`)
 const oldCode=(await one(`select advent_grant(1,1) code`)).code
 const before=(await db.query(`select user_id,day,xp,late,opened_at from advent_opens order by user_id,day`)).rows
 await db.exec(await sql(SEASONS))

 await t.test('legacy rows keep their identity, XP and codes',async()=>{
  assert.deepEqual((await db.query(`select user_id,day,xp,late,opened_at from advent_opens order by user_id,day`)).rows,before)
  for(const table of ['advent_doors','advent_opens','advent_rewards','advent_tickets'])assert.equal(await n(`${table} where season<>'legacy'`),0,table)
  assert.equal((await one(`select xp from users where id=1`)).xp,100)
  assert.equal((await one(`select status from reward_codes where code=$1`,[oldCode])).status,'issued')
  assert.equal((await one(`select config->>'start' start from advent_seasons where id='legacy'`)).start,'2026-10-18')
  assert.equal((await one(`select advent_active_season() s`)).s,'legacy')
 })

 await db.exec(`insert into advent_seasons(id) values('${NEW}');
  insert into advent_doors(season,day,title,kind,xp) select '${NEW}',i,'New '||i,'story',15 from generate_series(1,53)i;`)

 await t.test('the same day number is a different door in a new season',async()=>{
  assert.equal(await n(`advent_doors where day=1`),2)
  const first=await one(`select * from advent_open($1,1,1,0,0,15,false)`,[NEW])
  assert.deepEqual(first,{inserted:true,opened:1})
  const again=await one(`select * from advent_open($1,1,1,0,0,15,false)`,[NEW])
  assert.deepEqual(again,{inserted:false,opened:1})
  assert.equal((await one(`select xp from users where id=1`)).xp,115)
  assert.equal(await n(`advent_opens where user_id=1 and season='legacy'`),3)
 })

 await t.test('concurrent opens award XP once',async()=>{
  const replies=await Promise.all(Array.from({length:6},()=>one(`select * from advent_open($1,3,2,0,0,15,false)`,[NEW])))
  assert.equal(replies.filter(r=>r.inserted).length,1)
  assert.equal((await one(`select xp from users where id=3`)).xp,15)
 })

 await t.test('a late door needs a ticket of the same season',async()=>{
  assert.deepEqual(await one(`select * from advent_open_late($1,1,2,0,0,8)`,[NEW]),{inserted:false,opened:1,ticket:false})
  assert.equal(await n(`advent_tickets where user_id=1 and used_at is null`),1)
  await db.exec(`insert into advent_tickets(user_id,season,source,ref) values(1,'${NEW}','admin','${NEW}:admin:1:a')`)
  assert.deepEqual(await one(`select * from advent_open_late($1,1,2,0,0,8)`,[NEW]),{inserted:true,opened:2,ticket:true})
  assert.deepEqual(await one(`select * from advent_open_late($1,1,2,0,0,8)`,[NEW]),{inserted:false,opened:2,ticket:true})
  assert.equal(await n(`advent_tickets where user_id=1 and season='legacy' and used_at is null`),1)
  assert.equal((await one(`select xp from users where id=1`)).xp,123)
 })

 await t.test('prizes and draws only see their own season',async()=>{
  await db.exec(`insert into advent_rewards(season,doors,title,mode,stock,day_from,day_to) values('${NEW}',1,'New draw','draw',5,1,53)`)
  const id=(await one(`select id from advent_rewards where title='New draw'`)).id
  const winners=(await db.query(`select winner_id from advent_draw($1)`,[id])).rows.map(r=>Number(r.winner_id)).sort()
  assert.deepEqual(winners,[1,3]) // user 2 only opened legacy doors
  assert.equal(await n(`reward_codes where reward_id=1`),1)
 })

 await t.test('summary is scoped to one season',async()=>{
  const fresh=(await one(`select advent_summary($1) v`,[NEW])).v,old=(await one(`select advent_summary('legacy') v`)).v
  assert.equal(fresh.opens,3);assert.equal(fresh.by_day.length,53);assert.equal(fresh.rewards.length,1)
  assert.equal(old.opens,4);assert.equal(old.by_day.length,24);assert.equal(old.rewards[0].issued,1)
 })

 await t.test('old signatures and defaults follow the active season',async()=>{
  assert.equal((await one(`select advent_summary() v`)).v.opens,4)
  await db.exec(`update settings set value=value||'{"season":"${NEW}","start":"2026-11-14","days":53}' where key='advent'`)
  assert.equal((await one(`select advent_active_season() s`)).s,NEW)
  assert.deepEqual(await one(`select * from advent_open(2,5,0,0,15,false)`),{inserted:true,opened:1})
  assert.equal((await one(`select season from advent_opens where user_id=2 and day=5`)).season,NEW)
  await db.query(`select apply_ticket_payment(2,10,'charge-new')`)
  assert.equal((await one(`select season from advent_tickets where ref='stars:charge-new'`)).season,NEW)
  await db.exec(`update settings set value=value||'{"season":"Bad Season!"}' where key='advent'`)
  assert.equal((await one(`select advent_active_season() s`)).s,'legacy')
 })

 await t.test('deleting a new door cannot cascade into legacy opens and clients have no access',async()=>{
  await db.exec(`delete from advent_doors where season='${NEW}' and day=53`)
  assert.equal(await n(`advent_opens where season='legacy'`),4)
  for(const role of ['anon','authenticated']){
   assert.equal((await one(`select has_function_privilege($1,'public.advent_open(text,bigint,integer,integer,integer,integer,boolean)','execute') ok`,[role])).ok,false)
   assert.equal((await one(`select has_table_privilege($1,'public.advent_seasons','select') ok`,[role])).ok,false)
  }
 })
})
