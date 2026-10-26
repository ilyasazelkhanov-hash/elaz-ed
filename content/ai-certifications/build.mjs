import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const dir=new URL('./',import.meta.url)
const source=JSON.parse(await readFile(new URL('source.json',dir),'utf8'))
const checks=JSON.parse(await readFile(new URL('link-checks.json',dir),'utf8'))
const featured=['r0323','r0188','r0296','r0256','openai-academy-ai-foundations','kaggle-learn-intro-to-machine-learning','r0153','r0189']
function topic(title){
 if(/marketing|business|sales|finance|workplace|workspace|productivity|hr\b/i.test(title))return 'business'
 if(/image|video|design|creative|content|sora|firefly/i.test(title))return 'creative'
 if(/agent|python|coding|code|rag\b|lang|mcp\b|n8n|software|programming/i.test(title))return 'coding'
 if(/data|machine|learning|deep|neural|infrastructure|infiniband|network|gpu/i.test(title))return 'data'
 return 'fundamentals'
}
const courses=source.catalog.map((c,i)=>{
 assert(/^[a-z0-9-]{1,100}$/.test(c.id));assert(c.url.startsWith('https://'))
 const check=checks.find(x=>x.id===c.id)
 return {id:c.id,title:c.title,provider:c.provider,topic:topic(c.title),credential:c.credential,credential_note:String(c.research?.credential_type??c.review?.fields?.credential_free??'Уточни вид документа у провайдера').replace(/https?:\/\/\S+/g,'').slice(0,350),free_course:c.freeCourse??null,free_credential:c.freeCredential??null,availability:check?.availability??'unverified',checked_at:check?.checked_at??null,url:c.url,position:featured.includes(c.id)?featured.indexOf(c.id):100+i}
})
assert.equal(courses.length,353);assert.equal(new Set(courses.map(x=>x.id)).size,353);assert.equal(new Set(courses.map(x=>x.url)).size,353)
const prizes=[
 {id:'r0323',title:'Сертификационный маршрут: AI for Beginners',emoji:'🏅',mode:'day',stock:null,day_from:9,day_to:24},
 {id:'r0188',title:'Сертификационный маршрут: AI Agents',emoji:'🤗',mode:'instant',stock:10,day_from:9,day_to:24},
 {id:'r0296',title:'Бейдж-маршрут: Introduction to Generative AI',emoji:'✨',mode:'instant',stock:10,day_from:9,day_to:24},
 {id:'kaggle-learn-intro-to-machine-learning',title:'Сертификационный маршрут: Machine Learning',emoji:'🧠',mode:'instant',stock:10,day_from:9,day_to:24},
]
for(const p of prizes)assert(courses.some(c=>c.id===p.id))
const batch='certification_catalog:aicertified-2026-10-26-v1'
await writeFile(new URL('catalog.json',dir),JSON.stringify({source:source.source,retrieved:source.retrieved,courses,prizes},null,2)+'\n')
const data=JSON.stringify({courses,prizes})
await writeFile(new URL('import.sql',dir),`begin;
select pg_advisory_xact_lock(hashtext('${batch}'));
do $cert_import$
declare p jsonb := $cert_catalog$${data}$cert_catalog$::jsonb; c jsonb; r jsonb; rid bigint; rewards jsonb:='{}'::jsonb;
begin
 if exists(select 1 from public.settings where key='${batch}') then return; end if;
 for c in select value from jsonb_array_elements(p->'courses') loop
 insert into public.ai_certifications(id,title,provider,topic,credential,credential_note,free_course,free_credential,availability,checked_at,url,position)
 values(c->>'id',c->>'title',c->>'provider',c->>'topic',c->>'credential',c->>'credential_note',(c->>'free_course')::boolean,(c->>'free_credential')::boolean,c->>'availability',(c->>'checked_at')::timestamptz,c->>'url',(c->>'position')::integer)
 on conflict(id) do update set title=excluded.title,provider=excluded.provider,topic=excluded.topic,credential=excluded.credential,credential_note=excluded.credential_note,free_course=excluded.free_course,free_credential=excluded.free_credential,availability=excluded.availability,checked_at=excluded.checked_at,url=excluded.url,position=excluded.position,updated_at=now();
 end loop;
 for r in select value from jsonb_array_elements(p->'prizes') loop
 insert into public.advent_rewards(doors,title,description,emoji,stock,position,kind,payload,mode,day_from,day_to)
 values(1,r->>'title','Подарок открывает только этот маршрут сразу, независимо от стрика. Обучение и документ выдаёт внешний провайдер.',r->>'emoji',(r->>'stock')::integer,50,'certification',jsonb_build_object('certification_id',r->>'id'),r->>'mode',(r->>'day_from')::integer,(r->>'day_to')::integer) returning id into rid;
 rewards:=rewards||jsonb_build_object(r->>'id',rid);
 end loop;
 insert into public.settings(key,value) values('${batch}',jsonb_build_object('count',353,'date','2026-10-26','rewards',rewards));
end $cert_import$;
commit;
select value from public.settings where key='${batch}';
`)
console.log(JSON.stringify({courses:courses.length,providers:new Set(courses.map(c=>c.provider)).size,certificates:courses.filter(c=>c.credential==='certificate').length,badges:courses.filter(c=>c.credential==='badge').length,adventPrizes:prizes.length}))
