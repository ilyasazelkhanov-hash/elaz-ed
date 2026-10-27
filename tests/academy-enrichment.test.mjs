import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {enrichPack,loadStudyExamples} from '../scripts/academy-enrich-lessons.mjs'
import {publicAcademyCatalog} from '../scripts/academy-public.mjs'
const root=new URL('../content/ai-academy/',import.meta.url)
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'))

test('all 112 modules have distinct, concrete teaching cases and nonempty local concept diagrams',async()=>{
 const examples=await loadStudyExamples(),base=await read('catalog.normalized.json'),expected=base.entities.filter(node=>node.kind==='module').map(node=>node.code).sort()
 assert.deepEqual(examples.map(row=>row.module_code).sort(),expected)
 assert.equal(new Set(examples.map(row=>row.situation)).size,112)
 for(const row of examples){const svg=await readFile(new URL(`../public/learning/academy/concepts/${row.module_code}.svg`,import.meta.url),'utf8');assert.match(svg,/<svg[^>]+viewBox="0 0 720 610"/);assert.doesNotMatch(svg,/<script|<foreignObject|(?:href|src)="https?:/)}
})
test('first two courses have a specific beginner walkthrough for each lesson and enrichment preserves grading',async()=>{
 const examples=await loadStudyExamples()
 for(const code of ['CORE-000','VC-101']){
  const pack=await read('authored/'+code+'.json'),notes=await read('lesson-explainers/'+code+'.json')
  assert.equal(notes.length,16);assert.equal(new Set(notes.map(row=>row.lesson_code)).size,16)
  assert.deepEqual(notes.map(row=>row.lesson_code).sort(),pack.lessons.map(lesson=>lesson.code).sort())
  const enriched=enrichPack(pack,examples,notes)
  assert.deepEqual(enrichPack(enriched,examples,notes),enriched,'enrichment must be idempotent')
  for(const [index,lesson]of enriched.lessons.entries()){
   assert.deepEqual(lesson.assessment,pack.lessons[index].assessment)
   assert.deepEqual(lesson.data.acceptance,pack.lessons[index].data.acceptance)
   assert.equal(lesson.data.content_blocks.filter(block=>block.learning_role==='beginner').length,1)
   assert.equal(lesson.data.content_blocks.filter(block=>block.learning_role==='module_example').length,1)
   const original=pack.lessons[index].data.content_blocks.filter(block=>!['beginner','module_example'].includes(block.learning_role))
   assert.deepEqual(lesson.data.content_blocks.slice(0,original.length),original)
  }
  const hidden='PRIVATE_CASE_BODY',fixture={entities:[{code:code+'-M1-L1',kind:'lesson',state:'published',data:{content_blocks:[{type:'markdown',text:hidden,study:{concept:hidden}}]}}]}
  assert.ok(!JSON.stringify(publicAcademyCatalog(fixture)).includes(hidden),'worked examples stay out of public program metadata')
 }
})
