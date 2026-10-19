import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {pathToFileURL,fileURLToPath} from 'node:url'
import path from 'node:path'
import {createHash} from 'node:crypto'
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
export function contentSql(catalog,actor){
 assert(/^[a-f0-9]{16}$/.test(catalog.content_revision||''),'Invalid content revision')
 assert(/^[1-9]\d*$/.test(actor||'')&&BigInt(actor)<=9223372036854775807n,'--actor must be a positive bigint Telegram ID')
 const rows=catalog.entities.filter(n=>n.data.authored_pack)
 const ordered=[...rows].sort((a,b)=>({course:0,module:1,lesson:2,source:3,rubric:4,assessment:5}[a.kind]??9)-({course:0,module:1,lesson:2,source:3,rubric:4,assessment:5}[b.kind]??9))
 const literal=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`
 const stages=[...rows].sort((a,b)=>({rubric:0,source:1,assessment:2,lesson:3,module:4,course:5}[a.kind]??9)-({rubric:0,source:1,assessment:2,lesson:3,module:4,course:5}[b.kind]??9))
 const calls=ordered.map(n=>`perform academy_action(${actor},'admin_save',jsonb_build_object('expected_version',coalesce((select version from aa_nodes where code=${literal(n.code)}#>>'{}'),0),'entity',${literal({...n,state:'draft'})}));`)
 const publish=stages.map(n=>`foreach publish_state in array array['approved','published'] loop
 select to_jsonb(t) into current_node from aa_nodes t where code=${literal(n.code)}#>>'{}';
 perform academy_action(${actor},'admin_save',jsonb_build_object('expected_version',(current_node->>'version')::integer,'entity',current_node||jsonb_build_object('state',publish_state)));
 end loop;`)
 const links=catalog.links.filter(l=>rows.some(n=>n.code===l.source_code))
 // A content digest receipt makes reruns no-ops; mismatched/manual rows fail before any mutation.
 return `-- Reviewed authored Academy pack. Apply after original curriculum import and all Academy migrations.\n-- Existing non-outline content is never overwritten.\nbegin;\ncreate table if not exists public.aa_content_receipts(revision text primary key,applied_at timestamptz default now());\nalter table public.aa_content_receipts enable row level security;\nrevoke all on public.aa_content_receipts from public,anon,authenticated;\ndo $content$\ndeclare current_node jsonb; publish_state text;\nbegin\nperform pg_advisory_xact_lock(7813);\nif exists(select 1 from aa_content_receipts where revision='${catalog.content_revision}') then return;end if;\nif exists(select 1 from aa_nodes where code in(select value#>>'{}' from jsonb_array_elements(${literal(rows.map(n=>n.code))})) and (state<>'outline' or seed_managed=false)) then raise exception 'Authored pack conflicts with edited content; review manually';end if;\n${calls.join('\n')}\n${publish.join('\n')}\ninsert into aa_source_links(source_code,target_code,usage,visibility,start_seconds) select x.source_code,x.target_code,x.usage,x.visibility,x.start_seconds from jsonb_to_recordset(${literal(links)}) as x(source_code text,target_code text,usage text,visibility text,start_seconds integer) on conflict do nothing;\ninsert into aa_content_receipts(revision) values('${catalog.content_revision}');\nend $content$;\ncommit;\n`
}
export async function buildContent(){
 const base=JSON.parse(await readFile(path.join(root,'content/ai-academy/catalog.normalized.json'),'utf8'))
 const packs=await Promise.all(['CORE-000','VC-101'].map(async code=>JSON.parse(await readFile(path.join(root,`content/ai-academy/authored/${code}.json`),'utf8'))))
 const catalog=composeLearningCatalog(base,packs)
 await writeIfChanged(path.join(root,'content/ai-academy/catalog.learning.json'),JSON.stringify(catalog,null,2)+'\n')
 const actor=process.argv.find(a=>a.startsWith('--actor='))?.slice(8)
 if(actor){const out=path.join(root,'content/ai-academy/generated');await mkdir(out,{recursive:true});await writeIfChanged(path.join(out,'authored-content.sql'),contentSql(catalog,actor))}
 console.log(`Academy content: ${packs.length} courses, ${packs.reduce((n,p)=>n+p.lessons.length,0)} authored lessons; revision ${catalog.content_revision}. ${actor?'SQL exported; no database writes.':'No database writes.'}`)
 return catalog
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await buildContent()
