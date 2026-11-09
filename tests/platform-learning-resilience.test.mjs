import test from 'node:test'
import assert from 'node:assert/strict'
import { createActionQueue } from '../src/platform-kit/src/platform/action-queue.ts'
import { homeworkDraftKey, readHomeworkDraft, writeHomeworkDraft, clearSubmittedHomework } from '../src/platform-kit/src/platform/learning-draft.ts'
import { usePlatform } from '../src/platform-kit/src/platform/store.ts'
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('slow request queues quiz start, deduplicates repeated clicks and drains after a failure', async () => {
 const statuses=[], calls=[], gate=deferred(), queue=createActionQueue(n=>statuses.push(n))
 const first=queue('favorite',()=>{calls.push('favorite');return gate.promise})
 const start=queue('quiz.start',async()=>{calls.push('quiz.start');return 42})
 assert.equal(queue('quiz.start',async()=>{throw Error('duplicate')}),start)
 await Promise.resolve();assert.deepEqual(calls,['favorite']);assert.equal(statuses.at(-1),2)
 gate.reject(Error('offline'));await assert.rejects(first,/offline/)
 assert.equal(await start,42);assert.deepEqual(calls,['favorite','quiz.start']);assert.equal(statuses.at(-1),0)
})
test('store publishes responses in order and never drops quiz start while busy', async () => {
 const original=usePlatform.getState(), gate=deferred(),calls=[]
 const initial={me:{id:'learner',xp:0,points:0}}
 const api={dispatch:async action=>{calls.push(action);if(action==='favorite')await gate.promise;return {snapshot:{me:{id:'learner',xp:calls.length,points:0}},result:{attemptId:'attempt'}}}}
 try {
  usePlatform.setState({api,snapshot:initial})
  const first=usePlatform.getState().act('favorite')
  const start=usePlatform.getState().act('quiz.start',{entityId:'lesson'})
  await Promise.resolve();assert.equal(usePlatform.getState().busy,true);assert.equal(usePlatform.getState().pendingActions,2)
  gate.resolve();await first;assert.equal((await start).attemptId,'attempt');assert.deepEqual(calls,['favorite','quiz.start']);assert.equal(usePlatform.getState().busy,false)
 } finally {usePlatform.setState(original)}
})
test('queued actions and responses cannot cross to a changed API/account', async () => {
 const original=usePlatform.getState(), gate=deferred(),calls=[]
 const api={dispatch:async action=>{calls.push(action);await gate.promise;return {snapshot:{me:{id:'old',xp:1,points:0}}}}}
 try {
  usePlatform.setState({api,snapshot:{me:{id:'old',xp:0,points:0}}})
  const first=usePlatform.getState().act('favorite'), queued=usePlatform.getState().act('quiz.start',{entityId:'lesson'})
  await Promise.resolve();usePlatform.setState({api:{},snapshot:{me:{id:'new',xp:0,points:0}}})
  gate.resolve();assert.equal(await first,undefined);assert.equal(await queued,undefined);assert.equal(usePlatform.getState().snapshot.me.id,'new');assert.deepEqual(calls,['favorite'])
 } finally {usePlatform.setState(original)}
})
test('homework saves before navigation, isolates scope and keeps edits made during submit', () => {
 const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
 const key=homeworkDraftKey('app','one',true,'lesson'), submitted={body:'my draft',file:'file-id'}
 assert.equal(writeHomeworkDraft(key,submitted),true);assert.deepEqual(readHomeworkDraft(key),submitted)
 for(const other of [homeworkDraftKey('app','two',true,'lesson'),homeworkDraftKey('app','one',false,'lesson'),homeworkDraftKey('other','one',true,'lesson'),homeworkDraftKey('app','one',true,'other')])assert.deepEqual(readHomeworkDraft(other),{body:'',file:''})
 writeHomeworkDraft(key,{...submitted,body:'new text'});assert.equal(clearSubmittedHomework(key,submitted),false);assert.equal(readHomeworkDraft(key).body,'new text')
 assert.equal(clearSubmittedHomework(key,readHomeworkDraft(key)),true);assert.equal(readHomeworkDraft(key).body,'')
})
test('homework survives navigation in memory when session storage is unavailable', () => {
 globalThis.sessionStorage={setItem:()=>{throw Error('disabled')},getItem:()=>{throw Error('disabled')}}
 const key=homeworkDraftKey('app','offline',true,'lesson'), draft={body:'Do not lose this',file:''}
 assert.equal(writeHomeworkDraft(key,draft),false);assert.deepEqual(readHomeworkDraft(key),draft)
})

