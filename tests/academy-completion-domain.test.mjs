import test from 'node:test'
import assert from 'node:assert/strict'
import {createAcademyEngine} from '../src/lib/academy-domain.ts'
const admin={id:1,is_admin:true},student={id:2,is_admin:false},other={id:3,is_admin:false}
const node=(code,kind,parent_code=null,data={},position=0)=>({code,kind,parent_code,title:code,data,position,state:'published',version:1})
function fixture(){
 let state={entities:[node('C','course'),node('M','module','C'),node('L','lesson','M',{format:'microlecture',content_blocks:[{type:'markdown',body:'Approved author text'}]}),node('Q1','assessment','L',{kind:'quiz',questions:[{id:'q',prompt:'Question',choices:['A','B'],answer:1}]}),node('Q2','assessment','L',{kind:'quiz',questions:[{id:'q',prompt:'Question',choices:['A','B'],answer:1}]},1),node('R','rubric',null,{criteria:[{code:'quality',max_score:100}]}),node('A','assessment','L',{kind:'assignment',rubric_code:'R'},2),node('CAP','assessment','C',{kind:'capstone',rubric_code:'R'}),node('S','skill'),node('OPTIONAL','lesson','M',{format:'microlecture',required:false,content_blocks:[{type:'markdown',body:'Optional'}]},1),node('C2','course'),node('M2','module','C2'),node('L2','lesson','M2',{format:'microlecture',content_blocks:[{type:'markdown',body:'Other course'}]})],links:[],prerequisites:[],enrollments:[],progress:[],submissions:[],attempts:[],placements:[],certificates:[],audit:[],roles:[],events:[],blockVersions:[],skillLinks:[]}
 const api=createAcademyEngine(state,{load:()=>state,save:next=>{state=structuredClone(next)}})
 return {api,get state(){return state}}
}
test('demo completion requires every current assessment and reviews cannot auto-complete lessons',async()=>{
 const {api}=fixture();await api(student,'enroll',{code:'C'})
 const draft=await api(student,'submission_save',{code:'A',artifact:{text:'Reviewed artifact'}})
 await api(student,'submission_submit',{submission_id:draft.id});await api(admin,'review',{submission_id:draft.id,decision:'passed',scores:{quality:100},feedback:'Accepted'})
 assert.equal((await api(student,'my')).progress.length,0)
 await assert.rejects(api(student,'complete',{code:'L'}),/assessment_required/)
 for(const code of ['Q1','Q2']){const a=await api(student,'quiz_start',{code});await api(student,'quiz_submit',{attempt_id:a.id,answers:[1]})}
 const before=(await api(admin,'admin_list',{kind:'assessment'})).entities.find(n=>n.code==='Q2')
 await api(admin,'admin_save',{entity:{...before,title:'Revised question version'},expected_version:before.version})
 await assert.rejects(api(student,'complete',{code:'L'}),/assessment_required/)
 const fresh=await api(student,'quiz_start',{code:'Q2'});await api(student,'quiz_submit',{attempt_id:fresh.id,answers:[1]})
 await api(student,'complete',{code:'L'});await api(student,'complete',{code:'L'})
 const beforeLesson=(await api(admin,'admin_list',{kind:'lesson'})).entities.find(n=>n.code==='L')
 await api(admin,'admin_save',{entity:{...beforeLesson,data:{...beforeLesson.data,content_blocks:[{type:'markdown',body:'New revision'}]}},expected_version:beforeLesson.version})
 await api(student,'complete',{code:'L'})
 const progress=(await api(student,'my')).progress;assert.equal(progress.length,1)
 assert.equal(progress[0].version,1);assert.equal(progress[0].content_snapshot[0].body,'Approved author text')
})
test('demo course-level capstones recheck prerequisites on read/save/submit after enrollment',async()=>{
 const f=fixture();const {api}=f;await api(student,'enroll',{code:'C'})
 const draft=await api(student,'submission_save',{code:'CAP',artifact:{text:'Draft'}})
 f.state.prerequisites.push({course_code:'C',requires_code:'C2'})
 for(const action of ['lesson','submission_save'])await assert.rejects(api(student,action,{code:'CAP',artifact:{text:'Attempt'}}),/prerequisite_required/)
 await assert.rejects(api(student,'submission_submit',{submission_id:draft.id}),/prerequisite_required/)
 f.state.certificates.push({code:'pre',user_id:2,course_code:'C2',issued_at:new Date().toISOString()})
 assert.equal((await api(student,'lesson',{code:'CAP'})).assessment.code,'CAP')
})
test('demo analytics uses real first-result durations and course-scoped read activity',async()=>{
 const f=fixture();const {api}=f;const days=Date.now()-9*86400000
 f.state.enrollments.push({user_id:2,course_code:'C',state:'active',enrolled_at:new Date(days).toISOString()},{user_id:3,course_code:'C2',state:'active',enrolled_at:new Date(days).toISOString()})
 const event=(user_id,event,entity_code,time)=>({user_id,event,entity_code,created_at:new Date(time).toISOString()})
 f.state.events.push(event(2,'enrolled','C',days),event(2,'lesson_open','L',days+1000),event(2,'quiz_passed','Q1',days+60000),event(2,'lesson_open','L2',Date.now()),event(3,'enrolled','C2',days),event(3,'lesson_completed','L2',days+180000))
 const analytics=await api(admin,'analytics')
 assert.deepEqual(analytics.time_to_first_result,{learners:2,median_seconds:120})
 const course=analytics.dropout.find(c=>c.course_code==='C');assert.equal(course.started,1);assert.equal(course.inactive,1)
 assert.equal(JSON.stringify(analytics).includes('user_id'),false)
 await assert.rejects(api(student,'analytics'),/forbidden/)
})
test('demo competency maps, immutable bank pins and privacy are exercised through real actions',async()=>{
 const f=fixture();const {api}=f;await api(student,'enroll',{code:'C'})
 await assert.rejects(api(student,'skill_map',{target_code:'C',skill_codes:['S']}),/forbidden/)
 await api(admin,'skill_map',{target_code:'C',skill_codes:['S']});await api(admin,'skill_map',{target_code:'L',skill_codes:['S']})
 assert.deepEqual((await api(student,'skill_progress')).skills[0],{code:'S',title:'S',required:1,completed:0,percent:0,verified:false})
 const payload={type:'markdown',body:'Pinned original',accepted_answers:['PRIVATE KEY']}
 await api(admin,'block_save',{code:'B',expected_version:0,state:'approved',payload});await api(admin,'block_save',{code:'B',expected_version:1,state:'published',payload})
 const lessonData=f.state.entities.find(n=>n.code==='L').data
 lessonData.content_blocks=[{type:'reference',ref_code:'B',ref_version:2}]
 lessonData.translations={en:{title:'English lesson',data:{content_blocks:[{type:'markdown',body:'Authored English lesson',accepted_answers:['PRIVATE KEY']},{type:'reference',ref_code:'B',ref_version:2}]}},KK:{body:'Қазақша сабақ'}}
 await api(admin,'block_save',{code:'B',expected_version:2,state:'approved',payload:{type:'markdown',body:'Later'}})
 await api(admin,'block_save',{code:'B',expected_version:3,state:'published',payload:{type:'markdown',body:'Later'}})
 const lesson=await api(student,'lesson',{code:'L'});assert.equal(lesson.blocks[0].body,'Pinned original');assert.equal(JSON.stringify(lesson).includes('PRIVATE KEY'),false)
 assert.equal(lesson.localized_blocks.en[0].body,'Authored English lesson');assert.equal(lesson.localized_blocks.en[1].body,'Pinned original');assert.equal(lesson.localized_blocks.kk[0].body,'Қазақша сабақ')
 assert.equal(lesson.lesson.data.translations.en.content_blocks[1].body,'Pinned original')
 assert.equal(JSON.stringify(await api(other,'course',{code:'C'})).includes('Authored English lesson'),false)
 const authored=(await api(admin,'admin_list',{kind:'lesson'})).entities.find(n=>n.code==='L')
 await assert.rejects(api(admin,'admin_save',{entity:{...authored,data:{...authored.data,translations:{en:{content_blocks:[{type:'reference',ref_code:'B',ref_version:3}]}}}},expected_version:authored.version}),/block_not_published/)
 await assert.rejects(api(admin,'block_save',{code:'B',expected_version:2,state:'draft',payload}),/version_conflict/)
 assert.equal((await api(admin,'block_list')).blocks.length,4)
})
test('demo refund rechecks attempts and portfolio consent never exposes signed URLs or private IDs',async()=>{
 const f=fixture();const {api}=f;f.state.entities.find(n=>n.code==='C').data.legacy_course_id=10
 const paid={...student,commerce:[{id:10,title:'Product',price_stars:50,access:true}]},refunded={...student,commerce:[{id:10,title:'Product',price_stars:50,access:false}]}
 await api(paid,'enroll',{code:'C'});const attempt=await api(paid,'quiz_start',{code:'Q1'})
 await assert.rejects(api(refunded,'quiz_submit',{attempt_id:attempt.id,answers:[1]}),/payment_required/)
 f.state.submissions.push({id:'s',user_id:2,assessment_code:'CAP',state:'passed',artifact:{text:'Public artifact',url:'https://example.test/work?X-Amz-Signature=SECRET',file_ids:['private-id']}})
 await assert.rejects(api(student,'portfolio_publish',{submission_id:'s'}),/consent_required/)
 const entry=await api(student,'portfolio_publish',{submission_id:'s',consent:true})
 const pub=await api(other,'portfolio_public',{slug:entry.slug});assert.equal(pub.artifact.url,null);assert.equal(JSON.stringify(pub).includes('private-id'),false)
 await api(student,'portfolio_revoke',{submission_id:'s'});await assert.rejects(api(other,'portfolio_public',{slug:entry.slug}),/not_found/)
})
test('demo instructor cannot approve placement or receive self-review; internal source usage stays private',async()=>{
 const f=fixture();const {api}=f
 f.state.roles.push({user_id:2,role:'instructor'},{user_id:3,role:'instructor'})
 f.state.placements.push({id:'placement',user_id:3,course_code:'C',state:'pending'})
 await assert.rejects(api(student,'placement',{placement_id:'placement',state:'passed',reason:'Bypass'}),/forbidden/)
 f.state.submissions.push({id:'own',user_id:2,assessment_code:'A',state:'submitted'})
 await assert.rejects(api(admin,'admin_assign',{submission_id:'own',assigned_to:2}),/self_review_forbidden/)
 f.state.entities.push(node('SOURCE','source',null,{url:'https://example.test/source',rights_state:'owned',link_state:'verified',checked_at:new Date().toISOString()}))
 f.state.links.push({source_code:'SOURCE',target_code:'C',usage:'internal',visibility:'public'})
 assert.equal((await api(student,'library')).sources.length,0)
 assert.equal((await api(student,'course',{code:'C'})).sources.length,0)
 f.state.links[0].usage='supplementary'
 assert.equal((await api(student,'course',{code:'C'})).sources.length,1)
})
