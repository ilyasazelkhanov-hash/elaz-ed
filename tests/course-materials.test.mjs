import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {courseMaterials,writeCourseMaterials} from '../scripts/course-materials.mjs'
const catalog=JSON.parse(await readFile(new URL('../content/ai-academy/catalog.learning.json',import.meta.url),'utf8'))

test('all 28 public reading editions contain sixteen substantive actual lessons and practical files',async()=>{
 const books=courseMaterials(catalog)
 assert.equal(books.length,28);assert.equal(books.reduce((n,b)=>n+b.lessons.length,0),448)
 for(const book of books){
  assert.equal(book.modules.length,4);assert.equal(book.lessons.length,16)
  const persisted=JSON.parse(await readFile(new URL(`../public/learning/courses/materials/${book.course.code}.json`,import.meta.url),'utf8'))
  assert.deepEqual(persisted,book)
  for(const lesson of book.lessons){
   assert.ok(lesson.data.content_blocks.some(b=>(b.text||b.body||'').length>500),lesson.code)
   assert.ok(lesson.data.artifact.length>10);assert.ok(lesson.data.acceptance.length>0)
   assert.equal(lesson.data.questions,undefined)
  }
 }
 const core=books.find(b=>b.course.code==='CORE-000')
 assert.ok(core.lessons[0].data.content_blocks.some(b=>(b.text||'').includes('core-workbook.zip')))
})
test('public teaching allowlist excludes grading and learner data, paid or draft courses',()=>{
 const poisoned=structuredClone(catalog),course=poisoned.entities.find(n=>n.code==='CORE-000')
 const lesson=poisoned.entities.find(n=>n.code==='CORE-000-M1-L1')
 lesson.data.private_notes='PRIVATE_NODE_SENTINEL';lesson.data.submissions=[{text:'PRIVATE_LEARNER_SENTINEL'}]
 lesson.data.content_blocks[0].answer='PRIVATE_GRADE_SENTINEL'
 lesson.data.content_blocks.push({type:'quiz',questions:[{answer:'PRIVATE_QUIZ_SENTINEL'}]})
 lesson.data.content_blocks.push({type:'markdown',text:'Public example',study:{title:'Visible',input_text:'Input',steps:['Step'],accepted_answers:['PRIVATE_STUDY_SENTINEL']}})
 const encoded=JSON.stringify(courseMaterials(poisoned))
 assert.doesNotMatch(encoded,/PRIVATE_(?:NODE|LEARNER|GRADE|QUIZ|STUDY)_SENTINEL/)
 course.data.price_stars=50
 assert.equal(courseMaterials(poisoned).some(b=>b.course.code==='CORE-000'),false)
 course.data.price_stars=0;course.data.legacy_course_id=1
 assert.equal(courseMaterials(poisoned).some(b=>b.course.code==='CORE-000'),false)
 delete course.data.legacy_course_id;course.state='draft'
 assert.equal(courseMaterials(poisoned).some(b=>b.course.code==='CORE-000'),false)
})
test('publication removes a withdrawn generated edition while preserving unrelated files',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'og-materials-'));t.after(()=>rm(root,{recursive:true,force:true}))
 await mkdir(path.join(root,'content/ai-academy'),{recursive:true});await mkdir(path.join(root,'public/learning/courses/materials'),{recursive:true})
 const folder=path.join(root,'public/learning/courses/materials')
 await writeFile(path.join(folder,'OLD-101.json'),'stale');await writeFile(path.join(folder,'README.md'),'keep')
 await writeCourseMaterials(catalog,root)
 await assert.rejects(access(path.join(folder,'OLD-101.json')))
 assert.equal(await readFile(path.join(folder,'README.md'),'utf8'),'keep')
 const index=JSON.parse(await readFile(path.join(root,'content/ai-academy/materials-manifest.json'),'utf8'))
 assert.equal(index.courses.length,28)
 assert.ok(index.courses.every(c=>c.lessons.every(l=>!l.data&&!l.content_blocks)))
})
