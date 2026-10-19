import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAcademy, AcademyError } from '../../supabase/functions/api/academy.ts'

test('Academy handler binds verified actor and exposes safe structured RPC errors',async()=>{
 const calls=[]
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{courses:[]},error:null}}}
 const actor={id:123,is_admin:false}
 assert.deepEqual(await handleAcademy(db,actor,'catalog',{actor_id:999,p_actor:999}),{courses:[]})
 assert.equal(calls[0].name,'academy_action')
 assert.equal(calls[0].args.p_actor,123)
 await assert.rejects(handleAcademy(db,{id:NaN,is_admin:true},'catalog'),e=>e instanceof AcademyError && e.status===401)
 await assert.rejects(handleAcademy(db,actor,'delete_all'),e=>e.status===400)
 for(const [message,status] of [['academy_forbidden',403],['academy_not_found',404],['academy_version_conflict',409],['academy_answers_invalid',400]]){
  await assert.rejects(handleAcademy({rpc:async()=>({error:{message},data:null})},actor,'catalog'),e=>e.status===status && e.code===message)
 }
 await assert.rejects(handleAcademy({rpc:async()=>({error:{message:'invalid SQL input with sensitive detail',code:'22P02'},data:null})},actor,'catalog'),e=>e.status===400 && e.message==='academy_invalid_payload')
 await assert.rejects(handleAcademy({rpc:async()=>({error:{message:'database details',code:'XX001'},data:null})},actor,'catalog'),e=>e.status===500 && e.message==='academy_unavailable')
})
