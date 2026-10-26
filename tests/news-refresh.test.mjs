import test from 'node:test'
import assert from 'node:assert/strict'
import {refreshNewsMessage} from '../supabase/functions/_shared/newsRefresh.ts'
test('refresh edits existing message and never sends a duplicate',async()=>{
 const calls=[]
 const result=await refreshNewsMessage(async(method,payload)=>{calls.push({method,payload});return {ok:true}},-100,42,{id:7,title:'Title',body:'Body',cover_url:'https://example.org/new.jpg'},{username:'test_bot'})
 assert.equal(result.ok,true);assert.deepEqual(calls.map(x=>x.method),['editMessageMedia']);assert.equal(calls[0].payload.message_id,42)
})
test('refresh can edit text-only fallback and treats not-modified as success',async()=>{
 const calls=[]
 const result=await refreshNewsMessage(async(method)=>{calls.push(method);return method!=='editMessageText'?{ok:false,error_code:400,description:'message has no media'}:{ok:false,error_code:400,description:'Bad Request: message is not modified'}},-100,42,{id:7,title:'Title',body:'Body',cover_url:'https://example.org/new.jpg'},{username:'test_bot'})
 assert.equal(result.ok,true);assert.deepEqual(calls,['editMessageMedia','editMessageCaption','editMessageText'])
})
test('refresh stops on unknown network outcome',async()=>{
 let n=0;await assert.rejects(()=>refreshNewsMessage(async()=>{n++;throw Error('network')},-100,42,{id:7,title:'T',body:'B',cover_url:'https://example.org/a.jpg'},{username:'test_bot'}));assert.equal(n,1)
})
