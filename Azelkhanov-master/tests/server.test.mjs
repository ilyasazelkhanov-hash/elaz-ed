import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../server/errors.ts'
import { base64url, digest, equal, hmac, telegramId, utf8, verifyInitData, verifyOidcToken } from '../server/crypto.ts'
import { assertRole, validateAction } from '../server/validation.ts'
import { createGateway } from '../server/gateway.ts'
import { createHandler } from '../server/handler.ts'

const now=Date.UTC(2026,9,17,12), bot='123:test-secret'
async function signedInit(extra={}, user={id:1234567890123,first_name:'Test',last_name:'Member',username:'test'}) {
  const params=new URLSearchParams({auth_date:String(now/1000),query_id:'query',user:JSON.stringify(user),...extra})
  const check=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n')
  const secret=await hmac(utf8('WebAppData'),bot)
  params.set('hash',[...await hmac(secret,check)].map(v=>v.toString(16).padStart(2,'0')).join(''))
  return params.toString()
}
test('Telegram initData real HMAC validates user and signed invite only', async()=>{
  const data=await signedInit({start_param:'invite-token'})
  assert.deepEqual(await verifyInitData(data,bot,now),{id:'1234567890123',name:'Test Member',username:'test',startParam:'invite-token'})
  await assert.rejects(verifyInitData(data.replace('invite-token','stolen'),bot,now),/invalid_auth/)
  await assert.rejects(verifyInitData(data,bot+'x',now),/invalid_auth/)
  await assert.rejects(verifyInitData(data+'&user=x',bot,now),/invalid_auth/)
})
test('Telegram auth_date rejects past and future and invalid JSON/identity',async()=>{
  await assert.rejects(verifyInitData(await signedInit({auth_date:String(now/1000-3601)}),bot,now),/expired_auth/)
  await assert.rejects(verifyInitData(await signedInit({auth_date:String(now/1000+31)}),bot,now),/expired_auth/)
  await assert.rejects(verifyInitData(await signedInit({}, {id:0}),bot,now),/invalid_telegram_id/)
  await assert.rejects(verifyInitData(await signedInit({user:'invalid-json'}),bot,now),e=>e instanceof ApiError && e.status===401)
  assert.throws(()=>telegramId(9007199254740992),/invalid_telegram_id/)
  assert.equal(telegramId('9223372036854775807'),'9223372036854775807')
  assert.throws(()=>telegramId('9223372036854775808'),/invalid_telegram_id/)
  assert.equal(equal('abc','abc'),true); assert.equal(equal('abc','abcd'),false)
})

