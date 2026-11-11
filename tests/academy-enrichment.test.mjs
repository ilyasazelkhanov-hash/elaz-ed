import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {enrichPack,loadStudyExamples} from '../scripts/academy-enrich-lessons.mjs'
import {publicAcademyCatalog} from '../scripts/academy-public.mjs'
const root=new URL('../content/ai-academy/',import.meta.url)
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'))

test('all 112 module fallback cases remain available, with one teaching example per lesson',async()=>{
 const examples=await loadStudyExamples(),base=await read('catalog.normalized.json'),expected=base.entities.filter(node=>node.kind==='module').map(node=>node.code).sort()
 assert.deepEqual(examples.map(row=>row.module_code).sort(),expected)
 assert.equal(new Set(examples.map(row=>row.situation)).size,112)
 const courses=await read('authored/index.json')
 let worked=0
 for(const code of courses){const pack=await read('authored/'+code+'.json');for(const lesson of pack.lessons){assert.equal(lesson.data.content_blocks.filter(block=>block.learning_role==='module_example').length,1,lesson.code);worked++}}
 assert.equal(worked,448)
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

test('BI-301 pilot aligns all sixteen lesson examples and preserves original teaching and grading',async()=>{
 const {loadLessonExamples,assertLessonExamplesCurrent}=await import('../scripts/academy-enrich-lessons.mjs')
 const pack=await read('authored/BI-301.json'),rows=await loadLessonExamples('BI-301'),examples=await loadStudyExamples()
 assert.equal(rows.length,16)
 assert.deepEqual(rows.map(row=>row.lesson_code).sort(),pack.lessons.map(lesson=>lesson.code).sort())
 assertLessonExamplesCurrent(pack,rows)
 const snapshot=structuredClone(pack),enriched=enrichPack(pack,examples,[],undefined,rows)
 assert.deepEqual(pack,snapshot,'must not mutate source pack')
 assert.deepEqual(enriched,pack,'checked-in pilot must match its sources')
 assert.deepEqual(enrichPack(enriched,examples,[],undefined,rows),enriched,'idempotent generation')
 for(const lesson of enriched.lessons){
  const original=pack.lessons.find(item=>item.code===lesson.code),example=lesson.data.content_blocks.find(block=>block.learning_role==='module_example')
  assert.equal(example.example_scope,'lesson');assert.equal(example.source_lesson_code,lesson.code)
  assert.equal(example.study.diagram_src,undefined,'a portfolio module diagram must not illustrate the audit lesson')
  assert.deepEqual(lesson.assessment,original.assessment)
  assert.deepEqual(lesson.data.acceptance,original.data.acceptance)
  const practice=lesson.data.content_blocks.find(block=>block.learning_role==='lesson_practice')
  assert.match(practice.text,/другие исходные данные|контрольная работа/)
  assert.match(practice.text,/перенос в новый контекст/)
  assert.match(practice.text,/не автоматический зачёт/)
  if(lesson.code.endsWith('-L4'))assert.match(practice.text,/контрольная работа/)
 }
 assert.equal(new Set(enriched.lessons.map(lesson=>lesson.data.content_blocks.find(block=>block.study).study.input_text)).size,16)
 const first=rows[0]
 for(const id of ['E1:','E2:','E3:','E4:','E5:','E6:'])assert.ok(first.input.includes(id))
 assert.match(first.expected,/шести направлений/);assert.match(first.expected,/навык неизвестен/)
 assert.doesNotMatch(first.input,/бюджет|100000|50000/)
 // Manual author text is not an enrichment-owned block, even if it sits after an example.
 const manual=structuredClone(pack),note={type:'markdown',text:'Авторское дополнение: сохранить без изменений.'}
 manual.lessons[0].data.content_blocks.push(note)
 const changed=enrichPack(manual,examples,[],undefined,rows)
 assert.ok(changed.lessons[0].data.content_blocks.some(block=>JSON.stringify(block)===JSON.stringify(note)))
 const scoped=enrichPack(manual,examples,[],2,rows)
 for(let i=0;i<manual.lessons.length;i++)if(!manual.lessons[i].code.startsWith('BI-301-M2-'))assert.deepEqual(scoped.lessons[i],manual.lessons[i])
})

test('lesson-specific enrichment rejects missing, duplicated, stale and repetitive sources before generating',async()=>{
 const {loadLessonExamples,validateLessonExamples,assertLessonExamplesCurrent}=await import('../scripts/academy-enrich-lessons.mjs')
 const pack=await read('authored/BI-301.json'),rows=await loadLessonExamples('BI-301'),examples=await loadStudyExamples()
 assert.throws(()=>validateLessonExamples(pack,rows.slice(1)),/incomplete/)
 assert.throws(()=>enrichPack(pack,examples),/missing lesson examples/)
 for(const mutate of [
  data=>{data[1].lesson_code=data[0].lesson_code},
  data=>{data[0].lesson_code='BI-301-M9-L1'},
  data=>{data[0].lesson_title='Другая тема'},
  data=>{data[0].acceptance=['Другая проверка']},
  data=>{data[0].artifact='Другое задание'},
  data=>{data[0].feedback=[]},
  data=>{data[0].steps=['Коротко']},
  ...['input','expected','attempt','transfer','steps'].map(key=>data=>{data[1][key]=data[0][key]})
 ]){const invalid=structuredClone(rows);mutate(invalid);assert.throws(()=>enrichPack(pack,examples,[],1,invalid))}
 const stale=structuredClone(pack);stale.lessons[0].data.content_blocks.find(block=>block.study).study.input_text='Old generated case'
 assert.throws(()=>assertLessonExamplesCurrent(stale,rows),/stale generated/)
})

test('pilot practice survives public reading generation, semantic sections and complete course books',async()=>{
 const {loadAuthoredPacks,composeLearningCatalog}=await import('../scripts/academy-content.mjs')
 const {courseMaterials}=await import('../scripts/course-materials.mjs')
 const {courseBookFiles}=await import('../scripts/academy-books.mjs')
 const {readingParts,belongsToReadingSection}=await import('../src/lib/academy-reading.ts')
 const base=await read('catalog.normalized.json'),packs=await loadAuthoredPacks(),catalog=composeLearningCatalog(base,packs)
 const book=courseMaterials(catalog).find(book=>book.course.code==='BI-301'),pages=courseBookFiles(base,packs)
 assert.equal(book.lessons.length,16)
 for(const lesson of book.lessons){
  const practice=lesson.data.content_blocks.find(block=>block.learning_role==='lesson_practice')
  const parts=readingParts(practice.text)
  assert.equal(parts.filter(part=>belongsToReadingSection(part,'practice')).length,2,'attempt and transfer are visible in practice')
  assert.ok(parts.some(part=>part.kind==='hint'));assert.ok(parts.some(part=>part.kind==='check'))
  const module=lesson.code.match(/-M(\d)-/)[1],page=pages.get(`courses/BI-301/M${module}.md`)
  assert.ok(page.includes(practice.text))
  assert.match(page,/не автоматический зачёт/)
 }
 const disk=JSON.parse(await readFile(new URL('../public/learning/courses/materials/BI-301.json',import.meta.url),'utf8'))
 assert.deepEqual(disk,book,'generated public materials must be current')
 assert.ok(!JSON.stringify(book).includes('"assessment"'))
})

test('pilot dashboard examples reproduce the shipped lab rather than a module-level numeric fixture',async()=>{
 const {choosePortfolio}=await import('../content/ai-academy/projects/business-lab/portfolio.mjs')
 const {policyDecision}=await import('../content/ai-academy/projects/business-lab/governance.mjs')
 const portfolio=await read('projects/business-lab/portfolio.json'),policy=await read('projects/business-lab/policy.json')
 assert.deepEqual(choosePortfolio(portfolio).ids,['DATA','FAQ'])
 for(const effortLimit of [50,55])assert.deepEqual(choosePortfolio({...portfolio,effortLimit}).ids,['DATA','MEET'])
 for(const budget of [90000,70000])assert.deepEqual(choosePortfolio({...portfolio,budget}).ids,['DATA'])
 const request={policyVersion:policy.version,tool:'external_demo',dataClass:'public',purpose:'summary',action:'prepare_draft'}
 assert.equal(policyDecision(policy,request).allowed,true)
 for(const change of [{dataClass:'internal'},{purpose:'meeting_packet'},{action:'send'},{tool:'unknown_demo'}])assert.equal(policyDecision(policy,{...request,...change}).allowed,false)
 const {loadLessonExamples}=await import('../scripts/academy-enrich-lessons.mjs'),rows=await loadLessonExamples('BI-301')
 const tco=rows.find(row=>row.lesson_code==='BI-301-M3-L2')
 for(const [value,formula]of [[180400,40000+3*(12000+30000)+480*30],[282000,120000+3*(20000+30000)+480*25],[480000,480*15/60*4000]]){
  assert.equal(formula,value);assert.ok(tco.steps.join(' ').includes(String(value)),`worked TCO must contain ${value}`)
 }
})
