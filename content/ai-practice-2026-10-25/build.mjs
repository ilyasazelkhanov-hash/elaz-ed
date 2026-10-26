import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {publicArticle} from './editorial.mjs'
const dir=new URL('./',import.meta.url)
const source=(await readFile(new URL('source.md',dir),'utf8')).replaceAll('\r\n','\n')
const starts=[...source.matchAll(/^### (\d{2})\. (.+)$/gm)].filter(x=>Number(x[1])<=56)
const blocks=[
  {title:'Инструменты и агенты',ids:[1,2,3,4,5,6,7,8],emoji:'🤖',intro:'Собери рабочее место агента: задача, источники, память и границы доступа. Начни с одного повторяющегося поручения, чтобы видеть результат и стоимость.',task:'Подготовь бриф помощника: три задачи, разрешённые источники, формат результата и действия, которые требуют твоего решения.',check:'Бриф содержит конкретный результат, правила доступа, расписание и способ проверить качество.'},
  {title:'Исследования и обучение',ids:[9,10,11,12,13,14,15],emoji:'📚',intro:'Преврати набор источников в понятный учебный материал. Здесь важен порядок: сначала факты и план, затем слайды, видео и проверка знаний.',task:'Возьми три собственных источника. Собери план из пяти тезисов, презентацию на восемь слайдов и три проверочных вопроса.',check:'У каждого тезиса есть источник; вопросы проверяют применение; в слайдах нет чисел, которых нет в исходных материалах.'},
  {title:'Видео и монтаж',ids:[16,17,18,19,20,21,22,23,24,25],emoji:'🎬',intro:'Пройди путь от сценария до готового ролика: черновик, сцены, звук, монтаж и бюджет. Генерация сцены и программная графика решают разные задачи — выбирай их под конкретный кадр.',task:'Собери ролик на 15–30 секунд: три сцены, одна мысль, голос или звуковое оформление. Сначала сделай дешёвый черновик и только затем финальный экспорт.',check:'Ролик открывается, речь разборчива, текст читается на телефоне, персонаж сохраняет внешность, расход записан.'},
  {title:'Картинки и дизайн',ids:[26,27,28,29,30,31,32],emoji:'🎨',intro:'Создай серию визуальных материалов с общей системой: композиция, типографика, цвета, объекты и редактируемые слои. Сохрани правила, чтобы следующий макет продолжал серию.',task:'Сделай обложку и два её формата. Подготовь объект без фона, проверь текст и сохрани правила цветов, шрифтов и отступов.',check:'На всех форматах читается главный тезис; края объекта чистые; правила позволяют повторить стиль без угадывания.'},
  {title:'Голос и поддержка',ids:[33,34,35,36,37],emoji:'🎙️',intro:'Соедини речь с полезным действием: точная расшифровка, понятная озвучка и проверяемый следующий шаг. Отдельно проверь имена, числа, языки и ситуации, где нужен человек.',task:'На собственной записи проверь расшифровку, подготовь короткую озвучку и опиши сценарий обращения клиента с передачей оператору.',check:'Имена и числа сверены с аудио; агент различает уточнение и подтверждённое действие; предусмотрено исправление ошибки.'},
  {title:'Кодинг, Skills и автоматизация',ids:[38,39,40,41,42,43,55,56],emoji:'💻',intro:'Собери повторяемый процесс: инструкции, входные данные, инструменты, проверки и итоговый артефакт. Навык полезен, когда его результат можно воспроизвести и оценить.',task:'Опиши один процесс как Skill: вход, шаги, выход, проверки и обработка сбоя. Прогони три примера, включая неполные данные.',check:'Есть сохранённый результат, журнал ошибок и критерий приёмки. Код или интерактивный инструмент проверен на обычном и ошибочном вводе.'},
  {title:'Практические разборы и кейсы',ids:[44,45,46,47,48,49,50],emoji:'🧩',intro:'Собери небольшой рабочий эксперимент: отчёт, аудит данных, контентную цепочку или процедуру разработки. У каждого сценария есть исходные данные, действия и проверяемый результат.',task:'Выбери один сценарий. Выполни его на обезличенных данных, запиши время, расходы, исправления и итоговый файл.',check:'Результат проверен по критериям; учтены неудачные попытки; вывод ограничен условиями эксперимента.'},
  {title:'Локальный ИИ и умный поиск',ids:[51,52,53,54],emoji:'🔎',intro:'Разберись, когда пригодятся компактные модели, локальная обработка и поиск по смыслу. Сравнивай не только размер модели: нужны подходящий язык, лицензия, память устройства и качество на своей задаче.',task:'Подготовь десять поисковых запросов к собственной коллекции или десять коротких аудиозаписей. Выбери подходящую модель и составь протокол сравнения.',check:'Зафиксированы язык, устройство, лицензия, задержка и ошибки; вывод не переносится на другие условия без повторной проверки.'},
]
export const cards=starts.map((m,i)=>{
  let raw=source.slice(m.index+m[0].length,starts[i+1]?.index??source.length)
  raw=raw.split(/^## |^<a /m)[0].trim()
  const paragraphs=raw.split(/\n\n+/)
  const status=paragraphs.shift()
  const urls=[...raw.matchAll(/\]\((https?:[^)]+)\)/g)].map(x=>x[1])
  const explanation=status.replace(/^\*\*Статус:[\s\S]*?\*\*\s*/,'')
  const body=[explanation,...paragraphs].join('\n\n')
    .replace(/\s*Тема (?:поста|статьи):[^\n]+/g,'')
    .replace(/\*\*Применение:\*\*/g,'### Где пригодится\n\n')
    .replace(/\*\*(?:Практика для урока|Учебное задание|Практика|Методика|Методика \/ редакционная идея):\*\*/g,'### Попробуй на своей задаче\n\n')
    .replace(/\*\*Ограничения:\*\*/g,'### Что учесть\n\n')
  const block=blocks.find(b=>b.ids.includes(+m[1]))
  assert(block,`Нет блока ${m[1]}`)
  return {n:+m[1],title:m[2],status,urls,body,block:block.title,emoji:block.emoji}
})
assert.equal(cards.length,56)
assert.equal(new Set(blocks.flatMap(b=>b.ids)).size,56)
if(process.argv.includes('--sources')){console.log(JSON.stringify(cards.map(c=>({n:c.n,url:c.urls[0]}))));process.exit()}
const images=JSON.parse(await readFile(new URL('images.json',dir),'utf8'))
const officialCover=images.find(x=>x.ids.includes(8)).url
const gradients=['aurora','ocean','sunset','candy','mint','lime']
const common={kind:'lesson',video_url:null,copy_text:null,pinned:false,published:true,quiz:[],xp:25,free_preview:true}
const posts=cards.map((c,i)=>{
  const image=images.find(x=>x.ids.includes(c.n));assert(image?.url,`Нет обложки ${c.n}`)
  const subtitle=c.body.replace(/\[[^\]]+\]\([^)]+\)/g,'').replace(/[#*]/g,'').split(/(?<=[.!?])\s/)[0].slice(0,190)
  return publicArticle({...common,key:`post-${c.n}`,source_index:c.n,title:c.title,subtitle,category:c.block,emoji:c.emoji,gradient:gradients[i%6],cover_url:image.url,body:c.body,minutes:Math.max(2,Math.ceil(c.body.length/1200)),position:c.n,course_key:null},officialCover)
})
const lessons=blocks.map((b,i)=>{
  const items=b.ids.map(n=>posts.find(p=>p.source_index===n))
  return {...common,key:`block-${i+1}`,title:`${i+1}. ${b.title}`,subtitle:`${items.length} тем · практика и проверка результата`,category:b.title,emoji:b.emoji,gradient:gradients[i%6],cover_url:items[0].cover_url,body:`${b.intro}\n\n## Что разберём\n\n${items.map(p=>`- ${p.title}`).join('\n')}\n\n${items.map(p=>`## ${p.title}\n\n![${p.title.replace(/[\[\]]/g,'')}](${p.cover_url})\n\n${p.body}`).join('\n\n---\n\n')}\n\n## Практика блока\n\n${b.task}\n\n## Готово, когда\n\n${b.check}\n\nСохрани результат и короткую заметку: что получилось, что исправил и сколько попыток понадобилось.`,minutes:Math.max(10,items.reduce((n,p)=>n+p.minutes,0)+10),xp:100,position:i+1,course_key:'ai-practice',free_preview:true}
})
const course={key:'ai-practice',title:'ИИ на практике: инструменты, контент и автоматизация',subtitle:'56 прикладных тем в 8 блоках · подборка на 25 октября 2026',description:`Единый практический курс по материалам подборки: от агентов и исследований до изображений, видео, голоса, кодинга и локального ИИ.\n\n${blocks.map((b,i)=>`${i+1}. **${b.title}** — ${b.ids.length} тем.`).join('\n\n')}\n\nВ каждом блоке — объяснения, примеры применения, ограничения, ссылки на источники и итоговое задание с критериями результата. Все 56 материалов из ленты сохранены в программе и сгруппированы по задачам.\n\nМожно читать по порядку или начать с нужного блока. Все блоки открыты для чтения подписчикам. Сведения отражают предоставленную подборку на 25 октября 2026; статусы из исходника не означают повторного тестирования редакцией.`,emoji:'🚀',gradient:'aurora',price_stars:0,invite_unlock:0,position:1,published:true}
const batch='content_import:ai-practice-2026-10-25-v1'
const payload={batch,date:'2026-10-25',course,lessons:[...posts,...lessons]}
for(const p of payload.lessons){assert(p.title.length<=120);assert(p.body.length>300);assert(p.cover_url.startsWith('https://'))}
await writeFile(new URL('payload.json',dir),JSON.stringify(payload,null,2)+'\n')
const escaped=JSON.stringify(payload)
assert(!escaped.includes('$ai_content$'))
const sql=`begin;
select pg_advisory_xact_lock(hashtext('${batch}'));
do $import_ai$
declare p jsonb := $ai_content$${escaped}$ai_content$::jsonb; c jsonb; l jsonb; cid bigint; lid bigint; mapping jsonb := '{}'::jsonb;
begin
if exists(select 1 from public.settings where key='${batch}') then raise notice 'Пакет уже импортирован'; return; end if;
c := p->'course';
insert into public.courses(title,subtitle,description,emoji,gradient,price_stars,invite_unlock,position,published)
values(c->>'title',c->>'subtitle',c->>'description',c->>'emoji',c->>'gradient',0,0,(c->>'position')::integer,true) returning id into cid;
for l in select value from jsonb_array_elements(p->'lessons') loop
insert into public.lessons(kind,title,subtitle,category,emoji,gradient,cover_url,body,video_url,copy_text,quiz,minutes,xp,pinned,published,published_at,course_id,position,free_preview)
values('lesson',l->>'title',l->>'subtitle',l->>'category',l->>'emoji',l->>'gradient',l->>'cover_url',l->>'body',null,null,'[]'::jsonb,(l->>'minutes')::integer,(l->>'xp')::integer,false,true,now()-coalesce((l->>'source_index')::integer,0)*interval '1 second',case when l->>'course_key' is not null then cid else null end,(l->>'position')::integer,true) returning id into lid;
mapping := mapping || jsonb_build_object(l->>'key',lid);
end loop;
insert into public.settings(key,value) values('${batch}',jsonb_build_object('date','2026-10-25','course_id',cid,'lessons',mapping,'feed_count',56,'course_lesson_count',8));
end; $import_ai$;
commit;
select value from public.settings where key='${batch}';
`
await writeFile(new URL('import.sql',dir),sql)
const htmlEscape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
await writeFile(new URL('review.html',dir),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ИИ на практике · OG CRE8R²</title><style>body{font:17px/1.65 system-ui;background:#10121c;color:#edf0ff;margin:0}main{max-width:900px;margin:auto;padding:32px}article{background:#1c2030;padding:28px;border-radius:24px;margin:24px 0}img{width:100%;max-height:380px;object-fit:cover;border-radius:16px}pre{white-space:pre-wrap;font:inherit}a{color:#b7a0ff}nav a{display:block}h1,h2{line-height:1.2}</style><main><h1>${course.title}</h1><p>56 микропостов и единый курс из 8 блоков</p><nav>${blocks.map((b,i)=>`<a href="#block-${i}">${i+1}. ${b.title}</a>`).join('')}</nav>${blocks.map((b,i)=>`<section id="block-${i}"><h2>${i+1}. ${b.title}</h2><p>${b.intro}</p>${b.ids.map(n=>posts.find(p=>p.source_index===n)).map(p=>`<article><img src="${htmlEscape(p.cover_url)}" alt="${htmlEscape(p.title)}"><h2>${htmlEscape(p.title)}</h2><pre>${htmlEscape(p.body)}</pre></article>`).join('')}<article><h3>Практика блока</h3><p>${b.task}</p><h3>Готово, когда</h3><p>${b.check}</p></article></section>`).join('')}</main></html>`)
console.log(JSON.stringify({posts:posts.length,blocks:lessons.length,total:payload.lessons.length,characters:payload.lessons.reduce((n,p)=>n+p.body.length,0)}))