test('a new API session is not blocked by an old request and owns pending counters', async () => {
 const original=usePlatform.getState(), oldGate=deferred(), newGate=deferred()
 const snapshot=id=>({me:{id,xp:0,points:0}})
 try {
  usePlatform.setState({api:{dispatch:async()=>{await oldGate.promise;return {snapshot:snapshot('old')}}},snapshot:snapshot('old')})
  const old=usePlatform.getState().act('old');await Promise.resolve()
  usePlatform.setState({api:{dispatch:async()=>{await newGate.promise;return {snapshot:snapshot('new'),result:{ok:true}}}},snapshot:snapshot('new')})
  const current=usePlatform.getState().act('new');await Promise.resolve()
  assert.equal(usePlatform.getState().pendingActions,1)
  oldGate.resolve();await old;assert.equal(usePlatform.getState().pendingActions,1)
  newGate.resolve();assert.equal((await current).ok,true);assert.equal(usePlatform.getState().pendingActions,0);assert.equal(usePlatform.getState().snapshot.me.id,'new')
 } finally {usePlatform.setState(original)}
})

test('quiz drafts retain in-flight/practice state across navigation and isolate boot sessions', async () => {
 const { getQuizSession }=await import('../src/platform-kit/src/platform/quiz-session.ts')
 const api={}, draft=getQuizSession(api,'lesson'), values=[]
 const unsubscribe=draft.subscribe(()=>values.push(draft.get().picked))
 draft.set({initialized:true,attemptId:'practice',questions:[{question:'q',options:['a','b']}],picked:1})
 unsubscribe() // screen left before request returned
 draft.set({feedback:[{index:0,answer:1,correctIndex:0,explain:'Authored explanation'}],done:true,ready:true})
 assert.equal(getQuizSession(api,'lesson'),draft);assert.equal(getQuizSession(api,'lesson').get().picked,1);assert.equal(draft.get().done,true)
 assert.equal(getQuizSession(api,'other').get().attemptId,'');assert.equal(getQuizSession({},'lesson').get().attemptId,'')
 assert.deepEqual(values,[1])
})

test('store failure releases the queue and permits a subsequent quiz request', async () => {
 const original=usePlatform.getState(), calls=[]
 const snapshot={me:{id:'learner',xp:0,points:0}}
 try {
  usePlatform.setState({snapshot,message:()=>{},api:{dispatch:async action=>{
   calls.push(action)
   if(action==='failed')throw Error('temporary network error')
   return {snapshot,result:{attemptId:'recovered'}}
  }}})
  const failure=usePlatform.getState().act('failed')
  const recovery=usePlatform.getState().act('quiz.start',{entityId:'lesson'})
  assert.equal(await failure,undefined)
  assert.equal((await recovery).attemptId,'recovered')
  assert.deepEqual(calls,['failed','quiz.start'])
  assert.equal(usePlatform.getState().pendingActions,0)
  assert.equal(usePlatform.getState().busy,false)
 } finally {usePlatform.setState(original)}
})

test('quiz external-store snapshots stay stable until an update and prior snapshots remain immutable', async () => {
 const { createQuizSession }=await import('../src/platform-kit/src/platform/quiz-session.ts')
 const draft=createQuizSession(), initial=draft.get()
 assert.equal(draft.get(),initial)
 draft.set({initialized:true,picked:0})
 assert.notEqual(draft.get(),initial)
 assert.equal(initial.initialized,false)
 assert.equal(initial.picked,null)
 const pending=draft.get()
 draft.set({feedback:[{index:0,answer:0,correctIndex:1,explain:'Review'}],done:true})
 assert.equal(pending.done,false)
 assert.deepEqual(pending.feedback,[])
 assert.equal(draft.get().done,true)
})
