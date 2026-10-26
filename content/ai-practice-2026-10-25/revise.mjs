import {readFile,writeFile} from 'node:fs/promises'
import {supplement} from './supplement.mjs'
import {tools} from '../elaz-ed-2026-10/tools.mjs'
const dir=new URL('./',import.meta.url)
const original=JSON.parse(await readFile(new URL('payload.json',dir),'utf8'))
const base=original.lessons[0]
const added=supplement.flatMap((p,i)=>{
 const common={...base,source_index:undefined,title:p.title,subtitle:p.body.split('\n')[0].slice(0,190),category:'Агенты и исследование',emoji:p.emoji,cover_url:p.image,body:p.body,minutes:8}
 return [{...common,key:`post-${p.key}`,course_key:null,position:57+i},
 {...common,key:`block-${p.key}`,title:`${9+i}. ${p.title}`,course_key:'ai-practice',position:9+i,xp:100}]
})
const revision={batch:'content_revision:ai-practice-2026-10-26-v2',original_batch:original.batch,updates:original.lessons,added,legacy:tools.filter(x=>[56,58].includes(x.source_index))}
const encoded=JSON.stringify(revision)
const sql=`begin;
select pg_advisory_xact_lock(hashtext('${revision.batch}'));
do $revision$
declare p jsonb := $payload$${encoded}$payload$::jsonb; oldmap jsonb; legacymap jsonb; newmap jsonb; cid bigint; l jsonb; lid bigint;
begin
select value->'lessons',(value->>'course_id')::bigint into oldmap,cid from public.settings where key=p->>'original_batch';
if cid is null then raise exception 'Original course not found'; end if;
for l in select value from jsonb_array_elements(p->'updates') loop
 lid := (oldmap->>(l->>'key'))::bigint;
 if lid is null then raise exception 'Missing lesson mapping %',l->>'key'; end if;
 update public.lessons set title=l->>'title',subtitle=l->>'subtitle',body=l->>'body',cover_url=l->>'cover_url' where id=lid;
 if not found then raise exception 'Missing lesson %',lid; end if;
end loop;
select value->'lessons' into legacymap from public.settings where key='content_import:elaz-ed-2026-10-v1';
for l in select value from jsonb_array_elements(p->'legacy') loop
 lid := (legacymap->>(l->>'key'))::bigint;
 if lid is null then raise exception 'Missing legacy mapping %',l->>'key'; end if;
 update public.lessons set body=l->>'body',subtitle=l->>'subtitle' where id=lid and course_id is null and title=l->>'title';
 if not found then raise exception 'Legacy lesson mismatch %',lid; end if;
end loop;
select value->'lessons' into newmap from public.settings where key=p->>'batch';
newmap := coalesce(newmap,'{}'::jsonb);
for l in select value from jsonb_array_elements(p->'added') loop
 lid := (newmap->>(l->>'key'))::bigint;
 if lid is null then
 insert into public.lessons(kind,title,subtitle,category,emoji,gradient,cover_url,body,minutes,xp,pinned,published,published_at,course_id,position,free_preview,quiz)
 values('lesson',l->>'title',l->>'subtitle',l->>'category',l->>'emoji',l->>'gradient',l->>'cover_url',l->>'body',(l->>'minutes')::int,(l->>'xp')::int,false,true,now()+case when l->>'key'='post-agent-reach' then interval '1 second' else interval '0 seconds' end,case when l->>'course_key' is null then null else cid end,(l->>'position')::int,true,'[]'::jsonb) returning id into lid;
 newmap := newmap || jsonb_build_object(l->>'key',lid);
 end if;
end loop;
update public.courses set subtitle='58 прикладных тем в 10 блоках · OpenBot и Agent Reach',description='Практический курс: агенты, исследования, изображения, видео, голос, кодинг и локальный ИИ. 58 материалов из ленты сгруппированы в 10 блоков. Каждый блок содержит практику и критерии результата. В отдельных уроках — OpenBot и Agent Reach. Прямые ссылки ведут к инструментам и документации. Возможности и условия сервисов проверяй перед применением.' where id=cid;
insert into public.settings(key,value) values(p->>'batch',jsonb_build_object('course_id',cid,'lessons',newmap,'feed_count',2,'course_lesson_count',2)) on conflict(key) do update set value=excluded.value;
end; $revision$;
commit;
select value from public.settings where key='${revision.batch}';
`
await writeFile(new URL('revision.json',dir),JSON.stringify(revision,null,2)+'\n')
await writeFile(new URL('revision.sql',dir),sql)
console.log(JSON.stringify({updated:revision.updates.length,added:added.length,legacy:revision.legacy.length}))
