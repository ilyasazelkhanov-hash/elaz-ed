import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {doors,rewards,offers,telegramPosts} from './catalog.mjs'
const dir=new URL('./',import.meta.url)
assert.equal(doors.length,24);assert.equal(new Set(doors.map(x=>x.day)).size,24)
for(const d of doors){assert(d.body.length>600);assert(d.prize.length>100);assert(d.title.length<120);for(const q of d.quiz)assert(q.correct>=0&&q.correct<q.options.length)}
for(const r of rewards){assert(r.kind==='lesson'||r.payload.text.length>1500);if(r.payload?.text)assert(r.payload.text.length<=6000);assert(!/30.летним|ты.*эксперт.*стаж/i.test(r.payload?.text??''))}
for(const post of telegramPosts){assert(post.text.length<=3800);assert(post.text.includes('#ТолькоВКанале'))}
const batch='advent_premium:2026-10-26-v1'
const payload={batch,doors,rewards,offers,telegramPosts}
await writeFile(new URL('payload.json',dir),JSON.stringify(payload,null,2)+'\n')
const json=JSON.stringify({doors,rewards})
assert(!json.includes('$premium_content$'))
await writeFile(new URL('import.sql',dir),`begin;
select pg_advisory_xact_lock(hashtext('${batch}'));
do $premium_import$
declare p jsonb := $premium_content$${json}$premium_content$::jsonb; d jsonb; r jsonb; rid bigint; target_lesson bigint; mapping jsonb := '{}'::jsonb; updated_doors integer:=0; preserved_doors integer:=0;
begin
 if exists(select 1 from public.settings where key='${batch}') then return; end if;
 if not exists(select 1 from public.advent_rewards where id=9 and kind='message') then raise exception 'Expected existing prompt reward'; end if;
 for d in select value from jsonb_array_elements(p->'doors') loop
  if exists(select 1 from public.advent_opens where day=(d->>'day')::integer) then preserved_doors:=preserved_doors+1; continue; end if;
  update public.advent_doors set kind=d->>'kind',title=d->>'title',subtitle=d->>'subtitle',emoji=d->>'emoji',body=d->>'body',quiz=d->'quiz',prize=d->>'prize',arcade=d->'arcade',xp=(d->>'xp')::integer,updated_at=now() where day=(d->>'day')::integer;
  if not found then raise exception 'Missing door %',d->>'day'; end if;
  updated_doors:=updated_doors+1;
 end loop;
 for r in select value from jsonb_array_elements(p->'rewards') loop
  if r->>'existing_id' is not null then
   rid:=(r->>'existing_id')::bigint;
   -- Upgrade the already-issued message in place, retaining all award codes.
   update public.advent_rewards set title=r->>'title',description=r->>'description',emoji=r->>'emoji',payload=r->'payload' where id=rid and kind='message';
  else
   if r->>'kind'='lesson' then
    select id into strict target_lesson from public.lessons where title=r->>'lesson_title' and course_id=(select id from public.courses where title='Ролики с ИИ: от идеи до MP4') and not free_preview;
    r:=jsonb_set(r,'{payload}',jsonb_build_object('lesson_id',target_lesson));
   end if;
   insert into public.advent_rewards(doors,title,description,emoji,stock,position,kind,payload,mode,day_from,day_to)
   values((r->>'doors')::integer,r->>'title',r->>'description',r->>'emoji',null,10+jsonb_object_length_safe(mapping),r->>'kind',r->'payload',r->>'mode',(r->>'day_from')::integer,(r->>'day_to')::integer) returning id into rid;
  end if;
  mapping:=mapping||jsonb_build_object(r->>'key',rid);
 end loop;
 update public.advent_rewards set title='MCP на практике: закрытый урок',description='Полный урок курса «Ролики с ИИ»: подключение инструментов и проверка рабочего процесса.' where id=10 and kind='lesson';
 insert into public.settings(key,value) values('${batch}',jsonb_build_object('updated_doors',updated_doors,'preserved_opened_doors',preserved_doors,'rewards',mapping,'date','2026-10-26'));
end $premium_import$;
commit;
select value from public.settings where key='${batch}';
`.replace('jsonb_object_length_safe(mapping)',"(select count(*)::integer from jsonb_object_keys(mapping))"))
const editorial={posts:telegramPosts,date:'2026-10-26',destination:'@OGCRE8R'}
await writeFile(new URL('telegram-only.sql',dir),`insert into public.settings(key,value) values('telegram_editorial:club-lab-2026-10-26',$editorial$${JSON.stringify(editorial)}$editorial$::jsonb) on conflict(key) do nothing;\n`)
await writeFile(new URL('telegram-only.md',dir),telegramPosts.map(p=>`# ${p.key}\n\n${p.text}`).join('\n\n---\n\n'))
console.log(JSON.stringify({doors:doors.length,rewards:rewards.length,offers:offers.length,telegramOnly:telegramPosts.length,characters:doors.reduce((n,d)=>n+d.body.length,0)}))
