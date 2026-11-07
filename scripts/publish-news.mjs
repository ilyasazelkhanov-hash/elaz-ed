import {readFile,writeFile,mkdir,mkdtemp,rm,stat} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createHash,randomBytes} from 'node:crypto'
import {lookup} from 'node:dns/promises'
import {request as httpsRequest} from 'node:https'
import {isIP} from 'node:net'
import {Readable} from 'node:stream'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {normalizeEditorial} from '../supabase/functions/_shared/editorial.ts'
import {assertNoCourseOverlap,normalizedNewsText} from '../supabase/functions/_shared/news-policy.ts'

const root=fileURLToPath(new URL('../',import.meta.url))
const expectedProject='dcdepwdxvadhludnubis'
const execFileAsync=promisify(execFile)
const fail=code=>{throw Error(code)}
const hash=value=>createHash('sha256').update(value).digest('hex')
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
export const calendarDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
const dayDiff=(a,b)=>(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000

function publicAddress(address){
 if(isIP(address)===4){
  const [a,b,c]=address.split('.').map(Number)
  return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)
 }
 if(isIP(address)===6){
  const canonical=new URL(`https://[${address}]/`).hostname.slice(1,-1),parts=canonical.split(':')
  const first=parseInt(parts[0],16),second=parseInt(parts[1]||'0',16)
  return first>=0x2000&&first<=0x3fff&&first!==0x2002&&!(first===0x2001&&(second<0x200||second===0xdb8))
 }
 return false
}
function coverUrl(value){
 let url
 try{url=new URL(value)}catch{fail('cover_url_invalid')}
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')fail('cover_url_https_required')
 const hostname=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase()
 if(isIP(hostname)){if(!publicAddress(hostname))fail('cover_image_private_address')}
 else if(!hostname.includes('.')||/(?:^|\.)(?:localhost|localdomain|local|internal|home|test|invalid)$/.test(hostname))fail('cover_image_private_address')
 return url
}
function withSignal(promise,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(Error('cover_image_timeout'))
  if(signal.aborted){abort();return}
  signal.addEventListener('abort',abort,{once:true})
  Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
 })
}
/** Connect only to prevalidated DNS answers; a second DNS lookup cannot rebind the request. */
function fetchPinnedImage(url,{signal,addresses,headers}){
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(url,{method:'GET',headers,signal,agent:false,autoSelectFamily:false,lookup:(_hostname,options,callback)=>{
   if(options.all)callback(null,addresses)
   else callback(null,addresses[0].address,addresses[0].family)
  }},response=>{
   try{
    const responseHeaders=new Headers()
    for(const [key,value] of Object.entries(response.headers))if(value!=null)responseHeaders.set(key,Array.isArray(value)?value.join(', '):value)
    const empty=[204,205,304].includes(response.statusCode)
    if(empty)response.destroy()
    resolve(new Response(empty?null:Readable.toWeb(response),{status:response.statusCode,headers:responseHeaders}))
   }catch{response.destroy();reject(Error('cover_image_network'))}
  })
  req.on('error',()=>reject(Error(signal.aborted?'cover_image_timeout':'cover_image_network')))
  req.end()
 })
}
const maxImageBytes=2*1024*1024
export async function verifyNewsImage(value,{fetcher=fetchPinnedImage,resolveHost=hostname=>lookup(hostname,{all:true,verbatim:true}),timeoutMs=10000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)fail('cover_image_timeout_invalid')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs)
 let response
 try{
  let url=coverUrl(value)
  for(let redirects=0;;redirects++){
   const hostname=url.hostname.replace(/^\[|\]$/g,'')
   const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await withSignal(resolveHost(hostname),controller.signal)
   if(!Array.isArray(addresses)||!addresses.length||addresses.some(item=>!publicAddress(item.address)||item.family!==isIP(item.address)))fail('cover_image_private_address')
   response=await withSignal(fetcher(url.href,{signal:controller.signal,addresses,redirect:'manual',headers:{Range:`bytes=0-${maxImageBytes-1}`,Accept:'image/jpeg,image/png,image/webp','User-Agent':'ELAZ-News-Image-Check/1.0'}}),controller.signal)
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get('location')
    void response.body?.cancel().catch(()=>{})
    if(redirects>=3||!location)fail('cover_image_redirect_limit')
    url=coverUrl(new URL(location,url).href)
    continue
   }
   break
  }
  if(![200,206].includes(response.status))fail('cover_image_http_status')
  const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if(!['image/jpeg','image/png','image/webp'].includes(mime))fail('cover_image_mime')
  const length=response.headers.get('content-length'),range=response.headers.get('content-range')
  if(length!=null&&(!/^\d+$/.test(length)||Number(length)>maxImageBytes))fail('cover_image_size')
  if(range&&(!/^bytes 0-\d+\/\d+$/.test(range)||Number(range.split('/')[1])>maxImageBytes))fail('cover_image_size')
  if(response.status===206&&!range)fail('cover_image_range')
  if(!response.body)fail('cover_image_empty')
  const reader=response.body.getReader(),chunks=[]
  let total=0
  try{
   for(;;){
    const {done,value:chunk}=await withSignal(reader.read(),controller.signal)
    if(done)break
    total+=chunk.byteLength
    if(total>maxImageBytes)fail('cover_image_size')
    chunks.push(Buffer.from(chunk))
   }
  }finally{void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
  if(total<256||length!=null&&Number(length)!==total)fail('cover_image_size')
  if(range){const match=/^bytes 0-(\d+)\/(\d+)$/.exec(range);if(Number(match[1])+1!==total||Number(match[2])!==total)fail('cover_image_range')}
  const bytes=Buffer.concat(chunks,total)
  const jpeg=mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217
  const png=mime==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.subarray(-8).equals(Buffer.from([73,69,78,68,174,66,96,130]))
  const webp=mime==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.subarray(12,16).toString())&&bytes.readUInt32LE(4)+8===total
  if(!jpeg&&!png&&!webp)fail('cover_image_signature')
  return {mime,bytes:total,sha256:hash(bytes)}
 }catch(error){
  if(controller.signal.aborted)fail('cover_image_timeout')
  if(/^cover_[a-z_]+$/.test(error?.message??''))throw error
  fail('cover_image_network')
 }finally{
  clearTimeout(timer)
  controller.abort()
  if(response?.body&&!response.body.locked)void response.body.cancel().catch(()=>{})
 }
}

