import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {completedAcademyLessonCodes} from '../../src/lib/academy-sequence.ts'
import {PGlite} from '@electric-sql/pglite'

test('Academy completion: purchases, competencies, immutable shared blocks and private analytics',async t=>{
 const db=new PGlite(); t.after(()=>db.close())
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
 await db.exec(`insert into users(id) values(1),(2),(3); insert into settings(key,value) values('admins','{"owner":1}'); grant select on users,settings to service_role; insert into courses(title,price_stars,published) values('Stars product',50,true),('Free product',0,true);`)
 const rpc=async(user,action,payload={})=>(await db.query('select academy_action($1,$2,$3::jsonb) value',[user,action,JSON.stringify(payload)])).rows[0].value
 const save=async(code,kind,parent_code,data={},position=0)=>rpc(1,'admin_save',{expected_version:0,entity:{code,kind,parent_code,title:code,state:'draft',position,data}})
 const change=async(code,changes)=>{const n=(await db.query('select * from aa_nodes where code=$1',[code])).rows[0]; return rpc(1,'admin_save',{entity:{...n,...changes},expected_version:n.version})}
 const publish=async(code)=>{await change(code,{state:'approved'}); await change(code,{state:'published'})}
 await save('C','course',null,{legacy_course_id:1}); await save('M','module','C'); await save('S','skill'); await publish('S')
 await save('L','lesson','M',{format:'microlecture',content_blocks:[{type:'markdown',body:'Author content'}]})
 await save('OPT','lesson','M',{format:'microlecture',required:false,content_blocks:[{type:'markdown',body:'Optional content'}]},1)
 await save('Q','assessment','L',{kind:'quiz',questions:[{id:'q',prompt:'PRIVATE PROMPT',choices:['a','b'],answer:1}]})
 await save('R','rubric',null,{criteria:[{code:'quality',max_score:100}]}); await publish('R')
 await save('A','assessment','L',{kind:'assignment',rubric_code:'R'},1); await publish('A')
 await publish('Q'); await publish('L'); await publish('OPT'); await publish('M'); await publish('C')
 await t.test('unentitled course metadata cannot expose translated lectures or grading keys',async()=>{
  const n=(await db.query("select data from aa_nodes where code='L'")).rows[0]
  const translations={en:{title:'English title',description:'Public outline',content_blocks:[{type:'markdown',body:'TRANSLATED_PRIVATE_BODY'}],body:'TRANSLATED_PRIVATE_BODY',answer:'PRIVATE_TRANSLATED_KEY',data:{description:'Nested public outline',content_blocks:[{type:'markdown',body:'TRANSLATED_PRIVATE_BODY'}],body:'TRANSLATED_PRIVATE_BODY',accepted_answers:['PRIVATE_TRANSLATED_KEY'],tags:[{body:'TRANSLATED_PRIVATE_BODY'}]}}}
  await change('L',{data:{...n.data,translations}})
  const course=await rpc(3,'course',{code:'C'})
  assert.equal(JSON.stringify(course).includes('TRANSLATED_PRIVATE_BODY'),false)
  assert.equal(JSON.stringify(course).includes('PRIVATE_TRANSLATED_KEY'),false)
  const locale=course.lessons.find(l=>l.code==='L').data.translations.en
  assert.equal(locale.title,'English title'); assert.equal(locale.data.description,'Nested public outline')
  const full=(await db.query("select aa_safe(n,true) value from aa_nodes n where n.code='L'")).rows[0].value
  assert.equal(full.data.translations.en.content_blocks[0].body,'TRANSLATED_PRIVATE_BODY')
  assert.equal(JSON.stringify(full).includes('PRIVATE_TRANSLATED_KEY'),false)
  const admin=await rpc(1,'admin_list',{kind:'lesson'})
  assert.equal(JSON.stringify(admin).includes('TRANSLATED_PRIVATE_BODY'),true)
 })
 await t.test('mapping is N:M, author managed, required-only, and zero does not verify',async()=>{
  assert.deepEqual((await rpc(2,'skills')).links,[])
  assert.equal((await rpc(2,'skill_progress')).skills[0].verified,false)
  await assert.rejects(rpc(2,'skill_map',{target_code:'C',skill_codes:['S']}),/academy_forbidden/)
  await assert.rejects(rpc(1,'skill_map',{target_code:'C',skill_codes:['Q']}),/academy_skill_link_invalid/)
  await rpc(1,'skill_map',{target_code:'C',skill_codes:['S']}); await rpc(1,'skill_map',{target_code:'L',skill_codes:['S']})
  assert.equal((await rpc(2,'skill_progress')).skills[0].required,1)
  assert.equal((await rpc(2,'skills')).links.length,2)
 })
 await t.test('server purchase grants control enroll/read/start/submit and refund revokes existing session',async()=>{
  const course=await rpc(2,'course',{code:'C'}); assert.equal(course.offer.legacy_course_id,1); assert.equal(course.offer.has_access,false)
  await assert.rejects(rpc(2,'enroll',{code:'C',paid:true}),/academy_purchase_required/)
  await db.exec(`insert into course_access(user_id,course_id,source) values(2,1,'stars')`)
  await rpc(2,'enroll',{code:'C'}); const attempt=await rpc(2,'quiz_start',{code:'Q'})
  const draft=await rpc(2,'submission_save',{code:'A',artifact:{text:'PRIVATE ARTIFACT'}})
  await db.exec('delete from course_access where user_id=2')
  for(const action of ['lesson','quiz_start','complete']) await assert.rejects(rpc(2,action,{code:action==='quiz_start'?'Q':'L'}),/academy_purchase_required/)
  await assert.rejects(rpc(2,'quiz_submit',{attempt_id:attempt.id,answers:[1]}),/academy_purchase_required/)
  await assert.rejects(rpc(2,'submission_save',{code:'A',artifact:{text:'changed'}}),/academy_purchase_required/)
  await assert.rejects(rpc(2,'submission_submit',{submission_id:draft.id}),/academy_purchase_required/)
  await db.exec(`insert into course_access(user_id,course_id,source) values(2,1,'admin')`)
  assert.equal((await rpc(2,'quiz_submit',{attempt_id:attempt.id,answers:[1]})).passed,true)
  assert.equal((await rpc(2,'quiz_submit',{attempt_id:attempt.id,answers:[0]})).passed,true)
  await rpc(2,'submission_submit',{submission_id:draft.id})
  await rpc(1,'review',{submission_id:draft.id,decision:'passed',scores:{quality:100},gates:{},feedback:'Checked'})
  await rpc(2,'complete',{code:'L'}); await rpc(2,'complete',{code:'L'})
  assert.ok(completedAcademyLessonCodes((await rpc(2,'my')).progress).has('L'),'raw PostgreSQL completion must be recognized by the UI')
  assert.equal((await rpc(2,'skill_progress')).skills[0].verified,true)
  assert.equal((await db.query("select count(*)::int n from aa_events where event='lesson_completed'")).rows[0].n,1)
 })
 await t.test('unmapped/free courses remain free; invalid product mappings fail',async()=>{
  await assert.rejects(change('C',{data:{legacy_course_id:999}}),/academy_offer_invalid/)
  await change('C',{data:{legacy_course_id:2}}); assert.equal((await rpc(3,'enroll',{code:'C'})).state,'active')
  assert.equal((await rpc(3,'course',{code:'C'})).offer.has_access,true)
  await change('C',{data:{}}); assert.equal((await rpc(3,'course',{code:'C'})).offer,null)
 })
 await t.test('block revisions use optimistic locking, approval, fixed published pins and immutable history',async()=>{
  const payload={type:'markdown',body:'Pinned original',internal_notes:'HIDDEN'}
  await assert.rejects(rpc(2,'block_list'),/academy_forbidden/)
  await assert.rejects(rpc(1,'block_save',{code:'B',expected_version:0,state:'published',payload}),/academy_approval_required/)
  const first=await rpc(1,'block_save',{code:'B',expected_version:0,state:'approved',payload}); assert.equal(first.version,1)
  await assert.rejects(rpc(1,'block_save',{code:'B',expected_version:0,state:'approved',payload}),/academy_version_conflict/)
  await rpc(1,'block_save',{code:'B',expected_version:1,state:'published',payload})
  const n=(await db.query("select data from aa_nodes where code='L'")).rows[0]
  await change('L',{data:{...n.data,content_blocks:[{type:'reference',ref_code:'B',ref_version:2}],translations:{en:{title:'English lecture',data:{content_blocks:[{type:'markdown',body:'Authored English lesson',expected:'PRIVATE_TRANSLATION_KEY'},{type:'reference',ref_code:'B',ref_version:2}]}},KK:{title:'Kazakh lecture',body:'Қазақша авторлық сабақ'}}}})
  assert.equal((await rpc(2,'lesson',{code:'L'})).blocks[0].body,'Pinned original')
  const localized=await rpc(2,'lesson',{code:'L'})
  assert.equal(localized.localized_blocks.en[0].body,'Authored English lesson')
  assert.equal(localized.localized_blocks.en[1].body,'Pinned original')
  assert.equal(localized.localized_blocks.kk[0].body,'Қазақша авторлық сабақ')
  assert.equal(localized.lesson.data.translations.en.content_blocks[1].body,'Pinned original')
  assert.equal(JSON.stringify(localized).includes('PRIVATE_TRANSLATION_KEY'),false)
  assert.equal(JSON.stringify(await rpc(3,'course',{code:'C'})).includes('Authored English lesson'),false)
  await assert.rejects(change('L',{data:{...n.data,translations:{en:{content_blocks:[{type:'reference',ref_code:'B',ref_version:3}]}}}}),/academy_block_unpublished/)
  assert.equal(JSON.stringify(await rpc(2,'lesson',{code:'L'})).includes('HIDDEN'),false)
  await rpc(1,'block_save',{code:'B',expected_version:2,state:'approved',payload:{type:'markdown',body:'Later'}})
  await rpc(1,'block_save',{code:'B',expected_version:3,state:'published',payload:{type:'markdown',body:'Later'}})
  assert.equal((await rpc(2,'lesson',{code:'L'})).blocks[0].body,'Pinned original')
  await assert.rejects(change('L',{data:{format:'microlecture',content_blocks:[{type:'reference',ref_code:'B',ref_version:3}]}}),/academy_block_unpublished/)
  assert.equal((await db.query("select content_snapshot->0->>'body' body from aa_progress where user_id=2 and lesson_code='L'")).rows[0].body,'Author content')
  await assert.rejects(db.exec("update aa_block_versions set payload='{}' where code='B'"),/academy_immutable/)
  const results=await Promise.allSettled([rpc(1,'block_save',{code:'CONCURRENT',expected_version:0,state:'approved',payload}),rpc(1,'block_save',{code:'CONCURRENT',expected_version:0,state:'approved',payload})])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 })
 await t.test('only editors see aggregates; event table has no prompt/answers/artifact payload',async()=>{
  await assert.rejects(rpc(2,'analytics'),/academy_forbidden/)
  await rpc(2,'catalog',{code:'PRIVATE ARBITRARY PROMPT'}); const a=await rpc(1,'analytics')
  assert.equal(a.funnel.find(f=>f.event==='lesson_completed').count,1)
  assert.equal(a.time_to_first_result.learners,1)
  assert.equal(a.dropout[0].completed,1)
  assert.equal(JSON.stringify(a).includes('actor_id'),false)
  const events=(await db.query('select * from aa_events')).rows
  assert.equal(JSON.stringify(events).includes('PRIVATE PROMPT'),false)
  assert.equal(JSON.stringify(events).includes('PRIVATE ARTIFACT'),false)
  assert.equal(JSON.stringify(events).includes('PRIVATE ARBITRARY PROMPT'),false)
  assert.equal(JSON.stringify(events).includes('answers'),false)
  await assert.rejects(db.exec("insert into aa_events(actor_id,event,entity_code) values(2,'custom_prompt','L')"),/check constraint/)
 })
 await t.test('service role only for extension data and both dispatcher entrypoints',async()=>{
  await db.exec('set role service_role'); assert.ok((await rpc(2,'skills')).skills.length); await db.exec('reset role')
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`)
   for(const table of ['aa_skill_links','aa_block_versions','aa_events']) await assert.rejects(db.query(`select * from ${table}`),/permission denied/)
   await assert.rejects(rpc(1,'analytics'),/permission denied/)
   await assert.rejects(db.query("select aa_base_action(1,'my','{}')"),/permission denied/)
   await db.exec('reset role')
  }
 })
})
