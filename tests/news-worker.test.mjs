import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'
const settings=[{key:'cron_key',value:'test-cron'},{key:'bot',value:{id:99,username:'test_bot',main_app:true}},{key:'news_publishing',value:{enabled:true,chat_id:-100123}}]
let claims=[],finished=[],calls=[],reply=null
globalThis.__newsDb={from:()=>({select:()=>({in:async()=>({data:settings})})}),rpc:async(name,args)=>{
 if(name==='claim_news_post')return {data:claims.shift()??null}
 finished.push(args);return {data:true}
}}
globalThis.Deno={env:{get:k=>({BOT_TOKEN:'test',SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'})[k]},serve:handler=>{globalThis.__newsHandler=handler}}
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('npm:@supabase/supabase-js'))return {url:new URL('./news-worker-fake.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context)}})
await import('../supabase/functions/news-publisher/index.ts')
const invoke=async(auth='test-cron',body={})=>{const r=await globalThis.__newsHandler(new Request('https://test/news-publisher',{method:'POST',headers:{'x-cron-key':auth},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()}}
function setup(){claims=[];finished=[];calls=[];reply=null;globalThis.fetch=async(url,init)=>{calls.push({method:String(url).split('/').pop(),payload:JSON.parse(init.body)});if(reply)return reply(calls.at(-1));return new Response(JSON.stringify({ok:true,result:{message_id:123}}))}}
const item=()=>({attempt_id:'test-attempt',lesson:{id:42,title:'Новость',body:'Суть инструмента.',cover_url:'https://example.org/cover.jpg'}})
test('publisher rejects unauthenticated requests without claiming or sending',async()=>{setup();claims=[item()];assert.equal((await invoke('wrong')).status,401);assert.equal(claims.length,1);assert.equal(calls.length,0)})
test('network ambiguity is persisted and stops without retrying the message',async()=>{setup();claims=[item(),item()];reply=()=>{throw Error('network')};const r=await invoke();assert.equal(r.body.reason,'uncertain');assert.equal(calls.length,1);assert.equal(finished[0].p_status,'uncertain');assert.equal(claims.length,1)})
test('Telegram rate limits are persisted with retry_after and preserve queue order',async()=>{setup();claims=[item(),item()];reply=()=>new Response(JSON.stringify({ok:false,error_code:429,parameters:{retry_after:120}}));await invoke();assert.equal(calls.length,1);assert.equal(finished[0].p_status,'failed');assert.equal(finished[0].p_retry,125);assert.equal(claims.length,1)})
test('a definitely rejected photo falls back to one concise text message',async()=>{setup();claims=[item()];reply=call=>new Response(JSON.stringify(call.method==='sendPhoto'?{ok:false,error_code:400}:{ok:true,result:{message_id:123}}));const r=await invoke();assert.equal(r.body.sent,1);assert.deepEqual(calls.map(x=>x.method),['sendPhoto','sendMessage']);assert(calls[1].payload.text.includes('https://t.me/test_bot?startapp=l42'));assert.equal(finished[0].p_status,'sent')})
test('editorial batch refuses to publish if configured chat differs from OGCRE8R',async()=>{setup();reply=()=>new Response(JSON.stringify({ok:true,result:{id:-999}}));const r=await invoke('test-cron',{mode:'editorial',batch:'test-batch'});assert.equal(r.status,409);assert.equal(r.body.error,'editorial_destination');assert.equal(calls.filter(x=>x.method==='sendMessage').length,0)})
test('refresh refuses a mismatched destination before any edit or new publication',async()=>{setup();claims=[item()];reply=()=>new Response(JSON.stringify({ok:true,result:{id:-999}}));const r=await invoke('test-cron',{mode:'refresh_news',ids:[42]});assert.equal(r.status,409);assert.equal(r.body.error,'refresh_destination');assert.equal(calls.length,1);assert.equal(claims.length,1)})
test('refresh rejects excessive batches before loading content',async()=>{setup();reply=()=>new Response(JSON.stringify({ok:true,result:{id:-100123}}));const r=await invoke('test-cron',{mode:'refresh_news',ids:Array(11).fill(42)});assert.equal(r.status,400);assert.equal(r.body.error,'refresh_ids');assert.equal(calls.length,1)})