export function canonicalSource(value) {
 const url=new URL(value)
 if(url.protocol!=='https:'||url.username||url.password||url.pathname==='/')fail('source_article_url')
 url.hash=''
 for(const key of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))url.searchParams.delete(key)
 url.searchParams.sort()
 return url.href.replace(/\/$/,'')
}

export function validateNewsPayload(value,{now=new Date()}={}) {
 if(!value||typeof value!=='object'||Array.isArray(value))fail('payload_object')
 const allowed=new Set(['title','subtitle','body','category','minutes','event_on','editorial','emoji','gradient','cover_url','kind','course_id','news_eligible','published'])
 if(Object.keys(value).some(key=>!allowed.has(key)))fail('payload_unknown_field')
 if(value.kind!=null&&value.kind!=='lesson'||value.course_id!=null||value.news_eligible!=null&&value.news_eligible!==true||value.published!=null&&value.published!==true)fail('standalone_news_only')
 const text=(field,min,max)=>{
  const item=value[field]
  if(typeof item!=='string'||item.trim().length<min||item.trim().length>max)fail(`payload_${field}`)
  return item.trim()
 }
 const result={title:text('title',8,240),subtitle:text('subtitle',8,500),body:text('body',100,50000),category:text('category',2,80),minutes:value.minutes,event_on:value.event_on}
 if(!Number.isInteger(result.minutes)||result.minutes<1||result.minutes>30)fail('payload_minutes')
 if(normalizedNewsText(result.body).split(' ').length<80)fail('payload_body_words')
 const today=calendarDate(now)
 if(!validDate(result.event_on)||dayDiff(today,result.event_on)<0||dayDiff(today,result.event_on)>7)fail('event_date_future_or_stale')
 let editorial
 try{editorial=normalizeEditorial(value.editorial,{requireUpdateReview:true,today})}catch{fail('editorial_incomplete')}
 if(editorial?.kind!=='update')fail('editorial_update_required')
 if(dayDiff(today,editorial.checked_on)>1||editorial.checked_on<result.event_on||editorial.review_due<today)fail('editorial_dates_stale')
 for(const source of editorial.sources)canonicalSource(source.url)
 if(!editorial.sources.some(source=>result.body.includes(source.url)))fail('visible_source_required')
 if(!result.body.includes(result.event_on))fail('visible_event_date_required')
 // Persist the announcement date with provenance; rolling source pages can cover later events.
 result.editorial={...editorial,event_on:result.event_on}
 result.emoji=value.emoji==null?'📰':text('emoji',1,16)
 result.gradient=value.gradient==null?'aurora':text('gradient',1,40)
 result.cover_url=coverUrl(text('cover_url',1,2048)).href
 return result
}

