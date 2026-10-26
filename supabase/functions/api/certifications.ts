export class CertificationError extends Error {
 status: number
 constructor(status: number, code: string) { super(code); this.status=status }
}
// Database is privileged; actor and live streak always come from the signed API session.
// deno-lint-ignore no-explicit-any
export async function handleCertifications(db: any, actor: number, streak: number, action: string, input: Record<string,unknown>) {
 const unlocked=streak>=10
 if(action==='catalog'){
  const [catalog,progress,codes,rewards]=await Promise.all([
   db.from('ai_certifications').select('id,title,provider,topic,credential,credential_note,free_course,free_credential,availability,checked_at,position').eq('published',true).order('position').order('title'),
   db.from('certification_progress').select('certification_id,status').eq('user_id',actor),
   db.from('reward_codes').select('reward_id').eq('user_id',actor),
   db.from('advent_rewards').select('id,payload').eq('kind','certification'),
  ])
  if(catalog.error||progress.error||codes.error||rewards.error)throw new CertificationError(500,'db')
  const mine=new Map((progress.data??[]).map((p: {certification_id:string;status:string})=>[p.certification_id,p.status]))
  const awarded=new Set((codes.data??[]).map((c: {reward_id:number})=>c.reward_id))
  const gifts=new Set((rewards.data??[]).filter((r: {id:number})=>awarded.has(r.id)).map((r: {payload:{certification_id?:string}})=>r.payload?.certification_id))
  // Explicit allowlist: neither locked nor unlocked catalog responses include URLs.
  const items=(catalog.data??[]).map((c: Record<string,unknown>)=>({id:c.id,title:c.title,provider:c.provider,topic:c.topic,credential:c.credential,credential_note:c.credential_note,free_course:c.free_course,free_credential:c.free_credential,availability:c.availability,checked_at:c.checked_at,status:mine.get(c.id as string)??'saved',touched:mine.has(c.id as string),gift:gifts.has(c.id),available:unlocked||gifts.has(c.id)}))
  return {streak,required_streak:10,unlocked,items,total:items.length}
 }
 if(!['open','progress'].includes(action))throw new CertificationError(400,'certification_action')
 const id=typeof input.id==='string'?input.id:''
 if(!/^[a-z0-9-]{1,100}$/.test(id))throw new CertificationError(400,'certification_id')
 if(!unlocked){
  const [codes,rewards]=await Promise.all([db.from('reward_codes').select('reward_id').eq('user_id',actor),db.from('advent_rewards').select('id,payload').eq('kind','certification')])
  if(codes.error||rewards.error)throw new CertificationError(500,'db')
  const mine=new Set((codes.data??[]).map((c:{reward_id:number})=>c.reward_id))
  if(!(rewards.data??[]).some((r:{id:number;payload:{certification_id?:string}})=>mine.has(r.id)&&r.payload?.certification_id===id))throw new CertificationError(403,'streak_required')
 }
 const {data:course,error}=await db.from('ai_certifications').select('id,url').eq('id',id).eq('published',true).maybeSingle()
 if(error)throw new CertificationError(500,'db')
 if(!course)throw new CertificationError(404,'not_found')
 if(action==='open')return {url:course.url}
 const status=String(input.status??'')
 if(!['saved','in_progress','completed','received'].includes(status))throw new CertificationError(400,'certification_status')
 if(status==='received'){
  const previous=await db.from('certification_progress').select('status').eq('user_id',actor).eq('certification_id',id).maybeSingle()
  if(previous.error)throw new CertificationError(500,'db')
  if(!['completed','received'].includes(previous.data?.status))throw new CertificationError(409,'complete_first')
 }
 const saved=await db.from('certification_progress').upsert({user_id:actor,certification_id:id,status,updated_at:new Date().toISOString()},{onConflict:'user_id,certification_id'})
 if(saved.error)throw new CertificationError(500,'db')
 return {ok:true,status}
}