test('OIDC uses verified profile.id and validates RSA signature, issuer, audience, nonce and time',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify'])
  const publicJwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'}
  const claims={iss:'https://oauth.telegram.org',aud:'client',sub:'different-oidc-subject',id:1234567890123,name:'Admin',preferred_username:'admin',iat:now/1000,exp:now/1000+300,nonce:'nonce'}
  async function token(changes={},header={alg:'RS256',kid:'test-key'}) {
    const body=[base64url(utf8(JSON.stringify(header))),base64url(utf8(JSON.stringify({...claims,...changes})))].join('.')
    return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,utf8(body))))}`
  }
  const verify=async value=>verifyOidcToken(value,{keys:[publicJwk]},{clientId:'client',nonce:'nonce',now})
  assert.equal((await verify(await token())).id,'1234567890123')
  for(const changes of [{id:undefined},{iss:'https://evil.test'},{aud:'attacker'},{nonce:'wrong'},{exp:now/1000-1},{iat:now/1000+100},{iat:now/1000-601}]) await assert.rejects(verify(await token(changes)))
  await assert.rejects(verify(await token({},{alg:'none',kid:'test-key'})),/unsupported_oidc_algorithm/)
  const valid=await token(); await assert.rejects(verify(valid.slice(0,-5)+'XXXXX'),/invalid_oidc_signature/)
  await assert.rejects(verifyOidcToken(valid,{keys:[]},{clientId:'client',nonce:'nonce',now}),/invalid_oidc_key/)
})
test('action validation rejects malformed and unsupported payloads before storage',()=>{
  for(const [action,payload] of [['unknown',{}],['order.create',{items:[]}],['order.create',{items:[{entityId:'p',quantity:-1,variant:''}]}],['quiz.answer',{attemptId:'x',index:0,answer:-1}],['admin.member.update',{userId:'1',role:'superuser'}],['admin.points.adjust',{userId:'1',delta:1.5,ref:'x',reason:'x'}],['profile.update',{quietFrom:24}],['profile.update',{timezone:'Not/A_Timezone'}],['file.upload-url',{filename:'evil.exe',contentType:'application/x-msdownload',purpose:'content'}],['post.create',{body:'x'.repeat(5001)}]]) assert.throws(()=>validateAction(action,payload))
  validateAction('order.create',{requestId:crypto.randomUUID(),items:[{entityId:'p',quantity:2,variant:'large'}]})
  validateAction('profile.update',{notificationOptIn:false,timezone:'Asia/Qyzylorda',quietFrom:22,quietTo:8})
})
test('RBAC action roles least privilege at server layer',()=>{
  for(const role of ['member','editor','analyst','mentor','campaign_manager']) assert.throws(()=>assertRole('coupon.redeem',role),/forbidden/)
  assertRole('coupon.redeem','cashier'); assertRole('coupon.redeem','owner'); assertRole('homework.review','mentor')
  assert.throws(()=>assertRole('admin.member.update','editor'),/forbidden/)
})

const env={APP_URL:'https://app.example',BOT_TOKEN:bot,ADMIN_TELEGRAM_IDS:'1',SUPABASE_URL:'https://project.supabase.co',WEBHOOK_SECRET:'webhook',CRON_SECRET:'cron',OIDC_CLIENT_ID:'client',OIDC_CLIENT_SECRET:'secret'}
function harness(overrides={}, fetcher=async()=>Response.json({ok:true,result:{}})) {
  const calls=[], settings={config:{modules:['content','progress','learning','campaigns','loyalty','commerce','events','community','team','retention'],access:'telegram'},rules:{}}
  const member={id:'1234567890123',role:'member'}
  const defaults={az_rate_limit:true,az_authenticate:member,az_runtime_settings:settings,az_dispatch:{snapshot:{me:member},result:{}},az_snapshot:{me:member}}
  const gateway={rpc:async(name,args)=>{calls.push({name,args}); const value=Object.hasOwn(overrides,name)?overrides[name]:defaults[name]; return typeof value==='function'?await value(args):value },storage:async(path,body)=>{calls.push({name:'storage',args:{path,body}});return {url:'/object/upload/sign/az-private/123/file?token=abc',token:'abc'}}}
  return {calls,settings,handler:createHandler({gateway,env,fetcher,now:()=>now})}
}
function post(path,body,headers={}){return new Request(`https://project.supabase.co/functions/v1/master-api/v1${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
test('handler signed dispatch uses authenticated identity, ignores fake actor fields and returns contract',async()=>{
  const h=harness(), res=await h.handler(post('/dispatch',{auth:await signedInit(),action:'daily.claim',payload:{},userId:'1',role:'owner'},{origin:'https://app.example'}))
  assert.equal(res.status,200); assert.equal((await res.json()).snapshot.me.id,'1234567890123')
  assert.equal(h.calls.find(c=>c.name==='az_authenticate').args.p_owner,false)
  assert.equal(h.calls.find(c=>c.name==='az_dispatch').args.p_actor,'1234567890123')
  assert.equal(res.headers.get('Access-Control-Allow-Origin'),'https://app.example')
})
test('handler unauthenticated, malformed, forbidden origin and disabled module requests fail closed',async()=>{
  const h=harness()
  assert.equal((await h.handler(post('/dispatch',{action:'bootstrap'}))).status,401)
  assert.equal((await h.handler(post('/dispatch',{action:'nonsense'}))).status,404)
  assert.equal((await h.handler(post('/dispatch',{action:'bootstrap'},{origin:'https://evil.test'}))).status,403)
  assert.equal((await h.handler(new Request('https://app.example/api/v1/dispatch',{method:'POST',headers:{'Content-Type':'application/json'},body:'bad'}))).status,400)
  h.settings.config.modules=[]
  const res=await h.handler(post('/dispatch',{auth:await signedInit(),action:'daily.claim',payload:{}}))
  assert.equal(res.status,403); assert.equal((await res.json()).error,'module_disabled')
  assert.equal(h.calls.filter(c=>c.name==='az_dispatch').length,0)
})
test('cookie mutations require exact origin and CSRF hash; role fetched freshly',async()=>{
  const csrf='x'.repeat(43), session={userId:'5',csrfHash:await digest(csrf)}
  const h=harness({az_session_get:session,az_actor:{id:'5',role:'mentor'}}), cookie='__Host-az-session=session-token'
  assert.equal((await h.handler(post('/dispatch',{action:'bootstrap'},{cookie}))).status,403)
  assert.equal((await h.handler(post('/dispatch',{action:'bootstrap'},{cookie,origin:'https://app.example','x-csrf-token':'bad'}))).status,403)
  assert.equal((await h.handler(post('/dispatch',{action:'bootstrap'},{cookie,origin:'https://app.example','x-csrf-token':csrf}))).status,200)
  assert.equal((await h.handler(post('/dispatch',{action:'admin.member.update',payload:{userId:'2',role:'admin'}},{cookie,origin:'https://app.example','x-csrf-token':csrf}))).status,403)
  assert.ok(h.calls.find(c=>c.name==='az_actor'))
})
test('channel mode checks Telegram membership on each call',async()=>{
  let checks=0
  const h=harness({},async()=>{checks++;return Response.json({ok:true,result:{status:'left'}})})
  h.settings.config.access='channel';h.settings.rules.channelId='-100123'
  const res=await h.handler(post('/dispatch',{auth:await signedInit(),action:'bootstrap'}))
  assert.equal(res.status,403); assert.equal((await res.json()).error,'channel_membership_required'); assert.equal(checks,1)
  assert.equal(h.calls.filter(c=>c.name==='az_dispatch').length,0)
})
test('OIDC login persists state with browser binding, nonce and PKCE; secure cookies, same-origin callback',async()=>{
  const h=harness(), res=await h.handler(new Request('https://app.example/api/v1/auth/login'))
  assert.equal(res.status,302)
  const location=new URL(res.headers.get('Location'))
  assert.equal(location.origin,'https://oauth.telegram.org')
  assert.equal(location.searchParams.get('redirect_uri'),'https://app.example/api/v1/auth/callback')
  assert.equal(location.searchParams.get('scope'),'openid profile')
  assert.equal(location.searchParams.get('code_challenge_method'),'S256')
  const saved=h.calls.find(c=>c.name==='az_oidc_begin').args
  assert.equal(saved.p_state_hash,await digest(location.searchParams.get('state')))
  assert.equal(saved.p_nonce,location.searchParams.get('nonce'))
  assert.equal(await digest(saved.p_verifier),location.searchParams.get('code_challenge'))
  assert.match(res.headers.get('set-cookie'),/Secure; SameSite=Lax; HttpOnly/)
})
test('webhook secret verified before DB, durable response then awaited precheckout API',async()=>{
  const events=[]
  const h=harness({az_webhook:()=>{events.push('database');return {preCheckoutId:'pc',accepted:true}}},async(url,options)=>{events.push('telegram');assert.match(url,/answerPreCheckoutQuery$/);assert.equal(JSON.parse(options.body).ok,true);return Response.json({ok:true,result:true})})
  assert.equal((await h.handler(post('/webhook',{update_id:1}))).status,401)
  assert.deepEqual(events,[])
  assert.equal((await h.handler(post('/webhook',{update_id:1},{'x-telegram-bot-api-secret-token':'webhook'}))).status,200)
  assert.deepEqual(events,['database','telegram'])
})
test('notification worker awaits every Telegram send and persists success or retry',async()=>{
  const jobs=[{id:'a',leaseToken:'lease-a',userId:'2',title:'title',body:'body'},{id:'b',leaseToken:'lease-b',userId:'3',title:'title',body:'body'}]
  let sends=0
  const h=harness({az_jobs_claim:jobs},async()=>{sends++;return sends===1?Response.json({ok:true,result:true}):Response.json({ok:false,parameters:{retry_after:40}},{status:429})})
  assert.equal((await h.handler(post('/jobs/run',{}))).status,401)
  const res=await h.handler(post('/jobs/run',{}, {authorization:'Bearer cron'}))
  assert.deepEqual(await res.json(),{claimed:2,sent:1,refundsClaimed:0,refundsSucceeded:0})
  const outcomes=h.calls.filter(c=>c.name==='az_jobs_finish').map(c=>c.args)
  assert.equal(outcomes[0].p_success,true);assert.equal(outcomes[1].p_success,false);assert.equal(outcomes[1].p_retry,40)
})
test('private file URL created only after DB authorization',async()=>{
  const h=harness({az_file_get:()=>{throw new ApiError('file_forbidden',403)}})
  const res=await h.handler(post('/dispatch',{auth:await signedInit(),action:'file.download-url',payload:{fileId:'other'}}))
  assert.equal(res.status,403);assert.equal(h.calls.some(c=>c.name==='storage'),false)
})
test('public certificate endpoint exposes exactly the verification record',async()=>{
  const h=harness({az_certificate_verify:{name:'Member',course:'Course',date:'2026-10-17'}})
  const res=await h.handler(new Request('https://app.example/api/v1/certificates/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))
  assert.equal(res.status,200);assert.deepEqual(await res.json(),{name:'Member',course:'Course',date:'2026-10-17'})
})
test('gateway uses secret apikey correctly and conceals upstream SQL error details',async()=>{
  let seen
  const gateway=createGateway('https://project.supabase.co','sb_secret_test',async(url,options)=>{seen={url,options};return Response.json({value:1})})
  await gateway.rpc('az_snapshot',{p_actor:'2'})
  assert.equal(seen.options.headers.apikey,'sb_secret_test');assert.equal(seen.options.headers.Authorization,undefined)
  const bad=createGateway('https://project.supabase.co','eyJlegacy',async()=>Response.json({message:'SQL error with private details: secret'},{status:400}))
  await assert.rejects(bad.rpc('az_dispatch'),e=>e instanceof ApiError && e.message==='database_error')
})
test('gateway retries only guaranteed-rolled-back serialization/deadlock errors',async()=>{
  let calls=0
  const gateway=createGateway('https://project.supabase.co','sb_secret_test',async()=>++calls<3?Response.json({code:'40P01',message:'deadlock detected'},{status:500}):Response.json({ok:true}))
  assert.deepEqual(await gateway.rpc('az_dispatch'),{ok:true});assert.equal(calls,3)
  let failures=0
  const network=createGateway('https://project.supabase.co','sb_secret_test',async()=>{failures++;throw new Error('network_failed')})
  await assert.rejects(network.rpc('az_dispatch'),/network_failed/);assert.equal(failures,1)
})
test('signed referral start parameter credits only after actual membership access verification',async()=>{
  let allowed=false
  const h=harness({},async()=>Response.json({ok:true,result:{status:allowed?'member':'left'}}))
  h.settings.config.access='channel';h.settings.rules.channelId='-100123'
  const body={auth:await signedInit({start_param:'ref_99'}),action:'bootstrap',payload:{}}
  assert.equal((await h.handler(post('/dispatch',body))).status,403)
  assert.equal(h.calls.some(c=>c.name==='az_dispatch' && c.args.p_action==='referral.claim'),false)
  allowed=true
  assert.equal((await h.handler(post('/dispatch',body))).status,200)
  const confirmed=h.calls.findIndex(c=>c.name==='az_access_confirm')
  const credited=h.calls.findIndex(c=>c.name==='az_dispatch' && c.args.p_action==='referral.claim')
  assert.ok(confirmed>=0 && credited>confirmed)
  assert.equal(h.calls[credited].args.p_payload.code,'ref_99')
})
test('admin refund action uses durable server charge data and awaits Telegram then acknowledgement',async()=>{
  const events=[], id='11111111-1111-4111-8111-111111111111'
  const h=harness({az_authenticate:{id:'1',role:'owner'},az_refund_request:()=>{events.push('persist');return {id,status:'pending'}},az_refunds_claim:[{id,invoiceId:id,leaseToken:'lease',userId:'3',chargeId:'server-charge'}],az_refunds_finish:args=>{events.push(args.p_success?'ack-success':'ack-failure')},az_refund_get:{id,status:'succeeded'}},async(url,options)=>{
    events.push('telegram');assert.match(url,/refundStarPayment$/);assert.deepEqual(JSON.parse(options.body),{user_id:'3',telegram_payment_charge_id:'server-charge'});return Response.json({ok:true,result:true})
  })
  const response=await h.handler(post('/dispatch',{auth:await signedInit({}, {id:1,first_name:'Owner'}),action:'admin.refund',payload:{invoiceId:id,chargeId:'attacker-charge'}}))
  assert.equal(response.status,200);assert.equal((await response.json()).result.refund.status,'succeeded');assert.deepEqual(events,['persist','telegram','ack-success'])
})
test('ambiguous refund network failure remains queued; explicit already-refunded response reconciles success',async()=>{
  const id='11111111-1111-4111-8111-111111111111', outcomes=[]
  let already=false
  const h=harness({az_authenticate:{id:'1',role:'owner'},az_refund_request:{id,status:'pending'},az_refunds_claim:[{id,invoiceId:id,leaseToken:'lease',userId:'3',chargeId:'charge'}],az_refunds_finish:args=>{outcomes.push(args.p_success)},az_refund_get:{id,status:'pending'}},async()=>{if(!already) throw new Error('timeout_after_send');return Response.json({ok:false,description:'Bad Request: CHARGE_ALREADY_REFUNDED'},{status:400})})
  const body={auth:await signedInit({}, {id:1,first_name:'Owner'}),action:'admin.refund',payload:{invoiceId:id}}
  assert.equal((await h.handler(post('/dispatch',body))).status,200);assert.deepEqual(outcomes,[false])
  already=true
  assert.equal((await h.handler(post('/dispatch',body))).status,200);assert.deepEqual(outcomes,[false,true])
})
test('signed upload result contains usable private Supabase URL and file ID',async()=>{
  const h=harness({az_file_create:{fileId:'file-id',path:'123/file'}})
  const response=await h.handler(post('/dispatch',{auth:await signedInit(),action:'file.upload-url',payload:{filename:'homework.pdf',contentType:'application/pdf',purpose:'homework'}}))
  assert.equal(response.status,200)
  const result=(await response.json()).result
  assert.equal(result.fileId,'file-id');assert.equal(result.url,'https://project.supabase.co/storage/v1/object/upload/sign/az-private/123/file?token=abc')
  assert.equal(h.calls.find(c=>c.name==='storage').args.path,'/object/upload/sign/az-private/123/file')
})
