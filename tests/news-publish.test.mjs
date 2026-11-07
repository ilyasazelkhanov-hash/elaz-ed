import test from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {validateNewsPayload, validateNewsBatch, buildCatalogSql, buildPublishSql, runPublisher as publishNews, verifyNewsImage, contentKey, calendarDate, createCliQuery, parseCliEnvelope, loadLocalCourses} from '../scripts/publish-news.mjs'
import {readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises'
import path from 'node:path'

const now=new Date(),today=calendarDate(now),tomorrow=calendarDate(new Date(now.valueOf()+86400000))
const payload=()=>({title:'Новое официальное обновление продукта',subtitle:'Проверенный анонс и его ограничения',category:'Новости ИИ',minutes:3,cover_url:'https://cdn.example.org/news.jpg',event_on:today,body:`Дата события: ${today}. `+Array.from({length:100},(_,i)=>`новость${i}`).join(' ')+'\nИсточник: https://example.org/blog/release',editorial:{kind:'update',checked_on:today,review_due:tomorrow,reviewer:'Редактор',sources:[{title:'Официальный анонс',url:'https://example.org/blog/release'}]}})
const runPublisher=options=>publishNews({imageChecker:async()=>({mime:'image/jpeg',bytes:512}),...options})
async function database(){
 const db=new PGlite()
 await db.exec(`create table lessons(id bigint generated always as identity primary key,kind text,title text,subtitle text,body text,category text,minutes int,emoji text,gradient text,cover_url text,course_id bigint,news_eligible boolean,published boolean,published_at timestamptz,editorial jsonb); create table settings(key text primary key,value jsonb,updated_at timestamptz default now());`)
 return db
}
async function catalog(db){return (await db.query(buildCatalogSql())).rows[0].result}
async function publish(db,p=payload(),snapshot){return db.exec(buildPublishSql(validateNewsPayload(p,{now}),snapshot??await catalog(db),{now}))}
const article=index=>{
 const item=payload();item.title+=` ${index}`
 item.body=`Дата события: ${today}. `+Array.from({length:100},(_,i)=>`обновление${index}слово${i}`).join(' ')+`\nИсточник: https://example.org/blog/release-${index}`
 item.editorial.sources[0].url+=`-${index}`
 return item
}
const queryDatabase=db=>async sql=>{
 const results=await db.exec(sql)
 return results.flatMap(result=>result.rows).find(row=>Object.hasOwn(row,'result'))?.result
}
test('news dates, visible provenance, payload shape and freshness fail closed',()=>{
 assert.equal(calendarDate(new Date('2026-11-06T20:00:00Z')),'2026-11-07')
 assert.equal(validateNewsPayload(payload(),{now}).editorial.kind,'update')
 for(const change of [{event_on:tomorrow},{event_on:'2020-10-01'},{course_id:9},{published:false},{published:0},{news_eligible:false},{news_eligible:0},{body:'nothing'},{minutes:0},{cover_url:null},{cover_url:''},{cover_url:'http://cdn.example.org/image.jpg'},{cover_url:'https://user:secret@cdn.example.org/image.jpg'}])assert.throws(()=>validateNewsPayload({...payload(),...change},{now}))
 assert.throws(()=>validateNewsPayload({...payload(),editorial:{...payload().editorial,reviewer:''}},{now}))
 assert.throws(()=>validateNewsPayload({...payload(),body:payload().body.replace('https://example.org/blog/release','source')},{now}),/visible_source/)
 assert.equal(contentKey(validateNewsPayload(payload(),{now})),contentKey(validateNewsPayload({...payload(),body:payload().body+'  '},{now})))
})
test('missing, private or invalid cover images stop both dry run and publish before any database write',async()=>{
 for(const url of ['https://localhost/a.jpg','https://localhost.localdomain/a.jpg','https://127.1/a.jpg','https://10.0.0.1/a.jpg','https://169.254.169.254/a.jpg','https://[::1]/a.jpg','https://[::ffff:127.0.0.1]/a.jpg','https://192.168.1.2/a.jpg','https://100.64.0.1/a.jpg'])assert.throws(()=>validateNewsPayload({...payload(),cover_url:url},{now}),/cover_/)
 for(const publish of [false,true]){
  let writes=0,checks=0
  await assert.rejects(runPublisher({payload:[article(1),article(2)],projectRef:'dcdepwdxvadhludnubis',now,publish,localCourses:[],imageChecker:async()=>{checks++;throw Error('cover_image_invalid')},query:async sql=>{
   if(sql!==buildCatalogSql())writes++
   return {signature:'a'.repeat(32),news:[],courses:[],last:null}
  }}),/cover_image_invalid/)
  assert.ok(checks>0);assert.equal(writes,0)
 }
})
const jpeg=()=>{const bytes=Buffer.alloc(512,1);Buffer.from([255,216,255,224]).copy(bytes);bytes[510]=255;bytes[511]=217;return bytes}
const publicDns=async()=>[{address:'93.184.216.34',family:4}]
const imageResponse=(bytes=jpeg(),type='image/jpeg')=>new Response(bytes,{headers:{'content-type':type,'content-length':String(bytes.length)}})
test('cover verification requires matching MIME and image bytes with bounded size and deadline',async()=>{
 const good=await verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>imageResponse()})
 assert.equal(good.mime,'image/jpeg');assert.equal(good.bytes,512);assert.match(good.sha256,/^[a-f0-9]{64}$/)
 for(const fetcher of [async()=>imageResponse(Buffer.from('<html>'+'.'.repeat(500)+'</html>')),async()=>imageResponse(jpeg(),'text/html'),async()=>imageResponse(Buffer.from([255,216,255,217])),async()=>imageResponse(Buffer.alloc(2097153,1)),async()=>new Response(Buffer.alloc(2097153,1),{headers:{'content-type':'image/jpeg'}}),async()=>new Response(null,{status:404})])await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher}),/cover_image_/)
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,timeoutMs:20,fetcher:async()=>new Promise(()=>{})}),/cover_image_timeout/)
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,timeoutMs:20,fetcher:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(jpeg().subarray(0,64))}}),{headers:{'content-type':'image/jpeg'}})}),/cover_image_timeout/)
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>new Response(jpeg(),{status:206,headers:{'content-type':'image/jpeg','content-range':'bytes 0-511/1024'}})}),/cover_image_range/)
 const png=Buffer.alloc(512,1);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);Buffer.from([73,69,78,68,174,66,96,130]).copy(png,504)
 const webp=Buffer.alloc(512,1);webp.write('RIFF');webp.writeUInt32LE(504,4);webp.write('WEBPVP8 ',8)
 for(const [bytes,mime] of [[png,'image/png'],[webp,'image/webp']]){
  assert.equal((await verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>imageResponse(bytes,mime)})).mime,mime)
  await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>imageResponse(bytes,'image/jpeg')}),/cover_image_signature/)
 }
})
test('cover redirects validate every destination and DNS result before fetching',async()=>{
 let requests=0
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>{requests++;return new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}})}}),/cover_/)
 assert.equal(requests,1)
 requests=0
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:async()=>[{address:'10.0.0.1',family:4}],fetcher:async()=>{requests++;return imageResponse()}}),/cover_image_private_address/)
 assert.equal(requests,0)
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:async()=>[{address:'93.184.216.34',family:4},{address:'::1',family:6}],fetcher:async()=>imageResponse()}),/cover_image_private_address/)
 requests=0
 const result=await verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async(url,options)=>{
  assert.equal(options.redirect,'manual');assert.deepEqual(options.addresses,[{address:'93.184.216.34',family:4}])
  requests++;return requests===1?new Response(null,{status:302,headers:{location:'https://other.example.org/final.jpg'}}):imageResponse()
 }})
 assert.equal(requests,2);assert.equal(result.bytes,512)
 await assert.rejects(verifyNewsImage(payload().cover_url,{resolveHost:publicDns,fetcher:async()=>new Response(null,{status:302,headers:{location:'/again'}})}),/cover_image_redirect_limit/)
})
test('dry run queries once and does not write; wrong target never queries',async()=>{
 let queries=0
 const query=async sql=>{queries++;assert.equal(sql,buildCatalogSql());return {signature:'a'.repeat(32),news:[],courses:[],last:null}}
 const result=await runPublisher({payload:payload(),projectRef:'dcdepwdxvadhludnubis',query,now,localCourses:[]})
 assert.equal(result.status,'dry_run');assert.equal(queries,1)
 await assert.rejects(runPublisher({payload:payload(),projectRef:'wrong',query,now,localCourses:[]}),/project_ref/)
 assert.equal(queries,1)
})
test('atomic publication writes exactly one news and receipts while preserving other settings',async()=>{
 const db=await database()
 try{
 await db.exec(`insert into settings values ('other','{"keep":true}',now());`)
 await publish(db)
 const rows=(await db.query('select * from lessons')).rows
 assert.equal(rows.length,1);assert.equal(rows[0].course_id,null);assert.equal(rows[0].news_eligible,true);assert.equal(rows[0].published,true)
 assert.deepEqual((await db.query("select value from settings where key='other'")).rows[0].value,{keep:true})
 assert.equal((await db.query("select count(*)::int n from settings where key like 'news-automation:receipt:%'")).rows[0].n,1)
 const last=(await db.query("select value from settings where key='news-automation:last'")).rows[0].value
 assert.equal(last.published_on,today)
 await publish(db)
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,1)
 }finally{await db.close()}
})
test('SQL treats hostile dollar quotes and apostrophes as article text',async()=>{
 const db=await database()
 try{
 const article=payload();article.body+=" $publish$; delete from public.lessons; -- ' $$ ";article.title+=" ' $publish$"
 await publish(db,article)
 assert.equal((await db.query('select body from lessons')).rows[0].body,article.body.trim())
 }finally{await db.close()}
})
test('matching source article, normalized title or body is idempotent across edits',async()=>{
 for(const field of ['title','body','source','legacy_source']){
  const article=payload(),old={id:99,title:'Other older title',body:'Different body',editorial:{sources:[]}}
  if(field==='title')old.title=article.title.toUpperCase()
  if(field==='body')old.body=article.body.toUpperCase()
  if(field==='source')old.editorial.sources=[{url:article.editorial.sources[0].url+'?utm_source=old#fragment'}]
  if(field==='legacy_source')old.body='Old article with [source]('+article.editorial.sources[0].url+'?utm_campaign=old).'
  const result=await runPublisher({payload:article,projectRef:'dcdepwdxvadhludnubis',query:async sql=>{assert.equal(sql,buildCatalogSql());return {signature:'a'.repeat(32),news:[old],courses:[],last:null}},publish:true,now,localCourses:[]})
  assert.equal(result.status,'duplicate');assert.equal(result.id,99)
 }
})
test('cadence admits the third local calendar day and refuses earlier days',async()=>{
 const db=await database()
 try{
 await db.exec("insert into settings(key,value) values('news-automation:last',jsonb_build_object('published_on',((clock_timestamp() at time zone 'Asia/Qyzylorda')::date-2)::text))")
 await assert.rejects(publish(db),/cadence_not_due/)
 await db.exec('rollback')
 await db.exec("update settings set value=jsonb_build_object('published_on',((clock_timestamp() at time zone 'Asia/Qyzylorda')::date-3)::text) where key='news-automation:last'")
 await publish(db)
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,1)
 }finally{await db.close()}
})
test('CLI transport uses executable arguments, only one result envelope, private temporary SQL and cleanup',async()=>{
 const workdir=path.resolve('test-results/news-publish-transport')
 await mkdir(workdir,{recursive:true})
 try{
 const query=await createCliQuery({cli:process.execPath,projectRef:'dcdepwdxvadhludnubis',workdir,execute:async(exe,args,options)=>{
  assert.equal(exe,process.execPath);assert.equal(options.shell,false);assert.equal(options.windowsHide,true)
  assert.deepEqual(args.slice(0,5),['db','query','--linked','--project-ref','dcdepwdxvadhludnubis'])
  assert.deepEqual(args.slice(-2),['--output','json'])
  assert.equal(await readFile(args[6],'utf8'),'select private_body')
  return {stdout:'{"rows":[{"result":{"status":"dry_run"}}]}'}
 }})
 assert.deepEqual(await query('select private_body'),{status:'dry_run'})
 assert.deepEqual(await readdir(path.join(workdir,'test-results/news-publisher')),[])
 assert.throws(()=>parseCliEnvelope('{"rows":[{"result":{}},{"result":{}}]}'),/cli_result_envelope/)
 assert.throws(()=>parseCliEnvelope('private database error'),/cli_json_response/)
 }finally{
  const base=path.resolve('test-results'),target=path.resolve(workdir),relative=path.relative(base,target)
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))
  await rm(target,{recursive:true,force:true})
 }
})
test('batch validation rejects any invalid entry or duplicate before querying or writing',async()=>{
 let reads=0
 const query=async()=>{reads++;throw Error('unexpected_query')}
 const sameSource=article(2);sameSource.editorial.sources=article(1).editorial.sources;sameSource.body+=' '+sameSource.editorial.sources[0].url
 const firstBody=article(1),sameBody=article(2);firstBody.body+=' '+sameBody.editorial.sources[0].url;sameBody.body=firstBody.body
 for(const entries of [[],Array.from({length:21},(_,i)=>article(i)),[article(1),{...article(2),minutes:0}],[article(1),article(1)],[article(1),{...article(2),title:article(1).title}],[firstBody,sameBody],[article(1),sameSource]]){
  await assert.rejects(runPublisher({payload:entries,projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]}))
 }
 assert.equal(reads,0)
 assert.equal(validateNewsBatch([article(1),article(2)],{now}).length,2)
})
test('batch is atomic, idempotent, and subject to one cadence check',async()=>{
 const db=await database()
 try{
 const query=queryDatabase(db),entries=[article(1),article(2),article(3)]
 const prepared=buildPublishSql(entries,await catalog(db),{now})
 const dry=await runPublisher({payload:entries,projectRef:'dcdepwdxvadhludnubis',query,now,localCourses:[]})
 assert.equal(dry.status,'dry_run');assert.equal(dry.publish_count,3)
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,0)
 const result=await runPublisher({payload:entries,projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 assert.equal(result.status,'published');assert.deepEqual(result.ids,[1,2,3])
 const last=(await db.query("select value from settings where key='news-automation:last'")).rows[0].value
 assert.deepEqual(last.lesson_ids,[1,2,3]);assert.equal(last.batch_key,result.batch_key)
 const durableRetry=await query(prepared)
 assert.equal(durableRetry.status,'duplicate');assert.deepEqual(durableRetry.ids,[1,2,3])
 const retry=await runPublisher({payload:entries,projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 assert.equal(retry.status,'duplicate');assert.deepEqual(retry.ids,[1,2,3]);assert.equal(retry.batch_key,result.batch_key)
 const blocked=await runPublisher({payload:[article(4),article(5)],projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 assert.equal(blocked.status,'not_due')
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,3)
 }finally{await db.close()}
})
test('failing the second article rolls back the whole batch and every receipt',async()=>{
 const db=await database()
 try{
 await db.exec("alter table lessons add constraint reject_second check(title not like '% 2')")
 await assert.rejects(runPublisher({payload:[article(1),article(2),article(3)],projectRef:'dcdepwdxvadhludnubis',query:queryDatabase(db),now,publish:true,localCourses:[]}),/reject_second/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from settings')).rows[0].n,0)
 await db.exec("alter table lessons drop constraint reject_second; alter table settings add constraint reject_batch_receipt check(key not like 'news-automation:batch-receipt:%')")
 await assert.rejects(runPublisher({payload:[article(1),article(2)],projectRef:'dcdepwdxvadhludnubis',query:queryDatabase(db),now,publish:true,localCourses:[]}),/reject_batch_receipt/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int n from settings')).rows[0].n,0)
 }finally{await db.close()}
})
test('partial existing batch skips exact existing articles and publishes the remainder together',async()=>{
 const db=await database()
 try{
 const query=queryDatabase(db)
 await runPublisher({payload:article(1),projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 let result=await runPublisher({payload:[article(1),article(2)],projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 assert.equal(result.status,'not_due')
 await db.exec("update settings set value=jsonb_build_object('published_on',((clock_timestamp() at time zone 'Asia/Qyzylorda')::date-3)::text) where key='news-automation:last'")
 result=await runPublisher({payload:[article(1),article(2)],projectRef:'dcdepwdxvadhludnubis',query,now,publish:true,localCourses:[]})
 assert.equal(result.status,'published');assert.deepEqual(result.ids,[1,2]);assert.deepEqual(result.inserted_ids,[2])
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,2)
 }finally{await db.close()}
})
test('a rolling source can announce a later dated event without duplicating the same event',async()=>{
 const current=article(1),old={...article(2),id:10}
 current.editorial.sources[0].url='https://example.org/changelog';current.body+=' https://example.org/changelog'
 delete old.event_on
 old.editorial.sources=[{url:'https://example.org/changelog'}];old.editorial.event_on=today
 const query=async sql=>{
  assert.equal(sql,buildCatalogSql())
  return {signature:'a'.repeat(32),news:[old],courses:[],last:null}
 }
 assert.equal((await runPublisher({payload:current,projectRef:'dcdepwdxvadhludnubis',query,now,localCourses:[]})).status,'duplicate')
 old.editorial.event_on=calendarDate(new Date(now.valueOf()-86400000))
 assert.equal((await runPublisher({payload:current,projectRef:'dcdepwdxvadhludnubis',query,now,localCourses:[]})).status,'dry_run')
 delete old.editorial.event_on
 assert.equal((await runPublisher({payload:current,projectRef:'dcdepwdxvadhludnubis',query,now,localCourses:[]})).status,'dry_run')
})
test('published course and historical authored bodies are both protected',async()=>{
 const sample=payload()
 for(const local of [false,true])await assert.rejects(runPublisher({payload:sample,projectRef:'dcdepwdxvadhludnubis',query:async()=>({signature:'a'.repeat(32),news:[],courses:local?[]:[{id:5,body:sample.body}],last:null}),now,localCourses:local?[{id:'archive:5',body:sample.body}]:[]}),/course_overlap/)
 const localCourses=await loadLocalCourses()
 assert.equal(localCourses.length,47)
 assert.ok(localCourses.some(item=>item.id==='path:foundations:block-1'))
 const paths=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url),'utf8'))
 const pathLesson=paths.courses[0].lessons[0]
 const copy={...article(20),body:pathLesson.body+`\nДата: ${today}\nИсточник: https://example.org/blog/release-20`}
 await assert.rejects(runPublisher({payload:copy,projectRef:'dcdepwdxvadhludnubis',query:async()=>({signature:'a'.repeat(32),news:[],courses:[],last:null}),now,localCourses}),/course_overlap/)
 await assert.rejects(loadLocalCourses(new URL('../content/ai-practice-2026-10-25/training.json',import.meta.url),new URL('../test-results/missing-path-course.json',import.meta.url)),/ENOENT/)
})
test('catalog changes, cadence and receipt failure leave no partial publication',async()=>{
 const db=await database()
 try{
 const snapshot=await catalog(db)
 await db.exec("insert into lessons(title,kind,body,published) values('changed','lesson','body',false)")
 await assert.rejects(publish(db,payload(),snapshot),/catalog_changed/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from settings')).rows[0].n,0)
 await publish(db)
 const second=payload();second.title+=' второй';second.body+=' уникальное продолжение';second.editorial.sources[0].url+='-2';second.body=second.body.replace('https://example.org/blog/release','https://example.org/blog/release-2')
 await assert.rejects(publish(db,second),/cadence_not_due/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,2)
 await db.exec("delete from settings where key='news-automation:last'; alter table settings add constraint reject_receipt check (key not like 'news-automation:receipt:%') not valid;")
 await assert.rejects(publish(db,second),/reject_receipt/)
 await db.exec('rollback')
 assert.equal((await db.query('select count(*)::int n from lessons')).rows[0].n,2)
 }finally{await db.close()}
})
