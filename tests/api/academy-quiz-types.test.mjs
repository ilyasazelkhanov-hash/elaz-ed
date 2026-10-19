import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
test('Academy mixed question types are validated and graded from immutable snapshots',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const file of ['001_init.sql','20261018080000_ai_academy.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
 await db.exec(`insert into users(id) values(1),(2),(3);insert into settings(key,value) values('admins','{"owner":1}');`)
 const rpc=async(user,action,payload={})=>(await db.query('select academy_action($1,$2,$3::jsonb) v',[user,action,JSON.stringify(payload)])).rows[0].v
 const entity=(code,kind,parent_code,data={})=>({code,kind,parent_code,title:code,position:1,state:'draft',data})
 const questions=[{id:'single',type:'mcq',prompt:'Один ответ',choices:['A','B'],answer:1},{id:'multi',type:'multi',prompt:'Несколько ответов',choices:['A','B','C'],answer:[0,2]},{id:'text',type:'text',prompt:'Контроль версий',answer:'Git',accepted_answers:['Git SCM'],case_sensitive:false},{id:'code',type:'code',prompt:'SQL-константа',answer:'SELECT 1;',case_sensitive:true}]
 await t.test('missing answer keys and structured choices are invalid',async()=>{
  for(const question of [{prompt:'Missing',choices:['A','B']},{type:'text',prompt:'Missing'},{prompt:'Leak',choices:[{answer:'PRIVATE'},'B'],answer:1}]){
   assert.equal((await db.query('select aa_quiz_question_valid($1::jsonb) v',[JSON.stringify(question)])).rows[0].v,false)
   await assert.rejects(rpc(1,'admin_save',{entity:entity('INVALID','assessment',null,{kind:'quiz',questions:[question]}),expected_version:0}))
  }
 })
 for(const e of [entity('D','direction',null),entity('C','course','D'),entity('M','module','C'),entity('L','lesson','M',{format:'knowledge_check',content_blocks:[{type:'markdown',text:'Авторская проверка'}]}),entity('Q','assessment','L',{kind:'quiz',questions,max_attempts:4,passing_score:70})])await rpc(1,'admin_save',{entity:e,expected_version:0})
 const save=async(code,changes)=>{const e=(await db.query('select * from aa_nodes where code=$1',[code])).rows[0];return rpc(1,'admin_save',{entity:{...e,...changes},expected_version:e.version})}
 for(const code of ['Q','L','M','C']){await save(code,{state:'approved'});await save(code,{state:'published'})}
 await rpc(2,'enroll',{code:'C'})
 const first=await rpc(2,'quiz_start',{code:'Q'})
 assert.deepEqual(first.questions.map(q=>q.type),['mcq','multi','text','code'])
 for(const q of first.questions){assert.equal(q.answer,undefined);assert.equal(q.accepted_answers,undefined)}
 await t.test('duplicates and malformed types are rejected without committing',async()=>{
  await assert.rejects(rpc(2,'quiz_submit',{attempt_id:first.id,answers:[1,[0,0],'Git','SELECT 1;']}),/academy_answers_invalid/)
  await assert.rejects(rpc(2,'quiz_submit',{attempt_id:first.id,answers:[1,[0,9],'Git','SELECT 1;']}),/academy_answers_invalid/)
  await assert.rejects(rpc(2,'quiz_submit',{attempt_id:first.id,answers:[1,[0,2],{text:'Git'},'SELECT 1;']}),/academy_answers_invalid/)
  assert.equal((await db.query('select submitted_at from aa_attempts where id=$1',[first.id])).rows[0].submitted_at,null)
 })
 await t.test('unordered multi and normalized text pass; replay cannot regrade',async()=>{
  const r=await rpc(2,'quiz_submit',{attempt_id:first.id,answers:[1,[2,0],'  git scm  ','SELECT 1;'],score:0})
  assert.equal(r.score,100);assert.equal(r.passed,true)
  assert.equal((await rpc(2,'quiz_submit',{attempt_id:first.id,answers:[0,[],'wrong','wrong']})).score,100)
 })
 await t.test('wrong code is graded as text without execution and snapshot survives edits',async()=>{
  const attempt=await rpc(2,'quiz_start',{code:'Q'})
  const q=(await db.query("select data from aa_nodes where code='Q'")).rows[0].data
  q.questions[0].answer=0;await save('Q',{data:q})
  const result=await rpc(2,'quiz_submit',{attempt_id:attempt.id,answers:[1,[0,2],'git','rm -rf /']})
  assert.equal(result.score,75);assert.equal(result.passed,true)
 })
})
