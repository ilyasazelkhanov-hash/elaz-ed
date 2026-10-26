import {writeFile,mkdir} from 'node:fs/promises'
import {training as baseTraining} from './training.mjs'
import {composeTraining} from './training-modules.mjs'
import assert from 'node:assert/strict'
import {renderWalkthrough} from './training-walkthroughs.mjs'
import {renderLab} from './training-labs.mjs'
import {lessonAnimationByKey,lessonAnimations} from '../../src/lib/lesson-animations.ts'
const renderLessonAnimation=key=>{const id=lessonAnimationByKey[key];if(!id)return '';return ['## Наглядно: разберём процесс','','Последовательность: '+lessonAnimations[id].stages.map(s=>s.label).join(' → ')+'. Смотри автоматически или переключай шаги самостоятельно.','','```lesson-animation',id,'```',''].join('\n')+'\n'}
const training=composeTraining(baseTraining)
const dir=new URL('./',import.meta.url)
const assets=new URL('../../public/learning/ai-practice/',dir)
await mkdir(assets,{recursive:true})
const origin='https://elaz-ed.vercel.app'
const link=url=>url.startsWith('/')?origin+url:url
const lessons=training.map((l,i)=>{
 const image=`/learning/ai-practice/lesson-${i+1}.png`
 const body=`${l.module}\n\nАктуальность: 26 октября 2026. Лимиты и доступность сверяй в своём аккаунте перед запуском.\n\n## Чему научишься\n\n${l.goal}\n\nОриентир: ${l.minutes} минут вместе с практикой. Сохраняй файлы: они пригодятся в итоговом проекте.\n\n![Схема урока](${origin+image})\n\n## Как это работает\n\n${l.theory}\n\n${renderLessonAnimation(l.key)}${l.key==='block-4'?`![Учебный пример: иерархия заголовка, даты и действия](${origin}/learning/ai-practice/layout-example.png)\n\n`:''}## Какие инструменты выбрать\n\n${l.tools}\n\n## Бесплатно и платно\n\n${l.free}\n\n## Первый запуск\n\n${renderWalkthrough(l.key,origin)}\n\n## Разобранный пример\n\n${l.example}\n\n## Сделай по шагам\n\n${l.steps.map((s,n)=>`${n+1}. ${s}`).join('\n\n')}\n\n## Самостоятельная работа\n\n${l.task}\n\n## Критерии готовности\n\n${l.check}\n\n## Проверь себя\n\n${l.question}\n\nСначала ответь своими словами, затем сравни с разбором.\n\n## Разбор ответа\n\n${l.answer}\n\n${renderLab(l.key,origin)}## Ссылки для практики\n\n${l.links.map(([text,url])=>`- [${text}](${link(url)})`).join('\n')}\n\n${i<training.length-1?'Следующий шаг: сохрани результат этого урока и переходи к следующему.':'Курс завершён, когда комплект прошёл проверку и повторный запуск. Сохрани свою оценку и список следующих улучшений.'}`
 assert(body.length>2200,l.title)
 return {key:l.key,title:l.title,subtitle:l.goal,body,cover_url:origin+image,minutes:l.minutes,position:i+1,category:l.module}
})
const payload={revision:'ai-practice-training-2026-10-26-v3',checked_at:'2026-10-26',course:{title:'ИИ с нуля: текст, медиа, автоматизация и вайбкодинг',subtitle:'5 модулей · 14 уроков · практика с бесплатными и платными сервисами',description:'Базовое обучение для новичка: пойми возможности ИИ, выбери инструмент и создай собственный результат.\n\n1. **Знакомство с ИИ** — модели, агенты, инструменты, плагины, коннекторы, Skills, MCP и OpenBot.\n2. **Работа с текстом** — исследования через Agent Reach, проверка фактов, запросы и редактирование.\n3. **Работа с медиа** — изображения, видео, голос и музыка: от идеи до монтажа.\n4. **Автоматизация** — сначала встроенные задачи ChatGPT, Claude и Gemini, затем n8n: данные между шагами, ошибки и повторы.\n5. **Вайбкодинг** — первая страница, отдельная практика в OpenCode и итоговый проект.\n\nВ каждом уроке: объяснение, разобранный пример, шаги, самостоятельная работа, проверка и ссылки. Есть схемы, управляемые учебные анимации и файлы для практики. В 10 уроках добавлены дополнительные задания: выбор инструмента, процедура Skill, Gemini Notebook, расчёт отчёта, Gamma 5, нарезка записи, Claude Desktop, карта бизнес-процесса, приёмка кода и портфолио на 30 дней. Показаны бесплатный старт, ограничения и причины перехода на платный доступ; покупка подписок не является условием прохождения. Базовый маршрут — около 9 часов с практикой; дополнительные задания проходи в своём темпе. Возможности и условия сверены по официальным страницам на 26 октября 2026. Каталог обзоров инструментов находится в новостях.'},lessons}
await writeFile(new URL('training.json',dir),JSON.stringify(payload,null,2)+'\n')
await writeFile(new URL('training-media.json',dir),JSON.stringify(training.map((l,i)=>({n:i+1,title:l.title,diagram:l.diagram,gif:l.gif})),null,2)+'\n')
const sql=`begin;
select pg_advisory_xact_lock(hashtext('ai-practice-training-2026-10-26-v3'));
do $training$
declare p jsonb := $payload$${JSON.stringify(payload)}$payload$::jsonb; mapping jsonb; newer jsonb; extra jsonb; added jsonb := '{}'::jsonb; cid bigint; revision_cid bigint; l jsonb; lid bigint;
begin
select value->'lessons',(value->>'course_id')::bigint into mapping,cid from public.settings where key='content_import:ai-practice-2026-10-25-v1';
select value->'lessons',(value->>'course_id')::bigint into newer,revision_cid from public.settings where key='content_revision:ai-practice-2026-10-26-v2';
if cid is null or revision_cid is distinct from cid then raise exception 'Course mappings missing or inconsistent'; end if;
select value->'lessons' into extra from public.settings where key='content_revision:ai-practice-training-2026-10-26-v3';
mapping := mapping || newer || coalesce(extra,'{}'::jsonb);
if (select count(*) from public.lessons where course_id=cid) not in (10,13,14) then raise exception 'Unexpected course lesson count'; end if;
for l in select value from jsonb_array_elements(p->'lessons') loop
 lid := (mapping->>(l->>'key'))::bigint;
 if lid is null then
  if l->>'key' not in('block-connections','block-music','block-opencode','block-native-automation') then raise exception 'Missing lesson mapping %',l->>'key'; end if;
  insert into public.lessons(kind,title,body,course_id,position,published,published_at,free_preview,xp,quiz) values('lesson',l->>'title',l->>'body',cid,(l->>'position')::int,true,now(),true,100,'[]'::jsonb) returning id into lid;
 end if;
 added := added || jsonb_build_object(l->>'key',lid);
 update public.lessons set title=l->>'title',subtitle=l->>'subtitle',body=l->>'body',cover_url=l->>'cover_url',minutes=(l->>'minutes')::int,position=(l->>'position')::int,category=l->>'category' where id=lid and course_id=cid;
 if not found then raise exception 'Wrong course lesson %',lid; end if;
end loop;
update public.courses set title=p->'course'->>'title',subtitle=p->'course'->>'subtitle',description=p->'course'->>'description' where id=cid;
insert into public.settings(key,value) values('content_revision:ai-practice-training-2026-10-26-v3',jsonb_build_object('course_id',cid,'lessons',added,'lesson_count',14,'version',p->>'revision')) on conflict(key) do update set value=excluded.value;
end; $training$;
commit;
select id,title,subtitle from public.courses where id=(select (value->>'course_id')::bigint from public.settings where key='content_revision:ai-practice-training-2026-10-26-v3');
`
await writeFile(new URL('training.sql',dir),sql)
await writeFile(new URL('brief.md',assets),'# Учебный бриф: клуб «Фокус»\n\nВсе данные вымышлены, не публиковать как реальное событие.\n\n- Аудитория: новички в автоматизации.\n- Тема: первая полезная автоматизация.\n- Дата: 7 ноября 2026.\n- Время: 19:00, Алматы (UTC+5).\n- Длительность: 45 минут.\n- Формат: онлайн.\n- Места: 20.\n- Участие: бесплатно.\n- Ссылка регистрации: пока отсутствует.\n- Призыв для учебного черновика: «Сохрани дату».\n\nКритерии: факты совпадают с брифом; нет выдуманных гарантий; обязательные поля указаны; неизвестное помечено.\n')
await writeFile(new URL('evidence.csv',assets),'claim,url,checked_at,evidence_type,status,note\n"Возможность инструмента","вставь прямую ссылку","дата проверки","официальная документация","needs_check","что надо сверить"\n"Наблюдение пользователя","вставь ссылку","дата проверки","мнение","needs_check","не обобщать на всех"\n')
await writeFile(new URL('storyboard.csv',assets),'start_seconds,end_seconds,visual,text,audio\n0,4,"Проблема: рутина","Рутина съедает вечер?","Короткая фраза"\n4,10,"Заявка → таблица → черновик","Первая автоматизация","Объяснение одного действия"\n10,15,"Приглашение","7 ноября · 19:00 Алматы","Сохрани дату"\n')
await writeFile(new URL('registrations.json',assets),JSON.stringify([{name:'Алия',email:'A@EXAMPLE.COM'},{name:'Бек',email:'a@example.com'},{name:'',email:'bad'}],null,2)+'\n')
console.log(JSON.stringify({lessons:lessons.length,minutes:training.reduce((s,l)=>s+l.minutes,0),characters:lessons.reduce((s,l)=>s+l.body.length,0)}))
