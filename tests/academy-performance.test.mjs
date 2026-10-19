import test from 'node:test'
import assert from 'node:assert/strict'
import {createAcademySnapshotStorage} from '../src/lib/academy-storage.ts'
import {createAcademyEngine} from '../src/lib/academy-domain.ts'

test('snapshot storage reuses parsing, invalidates cross-tab reads and commits only durable writes',()=>{
 let raw='{"value":1}',reads=0,fail=false
 const store=createAcademySnapshotStorage({getItem(){reads++;return raw},setItem(k,v){if(fail)throw Error('quota');raw=v}},'test')
 const first=store.load();assert.equal(store.load(),first);assert.equal(reads,1)
 raw='{"value":2}';assert.equal(store.load().value,1)
 store.invalidate();assert.equal(store.load().value,2);assert.equal(reads,2)
 fail=true;assert.throws(()=>store.save({value:3}),/quota/);assert.equal(store.load().value,2)
 fail=false;store.save({value:4});assert.equal(store.load().value,4)
 raw='invalid';store.invalidate();assert.equal(store.load(),undefined)
})

test('shared read snapshots and failed writes cannot mutate persisted content or caller output',async()=>{
 const node=(code,kind,parent_code,data={})=>({code,kind,parent_code,title:code,data,state:'published',version:1,position:0,seed_managed:false})
 let state={entities:[node('C','course',null),node('M','module','C'),node('L','lesson','M',{format:'microlecture',content_blocks:[{type:'markdown',text:'Авторский материал'}]})],links:[],prerequisites:[],enrollments:[],progress:[],submissions:[],attempts:[],placements:[],certificates:[],audit:[],events:[]}
 const original=state,api=createAcademyEngine(state,{load:()=>state,save:s=>{state=s}}),actor={id:1,is_admin:true}
 const course=await api(actor,'course',{code:'C'})
 assert.equal(original.events.length,0);assert.equal(state.events.length,1)
 assert.equal(original.entities,state.entities)
 course.course.title='Changed outside';course.lessons[0].data.content_blocks=[]
 assert.equal(state.entities[0].title,'C');assert.equal(state.entities[2].data.content_blocks.length,1)
 const fail=createAcademyEngine(state,{load:()=>state,save(){throw Error('quota')}})
 await assert.rejects(fail(actor,'admin_save',{entity:{...state.entities[2],title:'Unsaved'},expected_version:1}),/quota/)
 assert.equal(state.entities[2].title,'L');assert.equal(state.entities[2].version,1)
 const before=state.events.length
 await assert.rejects(fail(actor,'catalog',{limit:12}),/quota/)
 assert.equal(state.events.length,before)
})