export const contentKey=payload=>hash(normalizedNewsText(payload.body))
export const batchKey=articles=>hash(JSON.stringify(articles.map(contentKey)))
export function validateNewsBatch(value,{now=new Date()}={}){
 const entries=Array.isArray(value)?value:[value]
 if(entries.length<1||entries.length>20)fail('batch_size_must_be_one_to_twenty')
 const articles=entries.map(item=>validateNewsPayload(item,{now}))
 for(let i=0;i<articles.length;i++)if(duplicate(articles[i],articles.slice(0,i)))fail('batch_duplicate_article')
 return articles
}
function batchPlan(articles,news){
 const existing=[],pending=[]
 articles.forEach((article,index)=>{
  const found=duplicate(article,news)
  if(found)existing.push({index:index+1,id:found.id})
  else pending.push({index:index+1,article:{...article,content_key:contentKey(article)}})
 })
 return {existing,pending}
}
// Same targeted catalog expression is used by the read and the locked transaction.
const rowsSql=`coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'editorial',editorial,'published',published,'course_id',course_id,'news_eligible',news_eligible) order by id) from public.lessons where (course_id is null and kind='lesson') or (course_id is not null and published)), '[]'::jsonb)`
export function buildCatalogSql(){
 return `select jsonb_build_object('signature',md5(catalog::text),'news',coalesce((select jsonb_agg(item) from jsonb_array_elements(catalog) item where item->'course_id'='null'::jsonb),'[]'::jsonb),'courses',coalesce((select jsonb_agg(item) from jsonb_array_elements(catalog) item where item->'course_id'<>'null'::jsonb),'[]'::jsonb),'last',(select value from public.settings where key='news-automation:last')) as result from (select ${rowsSql} as catalog) c;`
}
function sqlJson(value){
 const serialized=JSON.stringify(value)
 let tag
 do{tag='$news_'+randomBytes(12).toString('hex')+'$'}while(serialized.includes(tag))
 return `${tag}${serialized}${tag}::jsonb`
}
export function buildPublishSql(payload,snapshot,{now=new Date()}={}){
 if(!/^[a-f0-9]{32}$/.test(snapshot.signature))fail('catalog_signature')
 const articles=validateNewsBatch(payload,{now}),plan=batchPlan(articles,snapshot.news??[])
 const p=sqlJson({articles,...plan,content_keys:articles.map(contentKey),batch_key:batchKey(articles),catalog_signature:snapshot.signature,expected_on:calendarDate(now)})
 let blockTag
 do{blockTag='$publish_'+randomBytes(12).toString('hex')+'$'}while(p.includes(blockTag))
 return `begin;
select pg_advisory_xact_lock(hashtext('news-automation:publish'));
lock table public.lessons in share row exclusive mode;
create temporary table news_publish_result(result jsonb) on commit drop;
do ${blockTag}
declare p jsonb := ${p}; receipt jsonb; previous jsonb; entry jsonb; a jsonb; lesson_id bigint; lesson_ids bigint[]; inserted_ids bigint[] := '{}'::bigint[]; today date := (clock_timestamp() at time zone 'Asia/Qyzylorda')::date;
begin
 select value into receipt from public.settings where key='news-automation:batch-receipt:'||(p->>'batch_key');
 if receipt is not null then
  insert into news_publish_result values(jsonb_build_object('status','duplicate','id',receipt->'lesson_ids'->0,'ids',receipt->'lesson_ids','inserted_ids','[]'::jsonb,'batch_key',p->>'batch_key','content_key',case when jsonb_array_length(p->'articles')=1 then p->'content_keys'->>0 end,'content_keys',p->'content_keys'));
  return;
 end if;
 if md5((${rowsSql})::text) <> p->>'catalog_signature' then raise exception 'catalog_changed'; end if;
 if today <> (p->>'expected_on')::date then raise exception 'calendar_changed'; end if;
 lesson_ids := array_fill(null::bigint,array[jsonb_array_length(p->'articles')]);
 for entry in select value from jsonb_array_elements(p->'existing') loop
  lesson_ids[(entry->>'index')::int] := (entry->>'id')::bigint;
 end loop;
 if jsonb_array_length(p->'pending')=0 then
  insert into news_publish_result values(jsonb_build_object('status','duplicate','id',lesson_ids[1],'ids',to_jsonb(lesson_ids),'inserted_ids','[]'::jsonb,'batch_key',p->>'batch_key','content_key',case when jsonb_array_length(p->'articles')=1 then p->'content_keys'->>0 end,'content_keys',p->'content_keys'));
  return;
 end if;
 select value into previous from public.settings where key='news-automation:last' for update;
 if previous is not null and (previous->>'published_on' is null or today-(previous->>'published_on')::date<3) then raise exception 'cadence_not_due'; end if;
 for entry in select value from jsonb_array_elements(p->'pending') loop
  a := entry->'article';
  insert into public.lessons(kind,title,subtitle,body,category,minutes,emoji,gradient,cover_url,course_id,news_eligible,published,published_at,editorial)
  values('lesson',a->>'title',a->>'subtitle',a->>'body',a->>'category',(a->>'minutes')::int,a->>'emoji',a->>'gradient',a->>'cover_url',null,true,true,clock_timestamp(),a->'editorial') returning id into lesson_id;
  lesson_ids[(entry->>'index')::int] := lesson_id;
  inserted_ids := array_append(inserted_ids,lesson_id);
  receipt := jsonb_build_object('lesson_id',lesson_id,'content_key',a->>'content_key','batch_key',p->>'batch_key','published_on',today,'event_on',a->>'event_on','published_at',clock_timestamp());
  insert into public.settings(key,value) values('news-automation:receipt:'||(a->>'content_key'),receipt);
 end loop;
 receipt := jsonb_build_object('lesson_ids',to_jsonb(lesson_ids),'inserted_ids',to_jsonb(inserted_ids),'batch_key',p->>'batch_key','published_on',today,'published_at',clock_timestamp());
 insert into public.settings(key,value) values('news-automation:batch-receipt:'||(p->>'batch_key'),receipt);
 insert into public.settings(key,value) values('news-automation:last',receipt) on conflict(key) do update set value=excluded.value,updated_at=clock_timestamp();
 insert into news_publish_result values(jsonb_build_object('status','published','id',lesson_ids[1],'ids',to_jsonb(lesson_ids),'inserted_ids',to_jsonb(inserted_ids),'batch_key',p->>'batch_key','content_key',case when jsonb_array_length(p->'articles')=1 then p->'content_keys'->>0 end,'content_keys',p->'content_keys'));
end;
${blockTag};
select result from news_publish_result;
commit;`
}

