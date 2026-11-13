import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {ogLessonInteractions,ogLessonInteraction} from '../src/lib/og-lesson-interactions.ts'
import {evaluateGuideAnswer,initialGuideAnswer} from '../src/lib/guide-interactions.ts'
test('three reviewed lessons include an original Academy-informed coding slice',async()=>{
 const paths=JSON.parse(readFileSync(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url)))
 assert.equal(paths.courses.flatMap(c=>c.lessons).length,33)
 assert.equal(Object.keys(ogLessonInteractions).length,3)
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
  for(const q of flow.challenges){
   const answer=q.type==='choice'?q.correct:q.answer
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
 const source=readFileSync(new URL('../src/lib/og-lesson-interactions.ts',import.meta.url),'utf8')
 assert.doesNotMatch(source,/paths.json|fetch\(|localStorage|supabase/)
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
 assert.match(reader,/const training = readingBody !== lesson.body && !!interaction/)
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
