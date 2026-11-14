/** Small authored evidence tables, rendered as text cells, never arbitrary HTML. */
export type GuideStepVisual = {caption:string;columns:string[];rows:string[][]}
export type GuideStep = {title:string;text:string;visual?:GuideStepVisual}
/** Authored formative exercises. Client answers are public; this is not a graded assessment. */
export type GuideChallenge =
 | {type:'choice';prompt:string;options:{text:string;why:string}[];correct:number}
 | {type:'number';prompt:string;answer:number;unit:string;explanation:string}
 | {type:'order';prompt:string;items:string[];answer:number[];explanation:string}
export type GuideAnswer = number | string | number[] | null
const choice=(prompt:string,correct:number,options:[string,string][]):GuideChallenge=>({type:'choice',prompt,correct,options:options.map(([text,why])=>({text,why}))})
const order=(prompt:string,items:string[],answer:number[],explanation:string):GuideChallenge=>({type:'order',prompt,items,answer,explanation})
export const guideInteractions:Record<string,GuideChallenge[]>={
 'first-request':[
  choice('Какое задание проще проверить?',1,[['Сделай что-нибудь интересное','Не задан результат: невозможно понять, выполнена ли задача.'],['Напиши анонс встречи до 500 знаков, сохрани дату и формат','Есть конкретный результат, ограничение и факты для проверки.'],['Ты лучший маркетолог мира','Роль не заменяет задачу и критерии результата.']]),
  choice('Ссылки на регистрацию ещё нет. ИИ добавил её сам. Что делать?',2,[['Оставить: так выглядит убедительнее','Вымышленная ссылка может отправить людей не туда. Убедительность не доказывает точность.'],['Попросить другой ИИ подтвердить ссылку','Повтор другой моделью не подтверждает существование регистрации.'],['Убрать ссылку и отметить, что она пока не готова','Так сохраняется точность исходных фактов без догадок.']]),
  order('Собери цикл улучшения черновика.', ['Исправить конкретное несоответствие','Получить черновик по фактам','Сравнить с условиями задания'],[1,2,0],'Сначала нужен черновик, затем сравнение с условиями. Правка должна отвечать найденной проблеме, а не общему «сделай лучше».')
 ],
 'check-answer':[
  choice('Что нужно проверить в первую очередь?',0,[['Числа, даты, цитаты и ссылки','Эти детали влияют на вывод и могут быть выдуманы даже в уверенном ответе.'],['Насколько вежливо написан ответ','Тон важен, но не подтверждает факты.'],['Сколько моделей повторило ответ','Одинаковая ошибка может повторяться. Нужна независимая проверка.']]),
  choice('Статья по ссылке открылась, но нужного утверждения в ней нет. Статус факта?',1,[['Подтверждён: ссылка работает','Доступная страница не обязательно подтверждает конкретное утверждение.'],['Не подтверждён этим источником','Нужен фрагмент, подтверждающий именно этот вывод, или честная отметка неопределённости.'],['Опровергнут','Отсутствие подтверждения ещё не доказывает, что утверждение ложно.']]),
  {type:'number',prompt:'Новая задача: 21 заявка из 300 просмотров. Какова конверсия в процентах?',answer:7,unit:'%',explanation:'21 / 300 × 100 = 7%. Важно использовать число просмотров как знаменатель и записать формулу, а не верить уверенно названной цифре.'}
 ],
 'choose-tool':[
  choice('Нужно найти действующее правило на сегодня. Что важнее?',2,[['Самое новое название модели','Новизна сама по себе не даёт доступа к действующему документу.'],['Самый красивый ответ','Оформление не подтверждает актуальность.'],['Доступ к первоисточнику с датой и областью действия','Проверь сам документ и его актуальную редакцию.']]),
  choice('Две программы используют одну модель. Функции точно одинаковы?',0,[['Нет, файлы, поиск, экспорт и лимиты зависят от сервиса','Модель и приложение - разные уровни. Проверяй нужную функцию в своём аккаунте.'],['Да, модель определяет всё','Оболочка приложения и тариф могут ограничивать доступные действия.'],['Да, если названия похожи','Название не является доказательством одинаковых функций.']]),
  order('Как сравнить два инструмента честнее?', ['Сопоставить полученные ответы с критериями брифа','Дать обоим один бриф и получить ответы','Выбрать инструмент по результатам сравнения'],[1,0,2],'Нельзя сравнить ответы до их получения или сделать обоснованный выбор до сравнения. Один бриф и одинаковые критерии делают результаты сопоставимыми.')
 ],
 'image-brief':[
  choice('Обложку будут читать на телефоне. Какой бриф лучше?',1,[['Побольше деталей и десять разных идей','Мелкие детали и конкурирующие идеи потеряются в карточке.'],['Одна идея, свободное место под заголовок, понятный силуэт','Это можно проверить в реальном размере карточки.'],['Просто сделай красиво','Без назначения и композиции критерий остаётся неопределённым.']]),
  choice('ИИ нарисовал красивый фон, но ошибся в названии события. Что делать?',2,[['Использовать так, ошибка небольшая','Название может изменить смысл и подорвать доверие.'],['Уменьшить текст, чтобы не замечали','Скрытая ошибка не становится правильной.'],['Добавить точный заголовок отдельно и проверить каждую букву','Разделение фона и текста даёт контроль над обязательной информацией.']]),
  order('Что сделать перед публикацией обложки?', ['Исправить найденную в макете ошибку в заголовке','Проверить макет в размере карточки и найти ошибку в заголовке','Проверить исправленный заголовок и экспортировать макет'],[1,0,2],'Сначала нужно найти ошибку, затем исправить её и проверить правку перед экспортом. Права на изображение тоже нужно проверить до публикации, но это отдельная проверка, а не жёстко заданный порядок.')
 ],
 'safe-workflow':[
  choice('Для учебного теста нужны записи о пациентах. Что безопаснее?',0,[['Использовать вымышленные учебные записи','Учебную логику можно проверить без передачи реальных персональных данных.'],['Удалить только имя и отправить остальное','Остальные сведения тоже могут позволять идентифицировать человека.'],['Отправить всё, если сервис популярный','Популярность не заменяет основание для передачи и правила организации.']]),
  choice('Что полезно сохранить после удачного ответа?',1,[['Только красивый итог','Без исходных данных и запроса результат трудно воспроизвести.'],['Входные данные, запрос, проверенный итог и замеченные ошибки','Так можно повторить процесс и понять границы его работы.'],['Список названий моделей','Названия не описывают метод и критерии проверки.']]),
  order('Как проверить, что шаблон не случайно сработал один раз?', ['Сравнить новый результат с критериями','Изменить одно условие задачи','Выполнить шаблон на новых данных'],[1,2,0],'Измени аудиторию или ограничение, выполни шаблон заново и проверь результат. Это маленькая проверка переноса, а не доказательство универсальности.')
 ],
}
export function initialGuideAnswer(question:GuideChallenge):GuideAnswer{return question.type==='order'?question.items.map((_,i)=>i):null}
export function guideAnswerPresent(question:GuideChallenge,answer:GuideAnswer):boolean{
 if(question.type==='choice')return typeof answer==='number'&&Number.isInteger(answer)&&answer>=0&&answer<question.options.length
 if(question.type==='number')return typeof answer==='string'&&answer.trim()!==''
 return Array.isArray(answer)&&answer.length===question.items.length&&new Set(answer).size===answer.length&&answer.every(i=>Number.isInteger(i)&&i>=0&&i<question.items.length)
}
export function evaluateGuideAnswer(question:GuideChallenge,answer:GuideAnswer):{correct:boolean;explanation:string}{
 if(!guideAnswerPresent(question,answer))return{correct:false,explanation:'Сначала выбери или введи ответ.'}
 if(question.type==='choice'){const i=answer as number;return{correct:i===question.correct,explanation:question.options[i].why}}
 if(question.type==='number'){const raw=String(answer).trim().replace(',','.'),parsed=Number(raw);return{correct:/^-?\d+(?:\.\d+)?$/.test(raw)&&Number.isFinite(parsed)&&parsed===question.answer,explanation:question.explanation}}
 return{correct:JSON.stringify(answer)===JSON.stringify(question.answer),explanation:question.explanation}
}
export function moveGuideItem(items:number[],index:number,direction:-1|1):number[]{const target=index+direction;if(!Number.isInteger(index)||index<0||index>=items.length||target<0||target>=items.length)return [...items];const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next}
export type GuideJourneyState={step:number;answers:GuideAnswer[];checked:boolean[];phase?:'concept'|'question'}
const journeys=new Map<string,GuideJourneyState>()
const JOURNEY_STORE='og:guide-journeys:v2',MAX_ENTRIES=40,MAX_BYTES=1000000
/** Exact public exercise content, not a short hash: changed questions/steps never reuse answers. */
export const guideJourneyKey=(scope:string,id:string,revision:unknown='v1')=>JSON.stringify([scope,id,revision])
function emptyJourney(questions:GuideChallenge[]):GuideJourneyState{return {step:0,answers:questions.map(initialGuideAnswer),checked:questions.map(()=>false)}}
function safeJourney(value:unknown,questions:GuideChallenge[]):GuideJourneyState|null{
 if(!value||typeof value!=='object')return null
 const v=value as GuideJourneyState
 if(!Number.isInteger(v.step)||v.step<0||v.step>questions.length||!Array.isArray(v.answers)||v.answers.length!==questions.length||!Array.isArray(v.checked)||v.checked.length!==questions.length)return null
 const answers=questions.map((q,i)=>{
  const a=v.answers[i]
  if(a===null)return initialGuideAnswer(q)
  if(q.type==='number')return typeof a==='string'&&a.length<=24&&/^-?\d*(?:[.,]\d*)?$/.test(a)?a:null
  return guideAnswerPresent(q,a)?a:initialGuideAnswer(q)
 })
 return {step:v.step,phase:v.phase==='question'?'question':'concept',answers,checked:v.checked.map((checked,i)=>checked===true&&guideAnswerPresent(questions[i],v.answers[i])&&JSON.stringify(v.answers[i])===JSON.stringify(answers[i]))}
}
function storedJourneys():[string,GuideJourneyState][]{
 const raw=globalThis.localStorage?.getItem(JOURNEY_STORE)
 if(!raw||raw.length>MAX_BYTES)return []
 let rows:unknown;try{rows=JSON.parse(raw)}catch{return []}
 return Array.isArray(rows)?rows.slice(-MAX_ENTRIES).filter(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&row[0].length<=32000):[]
}
export function readGuideJourney(key:string,questions:GuideChallenge[]):GuideJourneyState{
 let saved=journeys.get(key)
 try{saved=saved??storedJourneys().find(row=>row[0]===key)?.[1]}catch{/* denied/corrupt storage: memory only */}
 return structuredClone(safeJourney(saved,questions)??emptyJourney(questions))
}
/** Returns whether this attempt was saved durably in this browser, never a server completion. */
export function saveGuideJourney(key:string,value:GuideJourneyState,questions?:GuideChallenge[]):boolean{
 const safe=questions?safeJourney(value,questions):value
 if(!safe||key.length>32000)return false
 journeys.delete(key);journeys.set(key,structuredClone(safe));while(journeys.size>MAX_ENTRIES)journeys.delete(journeys.keys().next().value!)
 try{
  const rows=storedJourneys().filter(row=>row[0]!==key);rows.push([key,safe])
  while(rows.length>MAX_ENTRIES||JSON.stringify(rows).length>MAX_BYTES)rows.shift()
  if(!rows.length||!globalThis.localStorage)return false
  globalThis.localStorage.setItem(JOURNEY_STORE,JSON.stringify(rows));return true
 }catch{return false}
}
