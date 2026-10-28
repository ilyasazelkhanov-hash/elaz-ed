import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {pathToFileURL,fileURLToPath} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {academyDemoSample} from './academy-demo-sample.mjs'
import {publicAcademyCatalog} from './academy-public.mjs'
import {writeCourseBooks} from './academy-books.mjs'
import {writeModuleIllustrations} from './academy-module-illustrations.mjs'
import {writeConceptIllustrations} from './academy-concept-illustrations.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const assert=(condition,message)=>{if(!condition)throw Error(message)}
const clone=value=>structuredClone(value)
const words=blocks=>blocks.map(b=>b.text||b.body||'').join(' ').split(/\s+/).filter(Boolean).length
async function writeIfChanged(file,text){
 let previous
 try{previous=await readFile(file,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 if(previous!==text)await writeFile(file,text)
}
export function composeLearningCatalog(base,packs){
 const result=clone(base),ids=new Set(),allCodes=new Set(result.entities.map(n=>n.code))
 const put=(entity)=>{const i=result.entities.findIndex(n=>n.code===entity.code);if(i<0)result.entities.push(entity);else result.entities[i]=entity;allCodes.add(entity.code)}
 const authored=(code,kind,parent,title,data,position=0)=>({code,kind,parent_code:parent,title,position,state:'published',version:1,seed_managed:false,data})
 for(const pack of packs){
  const code=pack.course_code,course=result.entities.find(n=>n.code===code&&n.kind==='course')
  assert(course&&!ids.has(code),'Unknown or duplicate authored course');ids.add(code)
  const prefix=`${code}-`,packId=`og-original:${code}:1`
  const expected=result.entities.filter(n=>n.kind==='lesson'&&n.code.startsWith(prefix))
  assert(pack.lessons?.length===expected.length&&expected.length===16,`${code}: expected sixteen authored lessons`)
  assert(new Set(pack.lessons.map(n=>n.code)).size===16,`${code}: duplicate lesson`)
  const mark=data=>({...data,authored_pack:packId})
  for(const item of [course,...result.entities.filter(n=>n.kind==='module'&&n.parent_code===code)])put({...item,state:'published',seed_managed:false,data:mark({...item.data,...(item.kind==='course'?pack.course?.data:{})}),title:item.kind==='course'?(pack.course?.title||item.title):item.title})
  const rubricCode=`${code}-AUTH-RUBRIC`
  const criteria=pack.capstone?.criteria||[{code:'result',title:'Работа соответствует заданию',max_score:40},{code:'verification',title:'Результат проверен и воспроизводится',max_score:40},{code:'explanation',title:'Решение объяснено своими словами',max_score:20}]
  assert(criteria.length&&criteria.every(c=>c.code&&Number(c.max_score)>0),'Missing rubric criteria')
  put(authored(rubricCode,'rubric',null,`Проверка практики · ${code}`,mark({criteria,critical_gates:['no_secrets','original_work']})))
  const practiceRubric=`${code}-PRACTICE-RUBRIC`
  put(authored(practiceRubric,'rubric',null,`Практика занятия · ${code}`,mark({criteria:[{code:'task',title:'Выполнены критерии именно этого занятия',max_score:40},{code:'check',title:'Приведено наблюдение или проверка результата',max_score:40},{code:'explain',title:'Решение и ограничения объяснены своими словами',max_score:20}],critical_gates:['no_secrets','original_work']})))
  for(const lesson of pack.lessons){
   const old=expected.find(n=>n.code===lesson.code)
   assert(old,`Unknown lesson ${lesson.code}`)
   const blocks=lesson.data?.content_blocks
   assert(Array.isArray(blocks)&&words(blocks)>=140,`${lesson.code}: insufficient authored teaching content`)
   assert(blocks.every(b=>['markdown','code','checklist','link'].includes(b.type)),`${lesson.code}: unsupported block`)
   assert(lesson.data.artifact&&lesson.data.acceptance?.length,`${lesson.code}: missing practical result`)
   put({...old,title:lesson.title||old.title,state:'published',seed_managed:false,data:mark({...old.data,...lesson.data,course_code:code,deliverable:lesson.data.artifact,criteria:lesson.data.acceptance.join('\n')})})
   let assessment=lesson.assessment
   const isFinal=old.code===`${code}-M4-L4`
   if(isFinal)assessment={...assessment,kind:'capstone',instructions:pack.capstone?.instructions||lesson.data.artifact}
   else if(!assessment&&!['microlecture','resource','guided_demo'].includes(old.data.format))assessment={kind:'assignment',instructions:`${lesson.data.artifact}\n\nКритерии:\n${lesson.data.acceptance.map(s=>`- ${s}`).join('\n')}`}
   if(assessment){
    assert(['quiz','assignment','capstone'].includes(assessment.kind),`${old.code}: invalid assessment`)
    if(assessment.kind==='quiz')assert(assessment.questions?.length>=2,`${old.code}: at least two questions required`)
    put(authored(`${old.code}-CHECK`,'assessment',old.code,isFinal?'Итоговая работа':assessment.kind==='quiz'?'Проверь себя':'Практика',mark({...assessment,...(assessment.kind!=='quiz'?{rubric_code:isFinal?rubricCode:practiceRubric}:{}),passing_score:70,max_attempts:5})))
   }
  }
  for(const source of pack.sources||[]){
   const url=new URL(source.url)
   assert(url.protocol==='https:'&&!url.username&&!url.password&&source.checked_at,`Unchecked source ${source.code}`)
   assert(source.code?.startsWith('AUTH-SRC-')&&!allCodes.has(source.code),`Duplicate source ${source.code}`)
   put(authored(source.code,'source',null,source.title,mark({url:url.href,canonical_url:url.href,type:'documentation',source_type:'documentation',language:source.language||'EN',rights_state:'public_link',link_state:'verified',checked_at:source.checked_at,rights:'Ссылка на официальный источник. Материал не перепечатывается.'})))
   for(const target of new Set([code,...source.targets||[]])){assert(expected.some(n=>n.code===target)||target===code,`Invalid source target ${target}`);result.links.push({source_code:source.code,target_code:target,usage:'supplementary',visibility:'student',start_seconds:0})}
  }
 }
 result.content_revision=createHash('sha256').update('composer:3').update(JSON.stringify(packs)).digest('hex').slice(0,16)
 return result
}

// Explicit, reviewable publication through existing validators. No direct table bypass.
export function contentSql(catalog,actor,courseCode,baseline){
 if(courseCode){
  const selected=catalog.entities.filter(n=>n.data.authored_pack===`og-original:${courseCode}:1`)
  assert(selected.some(n=>n.kind==='course'&&n.code===courseCode),'Unknown authored course')
  const selectedLinks=catalog.links.filter(link=>selected.some(n=>n.code===link.source_code))
  catalog={...catalog,entities:selected,content_revision:createHash('sha256').update('scoped-content:1').update(JSON.stringify({entities:selected,links:selectedLinks})).digest('hex').slice(0,16)}
 }
 assert(/^[a-f0-9]{16}$/.test(catalog.content_revision||''),'Invalid content revision')
 assert(/^[1-9]\d*$/.test(actor||'')&&BigInt(actor)<=9223372036854775807n,'--actor must be a positive bigint Telegram ID')
 const rows=catalog.entities.filter(n=>n.data.authored_pack)
 const ordered=[...rows].sort((a,b)=>({course:0,module:1,lesson:2,source:3,rubric:4,assessment:5}[a.kind]??9)-({course:0,module:1,lesson:2,source:3,rubric:4,assessment:5}[b.kind]??9))
 const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`
 const stages=[...rows].sort((a,b)=>({rubric:0,source:1,assessment:2,lesson:3,module:4,course:5}[a.kind]??9)-({rubric:0,source:1,assessment:2,lesson:3,module:4,course:5}[b.kind]??9))
 const shape=n=>({code:n.code,kind:n.kind,parent_code:n.parent_code??null,title:n.title,position:n.position??0,state:'published',data:n.data})
 const equal=(alias,n)=>`(${alias}->'data'=${literal(n.data)} and ${alias}->>'title'=${literal(n.title)}#>>'{}' and ${alias}->>'kind'=${literal(n.kind)}#>>'{}' and ${alias}->>'parent_code' is not distinct from ${literal(n.parent_code??null)}#>>'{}' and (${alias}->>'position')::integer=${n.position??0} and ${alias}->>'state'='published')`
 const calls=ordered.map(n=>`select to_jsonb(t) into current_node from aa_nodes t where code=${literal(n.code)}#>>'{}';
 if current_node is null or not ${equal('current_node',n)} then
 changed_codes:=array_append(changed_codes,${literal(n.code)}#>>'{}');
 perform academy_action(${actor},'admin_save',jsonb_build_object('expected_version',coalesce((current_node->>'version')::integer,0),'entity',${literal({...n,state:'draft'})}));end if;`)
 const publish=stages.map(n=>`if ${literal(n.code)}#>>'{}'=any(changed_codes) then
 foreach publish_state in array array['approved','published'] loop
 select to_jsonb(t) into current_node from aa_nodes t where code=${literal(n.code)}#>>'{}';
 perform academy_action(${actor},'admin_save',jsonb_build_object('expected_version',(current_node->>'version')::integer,'entity',current_node||jsonb_build_object('state',publish_state)));
 end loop;end if;`)
 const baselineRows=(baseline?.entities||[]).filter(n=>rows.some(r=>r.code===n.code)&&n.data.authored_pack).map(shape)
 const links=catalog.links.filter(l=>rows.some(n=>n.code===l.source_code))
 // A content digest receipt makes reruns no-ops; mismatched/manual rows fail before any mutation.
 return `-- Reviewed authored Academy pack. Apply after original curriculum import and all Academy migrations.\n-- Managed updates require an unchanged saved snapshot or an explicit previous catalog baseline.\nbegin;\ncreate table if not exists public.aa_content_receipts(revision text primary key,applied_at timestamptz default now());\ncreate table if not exists public.aa_content_node_receipts(code text primary key,snapshot jsonb not null);\nalter table public.aa_content_node_receipts enable row level security;\nrevoke all on public.aa_content_node_receipts from public,anon,authenticated;\nalter table public.aa_content_receipts enable row level security;\nrevoke all on public.aa_content_receipts from public,anon,authenticated;\ndo $content$\ndeclare current_node jsonb; publish_state text; changed_codes text[]:=array[]::text[];\nbegin\nperform pg_advisory_xact_lock(7813);\nif exists(select 1 from aa_content_receipts where revision='${catalog.content_revision}') then return;end if;\nif exists(select 1 from aa_nodes where code in(select value#>>'{}' from jsonb_array_elements(${literal(rows.map(n=>n.code))})) and (state<>'outline' or seed_managed=false) and not exists(select 1 from aa_content_node_receipts r where r.code=aa_nodes.code and r.snapshot=to_jsonb(aa_nodes)) and not exists(select 1 from jsonb_array_elements(${literal(baselineRows)}) b where b->>'code'=aa_nodes.code and b=jsonb_build_object('code',aa_nodes.code,'kind',aa_nodes.kind,'parent_code',aa_nodes.parent_code,'title',aa_nodes.title,'position',aa_nodes.position,'state',aa_nodes.state,'data',aa_nodes.data))) then raise exception 'Authored pack conflicts with edited content; review manually';end if;\n${calls.join('\n')}\n${publish.join('\n')}\ninsert into aa_source_links(source_code,target_code,usage,visibility,start_seconds) select x.source_code,x.target_code,x.usage,x.visibility,x.start_seconds from jsonb_to_recordset(${literal(links)}) as x(source_code text,target_code text,usage text,visibility text,start_seconds integer) on conflict do nothing;\ninsert into aa_content_node_receipts(code,snapshot) select n.code,to_jsonb(n) from aa_nodes n where n.code in(select value#>>'{}' from jsonb_array_elements(${literal(rows.map(n=>n.code))})) on conflict(code) do update set snapshot=excluded.snapshot;\ninsert into aa_content_receipts(revision) values('${catalog.content_revision}');\nend $content$;\ncommit;\n`
}
export async function loadAuthoredPacks(){
 const codes=JSON.parse(await readFile(path.join(root,'content/ai-academy/authored/index.json'),'utf8'))
 assert(Array.isArray(codes)&&codes.length>0&&new Set(codes).size===codes.length,'Invalid authored course index')
 return Promise.all(codes.map(async code=>{
  assert(typeof code==='string'&&/^[A-Z]+-\d{3}$/.test(code),'Invalid authored course code')
  const pack=JSON.parse(await readFile(path.join(root,`content/ai-academy/authored/${code}.json`),'utf8'))
  assert(pack.course_code===code,'Authored course identity mismatch')
  return pack
 }))
}
export async function buildContent(){
 const base=JSON.parse(await readFile(path.join(root,'content/ai-academy/catalog.normalized.json'),'utf8'))
 const packs=await loadAuthoredPacks()
 const catalog=composeLearningCatalog(base,packs)
 const publicCatalog=publicAcademyCatalog(catalog)
 await writeIfChanged(path.join(root,'content/ai-academy/demo.sample.json'),JSON.stringify(academyDemoSample(catalog),null,2)+'\n')
 await writeIfChanged(path.join(root,'content/ai-academy/catalog.public.json'),JSON.stringify(publicCatalog,null,2)+'\n')
 await writeIfChanged(path.join(root,'content/ai-academy/course-directory.json'),JSON.stringify(publicCatalog.entities.filter(n=>n.kind==='course'),null,2)+'\n')
 await writeIfChanged(path.join(root,'content/ai-academy/catalog.learning.json'),JSON.stringify(catalog,null,2)+'\n')
 const courses=catalog.entities.filter(n=>n.kind==='course')
 const completed=catalog.entities.filter(n=>n.kind==='lesson'&&n.state==='published').length
 const progress=['# Наполнение AI Academy','','Файл формируется командой `npm run academy:content` из учебного каталога.','',`Наполнены **${completed} из 448 занятий**; **${448-completed}** остаются планами. Это состояние локального учебного пакета, а не подтверждение публикации в рабочей Supabase.`,'','| Курс | Программа | Наполнено занятий |','| --- | --- | --- |',...courses.map(course=>{const count=catalog.entities.filter(n=>n.kind==='lesson'&&n.code.startsWith(course.code+'-')&&n.state==='published').length;return `| ${course.code} | ${course.title.replaceAll('|','/')} | ${count}/16 |`}), '','Наполненные пакеты перечислены в `content/ai-academy/authored/index.json`. Учебные проекты находятся в `content/ai-academy/projects/`. Публикация выполняется отдельно через проверенный SQL-экспорт конкретного курса.',''].join('\n')
 await writeIfChanged(path.join(root,'docs/ai-academy/content-status.md'),progress)
 await writeConceptIllustrations()
 await writeModuleIllustrations(catalog)
 await writeCourseBooks(base,packs)
 const actor=process.argv.find(a=>a.startsWith('--actor='))?.slice(8)
 if(actor){const out=path.join(root,'content/ai-academy/generated');await mkdir(out,{recursive:true});await writeIfChanged(path.join(out,'authored-content.sql'),contentSql(catalog,actor,process.argv.find(a=>a.startsWith('--course='))?.slice(9)))}
 console.log(`Academy content: ${packs.length} courses, ${packs.reduce((n,p)=>n+p.lessons.length,0)} authored lessons; revision ${catalog.content_revision}. ${actor?'SQL exported; no database writes.':'No database writes.'}`)
 return catalog
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildContent()
