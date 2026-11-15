import test from 'node:test'
import assert from 'node:assert/strict'
import { createApi } from '../src/platform-kit/src/platform/client.ts'
import { usePlatform } from '../src/platform-kit/src/platform/store.ts'
import { UnknownOutcomeError, canRetrySafely, reconcileUncertain, readUncertain, saveUncertain, uncertaintyKey } from '../src/platform-kit/src/platform/uncertain-action.ts'
const snapshot = { me: { id: 'u', xp: 0, points: 0 }, orders: [] }
const requestId = 'ca149999-0000-4000-8000-123456789abc'

test('transport loss, 5xx, bad JSON and incomplete success distinguish unknown mutation results', async () => {
 const prior = {fetch:globalThis.fetch,window:globalThis.window,location:globalThis.location,document:globalThis.document}
 globalThis.window={Telegram:{WebApp:{initData:'test'}}};globalThis.location={search:''};globalThis.document={cookie:''}
 try {
  const api=await createApi({},'/api')
  for (const response of [()=>{throw Error('offline')},()=>new Response('{}',{status:500}),()=>new Response('invalid'),()=>new Response('{}')]) {
   globalThis.fetch=async()=>response()
   await assert.rejects(api.dispatch('post.create',{body:'test'}),UnknownOutcomeError)
   await assert.rejects(api.bootstrap(),e=>!(e instanceof UnknownOutcomeError))
  }
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'forbidden'}),{status:403})
  await assert.rejects(api.dispatch('post.create'),e=>!(e instanceof UnknownOutcomeError))
  globalThis.fetch=async()=>new Response(JSON.stringify({snapshot,result:{ok:true}}))
  assert.equal((await api.dispatch('post.create')).result.ok,true)
 } finally {Object.assign(globalThis,prior)}
})
test('snapshot absence is not a failure receipt; exact owned order receipt resolves uncertainty',()=>{
 const uncertain={'order.create':{action:'order.create',requestId,checked:false},'post.create':{action:'post.create',checked:false}}
 assert.equal(Object.keys(reconcileUncertain(uncertain,snapshot)).length,2)
 assert.equal(Object.keys(reconcileUncertain(uncertain,{...snapshot,orders:[{requestId,userId:'other'}]})).length,2)
 const next=reconcileUncertain(uncertain,{...snapshot,orders:[{requestId,userId:'u'}]})
 assert.deepEqual(Object.keys(next),['post.create']);assert.equal(next['post.create'].checked,true)
})
test('safe retry requires completed refresh, supported action and the SAME idempotency key',()=>{
 for(const action of ['order.create','gift.send']) {
  const value={action,requestId,checked:true}
  assert.equal(canRetrySafely(value,action,{requestId}),true)
  assert.equal(canRetrySafely({...value,checked:false},action,{requestId}),false)
  assert.equal(canRetrySafely(value,action,{requestId:'new'}),false)
 }
 assert.equal(canRetrySafely({action:'post.create',requestId,checked:true},'post.create',{requestId}),false)
})
test('markers survive refresh without storing payload and isolate account/app/endpoint',()=>{
 const prior=globalThis.sessionStorage,values=new Map()
 globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}
 try {
  const key=uncertaintyKey('app','u','/api'),data={'post.create':{action:'post.create',checked:false}}
  saveUncertain(key,data);assert.deepEqual(readUncertain(key),data)
  for(const k of [uncertaintyKey('other','u','/api'),uncertaintyKey('app','other','/api'),uncertaintyKey('app','u','/other')])assert.deepEqual(readUncertain(k),{})
 } finally {globalThis.sessionStorage=prior}
})
test('unknown mutation refreshes but does not automatically repeat or unlock absent operation',async()=>{
 const original=usePlatform.getState(),calls=[]
 try {
  usePlatform.setState({snapshot,uncertain:{},checkingOutcome:false,message:()=>{},api:{
   dispatch:async(action)=>{calls.push(action);throw new UnknownOutcomeError()},
   bootstrap:async()=>{calls.push('bootstrap');return snapshot},
  }})
  await usePlatform.getState().act('post.create',{body:'test'})
  await usePlatform.getState().act('post.create',{body:'test'})
  assert.deepEqual(calls,['post.create','bootstrap'])
  assert.equal(usePlatform.getState().uncertain['post.create'].checked,true)
  assert.equal(usePlatform.getState().snapshot.me.xp,0)
 } finally {usePlatform.setState(original)}
})
test('failed reconciliation keeps guard and rechecking never dispatches mutation',async()=>{
 const original=usePlatform.getState(),calls=[]
 try {
  usePlatform.setState({snapshot,uncertain:{},checkingOutcome:false,message:()=>{},api:{
   dispatch:async()=>{calls.push('order');throw new UnknownOutcomeError()},
   bootstrap:async()=>{calls.push('bootstrap');throw Error('offline')},
  }})
  await usePlatform.getState().act('order.create',{requestId})
  await usePlatform.getState().act('order.create',{requestId})
  await usePlatform.getState().refreshOutcomes()
  assert.deepEqual(calls,['order','bootstrap','bootstrap'])
  assert.equal(usePlatform.getState().uncertain['order.create'].checked,false)
 } finally {usePlatform.setState(original)}
})

