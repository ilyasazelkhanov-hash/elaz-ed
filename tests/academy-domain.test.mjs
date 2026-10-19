import test from 'node:test'
import assert from 'node:assert/strict'
import { createAcademyEngine } from '../src/lib/academy-domain.ts'
import { safeAcademyUrl } from '../src/lib/academy-types.ts'

const node = (code,kind,parent_code,data={},state='outline') => ({code,kind,parent_code,title:code,position:1,state,version:1,seed_managed:true,data})
const seed = {entities:[node('VC','direction',null),node('CORE-000','course',null,{level:'Core'}),node('VC-101','course','VC',{level:'Junior'}),node('M1','module','CORE-000'),node('L1','lesson','M1',{format:'microlecture',content_blocks:[]}),node('S1','source',null,{url:'https://example.com/a',rights:'reference_only'})],links:[{source_code:'S1',target_code:'L1',visibility:'internal',usage:'methodological'}],prerequisites:[{course_code:'VC-101',requires_code:'CORE-000'}]}
const admin={id:1,is_admin:true},student={id:2,is_admin:false},other={id:3,is_admin:false}
function setup(){let state;return createAcademyEngine(seed,{load:()=>state,save:value=>{state=structuredClone(value)}})}

test('outlines allow waiting list but never lesson content or completion',async()=>{
 const api=setup()
 assert.equal((await api(student,'catalog',{})).courses.length,2)
 assert.equal((await api(student,'enroll',{code:'CORE-000'})).state,'waiting')
 await assert.rejects(api(student,'lesson',{code:'L1'}),/not_published/)
 await assert.rejects(api(student,'complete',{code:'L1'}),/not_published/)
 assert.equal((await api(student,'library',{})).total,0)
})
test('server-style permissions, publication checks and optimistic versions',async()=>{
 const api=setup(),lesson=structuredClone(seed.entities.find(n=>n.code==='L1'))
 await assert.rejects(api(student,'admin_save',{entity:lesson,expected_version:1}),/forbidden/)
 lesson.state='published'
 await assert.rejects(api(admin,'admin_save',{entity:lesson,expected_version:1}),/content_required/)
 lesson.data.content_blocks=[{type:'markdown',text:'Проверенный авторский текст для теста.'}]
 const saved=await api(admin,'admin_save',{entity:lesson,expected_version:1})
 assert.equal(saved.version,2)
 await assert.rejects(api(admin,'admin_save',{entity:lesson,expected_version:1}),/version_conflict/)
})
test('published progress requires active enrollment and prerequisites',async()=>{
 const api=setup()
 for(const code of ['CORE-000','M1','L1','VC-101']){
   const entity=structuredClone(seed.entities.find(n=>n.code===code));entity.state='published'
   if(code==='L1')entity.data.content_blocks=[{type:'markdown',text:'Собственный материал.'}]
   await api(admin,'admin_save',{entity,expected_version:1})
 }
 await assert.rejects(api(student,'enroll',{code:'VC-101'}),/prerequisite/)
 await assert.rejects(api(student,'complete',{code:'L1'}),/enrollment_required/)
 await api(student,'enroll',{code:'CORE-000'})
 await api(student,'complete',{code:'L1'})
 const again=await api(student,'complete',{code:'L1'})
 assert.equal(again.state,'completed')
 assert.equal((await api(student,'my',{})).progress.length,1)
 assert.equal((await api(student,'enroll',{code:'VC-101'})).state,'active')
 assert.equal((await api(other,'my',{})).progress.length,0)
})
test('URLs reject scripts/credentials and preserve video timestamp',()=>{
 assert.equal(safeAcademyUrl('javascript:alert(1)'),null)
 assert.equal(safeAcademyUrl('https://user:pass@example.com'),null)
 assert.equal(safeAcademyUrl('https://example.com/?token=secret'),null)
 assert.match(safeAcademyUrl('https://youtu.be/example',178),/t=178s/)
 assert.equal(safeAcademyUrl('https://example.com/documentation',178),'https://example.com/documentation')
})
test('course metadata and library do not leak draft bodies or internal references',async()=>{
 const custom=structuredClone(seed)
 custom.entities.find(n=>n.code==='L1').data.contentBlocks=[{type:'markdown',text:'PRIVATE_BODY'}]
 Object.assign(custom.entities.find(n=>n.code==='S1').data,{rights_state:'approved',link_state:'verified',editor_note:'PRIVATE_NOTE',original_records:[{private:'PRIVATE_SOURCE'}]})
 let state;const api=createAcademyEngine(custom,{load:()=>state,save:s=>state=structuredClone(s)})
 assert.ok(!JSON.stringify(await api(student,'course',{code:'CORE-000'})).includes('PRIVATE_BODY'))
 assert.equal((await api(student,'library',{})).total,0)
})
test('canonical assessment and versioned submission flow persists across calls',async()=>{
 const custom=structuredClone(seed)
 custom.prerequisites=[]
 for(const n of custom.entities.filter(n=>['CORE-000','M1','L1'].includes(n.code)))n.state='published'
 custom.entities.find(n=>n.code==='L1').data.content_blocks=[{type:'markdown',text:'Авторский материал'}]
 custom.entities.push(node('Q1','assessment','L1',{kind:'quiz',questions:[{id:'q',prompt:'Выбор?',choices:['A','B'],answer:1}]},'published'))
 custom.entities.push(node('R1','rubric',null,{criteria:[{code:'quality',max_score:100}],critical_gates:['no_secrets']},'published'))
 custom.entities.push(node('CAP','assessment','CORE-000',{kind:'capstone',rubric_code:'R1'},'published'))
 let state;const api=createAcademyEngine(custom,{load:()=>state,save:s=>state=structuredClone(s)})
 await api(student,'enroll',{code:'CORE-000'})
 const attempt=await api(student,'quiz_start',{code:'Q1'})
 assert.equal(attempt.questions[0].answer,undefined)
 await assert.rejects(api(other,'quiz_submit',{attempt_id:attempt.id,answers:[1]}),/not_found/)
 assert.equal((await api(student,'quiz_submit',{attempt_id:attempt.id,answers:[1]})).passed,true)
 await api(student,'complete',{code:'L1'})
 const first=await api(student,'submission_save',{code:'CAP',artifact:{text:'Первая работа'}})
 await api(student,'submission_submit',{submission_id:first.id})
 await api(admin,'review',{submission_id:first.id,decision:'needs_revision',scores:{quality:50},feedback:'Уточнить результат'})
 const second=await api(student,'submission_save',{code:'CAP',artifact:{text:'Исправленная работа'}})
 assert.equal(second.version,2)
 await api(student,'submission_submit',{submission_id:second.id})
 await assert.rejects(api(admin,'review',{submission_id:second.id,decision:'passed',scores:{quality:90},feedback:'Зачёт'}),/critical_gate/)
 await api(admin,'review',{submission_id:second.id,decision:'passed',scores:{quality:90},gates:{no_secrets:true},feedback:'Зачёт'})
 const certificate=await api(student,'certificate',{code:'CORE-000'})
 assert.ok(certificate.code)
 const mine=await api(student,'my',{})
 assert.equal(mine.submissions.length,2)
 assert.equal(mine.submissions[0].reviews[0].feedback,'Уточнить результат')
 assert.equal((await api(other,'my',{})).submissions.length,0)
})
test('staff permissions are assigned only by administrator',async()=>{
 const api=setup()
 await assert.rejects(api(student,'admin_roles',{user_id:2,role:'editor',enabled:true}),/forbidden/)
 await api(admin,'admin_roles',{user_id:2,role:'editor',enabled:true})
 assert.equal((await api(student,'permissions',{})).editor,true)
 assert.ok((await api(student,'admin_list',{})).entities.length)
 await assert.rejects(api(student,'admin_roles',{user_id:3,role:'instructor',enabled:true}),/forbidden/)
 await api(admin,'admin_roles',{user_id:2,role:'editor',enabled:false})
 assert.equal((await api(student,'permissions',{})).editor,false)
})
