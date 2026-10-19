import test from 'node:test'
import assert from 'node:assert/strict'
import {registerHooks} from 'node:module'

const calls=[]
let reply={data:{code:'AA-opaque-public-code',course_title:'Public title',valid:true},error:null}
globalThis.__academyPublicDb={rpc:async(name,args)=>{calls.push({name,args});return reply}}
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',BOT_TOKEN:'test-token'})[k]},serve:handler=>{globalThis.__academyPublicHandler=handler}}
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('npm:@supabase/supabase-js'))return {url:'data:text/javascript,export function createClient(){return globalThis.__academyPublicDb}',shortCircuit:true}
 return next(specifier,context)
}})
await import('../../supabase/functions/api/index.ts')
const handler=globalThis.__academyPublicHandler
let serial=0
async function request(body,{ip=`client-${serial++}`,raw,route='academy_public',method='POST'}={}){
 const response=await handler(new Request(`https://example.test/functions/v1/api/${route}`,{method,headers:{'x-forwarded-for':ip},...(method==='POST'?{body:raw??JSON.stringify(body)}:{})}))
 return {status:response.status,body:await response.json()}
}

test('public Academy route requires no Telegram auth and only exposes opaque public lookups',async()=>{
 const before=calls.length
 const result=await request({action:'certificate_public',payload:{code:'AA-opaque-public-code',p_actor:1,is_admin:true}})
 assert.equal(result.status,200)
 assert.deepEqual(calls.at(-1),{name:'academy_certificate_public',args:{p_code:'AA-opaque-public-code'}})
 assert.equal(JSON.stringify(result.body).includes('user_id'),false)
 reply={data:{slug:'opaque-portfolio-slug',title:'Reviewed work',artifact:{text:'Public result'}},error:null}
 assert.equal((await request({action:'portfolio_public',payload:{slug:'opaque-portfolio-slug',owner_id:1}})).status,200)
 assert.deepEqual(calls.at(-1),{name:'academy_portfolio',args:{p_actor:null,p_action:'public',p_payload:{slug:'opaque-portfolio-slug'}}})
 assert.equal(calls.length,before+2)
 assert.equal((await request({action:'catalog',payload:{}},{route:'academy'})).status,401)
 assert.equal(calls.length,before+2)
})

test('public route rejects malformed shapes, short identifiers and private actions before RPC',async()=>{
 const before=calls.length
 for(const raw of ['null','[]','"text"','{broken','{"action":"certificate_public","payload":[]}','{"action":"certificate_public","payload":null}'])assert.equal((await request(null,{raw})).status,400)
 for(const code of ['', 'short', '../opaque-code', 'a'.repeat(121)])assert.equal((await request({action:'certificate_public',payload:{code}})).status,400)
 for(const action of ['admin_list','file_download','catalog','certificate','constructor'])assert.equal((await request({action,payload:{code:'AA-opaque-public-code'}})).status,404)
 assert.equal((await request(null,{raw:'x'.repeat(2001)})).status,400)
 assert.equal((await request(null,{method:'GET'})).status,404)
 assert.equal(calls.length,before)
})

test('public lookup errors do not disclose database details and IP rate limit caps RPC calls',async()=>{
 reply={data:null,error:{message:'academy_certificate_not_found'}}
 assert.deepEqual(await request({action:'certificate_public',payload:{code:'AA-missing-public-code'}}),{status:404,body:{error:'academy_certificate_not_found'}})
 reply={data:null,error:{message:'sensitive database statement'}}
 assert.deepEqual(await request({action:'certificate_public',payload:{code:'AA-opaque-public-code'}}),{status:503,body:{error:'academy_unavailable'}})
 reply={data:{valid:true},error:null}
 const before=calls.length
 for(let i=0;i<30;i++)assert.equal((await request({action:'certificate_public',payload:{code:'AA-opaque-public-code'}},{ip:'rate-limited-client'})).status,200)
 assert.equal((await request({action:'certificate_public',payload:{code:'AA-opaque-public-code'}},{ip:'rate-limited-client'})).status,429)
 assert.equal(calls.length,before+30)
 assert.equal((await request({action:'certificate_public',payload:{code:'AA-opaque-public-code'}},{ip:'other-client'})).status,200)
})
