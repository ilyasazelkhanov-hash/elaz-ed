import test from 'node:test'
import assert from 'node:assert/strict'
import {KEY,SERVICES,validateDraft,saveRequest,readRequest,deleteRequest} from './request.mjs'
import {createFirstAppServer} from './server.mjs'
const good={serviceId:'light',name:'  Учебная Алия  ',contact:' student@example.test '}
const memory=()=>{const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}}
const fixed=()=>new Date('2026-10-27T12:00:00.000Z')
test('three fixed services and trimmed name/contact boundaries reject unusable drafts',()=>{
 assert.deepEqual(SERVICES.map(s=>s.id),['tap','light','inspect']);assert.deepEqual(validateDraft(good),{})
 for(const name of ['', '  ','А','а'.repeat(61)])assert.ok(validateDraft({...good,name}).name)
 for(const contact of ['', '  ','ab','a'.repeat(81)])assert.ok(validateDraft({...good,contact}).contact)
 assert.ok(validateDraft({...good,serviceId:'unknown'}).serviceId)
 assert.deepEqual(validateDraft({...good,name:'аб',contact:'abc'}),{})
 assert.deepEqual(validateDraft({...good,name:'а'.repeat(60),contact:'a'.repeat(80)}),{})
 assert.equal(Object.keys(validateDraft(null)).length,3)
})
test('successful write is trimmed, contains only the local contract and survives a fresh reader',()=>{
 const store=memory(),result=saveRequest(store,{...good,extra:'not stored'},fixed)
 assert.equal(result.ok,true);assert.deepEqual(result.request,{serviceId:'light',name:'Учебная Алия',contact:'student@example.test',createdAt:'2026-10-27T12:00:00.000Z'})
 assert.deepEqual(readRequest(store),{state:'saved',request:result.request})
 assert.deepEqual(JSON.parse(store.getItem(KEY)),result.request)
 const draft={...good};const second=saveRequest(store,draft,fixed);draft.name='Changed later';assert.equal(second.request.name,'Учебная Алия')
})
test('only the last valid request is kept, while validation/storage failures preserve the previous record',()=>{
 const store=memory();saveRequest(store,good,fixed);const previous=store.getItem(KEY)
 assert.equal(saveRequest(store,{...good,name:' '},fixed).kind,'validation');assert.equal(store.getItem(KEY),previous)
 const denied={getItem:store.getItem,setItem(){throw Error('blocked')},removeItem:store.removeItem};const result=saveRequest(denied,{...good,serviceId:'tap'},fixed)
 assert.equal(result.ok,false);assert.equal(result.kind,'storage');assert.equal(store.getItem(KEY),previous)
 assert.equal(saveRequest(store,{...good,serviceId:'tap'},fixed).ok,true);assert.equal(readRequest(store).request.serviceId,'tap')
})
test('missing, corrupt, invalid and unavailable storage never creates a success record',()=>{
 const store=memory();assert.equal(readRequest(store).state,'empty')
 for(const raw of ['{broken','null','[]',JSON.stringify({...good,createdAt:'not a date'}),JSON.stringify({...good,serviceId:'other',createdAt:fixed().toISOString()})]){store.setItem(KEY,raw);assert.deepEqual(readRequest(store),{state:'unreadable',request:null});assert.equal(store.getItem(KEY),raw)}
 assert.deepEqual(readRequest({getItem(){throw Error('blocked')}}),{state:'unavailable',request:null})
})
test('stored text remains text data and deletion affects only the teaching key',()=>{
 const store=memory(),name='<b>Учебное имя</b>';store.setItem('other-learning-data','keep')
 saveRequest(store,{...good,name},fixed);assert.equal(readRequest(store).request.name,name)
 assert.equal(deleteRequest(store).ok,true);assert.equal(readRequest(store).state,'empty');assert.equal(store.getItem('other-learning-data'),'keep')
 assert.equal(deleteRequest({removeItem(){throw Error('blocked')}}).ok,false)
})
test('local server exposes only static teaching assets and accepts no submission API',async t=>{
 const server=createFirstAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)))
 const origin=`http://127.0.0.1:${server.address().port}`
 const response=await fetch(origin);assert.equal(response.status,200);assert.match(await response.text(),/мастеру не отправлено/)
 assert.match(response.headers.get('content-security-policy'),/form-action 'none'/)
 assert.equal((await fetch(origin+'/request.mjs')).status,200)
 assert.equal((await fetch(origin+'/server.mjs')).status,404)
 assert.equal((await fetch(origin+'/../../package.json')).status,404)
 assert.equal((await fetch(origin+'/api/requests',{method:'POST',body:'fictional'})).status,405)
})
