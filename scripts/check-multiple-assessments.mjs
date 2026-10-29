import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';import {readFile,writeFile} from 'node:fs/promises';
const db=new PGlite();try{
await db.exec(`create schema extensions;create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat(md5(random()::text),ceil(n/16.0)::int),'hex')$$;create role anon;create role authenticated;create role service_role bypassrls;`)
for(const f of ['001_init.sql','006_courses_stars_freezes.sql','007_refunds_webhook_url.sql','009_advent.sql','010_advent_catchup_rewards.sql','011_advent_prize_modes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql','20261018170000_ai_academy_files.sql','20261028090000_core_atomic_operations.sql','20261028091000_academy_version_policy.sql','20261029090000_academy_multiple_checks.sql'])await db.exec((await readFile('supabase/migrations/'+f,'utf8')).replace('create extension if not exists pgcrypto with schema extensions;',''));
await db.exec(`insert into users(id) values(1),(2);insert into settings(key,value) values('admins','{"owner":1}');`)
const rpc=async(user,action,payload={})=>(await db.query('select academy_action($1,$2,$3::jsonb) value',[user,action,JSON.stringify(payload)])).rows[0].value;
const save=(code,kind,parent_code,data={},position=0)=>rpc(1,'admin_save',{expected_version:0,entity:{code,kind,parent_code,title:code,position,state:'draft',data}});
const change=async(code,patch)=>{const n=(await db.query('select * from aa_nodes where code=$1',[code])).rows[0];return rpc(1,'admin_save',{expected_version:n.version,entity:{...n,...patch}})};
const publish=async code=>{await change(code,{state:'approved'});await change(code,{state:'published'})};
await save('C','course',null);await save('M','module','C');await save('L','lesson','M',{format:'microlecture',content_blocks:[{type:'markdown',text:'Actual lesson teaching'}]});
for(const [code,position]of [['Q1',0],['Q2',1]])await save(code,'assessment','L',{kind:'quiz',questions:[{id:'q',prompt:'Pick',choices:['a','b'],answer:1}]},position);
for(const code of ['Q1','Q2','L','M','C'])await publish(code);await rpc(2,'enroll',{code:'C'});
const initial=await rpc(2,'lesson',{code:'L'});const attempt=await rpc(2,'quiz_start',{code:initial.assessment.code});await rpc(2,'quiz_submit',{attempt_id:attempt.id,answers:[1]});
let completionError;try{await rpc(2,'complete',{code:'L'})}catch(error){completionError=error.message}
const reopened=await rpc(2,'lesson',{code:'L'});
assert.deepEqual(reopened.assessments.map(a=>a.code),['Q1','Q2']);
assert.equal(reopened.assessments[0].quiz_result.passed,true);
assert.equal(reopened.assessments[1].quiz_result,null);
assert.match(completionError,/academy_assessment_required/);
assert.ok(!JSON.stringify(reopened.assessments).includes('answer'));
const second=await rpc(2,'quiz_start',{code:'Q2'});await rpc(2,'quiz_submit',{attempt_id:second.id,answers:[1]});
await rpc(2,'complete',{code:'L'});
assert.ok((await rpc(2,'lesson',{code:'L'})).progress.completed_at);
console.log('Multiple assessments: both exposed safely; completion blocked until both passed; completion persisted.');
}finally{await db.close()}
