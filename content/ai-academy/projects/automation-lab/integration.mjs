export class IntegrationError extends Error {
  constructor(code,{status=0,retryable=false,retryAfterMs=0}={}){super(code);Object.assign(this,{status,retryable,retryAfterMs})}
}
export async function requestJSON(url,{token,timeoutMs=1000,fetcher=fetch}={}){
  let response
  try{response=await fetcher(url,{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(timeoutMs)})}
  catch(error){throw new IntegrationError(error.name==='TimeoutError'||error.name==='AbortError'?'timeout':'network_error',{retryable:true})}
  if(!response.ok){const retryAfter=Number(response.headers.get('retry-after'));throw new IntegrationError(`http_${response.status}`,{status:response.status,retryable:[408,429,500,502,503,504].includes(response.status),retryAfterMs:Number.isFinite(retryAfter)&&retryAfter>0?Math.min(60,retryAfter)*1000:0})}
  try{return await response.json()}catch{throw new IntegrationError('invalid_json')}
}
export async function withRetry(operation,{maxAttempts=3,baseDelayMs=100,wait=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random}={}){
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>10||!Number.isFinite(baseDelayMs)||baseDelayMs<0)throw new TypeError('invalid_retry_policy')
  for(let attempt=1;;attempt++){
    try{return await operation(attempt)}catch(error){if(!error.retryable||attempt>=maxAttempts)throw error;const ceiling=Math.min(30000,baseDelayMs*2**(attempt-1));await wait(Math.max(error.retryAfterMs||0,Math.floor(ceiling*(0.5+random()*0.5))))}
  }
}
export async function fetchPages(origin,options={}){
  const rows=[],visited=new Set();let page=1
  for(let n=0;n<(options.maxPages??10);n++){
    if(visited.has(page))throw new IntegrationError('pagination_cycle');visited.add(page)
    const data=await requestJSON(new URL(`/tickets?page=${page}`,origin),options)
    if(!Array.isArray(data.items))throw new IntegrationError('invalid_items')
    rows.push(...data.items);if(rows.length>1000)throw new IntegrationError('too_many_items')
    if(data.nextPage===null)return rows
    if(!Number.isSafeInteger(data.nextPage)||data.nextPage<1)throw new IntegrationError('invalid_next_page')
    page=data.nextPage
  }
  throw new IntegrationError('pagination_limit')
}
export function normalizeTickets(items){
  const seen=new Set(),accepted=[],rejected=[]
  for(const item of items){
    if(!item||typeof item.id!=='string'||!/^T-\d{3}$/.test(item.id)||typeof item.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim())||typeof item.message!=='string'||!item.message.trim()){rejected.push({id:typeof item?.id==='string'?item.id:null,reason:'invalid_fields'});continue}
    if(seen.has(item.id)){rejected.push({id:item.id,reason:'duplicate_id'});continue}seen.add(item.id)
    accepted.push({id:item.id,email:item.email.trim().toLowerCase(),message:item.message.trim(),owner:'support',status:'new'})
  }
  return {accepted,rejected}
}
