import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {composeLearningCatalog,contentSql,loadAuthoredPacks} from '../scripts/academy-content.mjs'
import {createAcademyEngine} from '../src/lib/academy-domain.ts'
import {academyReleasePlan} from '../scripts/academy-release.mjs'
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'))
const base=await read('../content/ai-academy/catalog.normalized.json')
const packs=await loadAuthoredPacks()
const expectedLessons=packs.length*16
const catalog=composeLearningCatalog(base,packs)
test('authored courses contain substantive lessons, source links and distinct practical work',()=>{
 assert.equal(catalog.entities.filter(n=>n.kind==='lesson'&&n.state==='published').length,expectedLessons)
 assert.equal(catalog.entities.filter(n=>n.kind==='lesson'&&n.state==='outline').length,448-expectedLessons)
 assert.equal(base.entities.filter(n=>n.kind==='lesson'&&n.state==='published').length,0)
 const practice=catalog.entities.find(n=>n.code==='CORE-000-M1-L1-CHECK'),final=catalog.entities.find(n=>n.code==='CORE-000-M4-L4-CHECK')
 assert.notEqual(practice.data.rubric_code,final.data.rubric_code)
 const bodies=catalog.entities.filter(n=>n.kind==='lesson'&&n.state==='published').map(n=>n.data.content_blocks.map(b=>b.text||b.body||'').join('\n'))
 assert.equal(new Set(bodies).size,expectedLessons)
 for(const lesson of catalog.entities.filter(n=>n.kind==='lesson'&&n.state==='published')){
  assert.ok(catalog.links.some(l=>l.target_code===lesson.code&&l.source_code.startsWith('AUTH-SRC-')),`missing source ${lesson.code}`)
  assert.ok(lesson.data.artifact.length>15)
 }
 const invalid=structuredClone(packs);invalid[0].lessons[0].data.content_blocks=[{type:'markdown',text:'Короткая заглушка'}]
 assert.throws(()=>composeLearningCatalog(base,invalid),/insufficient/)
 assert.throws(()=>contentSql(catalog,'1;drop table users'),/actor/)
})
test('demo content upgrade preserves manual edits, enrollments and progress',async()=>{
 let state={...structuredClone(base),enrollments:[{user_id:2,course_code:'CORE-000',state:'waiting'}],progress:[{user_id:2,lesson_code:'OTHER',state:'completed'}],submissions:[],attempts:[],placements:[],certificates:[],audit:[]}
 const manual=state.entities.find(n=>n.code==='VC-101-M1-L1');manual.seed_managed=false;manual.title='Моя ручная редактура';manual.version=7
 const api=createAcademyEngine(catalog,{load:()=>state,save:s=>{state=structuredClone(s)}})
 const core=await api({id:2,is_admin:false},'course',{code:'CORE-000'})
 assert.equal(core.course.state,'published');assert.equal(core.lessons.length,16)
 assert.equal((await api({id:2,is_admin:false},'course',{code:'VC-101'})).eligible,false)
 assert.equal(state.entities.find(n=>n.code===manual.code).title,'Моя ручная редактура')
 assert.equal(state.progress.length,1);assert.equal(state.enrollments.length,1)
 await api({id:2,is_admin:false},'enroll',{code:'CORE-000'})
 const first=await api({id:2,is_admin:false},'lesson',{code:'CORE-000-M1-L1'})
 assert.ok(first.blocks.length);assert.ok(first.sources.length)
 assert.equal(JSON.stringify(first).includes('"answer":'),false)
 const quiz=state.entities.find(n=>n.kind==='assessment'&&n.code.startsWith('CORE-000')&&n.data.kind==='quiz')
 state.attempts.push({id:'previous-pass',user_id:2,assessment_code:quiz.code,version:quiz.version,state:'passed'})
 const revised=structuredClone(catalog);revised.content_revision='ffff0123456789ab';revised.entities.find(n=>n.code===quiz.code).data.questions[0].prompt+=' Обновлённый вопрос.'
 const upgraded=createAcademyEngine(revised,{load:()=>state,save:s=>{state=structuredClone(s)}})
 await upgraded({id:2,is_admin:false},'course',{code:'CORE-000'})
 assert.equal(state.entities.find(n=>n.code===quiz.code).version,quiz.version+1)
 assert.equal(state.attempts[0].version,quiz.version)
 await assert.rejects(upgraded({id:2,is_admin:false},'complete',{code:quiz.parent_code}),/assessment_required/)
 const editable=structuredClone(state.entities.find(n=>n.code===quiz.parent_code))
 const saved=await upgraded({id:1,is_admin:true},'admin_save',{entity:{...editable,title:'Проверка с новым названием'},expected_version:editable.version})
 assert.equal(saved.title,'Проверка с новым названием')
})
test('real PostgreSQL publishes pack through validators, reruns once and rejects edited conflicts',async t=>{
 const db=new PGlite();t.after(()=>db.close())
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql','20261018170000_ai_academy_files.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'))
 await db.exec(`insert into users(id) values(1),(2);insert into settings(key,value) values('admins','{"owner":1}')`)
 const rpc=async(action,payload={},actor=1)=>(await db.query('select academy_action($1,$2,$3::jsonb) v',[actor,action,JSON.stringify(payload)])).rows[0].v
 const plan=academyReleasePlan(base,packs,'1')
 for(const step of plan)await db.exec(step.sql)
 assert.equal((await db.query("select count(*)::int n from aa_nodes where kind='lesson' and state='published'")).rows[0].n,expectedLessons)
 const versions=JSON.stringify((await db.query('select code,version from aa_nodes order by code')).rows)
 for(const step of plan)await db.exec(step.sql)
 assert.equal(JSON.stringify((await db.query('select code,version from aa_nodes order by code')).rows),versions)
 await rpc('enroll',{code:'CORE-000'},2)
 const lesson=await rpc('lesson',{code:'CORE-000-M1-L1'},2)
 assert.ok(lesson.blocks.length&&lesson.sources.length)
 await assert.rejects(rpc('enroll',{code:'VC-101'},2),/academy_prerequisites_required/)
 const changed={...catalog,content_revision:'0123456789abcdef'}
 await assert.rejects(db.exec(contentSql(changed,'1')),/conflicts with edited/)
 await db.exec('rollback')
})
