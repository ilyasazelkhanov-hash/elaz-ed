import { isGifCoverUrl } from '../_shared/cover-media.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { newsTelegramPost } from '../_shared/news.ts'
import { publishEditorialBatch } from '../_shared/editorial.ts'
import { refreshNewsMessage } from '../_shared/newsRefresh.ts'

const token = Deno.env.get('BOT_TOKEN') ?? ''
let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
if (!key) { const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); key = String(keys.default ?? Object.values(keys)[0] ?? '') }
const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', key, {auth:{persistSession:false,autoRefreshToken:false}})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json'}})
const equal = (a: string, b: string) => { let diff=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return diff===0 }
async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)})
  // A timeout/server response cannot prove whether Telegram accepted the send.
  if(response.status===408||response.status>=500)throw new Error('telegram_unknown_delivery')
  const result=await response.json()
  if(!response.ok&&result?.ok===true)throw new Error('telegram_invalid_status')
  return result
}

Deno.serve(async req => {
 try {
  if(req.method!=='POST')return json({error:'not_found'},404)
  const settings=await db.from('settings').select('key,value').in('key',['cron_key','news_publishing','bot'])
  if(settings.error)throw new Error('settings')
  const s=Object.fromEntries((settings.data??[]).map(r=>[r.key,r.value]))
  if(!s.cron_key||!equal(req.headers.get('x-cron-key')??'',String(s.cron_key)))return json({error:'unauthorized'},401)
  const input=await req.json().catch(()=>({}))
  if(input.mode==='inspect'){
   const chat=await telegram('getChat',{chat_id:'@OGCRE8R'})
   if(!chat.ok)return json({ok:false,stage:'getChat',description:chat.description})
   const member=await telegram('getChatMember',{chat_id:chat.result.id,user_id:s.bot?.id})
   const m=member.result??{}
   const allowed=member.ok&&(['creator','administrator'].includes(m.status)||(chat.result.type!=='channel'&&m.status==='member')||(m.status==='restricted'&&m.is_member&&m.can_send_messages))
   const ready=allowed&&(chat.result.type!=='channel'||m.status==='creator'||m.can_post_messages===true)
   return json({ok:!!ready,chat:{id:chat.result.id,title:chat.result.title,username:chat.result.username,type:chat.result.type},bot_status:m.status,can_post:m.can_post_messages,description:member.description})
  }
  const cfg=s.news_publishing
  if(!cfg?.enabled||!Number.isSafeInteger(cfg.chat_id)||!s.bot?.username)return json({ok:true,sent:0,reason:'disabled'})
  if(input.mode==='editorial'){
   const target=await telegram('getChat',{chat_id:'@OGCRE8R'})
   if(!target.ok||target.result?.id!==cfg.chat_id)return json({error:'editorial_destination'},409)
   return json(await publishEditorialBatch(db,telegram,cfg.chat_id,String(input.batch??'')))
  }
  if(input.mode==='refresh_news'){
   const target=await telegram('getChat',{chat_id:'@OGCRE8R'})
   if(!target.ok||target.result?.id!==cfg.chat_id)return json({error:'refresh_destination'},409)
   if(!Array.isArray(input.ids)||input.ids.length>10||!input.ids.every((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>0))return json({error:'refresh_ids'},400)
   const receipts=await db.from('news_publications').select('lesson_id,message_id').eq('chat_id',cfg.chat_id).eq('status','sent').in('lesson_id',input.ids)
   const lessons=await db.from('lessons').select('id,title,subtitle,body,cover_url').in('id',input.ids)
   if(receipts.error||lessons.error)throw new Error('refresh_load')
   const results=[]
   for(const receipt of receipts.data??[]){
    const lesson=lessons.data?.find(l=>l.id===receipt.lesson_id)
    if(!lesson||!Number.isSafeInteger(receipt.message_id))continue
    const result=await refreshNewsMessage(telegram,cfg.chat_id,receipt.message_id,lesson,s.bot)
    results.push({lesson_id:lesson.id,message_id:receipt.message_id,...result})
    if(!result.ok)break
   }
   return json({ok:results.length===input.ids.length&&results.every(r=>r.ok),results})
  }
  let sent=0
  const deliveries: Array<{lesson_id:number,message_id:number,requested:string,delivered:string,fallback:boolean}> = []
  for(let i=0;i<10;i++){
   const claimed=await db.rpc('claim_news_post',{p_chat:cfg.chat_id})
   if(claimed.error)throw new Error('claim')
   if(!claimed.data)break
   const {lesson,attempt_id}=claimed.data
   const post=newsTelegramPost(lesson,s.bot)
   let result;let status='failed';let messageId=null;let error=null;let retry=60
   const requested=lesson.cover_url?(isGifCoverUrl(lesson.cover_url)?'animation':'photo'):'text'
   let fallback=false
   const markup={inline_keyboard:[[{text:'Читать полностью',url:post.link}]]}
   try{
    if(lesson.cover_url){
     const animated = isGifCoverUrl(lesson.cover_url)
     result=await telegram(animated ? 'sendAnimation' : 'sendPhoto',{chat_id:cfg.chat_id,[animated ? 'animation' : 'photo']:lesson.cover_url,caption:post.text,parse_mode:'HTML',reply_markup:markup})
     // A definite 400 means Telegram rejected the media; no message was sent.
     if(result?.ok===false&&result.error_code===400){
      fallback=true
      result=await telegram('sendMessage',{chat_id:cfg.chat_id,text:post.text,parse_mode:'HTML',reply_markup:markup,link_preview_options:{is_disabled:true}})
     }
    }else result=await telegram('sendMessage',{chat_id:cfg.chat_id,text:post.text,parse_mode:'HTML',reply_markup:markup,link_preview_options:{is_disabled:true}})
    if(result?.ok===true&&Number.isSafeInteger(result.result?.message_id)&&result.result.message_id>0){status='sent';messageId=result.result.message_id;error=fallback?'media_400_text_fallback':null}
    else if(result?.ok===true){status='uncertain';error='missing_message_id'}
    else if(result?.ok===false&&[400,401,403,404,409,429].includes(result.error_code)){error=`telegram_${result.error_code}`;retry=Math.max(60,Number(result.parameters?.retry_after??0)+5)}
    else {status='uncertain';error='invalid_delivery_response'}
   }catch{status='uncertain';error='network_unknown_delivery'}
   const finished=await db.rpc('finish_news_post',{p_chat:cfg.chat_id,p_lesson:lesson.id,p_attempt:attempt_id,p_status:status,p_message:messageId,p_error:error,p_retry:retry})
   if(finished.error||!finished.data)return json({ok:false,sent,deliveries,reason:'delivery_record_failed'},500)
   if(status!=='sent')return json({ok:false,sent,deliveries,reason:status,error})
   // A message ID proves acceptance, not a GIF. Report only fields Telegram returned.
   const message=result.result
   const delivered=message.animation?.file_id?'animation':Array.isArray(message.photo)&&message.photo.some((p:any)=>p?.file_id)?'photo':typeof message.text==='string'?'text':'unknown'
   const evidence={lesson_id:lesson.id,message_id:messageId!,requested,delivered,fallback}
   deliveries.push(evidence)
   // No token, source URL, caption or response body is logged.
   console.info(JSON.stringify({event:'news_delivery_recorded',...evidence}))
   sent++
   if(i<9)await new Promise(resolve=>setTimeout(resolve,5200))
  }
  return json({ok:true,sent,deliveries})
 }catch{return json({error:'publisher_failed'},500)}
})
