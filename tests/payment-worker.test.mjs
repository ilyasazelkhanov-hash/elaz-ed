import test from 'node:test'
import assert from 'node:assert/strict'
import { processRefundJobs } from '../supabase/functions/api/payments.ts'

test('refund worker retries transport failures, treats already refunded as success and checks finalization',async()=>{
 const finishes=[];let calls=0
 const db={rpc:async(name,args)=>name==='claim_payment_refunds'?{data:[{charge_id:'a',user_id:1,lease_token:'lease-a'},{charge_id:'b',user_id:2,lease_token:'lease-b'}]}:(finishes.push(args),{data:true})}
 const result=await processRefundJobs(db,async()=>{if(calls++===0)throw Error('network');return {ok:false,description:'Bad Request: PAYMENT_ALREADY_REFUNDED'}})
 assert.equal(result.completed,1);assert.equal(result.failed,1);assert.equal(finishes[0].p_ok,false);assert.equal(finishes[1].p_ok,true)
 await assert.rejects(processRefundJobs({rpc:async()=>({error:{message:'offline'}})},async()=>({ok:true})),/offline/)
})

test('refund worker runs independent jobs concurrently and never hides DB finish failure',async()=>{
 let release, started=0, finalized=0
 const slow=new Promise(resolve=>{release=resolve})
 const db={rpc:async(name,args)=>name==='claim_payment_refunds'?{data:[1,2,3,4,5].map(id=>({charge_id:String(id),user_id:id,lease_token:String(id)}))}:(finalized++,{data:true})}
 const work=processRefundJobs(db,async(_method,payload)=>{started++;if(payload.user_id===1)await slow;return {ok:true}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(started,5);assert.equal(finalized,4)
 release();assert.deepEqual(await work,{completed:5,failed:0})
 await assert.rejects(processRefundJobs({rpc:async name=>name==='claim_payment_refunds'?{data:[{charge_id:'a'}]}:{error:{message:'commit-failed'}}},async()=>({ok:true})),/commit-failed/)
})

test('targeted refund uses only the requested lease and notifies only after commit',async()=>{
 const calls=[],notified=[]
 const db={rpc:async(name,args)=>{calls.push([name,args]);return name==='claim_payment_refund'?{data:[{charge_id:'target',user_id:1,lease_token:'lease'}]}:{data:true}}}
 assert.deepEqual(await processRefundJobs(db,async()=>({ok:true}),'target',async charge=>{notified.push(charge)}),{completed:1,failed:0})
 assert.deepEqual(calls[0],['claim_payment_refund',{p_charge:'target'}]);assert.deepEqual(notified,['target'])
})

test('refund batch deadline stops a stalled claim before any Telegram call',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let called=false
 const pending=processRefundJobs({rpc:()=>new Promise(()=>{})},async()=>{called=true;return {ok:true}})
 const rejected=assert.rejects(pending,/request_timeout/)
 t.mock.timers.tick(60000);await rejected;assert.equal(called,false)
})
