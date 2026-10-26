import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {once} from 'node:events'
import {mkdtemp,rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createBookingServer} from './server.mjs'
async function start(options){const server=createBookingServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');return {server,url:`http://127.0.0.1:${server.address().port}`}}
async function request(url,route,{token,data}={}){const r=await fetch(url+route,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,body:await r.json()}}
const account=(url,email)=>request(url,'/register',{data:{email,password:'fictional-password-123'}})
const close=server=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
test('authentication, ownership, idempotency and slot conflicts',async()=>{const {server,url}=await start();try{
 assert.equal((await request(url,'/bookings')).status,401)
 const a=(await account(url,'alice@example.test')).body.token,b=(await account(url,'bob@example.test')).body.token
 assert.equal((await request(url,'/login',{data:{email:'alice@example.test',password:'wrong-password-123'}})).status,401)
 const data={slot:'2030-01-02T09:00',requestKey:'first-request'}
 const created=await request(url,'/bookings',{token:a,data});assert.equal(created.status,201)
 assert.equal((await request(url,'/bookings',{token:a,data})).body.id,created.body.id)
 assert.equal((await request(url,'/bookings',{token:b,data})).status,409)
 assert.equal((await request(url,`/bookings/${created.body.id}`,{token:b})).status,404)
 assert.equal((await request(url,'/bookings',{token:b})).body.bookings.length,0)
 assert.equal((await request(url,'/bookings',{token:a,data:{...data,slot:'2030-01-03T09:00'}})).status,409)
 assert.equal((await request(url,'/bookings',{token:a,data:{slot:'2030-01-02T09:30',requestKey:'invalid-time'}})).status,400)
 await request(url,'/logout',{token:a,data:{}});assert.equal((await request(url,'/bookings',{token:a})).status,401)
}finally{await close(server)}})
test('SQLite survives restart while sessions expire on restart',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'booking-'));let instance;try{const database=path.join(dir,'test.sqlite');instance=await start({database});const token=(await account(instance.url,'owner@example.test')).body.token;await request(instance.url,'/bookings',{token,data:{slot:'2030-01-04T10:00',requestKey:'persist-key'}});const checkDb=new DatabaseSync(database);assert.equal(checkDb.prepare('SELECT count(*) n FROM outbox').get().n,1);checkDb.close();await close(instance.server);instance=await start({database});assert.equal((await request(instance.url,'/bookings',{token})).status,401);const login=await request(instance.url,'/login',{data:{email:'owner@example.test',password:'fictional-password-123'}});assert.equal((await request(instance.url,'/bookings',{token:login.body.token})).body.bookings.length,1)}finally{if(instance?.server.listening)await close(instance.server);await rm(dir,{recursive:true,force:true})}})
test('expired sessions and forged tokens fail',async()=>{let clock=0;const {server,url}=await start({now:()=>clock});try{const token=(await account(url,'clock@example.test')).body.token;assert.equal((await request(url,'/bookings',{token:'a'.repeat(64)})).status,401);clock=3600001;assert.equal((await request(url,'/bookings',{token})).status,401)}finally{await close(server)}})

test('malformed input and excessive bodies are rejected',async()=>{const {server,url}=await start();try{for(const [headers,body,status] of [[{},'{}',415],[{'Content-Type':'application/json'},'{',400],[{'Content-Type':'application/json'},'[]',400],[{'Content-Type':'application/json'},JSON.stringify({large:'x'.repeat(9000)}),413]]){const response=await fetch(url+'/login',{method:'POST',headers,body});assert.equal(response.status,status)}}finally{await close(server)}})
