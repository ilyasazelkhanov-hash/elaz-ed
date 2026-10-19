import { ApiError, requireValue } from './errors.ts'
import { digest, equal, hmac, utf8, randomToken, verifyInitData, verifyOidcToken } from './crypto.ts'
import type { TelegramIdentity } from './crypto.ts'
import type { Gateway } from './gateway.ts'
import { actionModules, assertRole, validateAction } from './validation.ts'

export interface ServerEnv {
  APP_URL: string; BOT_TOKEN: string; ADMIN_TELEGRAM_IDS: string; OIDC_CLIENT_ID?: string; OIDC_CLIENT_SECRET?: string;
  ALLOWED_ORIGINS?: string; WEBHOOK_SECRET?: string; CRON_SECRET?: string; SUPABASE_URL: string; INTEGRATION_WEBHOOK_SECRET?: string; ADMIN_RETURN_PATH?: string; API_PUBLIC_PATH?:string;
}
interface Dependencies { gateway: Gateway; env: ServerEnv; fetcher?: typeof fetch; now?: () => number }
const sessionName = '__Host-az-session', csrfName = '__Host-az-csrf', oidcName = '__Host-az-oidc'
const cookie = (name: string, value: string, maxAge: number, httpOnly = true) => `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`
const cookies = (request: Request) => new Map((request.headers.get('cookie') || '').split(';').map(value => { const index = value.indexOf('='); try { return [value.slice(0,index).trim(), decodeURIComponent(value.slice(index+1))] } catch { return ['',''] } }))

async function readJson(request: Request, limit = 256000, includeRaw = false): Promise<any> {
  requireValue((request.headers.get('content-type') || '').includes('application/json'), 'content_type_required', 415)
  requireValue(Number(request.headers.get('content-length') || 0) <= limit, 'request_too_large', 413)
  const reader = request.body?.getReader(); requireValue(reader, 'invalid_json')
  const parts: Uint8Array[] = []; let size = 0
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new ApiError('request_too_large', 413) } parts.push(value) }
  const bytes = new Uint8Array(size); let at = 0; for (const part of parts) { bytes.set(part,at); at += part.length }
  let data: any
  const raw = new TextDecoder().decode(bytes)
  try { data = JSON.parse(raw) } catch { throw new ApiError('invalid_json') }
  requireValue(data && typeof data === 'object' && !Array.isArray(data), 'invalid_json')
  return includeRaw ? {raw,data} : data
}