function duplicate(payload,news){
 const title=normalizedNewsText(payload.title),body=normalizedNewsText(payload.body)
 const sources=new Set(payload.editorial.sources.map(source=>canonicalSource(source.url)))
 return news.find(item=>{
  if(normalizedNewsText(item.title)===title||normalizedNewsText(item.body)===body)return true
  const links=[...(item.editorial?.sources??[]).map(source=>source.url),...(item.body.match(/https:\/\/[^\s<>"\])}]+/g)??[]).map(url=>url.replace(/[.,;:!?]+$/,''))]
  const previousDate=item.event_on??item.editorial?.event_on
  return links.some(url=>{
   try{
    if(!sources.has(canonicalSource(url)))return false
    if(previousDate)return previousDate===payload.event_on
    // Legacy rolling pages without a saved event date must not block all future news.
    return !/(?:changelog|release[-_]?notes|\/updates(?:\/|$))/i.test(new URL(url).pathname)
   }catch{return false}
  })
 })
}
export async function runPublisher({payload,projectRef,query,publish=false,now=new Date(),localCourses=[],imageChecker=verifyNewsImage}){
 if(projectRef!==expectedProject)fail('project_ref_must_be_dcdepwdxvadhludnubis')
 const articles=validateNewsBatch(payload,{now}),key=batchKey(articles),keys=articles.map(contentKey)
 const images=await Promise.allSettled([...new Set(articles.map(item=>item.cover_url))].map(url=>imageChecker(url)))
 for(const result of images)if(result.status==='rejected')throw result.reason
 const snapshot=await query(buildCatalogSql())
 if(!snapshot||!/^[a-f0-9]{32}$/.test(snapshot.signature)||!Array.isArray(snapshot.news)||!Array.isArray(snapshot.courses))fail('catalog_response')
 for(const article of articles)assertNoCourseOverlap(article.body,[...snapshot.courses,...localCourses])
 const plan=batchPlan(articles,snapshot.news),identity={batch_key:key,content_keys:keys,...(articles.length===1?{content_key:keys[0]}:{})}
 if(!plan.pending.length){
  const ids=plan.existing.map(item=>item.id)
  return {status:'duplicate',id:ids[0],ids,inserted_ids:[],...identity}
 }
 if(snapshot.last&&(!validDate(snapshot.last.published_on)||dayDiff(calendarDate(now),snapshot.last.published_on)<3))return {status:'not_due',...identity,last_published_on:snapshot.last.published_on}
 if(!publish)return {status:'dry_run',...identity,article_count:articles.length,publish_count:plan.pending.length,existing_ids:plan.existing.map(item=>item.id),course_count:snapshot.courses.length+localCourses.length}
 const result=await query(buildPublishSql(articles,snapshot,{now}))
 if(!result||!['published','duplicate'].includes(result.status)||result.batch_key!==key||!Array.isArray(result.ids)||result.ids.length!==articles.length||result.ids.some(id=>!Number.isSafeInteger(id)||id<1)||result.id!==result.ids[0]||JSON.stringify(result.content_keys)!==JSON.stringify(keys))fail('publish_response_uncertain_check_receipt')
 return result
}

/** Load known authored course files only, never frontend bundles or private snapshots. */
export async function loadLocalCourses(file=path.join(root,'content/ai-practice-2026-10-25/training.json'),pathsFile=path.join(root,'content/ai-practice-2026-10-25/paths.json')){
 const input=JSON.parse(await readFile(file,'utf8'))
 if(!Array.isArray(input.lessons)||!input.lessons.length)fail('local_course_corpus_missing')
 const courses=[]
 const addLesson=async(lesson,id,sourceFile)=>{
  if(typeof lesson.body==='string'&&lesson.body.trim())courses.push({id,body:lesson.body})
  else if(typeof lesson.localpath==='string'){
   const local=path.resolve(path.dirname(sourceFile),lesson.localpath),base=path.resolve(path.dirname(sourceFile))
   if(!local.startsWith(base+path.sep))fail('local_course_path_outside_corpus')
   const body=await readFile(local,'utf8')
   if(!body.trim())fail('local_course_body_missing')
   courses.push({id,body})
  }else fail('local_course_body_missing')
 }
 for(const [i,lesson] of input.lessons.entries())await addLesson(lesson,`archive:${i+1}`,file)
 const paths=JSON.parse(await readFile(pathsFile,'utf8'))
 if(!Array.isArray(paths.courses)||!paths.courses.length)fail('local_path_course_corpus_missing')
 for(const course of paths.courses){
  if(typeof course.key!=='string'||!course.key||!Array.isArray(course.lessons)||!course.lessons.length)fail('local_path_course_corpus_invalid')
  for(const lesson of course.lessons){
   if(typeof lesson.key!=='string'||!lesson.key)fail('local_path_lesson_key_missing')
   await addLesson(lesson,`path:${course.key}:${lesson.key}`,pathsFile)
  }
 }
 return courses
}

export function parseCliEnvelope(stdout){
 let parsed
 try{parsed=JSON.parse(stdout)}catch{fail('cli_json_response')}
 const rows=Array.isArray(parsed)?parsed:parsed?.rows
 if(!Array.isArray(rows))fail('cli_rows_response')
 const results=rows.filter(row=>row&&Object.hasOwn(row,'result'))
 if(results.length!==1)fail('cli_result_envelope')
 let result=results[0].result
 if(typeof result==='string'){try{result=JSON.parse(result)}catch{fail('cli_result_json')}}
 return result
}
export async function createCliQuery({cli,projectRef,execute=execFileAsync,workdir=root}){
 if(projectRef!==expectedProject)fail('project_ref_must_be_dcdepwdxvadhludnubis')
 if(!cli||!path.isAbsolute(cli)||(await stat(cli)).isDirectory())fail('supabase_cli_absolute_executable_required')
 return async sql=>{
  const base=path.resolve(workdir,'test-results','news-publisher')
  await mkdir(base,{recursive:true,mode:0o700})
  const dir=await mkdtemp(path.join(base,'query-')),file=path.join(dir,'query.sql')
  try{
   await writeFile(file,sql,{mode:0o600,flag:'wx'})
   let output
   try{output=await execute(cli,['db','query','--linked','--project-ref',projectRef,'--file',file,'--output','json'],{cwd:workdir,shell:false,windowsHide:true,maxBuffer:32*1024*1024,timeout:120000})}catch{fail('cli_query_failed_check_receipt_before_retry')}
   return parseCliEnvelope(output.stdout)
  }finally{
   const target=path.resolve(dir),relative=path.relative(base,target)
   if(!relative||relative.startsWith('..')||path.isAbsolute(relative))fail('sql_cleanup_path_outside_workspace')
   await rm(target,{recursive:true,force:true})
  }
 }
}

async function main(){
 const args=process.argv.slice(2)
 if(args.includes('--help')){console.log('node scripts/publish-news.mjs --file <news.json> [--dry-run | --publish]\nRequires SUPABASE_CLI absolute executable and RELEASE_PROJECT_REF=dcdepwdxvadhludnubis.');return}
 let file,publish=false,mode
 for(let i=0;i<args.length;i++){
  if(args[i]==='--file'&&!file){file=args[++i];if(!file||file.startsWith('--'))fail('file_required')}
  else if(['--publish','--dry-run'].includes(args[i])&&!mode){mode=args[i];publish=mode==='--publish'}
  else fail('invalid_cli_arguments')
 }
 if(!file)fail('file_required')
 const projectRef=process.env.RELEASE_PROJECT_REF
 if(projectRef!==expectedProject)fail('project_ref_must_be_dcdepwdxvadhludnubis')
 const payload=JSON.parse(await readFile(path.resolve(file),'utf8'))
 const localCourses=await loadLocalCourses()
 const query=await createCliQuery({cli:process.env.SUPABASE_CLI,projectRef})
 console.log(JSON.stringify(await runPublisher({payload,projectRef,query,publish,localCourses})))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
 // CLI errors can contain SQL, course bodies, or credentials. Emit only known codes.
 const code=String(error?.message??'')
 console.error(JSON.stringify({status:'error',reason:/^(course_overlap:|[a-z_]+(?:_dcdepwdxvadhludnubis)?$)/.test(code)?code:'publisher_failed'}));process.exitCode=1
})
