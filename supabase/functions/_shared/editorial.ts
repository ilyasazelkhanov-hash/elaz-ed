export interface EditorialSource { title: string; url: string }
export interface EditorialMetadata {
 kind: 'evergreen' | 'update'
 checked_on?: string
 review_due?: string
 reviewer?: string
 correction_note?: string
 audience?: string
 outcome?: string
 access_note?: string
 example?: string
 criteria?: string[]
 sources?: EditorialSource[]
}

const editorialLimits = { reviewer: 80, correction_note: 1000, audience: 240, outcome: 300, access_note: 400, example: 1500 } as const
const dateIsValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const utcToday = () => new Date().toISOString().slice(0, 10)

/** Shared by the editor and API; never asserts that an author actually performed a check. */
export function normalizeEditorial(value: unknown, options: { requireUpdateReview?: boolean; today?: string } = {}): EditorialMetadata | null {
 if(value == null)return null
 if(typeof value !== 'object' || Array.isArray(value))throw new Error('Редакционные сведения должны быть объектом')
 const input=value as Record<string,unknown>
 if(input.kind!=='evergreen'&&input.kind!=='update')throw new Error('Выбери тип материала: практика или обновление')
 const result: EditorialMetadata={kind:input.kind}
 const today=options.today??utcToday()
 if(!dateIsValid(today))throw new Error('Неверная текущая дата проверки')
 const text=(raw:unknown,limit:number,label:string) => {
  if(raw==null)return undefined
  if(typeof raw!=='string')throw new Error(`${label}: нужен текст`)
  const trimmed=raw.trim()
  if(trimmed.length>limit)throw new Error(`${label}: не больше ${limit} символов`)
  return trimmed||undefined
 }
 for(const key of Object.keys(editorialLimits) as (keyof typeof editorialLimits)[]){
  const item=text(input[key],editorialLimits[key],key==='reviewer'?'Ответственный':'Редакционное поле')
  if(item)result[key]=item
 }
 for(const key of ['checked_on','review_due'] as const){
  const item=text(input[key],10,'Дата проверки')
  if(item&&!dateIsValid(item))throw new Error('Дата проверки должна быть настоящей датой ГГГГ-ММ-ДД')
  if(item)result[key]=item
 }
 if(result.checked_on&&result.checked_on>today)throw new Error('Дата выполненной проверки не может быть в будущем')
 if(result.checked_on&&result.review_due&&result.review_due<result.checked_on)throw new Error('Следующая проверка не может быть раньше выполненной')
 if(input.criteria!=null){
  if(!Array.isArray(input.criteria)||input.criteria.length>5)throw new Error('Критерии: список не больше 5 пунктов')
  const criteria=input.criteria.map(item=>text(item,300,'Критерий')).filter((item):item is string=>!!item)
  if(criteria.length)result.criteria=criteria
 }
 if(input.sources!=null){
  if(!Array.isArray(input.sources)||input.sources.length>5)throw new Error('Источники: список не больше 5 ссылок')
  const sources:EditorialSource[]=[]
  for(const source of input.sources){
   if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('Источник должен содержать название и ссылку')
   const item=source as Record<string,unknown>
   const title=text(item.title,120,'Название источника'),url=text(item.url,2048,'Ссылка источника')
   if(!title&&!url)continue
   if(!title||!url)throw new Error('Укажи название и ссылку для каждого источника')
   try { const parsed=new URL(url); if(!['https:','http:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password)throw new Error() } catch {throw new Error('Ссылка источника должна быть http(s) без логина и пароля')}
   sources.push({title,url})
  }
  if(sources.length)result.sources=sources
 }
 if(options.requireUpdateReview&&result.kind==='update'){
  if(!result.sources?.length)throw new Error('Для публикации обновления нужен первоисточник')
  if(!result.checked_on)throw new Error('Укажи дату выполненной проверки обновления')
  if(!result.review_due)throw new Error('Назначь следующую проверку обновления')
  if(!result.reviewer)throw new Error('Укажи ответственного за проверку обновления')
 }
 return result
}

export type EditorialReviewStatus = 'missing' | 'incomplete' | 'due' | 'scheduled' | 'evergreen'
export function editorialReviewStatus(value: unknown, today = utcToday()): EditorialReviewStatus {
 if(value==null)return 'missing'
 try {
  const metadata=normalizeEditorial(value,{requireUpdateReview:true,today})!
  if(metadata.review_due)return metadata.review_due<=today?'due':'scheduled'
  return metadata.kind==='evergreen'?'evergreen':'incomplete'
 }catch{return 'incomplete'}
}
export function editorialReviewLabel(value: unknown, today = utcToday()): string {
 const labels:Record<EditorialReviewStatus,string>={missing:'Сведения о проверке не заполнены',incomplete:'Нужно дополнить сведения',due:'Пора проверить',scheduled:'Следующая проверка назначена',evergreen:'Практика без срока актуальности'}
 return labels[editorialReviewStatus(value,today)]
}

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
