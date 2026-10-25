import test from 'node:test'
import assert from 'node:assert/strict'
import {publishEditorialBatch} from '../supabase/functions/_shared/editorial.ts'
test('Telegram-only publishing is repeat-safe and never creates app lessons',async()=>{
 const rows=new Map([['telegram_editorial:test-batch',{posts:[{key:'one',text:'<b>Только в канале</b>'}]}]])
 const tables=[];const sent=[]
 const db={from(name){tables.push(name);return {
 select(){return {eq(_,key){return {async maybeSingle(){return {data:rows.has(key)?{value:rows.get(key)}:null}}}}}},
 async insert(row){if(rows.has(row.key))return {error:{code:'23505'}};rows.set(row.key,row.value);return {}},
 update(row){return {async eq(_,key){rows.set(key,row.value);return {}}}},
 }}}
 const send=async(method,payload)=>{sent.push({method,payload});return {ok:true,result:{message_id:200}}}
 const delay=async()=>{}
 assert.equal((await publishEditorialBatch(db,send,-100123,'test-batch',delay)).sent,1)
 assert.equal((await publishEditorialBatch(db,send,-100123,'test-batch',delay)).sent,0)
 assert.equal(sent.length,1);assert(tables.every(x=>x==='settings'))
})
test('uncertain Telegram-only delivery is not sent twice',async()=>{
 const rows=new Map([['telegram_editorial:test-batch',{posts:[{key:'one',text:'Один'},{key:'two',text:'Два'}]}]])
 let calls=0
 const db={from(){return {select(){return {eq(_,key){return {async maybeSingle(){return {data:rows.has(key)?{value:rows.get(key)}:null}}}}}},async insert(row){if(rows.has(row.key))return {error:{code:'23505'}};rows.set(row.key,row.value);return {}},update(row){return {async eq(_,key){rows.set(key,row.value);return {}}}}}}}
 const send=async()=>{calls++;throw Error('unknown delivery')}
 assert.equal((await publishEditorialBatch(db,send,-100123,'test-batch',async()=>{})).reason,'uncertain')
 await publishEditorialBatch(db,send,-100123,'test-batch',async()=>{})
 assert.equal(calls,1)
})
