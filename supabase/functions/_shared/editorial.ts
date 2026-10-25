// Delivery receipts use private settings, never the lesson/feed tables.
// deno-lint-ignore no-explicit-any
export async function publishEditorialBatch(db: any, send: (method: string, payload: Record<string, unknown>) => Promise<any>, chatId: number, batch: string, delay: (ms: number) => Promise<unknown> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
 if(!/^[a-zA-Z0-9-]{1,64}$/.test(batch))return {ok:false,sent:0,reason:'invalid_batch'}
 const source=await db.from('settings').select('value').eq('key',`telegram_editorial:${batch}`).maybeSingle()
 const posts=source.data?.value?.posts
 if(source.error||!Array.isArray(posts)||posts.length>12||posts.some(p=>!/^[a-zA-Z0-9-]{1,64}$/.test(p.key)||typeof p.text!=='string'||p.text.length>3800)||new Set(posts.map(p=>p.key)).size!==posts.length)return {ok:false,sent:0,reason:'invalid_posts'}
 let sent=0
 for(const post of posts){
  const key=`telegram_delivery:${chatId}:${batch}:${post.key}`
  const claimed=await db.from('settings').insert({key,value:{status:'sending',attempted_at:new Date().toISOString()}})
  if(claimed.error){
   if(claimed.error.code!=='23505')return {ok:false,sent,reason:'claim_failed'}
   const existing=await db.from('settings').select('value').eq('key',key).maybeSingle()
   if(existing.data?.value?.status==='sent')continue
   return {ok:false,sent,reason:'delivery_needs_review'}
  }
  let status='failed';let messageId=null;let error=null
  try{
   const result=await send('sendMessage',{chat_id:chatId,text:post.text,parse_mode:'HTML',link_preview_options:{is_disabled:true}})
   if(result.ok&&Number.isSafeInteger(result.result?.message_id)){status='sent';messageId=result.result.message_id}
   else if(result.ok){status='uncertain';error='missing_message_id'}
   else error=`telegram_${result.error_code??'rejected'}`
  }catch{status='uncertain';error='network_unknown_delivery'}
  const stored=await db.from('settings').update({value:{status,message_id:messageId,error,completed_at:new Date().toISOString()}}).eq('key',key)
  if(stored.error)return {ok:false,sent,reason:'receipt_failed'}
  if(status!=='sent')return {ok:false,sent,reason:status}
  sent++
  await delay(5200)
 }
 return {ok:true,sent}
}