export function createHandler({ gateway: db, env, fetcher = fetch, now = Date.now }: Dependencies) {
  const app = new URL(env.APP_URL), appOrigin = app.origin
  requireValue(app.protocol === 'https:' || ['localhost','127.0.0.1'].includes(app.hostname), 'app_url_must_be_https', 500)
  const allowedOrigins = new Set([appOrigin, ...(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)])
  const owners = new Set(env.ADMIN_TELEGRAM_IDS.split(',').map(s => s.trim()).filter(Boolean))
  const publicPath=env.API_PUBLIC_PATH || '/api'
  requireValue(/^\/[a-zA-Z0-9/_-]+$/.test(publicPath)&&!publicPath.startsWith('//'),'invalid_api_public_path',500)
  const callback = `${appOrigin}${publicPath}/v1/auth/callback`
  let jwksCache: { keys: JsonWebKey[]; at: number } | undefined
  async function telegram(method: string, body: unknown) {
    const response = await fetcher(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json.ok) {
      const error = new ApiError('telegram_unavailable', 502) as ApiError & { retryAfter?: number; alreadyRefunded?: boolean }
      error.retryAfter = Number(json.parameters?.retry_after) || 0
      error.alreadyRefunded = method==='refundStarPayment' && /\b(?:CHARGE_ALREADY_REFUNDED|PAYMENT_ALREADY_REFUNDED)\b/.test(String(json.description || ''))
      throw error
    }
    return json.result
  }
  async function limit(key: string, count = 120, seconds = 60) { requireValue(await db.rpc('az_rate_limit',{p_key:key,p_limit:count,p_seconds:seconds}), 'rate_limited', 429) }
  async function settings() { return await db.rpc<any>('az_runtime_settings') }
  async function checkAccess(id: string, config: any) {
    if (config?.config?.access === 'channel') {
      requireValue(config.rules?.channelId, 'channel_not_configured', 503)
      const member = await telegram('getChatMember',{chat_id:config.rules.channelId,user_id:id})
      requireValue(['creator','administrator','member'].includes(member.status) || member.status === 'restricted' && member.is_member === true, 'channel_membership_required', 403)
    }
  }
  async function authenticate(request: Request, body: any) {
    let id: string, profile: any, csrf: string | undefined, signedStartParam: string | undefined
    if (typeof body.auth === 'string' && body.auth) {
      const identity = await verifyInitData(body.auth, env.BOT_TOKEN, now())
      id = identity.id; profile = await db.rpc<any>('az_authenticate',{p_identity:identity,p_owner:owners.has(id)})
      signedStartParam=identity.startParam
    } else {
      const jar = cookies(request), token = jar.get(sessionName)
      requireValue(token, 'authentication_required', 401)
      const session = await db.rpc<any>('az_session_get',{p_token_hash:await digest(token)})
      requireValue(session?.userId, 'session_expired', 401)
      const origin = request.headers.get('origin')
      csrf = request.headers.get('x-csrf-token') || ''
      requireValue(origin === appOrigin && csrf.length >= 32 && equal(await digest(csrf), session.csrfHash), 'csrf_failed', 403)
      id = session.userId; profile = await db.rpc<any>('az_actor',{p_actor:id})
      // Roles and employee approval are checked fresh by az_dispatch (never copied from a token).
    }
    await limit(`member:${id}`)
    const runtime=await settings(); await checkAccess(id, runtime)
    await db.rpc('az_access_confirm',{p_actor:id})
    if (signedStartParam?.startsWith('ref_') && signedStartParam!==`ref_${id}` && runtime?.config?.modules?.includes('retention')) {
      try { await db.rpc('az_dispatch',{p_actor:id,p_action:'referral.claim',p_payload:{code:signedStartParam}}) }
      catch(error) { if(!(error instanceof ApiError) || error.message!=='invalid_referral') throw error }
    }
    return { id, profile, csrf }
  }
  async function oidcIdentity(code: string, verifier: string, nonce: string): Promise<TelegramIdentity> {
    requireValue(env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET, 'oidc_not_configured', 503)
    const response = await fetcher('https://oauth.telegram.org/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:`Basic ${btoa(`${env.OIDC_CLIENT_ID}:${env.OIDC_CLIENT_SECRET}`)}`},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:callback,client_id:env.OIDC_CLIENT_ID,code_verifier:verifier}),signal:AbortSignal.timeout(15000)})
    const tokens = await response.json().catch(() => ({})); requireValue(response.ok && typeof tokens.id_token === 'string', 'oidc_exchange_failed', 401)
    const refreshKeys = async () => { const keys = await fetcher('https://oauth.telegram.org/.well-known/jwks.json',{signal:AbortSignal.timeout(10000)}); requireValue(keys.ok,'oidc_keys_unavailable',503); jwksCache={...await keys.json(),at:now()} }
    if (!jwksCache || now()-jwksCache.at>300000) await refreshKeys()
    requireValue(jwksCache && Array.isArray(jwksCache.keys), 'oidc_keys_unavailable',503)
    try { return await verifyOidcToken(tokens.id_token,jwksCache,{clientId:env.OIDC_CLIENT_ID,nonce,now:now()}) }
    catch (error) {
      if (!(error instanceof ApiError) || error.message!=='invalid_oidc_key') throw error
      await refreshKeys(); requireValue(jwksCache && Array.isArray(jwksCache.keys),'oidc_keys_unavailable',503)
      return verifyOidcToken(tokens.id_token,jwksCache,{clientId:env.OIDC_CLIENT_ID,nonce,now:now()})
    }
  }
  async function deliverRefunds(jobs: any[]) {
    let succeeded=0
    await Promise.all(jobs.map(async job=>{
      try {
        try { await telegram('refundStarPayment',{user_id:job.userId,telegram_payment_charge_id:job.chargeId}) }
        catch(error) { if(!(error as any)?.alreadyRefunded) throw error }
        await db.rpc('az_refunds_finish',{p_id:job.id,p_lease:job.leaseToken,p_success:true}); succeeded++
      } catch(error) { await db.rpc('az_refunds_finish',{p_id:job.id,p_lease:job.leaseToken,p_success:false,p_error:error instanceof ApiError?error.message:'refund_delivery_failed',p_retry:(error as any)?.retryAfter || 0}) }
    }))
    return succeeded
  }
  async function run(request: Request, route: string, headers: Headers): Promise<Response> {
    const response = (body: unknown, status=200) => Response.json(body,{status,headers})
    const jar = cookies(request), url = new URL(request.url)
    if (route === '/health' && request.method === 'GET') return response({ok:true,version:'1'})
    if (route === '/auth/login' && request.method === 'GET') {
      requireValue(env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET, 'oidc_not_configured',503)
      await limit('oidc:global',1000); await limit(`oidc:${request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'}`,20)
      const state=randomToken(), browser=randomToken(), nonce=randomToken(), verifier=randomToken()
      await db.rpc('az_oidc_begin',{p_state_hash:await digest(state),p_browser_hash:await digest(browser),p_nonce:nonce,p_verifier:verifier})
      const login = new URL('https://oauth.telegram.org/auth'); login.search=new URLSearchParams({client_id:env.OIDC_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'openid profile',state,nonce,code_challenge:await digest(verifier),code_challenge_method:'S256'}).toString()
      headers.append('Set-Cookie',cookie(oidcName,browser,300)); headers.set('Location',login.href)
      return new Response(null,{status:302,headers})
    }
    if (route === '/auth/callback' && request.method === 'GET') {
      const state=url.searchParams.get('state'), code=url.searchParams.get('code'), browser=jar.get(oidcName)
      requireValue(state && code && browser && state.length<=100 && code.length<=4096,'invalid_oidc_callback',401)
      const saved = await db.rpc<any>('az_oidc_consume',{p_state_hash:await digest(state),p_browser_hash:await digest(browser)})
      const identity=await oidcIdentity(code,saved.verifier,saved.nonce)
      const member=await db.rpc<any>('az_authenticate',{p_identity:identity,p_owner:owners.has(identity.id)})
      requireValue(member.role !== 'member','admin_access_required',403)
      await checkAccess(identity.id,await settings())
      const token=randomToken(), csrf=randomToken()
      await db.rpc('az_session_create',{p_actor:identity.id,p_token_hash:await digest(token),p_csrf_hash:await digest(csrf)})
      const returnPath=env.ADMIN_RETURN_PATH || '/admin'
      requireValue(returnPath.startsWith('/')&&!returnPath.startsWith('//')&&!returnPath.includes('\\'),'invalid_admin_return_path',500)
      headers.append('Set-Cookie',cookie(oidcName,'',0)); headers.append('Set-Cookie',cookie(sessionName,token,28800)); headers.append('Set-Cookie',cookie(csrfName,csrf,28800,false)); headers.set('Location',`${appOrigin}${returnPath}`)
      return new Response(null,{status:302,headers})
    }
    if (route === '/auth/session' && request.method === 'GET') {
      requireValue(!request.headers.has('origin') || request.headers.get('origin')===appOrigin,'origin_forbidden',403)
      const token=jar.get(sessionName), csrf=jar.get(csrfName); requireValue(token && csrf,'authentication_required',401)
      const session=await db.rpc<any>('az_session_get',{p_token_hash:await digest(token)})
      requireValue(session && equal(session.csrfHash,await digest(csrf)),'session_expired',401)
      return response({csrf,userId:session.userId})
    }
    if (route.startsWith('/certificates/') && request.method==='GET') {
      const code=route.slice('/certificates/'.length); requireValue(/^[a-f0-9]{32}$/.test(code),'certificate_not_found',404)
      await limit('certificate:global',300)
      const certificate=await db.rpc('az_certificate_verify',{p_code:code}); requireValue(certificate,'certificate_not_found',404); return response(certificate)
    }
    if (route==='/webhook' && request.method==='POST') {
      requireValue(env.WEBHOOK_SECRET && equal(request.headers.get('x-telegram-bot-api-secret-token') || '',env.WEBHOOK_SECRET),'invalid_webhook_secret',401)
      const update=await readJson(request); requireValue(Number.isSafeInteger(update.update_id),'invalid_update')
      const result=await db.rpc<any>('az_webhook',{p_update:update})
      // This call is awaited. Telegram can retry the durable inbox response if delivery fails.
      if (result.preCheckoutId) await telegram('answerPreCheckoutQuery',{pre_checkout_query_id:result.preCheckoutId,ok:result.accepted,...(!result.accepted?{error_message:'This invoice is no longer valid. Please reopen the course.'}:{})})
      return response({ok:true})
    }
    if(route==='/integrations/events' && request.method==='POST') {
      requireValue(env.INTEGRATION_WEBHOOK_SECRET,'integration_not_configured',503)
      const timestamp=request.headers.get('x-az-timestamp')||'', signature=(request.headers.get('x-az-signature')||'').replace(/^sha256=/,'')
      requireValue(/^\d{10}$/.test(timestamp)&&Math.abs(now()/1000-Number(timestamp))<=300&&/^[a-f0-9]{64}$/.test(signature),'invalid_integration_signature',401)
      const {raw,data}=await readJson(request,256000,true)
      const expected=[...await hmac(utf8(env.INTEGRATION_WEBHOOK_SECRET),`${timestamp}.${raw}`)].map(b=>b.toString(16).padStart(2,'0')).join('')
      requireValue(equal(signature,expected),'invalid_integration_signature',401)
      requireValue(typeof data.id==='string'&&/^[a-zA-Z0-9._:-]{1,120}$/.test(data.id)&&['visit.confirmed','purchase.confirmed','order.status','employee.approved'].includes(data.type)&&data.data&&typeof data.data==='object'&&!Array.isArray(data.data),'invalid_integration_event')
      await limit('integration:global',120)
      const result=await db.rpc<any>('az_integration_event',{p_event:data})
      return response(result,result.ok?200:409)
    }
    if ((route==='/jobs/run' || route==='/jobs/produce') && request.method==='POST') {
      requireValue(env.CRON_SECRET && equal(request.headers.get('authorization') || '',`Bearer ${env.CRON_SECRET}`),'invalid_cron_secret',401)
      const produced=await db.rpc('az_jobs_produce')
      if(route==='/jobs/produce') return response(produced)
      const refunds=await db.rpc<any[]>('az_refunds_claim',{p_limit:5}) || []
      const refundsSucceeded=await deliverRefunds(refunds)
      const jobs=await db.rpc<any[]>('az_jobs_claim',{p_limit:20}); let sent=0
      // Lease gives at-least-once delivery; Telegram sendMessage has no idempotency key.
      for (let start=0;start<jobs.length;start+=4) await Promise.all(jobs.slice(start,start+4).map(async job => {
        try { await telegram('sendMessage',{chat_id:job.userId,text:`${job.title}\n\n${job.body}`.slice(0,4096)}); await db.rpc('az_jobs_finish',{p_id:job.id,p_lease:job.leaseToken,p_success:true}); sent++ }
        catch (error) { await db.rpc('az_jobs_finish',{p_id:job.id,p_lease:job.leaseToken,p_success:false,p_error:error instanceof ApiError?error.message:'delivery_failed',p_retry:(error as any)?.retryAfter || 0}) }
      }))
      return response({claimed:jobs.length,sent,refundsClaimed:refunds.length,refundsSucceeded})
    }
    requireValue(request.method==='POST','method_not_allowed',405)
    requireValue(['/dispatch','/provision','/auth/logout'].includes(route),'not_found',404)
    const body=await readJson(request,route==='/provision'?2000000:256000)
    if (route==='/dispatch') validateAction(body.action,body.payload ?? {})
    const actor=await authenticate(request,body)
    if (route==='/auth/logout') {
      const token=jar.get(sessionName); if(token) await db.rpc('az_session_delete',{p_token_hash:await digest(token)})
      headers.append('Set-Cookie',cookie(sessionName,'',0)); headers.append('Set-Cookie',cookie(csrfName,'',0,false)); return response({ok:true})
    }
    if (route==='/provision') return response(await db.rpc('az_provision',{p_actor:actor.id,p_config:body.config,p_brand:body.brand,p_entities:body.entities || [],p_rules:body.rules || {}}))
    const action=body.action as string, payload=body.payload ?? {}
    if(actor.profile) assertRole(action,actor.profile.role)
    if(action==='admin.refund') {
      const refund=await db.rpc<any>('az_refund_request',{p_actor:actor.id,p_invoice_id:payload.invoiceId,p_reason:payload.reason || ''})
      const jobs=await db.rpc<any[]>('az_refunds_claim',{p_limit:1,p_invoice_id:payload.invoiceId})
      await deliverRefunds(jobs)
      return response({snapshot:await db.rpc('az_snapshot',{p_actor:actor.id}),result:{refund:await db.rpc('az_refund_get',{p_actor:actor.id,p_job_id:refund.id})}})
    }
    if(action==='stars.invoice') {
      const invoice=await db.rpc<any>('az_invoice_prepare',{p_actor:actor.id,p_entity_id:payload.entityId})
      const link=await telegram('createInvoiceLink',{title:invoice.title.slice(0,32),description:invoice.description,payload:invoice.invoiceId,provider_token:'',currency:'XTR',...(invoice.subscriptionPeriod?{subscription_period:invoice.subscriptionPeriod}:{}),prices:[{label:invoice.title.slice(0,32),amount:invoice.amount}]})
      return response({snapshot:await db.rpc('az_snapshot',{p_actor:actor.id}),result:{link}})
    }
    if(action==='file.upload-url' || action==='file.download-url') {
      const file=action==='file.upload-url'?await db.rpc<any>('az_file_create',{p_actor:actor.id,p_filename:payload.filename,p_type:payload.contentType,p_purpose:payload.purpose}):await db.rpc<any>('az_file_get',{p_actor:actor.id,p_file_id:payload.fileId})
      const signed=await db.storage(`/object/${action==='file.upload-url'?'upload/sign':'sign'}/az-private/${file.path}`,action==='file.upload-url'?{}:{expiresIn:300})
      const path=signed.url || signed.signedURL || signed.signedUrl
      requireValue(typeof path==='string','storage_unavailable',502)
      const signedUrl=path.startsWith('http')?path:`${env.SUPABASE_URL}/storage/v1${path}`
      return response({snapshot:await db.rpc('az_snapshot',{p_actor:actor.id}),result:{...file,url:signedUrl,...(signed.token?{token:signed.token}:{})}})
    }
    const module=actionModules[action]; if(module) requireValue((await settings())?.config?.modules?.includes(module),'module_disabled',403)
    return response(await db.rpc('az_dispatch',{p_actor:actor.id,p_action:action,p_payload:payload}))
  }
  return async (request: Request): Promise<Response> => {
    const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'})
    try {
      const origin=request.headers.get('origin')
      requireValue(!origin || allowedOrigins.has(origin),'origin_forbidden',403)
      if(origin) { headers.set('Access-Control-Allow-Origin',origin); headers.set('Access-Control-Allow-Credentials','true') }
      if(request.method==='OPTIONS') { headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS'); headers.set('Access-Control-Allow-Headers','content-type,x-csrf-token,authorization,apikey'); return new Response(null,{status:204,headers}) }
      const pathname=new URL(request.url).pathname
      const route=pathname.replace(/^(?:.*\/(?:az-)?master-api|\/api)?\/v1(?=\/|$)/,'')
      return await run(request,route,headers)
    } catch(error) {
      // Never log request bodies, Telegram URLs, cookies, tokens, or upstream error text.
      return Response.json({error:error instanceof ApiError?error.message:'internal_error'},{status:error instanceof ApiError?error.status:500,headers})
    }
  }
}
