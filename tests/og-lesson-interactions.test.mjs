import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ogLessonInteractions,ogLessonInteraction} from '../src/lib/og-lesson-interactions.ts'
import {evaluateGuideAnswer,initialGuideAnswer} from '../src/lib/guide-interactions.ts'
test('all 33 source lessons have original content-specific formative interactions',async()=>{
 const paths=JSON.parse(readFileSync(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url)))
 assert.equal(paths.courses.flatMap(c=>c.lessons).length,33)
 assert.equal(Object.keys(ogLessonInteractions).length,33)
 for(const [key,flow] of Object.entries(ogLessonInteractions)){
  const [course,lesson]=key.split('/')
  const source=paths.courses.find(c=>c.key===course)?.lessons.find(l=>l.key===lesson)
  assert.ok(source)
  assert.equal(await ogLessonInteraction(course,lesson,source.body),flow)
  assert.equal(await ogLessonInteraction(course,lesson,source.body+' '),undefined)
  assert.equal(await ogLessonInteraction(course,lesson,''),undefined)
  assert.equal(await ogLessonInteraction(course,lesson),undefined)
  assert.equal(await ogLessonInteraction(course,lesson,'Locked lesson'),undefined)
  assert.equal(flow.steps.length,3);assert.equal(flow.challenges.length,3)
  assert.match(flow.id,/-v1$/)
  for(const step of flow.steps){
   assert.ok(step.title.length>8&&step.text.length>80)
   if(step.visual){
    assert.ok(step.visual.caption.length>10)
    assert.ok(step.visual.columns.length>=2&&step.visual.columns.length<=3)
    assert.ok(step.visual.rows.length>0&&step.visual.rows.length<=5)
    assert.ok(step.visual.rows.every(row=>row.length===step.visual.columns.length&&row.every(cell=>typeof cell==='string')))
   }
  }
  for(const q of flow.challenges){
   const answer=q.type==='choice'?q.correct:q.type==='number'?String(q.answer):q.answer
   assert.equal(evaluateGuideAnswer(q,answer).correct,true)
   if(q.type==='choice')for(let i=0;i<q.options.length;i++){
    assert.equal(evaluateGuideAnswer(q,i).correct,i===q.correct)
    assert.ok(evaluateGuideAnswer(q,i).explanation.length>20)
   }
   else assert.equal(evaluateGuideAnswer(q,initialGuideAnswer(q)).correct,false)
  }
 }
 assert.equal(await ogLessonInteraction('other','block-1'),undefined)
 assert.equal(await ogLessonInteraction('text','text-report'),undefined)
})
test('no paid content import, backend grading, or persistent writes in public formative package',()=>{
 for(const name of ['og-lesson-interactions','og-text-interactions','og-media-interactions','og-automation-interactions','og-foundations-coding-interactions']){
  const source=readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8')
  assert.doesNotMatch(source,/paths.json|fetch\(|localStorage|supabase/)
 }
 const reader=readFileSync(new URL('../src/screens/home/PracticeReader.tsx',import.meta.url),'utf8')
 assert.match(reader,/view === 'reading'.*training && interaction/)
 assert.match(reader,/challenges=\{interaction.challenges\}/)
 assert.match(reader,/select\('practice', true\)/)
})

test('reader keeps source visible and never bypasses an entitlement boundary',()=>{
 const reader=readFileSync(new URL('../src/screens/home/PracticeReader.tsx',import.meta.url),'utf8')
 assert.match(reader,/verified\?\.body===lesson.body/)
 assert.match(reader,/verified.key===interactionKey/)
 assert.match(reader,/if\(active&&value\)/)
 assert.match(reader,/<details className="og-reader-source"><summary tabIndex=\{0\}>Исходный материал урока<\/summary><Markdown text=\{content.reading\}\//)
 assert.match(reader,/const training = currentBookmark.mode === 'training' && !!interaction/)
 assert.doesNotMatch(reader,/paths.json|fetch\(|supabase/)
 const journey=readFileSync(new URL('../src/screens/home/GuideJourney.tsx',import.meta.url),'utf8')
 assert.match(journey,/initialPractice/)
 assert.match(journey,/closest<HTMLElement>\('\.scroll'\)/)
})

test('real compatibility guard fails closed without crypto or when digest rejects',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto')
 const paths=JSON.parse(readFileSync(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url)))
 const body=paths.courses.find(c=>c.key==='foundations').lessons.find(l=>l.key==='block-1').body
 try{
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined})
  assert.equal(await ogLessonInteraction('foundations','block-1',body),undefined)
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async()=>{throw Error('unavailable')}}}})
  assert.equal(await ogLessonInteraction('foundations','block-1',body),undefined)
 }finally{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto}
})

test('offline coverage diagnoses supplied bytes without treating an export as live evidence',async()=>{
 const {interactionCoverage}=await import('../scripts/og-interaction-coverage.mjs')
 const paths=JSON.parse(readFileSync(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url)))
 const body=paths.courses.find(c=>c.key==='foundations').lessons.find(l=>l.key==='block-1').body
 const input={lessons:[{courseKey:'foundations',lessonKey:'block-1',body,published:true},{courseKey:'foundations',lessonKey:'foundations-context',body:'changed',published:true},{courseKey:'unknown',lessonKey:'x',body:'private',published:true},{courseKey:'coding',lessonKey:'block-7',body:'draft',published:false}]}
 const snapshot=structuredClone(input),report=await interactionCoverage(input)
 assert.equal(report.live_verified,false)
 assert.deepEqual(report.rows.map(r=>r.status),['compatible','body_mismatch','not_authored','unpublished'])
 assert.deepEqual(input,snapshot)
 assert.equal(JSON.stringify(report).includes('private'),false)
 assert.equal(report.rows.some(r=>'body' in r),false)
 await assert.rejects(()=>interactionCoverage({lessons:[input.lessons[0],input.lessons[0]]}),/Duplicate/)
 await assert.rejects(()=>interactionCoverage({lessons:[{courseKey:'x',lessonKey:'y',body:'z'}]}),/boolean published/)
})
