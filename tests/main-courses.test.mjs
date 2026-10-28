import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {academyDemoSample} from '../scripts/academy-demo-sample.mjs'
import {coursesEntry,learningPath,learningUrl} from '../src/lib/learning-entry.ts'
import {createAcademyEngine} from '../src/lib/academy-domain.ts'

test('main course links round-trip independently from Academy demo links',()=>{
 for(const route of ['','/courses/CORE-000','/lessons/CORE-000-M1-L1','/my-learning','/library','/directions/VC','/admin']){
  assert.equal(learningPath(learningUrl(route,false),false),route)
  assert.equal(learningPath(learningUrl(route,true),true),route)
 }
 assert.equal(coursesEntry('#/courses/CORE-000','/','academy'),'/courses/CORE-000')
 assert.equal(coursesEntry('','/','course_ENG-201'),'/courses/ENG-201')
 assert.equal(coursesEntry('','/','courses'),'/courses')
 for(const start of ['course_admin','course_UNKNOWN','c2','academy'])assert.equal(coursesEntry('','/',start),null)
 assert.equal(coursesEntry('#/coursesevil','/courses-evil',''),null)
})
test('Academy sample has one real introductory module and cannot mutate real enrollment',async()=>{
 const seed=JSON.parse(await readFile(new URL('../content/ai-academy/demo.sample.json',import.meta.url),'utf8'))
 const main=JSON.parse(await readFile(new URL('../content/ai-academy/catalog.learning.json',import.meta.url),'utf8'))
 assert.deepEqual(seed,academyDemoSample(main))
 for(const assessment of seed.entities.filter(n=>n.kind==='assessment')){
  assert.ok(assessment.code.startsWith('DEMO-'))
  if(assessment.data.kind==='quiz')assert.ok(assessment.data.questions.every(q=>q.id.startsWith('demo-')))
 }
 let demoState;const demo=createAcademyEngine(seed,{load:()=>demoState,save:s=>demoState=structuredClone(s)})
 const actor={id:1,is_admin:false},catalog=await demo(actor,'catalog',{limit:100})
 assert.equal(catalog.total,1)
 const code=catalog.courses[0].code,course=await demo(actor,'course',{code})
 assert.equal(course.modules.length,1);assert.equal(course.lessons.length,4)
 assert.deepEqual(await demo(actor,'permissions',{}),{admin:false,editor:false,instructor:false})
 await demo(actor,'enroll',{code})
 const lesson=await demo(actor,'lesson',{code:course.lessons[0].code})
 assert.ok(lesson.blocks.length>0)
 await assert.rejects(demo(actor,'admin_save',{entity:catalog.courses[0]}),/forbidden/)
 assert.equal(demoState.enrollments.length,1)
})
