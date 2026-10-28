import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'

test('atomic audit fixes on actual PostgreSQL functions',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;`)
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const f of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql','20261018170000_ai_academy_files.sql','20261028090000_core_atomic_operations.sql','20261028091000_academy_version_policy.sql']) await db.exec((await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8')).replace('create extension if not exists pgcrypto with schema extensions;',''))
 const rpc=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
 await db.exec(`insert into users(id) values(1),(2),(3);insert into settings(key,value) values('admins','{"boss":null,"other":null}');insert into courses(title) values('C');`)
 await t.test('concurrent bindings preserve both IDs and revocation is immediate',async()=>{
  assert.deepEqual(await Promise.all([rpc('resolve_admin',[1,'boss']),rpc('resolve_admin',[2,'other'])]),[true,true])
  assert.deepEqual((await db.query("select value from settings where key='admins'")).rows[0].value,{boss:1,other:2})
  await db.exec(`update settings set value='{}' where key='admins'`)
  assert.equal(await rpc('resolve_admin',[1,'boss']),false)
 })
 await t.test('parallel wrong PIN requests lock at eight',async()=>{
  await db.exec(`insert into advent_points(name,pin_hash) values('Test','good')`)
  const replies=await Promise.all(Array.from({length:9},()=>rpc('cashier_auth',[1,'wrong'])))
  assert.equal(replies.filter(r=>r.error==='pin_locked').length,1)
  assert.equal((await rpc('cashier_auth',[1,'good'])).error,'pin_locked')
 })
 await t.test('grant failure rolls back approval; retry succeeds',async()=>{
  await assert.rejects(rpc('decide_course_request',[2,999,true]))
  assert.equal((await db.query('select count(*)::int n from access_requests')).rows[0].n,0)
  await rpc('decide_course_request',[2,1,true]);assert.equal((await db.query('select count(*)::int n from course_access')).rows[0].n,1)
 })
 await t.test('refund and paid fulfillment cannot leave a live ticket',async()=>{
  await rpc('apply_ticket_payment',[2,10,'charge'])
  await Promise.all([rpc('apply_ticket_payment',[2,10,'charge']),rpc('apply_star_refund',['charge'])])
  assert.equal((await rpc('apply_ticket_payment',[2,10,'charge'])).refunded,true)
  assert.equal((await db.query('select count(*)::int n from advent_tickets where revoked_at is null')).rows[0].n,0)
 })
 await t.test('random decision is durable and cannot be rerolled',async()=>{
  await db.exec(`insert into advent_rewards(title,doors) values('Reward',1)`)
  assert.equal(await rpc('advent_reward_decision',[2,1,1,false]),false)
  assert.equal(await rpc('advent_reward_decision',[2,1,1,true]),false)
 })
 await db.exec(`update settings set value='{"boss":1}' where key='admins'`)
 const action=(actor,kind,payload={})=>rpc('academy_action',[actor,kind,JSON.stringify(payload)])
 const save=(code,kind,parent_code,data={})=>action(1,'admin_save',{expected_version:0,entity:{code,kind,parent_code,title:code,position:['CAP2','LCAP'].includes(code)?1:0,state:'draft',data}})
 const change=async(code,patch)=>{const n=(await db.query('select * from aa_nodes where code=$1',[code])).rows[0];return action(1,'admin_save',{expected_version:n.version,entity:{...n,...patch}})}
 const publish=async code=>{await change(code,{state:'approved'});await change(code,{state:'published'})}
 await save('C','course',null,{description:'Visible',internal_notes:'HIDDEN_MARKER'});await save('M','module','C')
 await save('L','lesson','M',{format:'microlecture',content_blocks:[{type:'markdown',body:'Actual lesson'}]})
 await save('Q','assessment','L',{kind:'quiz',max_attempts:1,questions:[{id:'q',prompt:'Pick',choices:['a','b'],answer:1}]})
 await save('R','rubric',null,{criteria:[{code:'quality',max_score:100}]});await publish('R')
 await save('CAP','assessment','C',{kind:'capstone',rubric_code:'R'});await publish('CAP')
 for(const code of ['Q','L','M','C'])await publish(code)
 await action(2,'enroll',{code:'C'})
 await t.test('public search excludes hidden metadata',async()=>{
  assert.equal((await action(2,'catalog',{q:'HIDDEN_MARKER'})).total,0)
  assert.equal((await action(2,'catalog',{q:'Visible'})).total,1)
  assert.equal((await action(1,'admin_list',{q:'HIDDEN_MARKER'})).total,1)
 })
 await t.test('passed quiz receipt survives reload; new version gets new attempts',async()=>{
  const first=await action(2,'quiz_start',{code:'Q'})
  await action(2,'quiz_submit',{attempt_id:first.id,answers:[1]})
  assert.deepEqual((await action(2,'lesson',{code:'L'})).quiz_result,{passed:true,score:100})
  await assert.rejects(action(2,'quiz_start',{code:'Q'}),/attempt_limit/)
  const n=(await db.query("select * from aa_nodes where code='Q'")).rows[0]
  await change('Q',{data:{...n.data,description:'New revision'}})
  assert.equal((await action(2,'lesson',{code:'L'})).quiz_result,null)
  const next=await action(2,'quiz_start',{code:'Q'});assert.notEqual(first.id,next.id)
  await action(2,'quiz_submit',{attempt_id:next.id,answers:[1]});await action(2,'complete',{code:'L'})
 })
 await t.test('updated assignment creates fresh draft and preserves old artifact',async()=>{
  const old=await action(2,'submission_save',{code:'CAP',artifact:{text:'Old work'}})
  const n=(await db.query("select * from aa_nodes where code='CAP'")).rows[0]
  await change('CAP',{data:{...n.data,instructions:'New instructions'}})
  const next=await action(2,'submission_save',{code:'CAP',artifact:{text:'New work'}})
  assert.notEqual(old.id,next.id);assert.equal(next.assessment_version,old.assessment_version+1)
  assert.equal((await db.query('select artifact from aa_submissions where id=$1',[old.id])).rows[0].artifact.text,'Old work')
  await action(2,'submission_submit',{submission_id:next.id})
  await action(1,'review',{submission_id:next.id,decision:'passed',scores:{quality:100},gates:{},feedback:'Checked'})
 })
 await t.test('certificate requires every published current capstone',async()=>{
  await save('CAP2','assessment','C',{kind:'capstone',rubric_code:'R'});await publish('CAP2')
  await assert.rejects(action(2,'certificate',{code:'C'}),/completion_required/)
  const work=await action(2,'submission_save',{code:'CAP2',artifact:{text:'Second defense'}})
  await action(2,'submission_submit',{submission_id:work.id})
  await action(1,'review',{submission_id:work.id,decision:'passed',scores:{quality:100},gates:{},feedback:'Checked'})
  const cap=(await db.query("select * from aa_nodes where code='CAP'")).rows[0]
  await change('CAP',{data:{...cap.data,instructions:'Third revision'}})
  await assert.rejects(action(2,'certificate',{code:'C'}),/completion_required/)
  const current=await action(2,'submission_save',{code:'CAP',artifact:{text:'Current defense'}})
  await action(2,'submission_submit',{submission_id:current.id})
  await action(1,'review',{submission_id:current.id,decision:'passed',scores:{quality:100},gates:{},feedback:'Checked'})
  assert.match((await action(2,'certificate',{code:'C'})).code,/^AA-/)
 })

 await t.test('a stale lesson-level defense blocks first certificate even at 100% progress',async()=>{
  await save('LCAP','assessment','L',{kind:'capstone',rubric_code:'R'})
  // Assessments share a parent's position namespace.
  await publish('LCAP')
  await action(3,'enroll',{code:'C'})
  const q=await action(3,'quiz_start',{code:'Q'});await action(3,'quiz_submit',{attempt_id:q.id,answers:[1]})
  for(const code of ['CAP','CAP2','LCAP']){
   const work=await action(3,'submission_save',{code,artifact:{text:'Defense artifact'}})
   await action(3,'submission_submit',{submission_id:work.id})
   await action(1,'review',{submission_id:work.id,decision:'passed',scores:{quality:100},gates:{},feedback:'Checked'})
  }
  await action(3,'complete',{code:'L'})
  const n=(await db.query("select * from aa_nodes where code='LCAP'")).rows[0]
  await change('LCAP',{data:{...n.data,instructions:'Updated defense requirement'}})
  assert.equal((await action(3,'course',{code:'C'})).progress.percent,100)
  await assert.rejects(action(3,'complete',{code:'L'}),/assessment_required/)
  await assert.rejects(action(3,'certificate',{code:'C'}),/completion_required/)
 })
 await t.test('new mutation RPCs remain inaccessible to anonymous clients',async()=>{
  await db.exec('set role anon')
  for(const [name,args] of [['resolve_admin',[1,'boss']],['cashier_auth',[1,'good']],['decide_course_request',[2,1,true]],['apply_ticket_payment',[2,1,'forged']],['advent_reward_decision',[2,1,1,true]]])await assert.rejects(rpc(name,args),/permission denied/)
  await db.exec('reset role')
 })

})
