import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {evaluateGuideAnswer,initialGuideAnswer} from '../src/lib/guide-interactions.ts'
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'))
const draft=read('../content/og-academy-bridge/creator-decisions.v1.json')
test('bridge remains an inactive original draft with valid source topic references',()=>{
 assert.equal(draft.activate,false);assert.equal(draft.publication_state,'draft')
 const academy=read('../content/ai-academy/catalog.learning.json').entities
 const paths=read('../content/ai-practice-2026-10-25/paths.json').courses
 assert.equal(draft.lessons.length,3)
 for(const lesson of draft.lessons){
  for(const code of lesson.academy_basis)assert.ok(academy.some(e=>e.code===code&&e.kind==='lesson'),code)
  const [course,key]=lesson.suggested_after.split('/')
  assert.ok(paths.find(c=>c.key===course)?.lessons.some(l=>l.key===key))
  assert.equal(lesson.steps.length,3);assert.equal(lesson.challenges.length,3)
  assert.ok(lesson.artifact.files.every(f=>f.template.length>40))
 }
})
test('nine draft challenges work with the actual existing evaluator',()=>{
 for(const lesson of draft.lessons)for(const q of lesson.challenges){
  assert.equal(evaluateGuideAnswer(q,q.type==='number'?String(q.answer):q.correct).correct,true)
  assert.equal(evaluateGuideAnswer(q,initialGuideAnswer(q)).correct,false)
  if(q.type==='choice')q.options.forEach((_,i)=>assert.equal(evaluateGuideAnswer(q,i).correct,i===q.correct))
  else assert.equal(evaluateGuideAnswer(q,String(q.answer+1)).correct,false)
 }
})
