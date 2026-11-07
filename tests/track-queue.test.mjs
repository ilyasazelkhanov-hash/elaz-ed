import test from 'node:test'
import assert from 'node:assert/strict'
import {createEventQueue} from '../src/lib/track-queue.ts'

function clock() {
 const jobs=new Map();let id=0
 return {jobs,schedule(fn){jobs.set(++id,fn);return id},cancel(id){jobs.delete(id)},async tick(){const [id,fn]=jobs.entries().next().value??[];if(fn){jobs.delete(id);await fn()}}}
}
const event=id=>({name:'blog_save',lesson_id:id,props:{saved:true,source:'blog'}})

test('failed batches retry with a bound and never race new events',async()=>{
 const timer=clock(),sent=[];let reject,resolve
 const queue=createEventQueue({send:batch=>{sent.push(batch);return new Promise((yes,no)=>{resolve=yes;reject=no})},schedule:timer.schedule,cancel:timer.cancel,enabled:()=>true})
 queue.push(event(1));assert.equal(timer.jobs.size,1)
 const first=queue.flush();queue.push(event(2));await queue.flush()
 assert.equal(sent.length,1);reject(Error('offline'));await first
 assert.equal(timer.jobs.size,1)
 const second=timer.tick();await Promise.resolve();assert.deepEqual(sent[1].map(e=>e.lesson_id),[1,2]);resolve();await second
 assert.equal(timer.jobs.size,0);await queue.flush();assert.equal(sent.length,2)
})

test('permanent failures stop after three sends and clear timers',async()=>{
 const timer=clock();let sends=0
 const queue=createEventQueue({send:async()=>{sends++;throw Error('offline')},schedule:timer.schedule,cancel:timer.cancel,enabled:()=>true})
 queue.push(event(1));await timer.tick();await timer.tick();await timer.tick()
 assert.equal(sends,3);assert.equal(timer.jobs.size,0)
})

test('queue is bounded, batches fit the API, and disabled sessions never send',async()=>{
 const timer=clock(),sent=[];let enabled=true
 const queue=createEventQueue({send:async batch=>{sent.push(batch)},schedule:timer.schedule,cancel:timer.cancel,enabled:()=>enabled})
 for(let id=1;id<=150;id++)queue.push(event(id))
 while(timer.jobs.size)await timer.tick()
 assert.equal(sent.flat().length,100);assert.equal(sent.flat()[0].lesson_id,51);assert.ok(sent.every(batch=>batch.length<=20))
 queue.push(event(200));enabled=false;await queue.flush();queue.push(event(201))
 assert.equal(sent.flat().length,100);assert.equal(timer.jobs.size,0)
})
