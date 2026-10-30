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