test('manual verified outcome unlocks only matching marker without dispatch, snapshot or XP changes',()=>{
 const original=usePlatform.getState();let calls=0
 const marker={action:'post.create',checked:true}
 try {
  usePlatform.setState({snapshot,uncertain:{'post.create':marker},checkingOutcome:false,message:()=>{},api:{dispatch:()=>calls++}})
  usePlatform.getState().resolveOutcome({...marker},'done')
  assert.equal(usePlatform.getState().uncertain['post.create'],marker)
  usePlatform.getState().resolveOutcome(marker,'not-done')
  assert.deepEqual(usePlatform.getState().uncertain,{})
  assert.equal(calls,0);assert.equal(usePlatform.getState().snapshot,snapshot)
 } finally {usePlatform.setState(original)}
})

test('slow refresh cannot overwrite a newer successful action snapshot',async()=>{
 const original=usePlatform.getState();let resolveDispatch,resolveRefresh
 const dispatchGate=new Promise(r=>resolveDispatch=r),refreshGate=new Promise(r=>resolveRefresh=r)
 const newer={...snapshot,me:{...snapshot.me,xp:10}}
 try {
  usePlatform.setState({snapshot,uncertain:{},checkingOutcome:false,message:()=>{},api:{dispatch:async()=>{await dispatchGate;return {snapshot:newer}},bootstrap:async()=>{await refreshGate;return snapshot}}})
  const action=usePlatform.getState().act('post.create');await Promise.resolve()
  const refresh=usePlatform.getState().refreshOutcomes()
  resolveDispatch();await action;resolveRefresh();await refresh
  assert.equal(usePlatform.getState().snapshot,newer)
 } finally {usePlatform.setState(original)}
})

test('verified order receipt returns its real ID without redispatch or invented rewards',async()=>{
 const original=usePlatform.getState();let calls=0
 try {
  usePlatform.setState({snapshot,uncertain:{},checkingOutcome:false,message:()=>{},api:{
   dispatch:async()=>{calls++;throw new UnknownOutcomeError()},
   bootstrap:async()=>({...snapshot,orders:[{id:'actual-order',userId:'u',requestId}]}),
  }})
  assert.deepEqual(await usePlatform.getState().act('order.create',{requestId}),{orderId:'actual-order',recovered:true,gainedXp:0,gainedPoints:0})
  assert.equal(calls,1);assert.deepEqual(usePlatform.getState().uncertain,{})
 } finally {usePlatform.setState(original)}
})

test('SQL snapshot orders without optional requestId cannot clear uncertainty', () => {
 const state = {'order.create': {action:'order.create',requestId,checked:false}}
 const result = reconcileUncertain(state,{...snapshot,orders:[{id:'already-created',userId:'u'}]})
 assert.equal(result['order.create'].requestId,requestId)
 assert.equal(result['order.create'].checked,true)
 assert.equal(canRetrySafely(result['order.create'],'order.create',{requestId}),true)
 assert.equal(canRetrySafely(result['order.create'],'order.create',{requestId:'new-key'}),false)
})
