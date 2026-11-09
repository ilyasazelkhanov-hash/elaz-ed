import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
const source=readFileSync(new URL('../../src/lib/learning-drafts.ts',import.meta.url),'utf8')
function setup(storage){const context={exports:{},sessionStorage:storage,Date};vm.runInNewContext(stripTypeScriptTypes(source).replace(/export function /g,'function ')+';Object.assign(exports,{learningDraftKey,readLearningDraft,writeLearningDraft,clearLearningDraft,questionSignature,restoreLearningAnswers});',context);return context.exports}
test('drafts isolate accounts, scopes and entities and restore exact learner input',()=>{
 const values=new Map(),api=setup({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)})
 const key=api.learningDraftKey('live',1,'Q')
 const input={attemptId:12,signature:'123',answers:{a:0,b:[1,2],c:'Unfinished text'}}
 assert.equal(api.writeLearningDraft(key,input),true)
 assert.deepEqual(JSON.parse(JSON.stringify(api.readLearningDraft(key).answers)),input.answers)
 for(const other of [api.learningDraftKey('demo',1,'Q'),api.learningDraftKey('live',2,'Q'),api.learningDraftKey('live',1,'R')])assert.equal(api.readLearningDraft(other),null)
 assert.equal(api.learningDraftKey('live',undefined,'Q'),null)
 api.clearLearningDraft(key);assert.equal(api.readLearningDraft(key),null)
})
test('unavailable and malformed storage fail without false saved claims',()=>{
 const api=setup({getItem:()=>'{',setItem:()=>{throw Error('quota')},removeItem:()=>{throw Error('disabled')}})
 assert.equal(api.readLearningDraft('x'),null);assert.equal(api.writeLearningDraft('x',{}),false);assert.doesNotThrow(()=>api.clearLearningDraft('x'))
})
test('review uses committed feedback and drafts never persist question payloads',()=>{
 const main=readFileSync(new URL('../../src/screens/Lesson.tsx',import.meta.url),'utf8'),academy=readFileSync(new URL('../../src/screens/academy/Quiz.tsx',import.meta.url),'utf8')
 assert.match(main,/attempt\.done && <section/);assert.match(main,/attempt\.feedback\.filter\(item => !item\.correct\)/)
 assert.match(academy,/restoreLearningAnswers\(saved,a\.attempt_id\|\|a\.id,a\.questions\)/)
 assert.match(academy,/onChange=\{e=>saveAnswers/)
 assert.doesNotMatch(academy,/writeLearningDraft\([^\n]*questions:/)
})

test('restore requires same server attempt, same questions and valid answer shape',()=>{
 const values=new Map(),api=setup({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)})
 const questions=[{id:'a',type:'mcq',choices:['A','B']}]
 api.writeLearningDraft('x',{attemptId:1,signature:api.questionSignature(questions),answers:{a:1}})
 const saved=api.readLearningDraft('x')
 assert.equal(api.restoreLearningAnswers(saved,1,questions).a,1)
 assert.equal(api.restoreLearningAnswers(saved,2,questions),null)
 assert.equal(api.restoreLearningAnswers(saved,1,[{...questions[0],choices:['C','D']}]),null)
 assert.equal(api.restoreLearningAnswers({...saved,answers:{a:9}},1,questions),null)
 assert.equal(api.restoreLearningAnswers({...saved,answers:{a:'wrong type'}},1,questions),null)
})
test('malformed, future, expired and oversized drafts are rejected',()=>{
 let raw;const api=setup({getItem:()=>raw,setItem:(_,v)=>{raw=v}})
 for(const value of [{version:1,savedAt:Date.now()+10000,scrollTop:1},{version:1,savedAt:'now',scrollTop:1},{version:1,savedAt:Date.now()-8*86400000,scrollTop:1},{version:1,savedAt:Date.now(),scrollTop:-1}]){raw=JSON.stringify(value);assert.equal(api.readLearningDraft('x'),null)}
 assert.equal(api.writeLearningDraft('x',{attemptId:1,signature:'x',answers:{a:'x'.repeat(20001)}}),false)
 assert.equal(api.writeLearningDraft('x',{scrollTop:1,correct:0}),false)
 raw=' '.repeat(250001);assert.equal(api.readLearningDraft('x'),null)
})
