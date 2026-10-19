import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../server/handler.ts'
import { hmac, utf8 } from '../server/crypto.ts'

test('integration HMAC binds raw bytes and timestamp; invalid and stale events never reach storage',async()=>{
  const now=Date.now(), secret='local-test-integration-secret', calls=[]
  const gateway={rpc:async(name,args)=>{calls.push({name,args});return name==='az_rate_limit'?true:{ok:true}},storage:async()=>({})}
  const handler=createHandler({gateway,env:{APP_URL:'https://app.example',BOT_TOKEN:'test',ADMIN_TELEGRAM_IDS:'1',SUPABASE_URL:'https://db.example',INTEGRATION_WEBHOOK_SECRET:secret},now:()=>now})
  const raw=JSON.stringify({id:'pos-001',type:'visit.confirmed',data:{userId:'123'}})
  const timestamp=String(Math.floor(now/1000))
  const signature=[...await hmac(utf8(secret),`${timestamp}.${raw}`)].map(b=>b.toString(16).padStart(2,'0')).join('')
  const request=(body=raw,time=timestamp,sig=signature)=>new Request('https://app.example/api/v1/integrations/events',{method:'POST',headers:{'content-type':'application/json','x-az-timestamp':time,'x-az-signature':sig},body})
  assert.equal((await handler(request())).status,200)
  assert.deepEqual(calls.find(c=>c.name==='az_integration_event').args.p_event,JSON.parse(raw))
  calls.length=0
  assert.equal((await handler(request(raw+' '))).status,401)
  assert.equal((await handler(request(raw,String(Number(timestamp)-301)))).status,401)
  assert.equal(calls.length,0)
})
