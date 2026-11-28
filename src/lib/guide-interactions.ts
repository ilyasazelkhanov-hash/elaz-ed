/** Small authored evidence tables, rendered as text cells, never arbitrary HTML. */
export type GuideStepVisual = {caption:string;columns:string[];rows:string[][]}
export type GuideStep = {title:string;text:string;visual?:GuideStepVisual}
/** Authored formative exercises. Client answers are public; this is not a graded assessment. */
export type GuideChallenge =
 | {type:'choice';prompt:string;options:{text:string;why:string}[];correct:number}
 | {type:'number';prompt:string;answer:number;unit:string;explanation:string}
 | {type:'order';prompt:string;items:string[];answer:number[];explanation:string}
 /** Assemble a request: every slot takes one card from the bank, the remaining cards are distractors. */
 | {type:'build';prompt:string;slots:{label:string;card:number}[];bank:string[];explanation:string;hint:string}
 /** Mark every fragment of the source that matches the instruction. */
 | {type:'spot';prompt:string;source:string;fragments:string[];answer:number[];explanation:string;hint:string}
 /** Put every item into one of two named groups. */
 | {type:'sort';prompt:string;groups:[string,string];items:{text:string;group:0|1}[];explanation:string;hint:string}
/** build: card index per slot or -1; spot: ascending selected fragments; sort: group per item or -1. */
export type GuideAnswer = number | string | number[] | null
const choice=(prompt:string,correct:number,options:[string,string][]):GuideChallenge=>({type:'choice',prompt,correct,options:options.map(([text,why])=>({text,why}))})
const order=(prompt:string,items:string[],answer:number[],explanation:string):GuideChallenge=>({type:'order',prompt,items,answer,explanation})
const build=(prompt:string,slots:[string,number][],bank:string[],explanation:string,hint:string):GuideChallenge=>({type:'build',prompt,slots:slots.map(([label,card])=>({label,card})),bank,explanation,hint})
const spot=(prompt:string,source:string,fragments:string[],answer:number[],explanation:string,hint:string):GuideChallenge=>({type:'spot',prompt,source,fragments,answer,explanation,hint})
const sort=(prompt:string,groups:[string,string],items:[string,0|1][],explanation:string,hint:string):GuideChallenge=>({type:'sort',prompt,groups,items:items.map(([text,group])=>({text,group})),explanation,hint})
export const guideInteractions:Record<string,GuideChallenge[]>={
 'first-request':[
  choice('Какое задание проще проверить?',1,[['Сделай что-нибудь интересное','Не задан результат: невозможно понять, выполнена ли задача.'],['Напиши анонс встречи до 500 знаков, сохрани дату и формат','Есть конкретный результат, ограничение и факты для проверки.'],['Ты лучший маркетолог мира','Роль не заменяет задачу и критерии результата.']]),
  build('Собери запрос из трёх блоков. Лишние карточки оставь в стороне.',[['Для кого',2],['Что известно',0],['Какой результат нужен',3]],['Суббота, 18:00 по Алматы, онлайн, 30 минут, 10 мест, бесплатно','Ты лучший копирайтер в мире','Для новичков, которые ещё не пробовали ИИ','Анонс до 500 знаков без ссылок и обещаний','Сделай красиво и продающе'],'В запросе есть адресат, проверяемые факты и измеримый результат. Роль и «сделай красиво» не дают помощнику ни фактов, ни критерия.','Адресат отвечает на вопрос «кому», факты можно сверить с исходником, результат можно измерить.'),
  order('Собери цикл улучшения черновика.', ['Исправить конкретное несоответствие','Получить черновик по фактам','Сравнить с условиями задания'],[1,2,0],'Сначала нужен черновик, затем сравнение с условиями. Правка должна отвечать найденной проблеме, а не общему «сделай лучше».')
 ],
 'check-answer':[
  spot('Отметь всё, что нужно проверить до отправки.','Черновик от ИИ',['Привет! Рады позвать тебя на встречу.','Она пройдёт 14 марта в 19:00 по Алматы.','Будет интересно и полезно.','По данным исследования, 73% новичков бросают ИИ за первую неделю.','Записаться можно по ссылке example.org/start.','До встречи!'],[1,3,4],'Дата, число со ссылкой на исследование и адрес регистрации влияют на решение читателя и могут быть выдуманы. Приветствие и оценка «интересно» не являются фактами для сверки.','Ищи даты, числа, названия, цитаты и ссылки. Тон и вежливость сверять с источником не нужно.'),
  choice('Статья по ссылке открылась, но нужного утверждения в ней нет. Статус факта?',1,[['Подтверждён: ссылка работает','Доступная страница не обязательно подтверждает конкретное утверждение.'],['Не подтверждён этим источником','Нужен фрагмент, подтверждающий именно этот вывод, или честная отметка неопределённости.'],['Опровергнут','Отсутствие подтверждения ещё не доказывает, что утверждение ложно.']]),
  {type:'number',prompt:'Новая задача: 21 заявка из 300 просмотров. Какова конверсия в процентах?',answer:7,unit:'%',explanation:'21 / 300 × 100 = 7%. Важно использовать число просмотров как знаменатель и записать формулу, а не верить уверенно названной цифре.'}
 ],
 'choose-tool':[
  choice('Нужно найти действующее правило на сегодня. Что важнее?',2,[['Самое новое название модели','Новизна сама по себе не даёт доступа к действующему документу.'],['Самый красивый ответ','Оформление не подтверждает актуальность.'],['Доступ к первоисточнику с датой и областью действия','Проверь сам документ и его актуальную редакцию.']]),
  sort('Что зависит от сервиса, а что от модели внутри него?',['Сервис','Модель'],[['Загрузка файлов и экспорт ответа',0],['Лимит сообщений на тарифе',0],['Насколько связно получается текст',1],['История чатов и папки проектов',0],['Как справляется с длинным рассуждением',1]],'Файлы, лимиты и история относятся к приложению и тарифу. Связность текста и рассуждение зависят от модели. Поэтому одна модель в двух сервисах даёт разный набор функций: нужную проверяй в своём аккаунте.','Спроси себя: это кнопка или условие в приложении, или качество самого ответа?'),
  order('Как сравнить два инструмента честнее?', ['Сопоставить полученные ответы с критериями брифа','Дать обоим один бриф и получить ответы','Выбрать инструмент по результатам сравнения'],[1,0,2],'Нельзя сравнить ответы до их получения или сделать обоснованный выбор до сравнения. Один бриф и одинаковые критерии делают результаты сопоставимыми.')
 ],
 'image-brief':[
  spot('Найди строки брифа, которые испортят обложку на экране телефона.','Бриф обложки',['Обложка для карточки в ленте телефона.','Покажи сразу три идеи: чат, робота и графики.','Свободная верхняя треть под заголовок.','По краям добавь много мелких значков и подписей.','Понятный силуэт в центре кадра.'],[1,3],'Три идеи спорят между собой, а мелкие значки пропадут в маленькой карточке. Остальные строки задают место использования, композицию и главный объект.','Представь картинку размером со спичечный коробок: что перестанет читаться и что будет спорить за внимание?'),
  choice('ИИ нарисовал красивый фон, но ошибся в названии события. Что делать?',2,[['Использовать так, ошибка небольшая','Название может изменить смысл и подорвать доверие.'],['Уменьшить текст, чтобы не замечали','Скрытая ошибка не становится правильной.'],['Добавить точный заголовок отдельно и проверить каждую букву','Разделение фона и текста даёт контроль над обязательной информацией.']]),
  order('Что сделать перед публикацией обложки?', ['Исправить найденную в макете ошибку в заголовке','Проверить макет в размере карточки и найти ошибку в заголовке','Проверить исправленный заголовок и экспортировать макет'],[1,0,2],'Сначала нужно найти ошибку, затем исправить её и проверить правку перед экспортом. Права на изображение тоже нужно проверить до публикации, но это отдельная проверка, а не жёстко заданный порядок.')
 ],
 'safe-workflow':[
  sort('Что оставить в учебном примере, а что заменить вымышленным?',['Оставить','Заменить'],[['Тема и формат встречи',0],['Телефон клиента',1],['Нужный объём текста',0],['Фамилия и диагноз пациента',1],['Номер договора',1]],'Тема, формат и объём нужны для задачи и никого не раскрывают. Телефон, сведения о пациенте и номер договора указывают на конкретных людей и документы: в учебной практике их заменяют вымышленными.','Спроси себя: нужна ли эта деталь для решения задачи и можно ли по ней узнать человека или документ?'),
  choice('Что полезно сохранить после удачного ответа?',1,[['Только красивый итог','Без исходных данных и запроса результат трудно воспроизвести.'],['Входные данные, запрос, проверенный итог и замеченные ошибки','Так можно повторить процесс и понять границы его работы.'],['Список названий моделей','Названия не описывают метод и критерии проверки.']]),
  order('Как проверить, что шаблон не случайно сработал один раз?', ['Сравнить новый результат с критериями','Изменить одно условие задачи','Выполнить шаблон на новых данных'],[1,2,0],'Измени аудиторию или ограничение, выполни шаблон заново и проверь результат. Это маленькая проверка переноса, а не доказательство универсальности.')
 ],
}
export function initialGuideAnswer(question:GuideChallenge):GuideAnswer{
 if(question.type==='order')return question.items.map((_,i)=>i)
 if(question.type==='build')return question.slots.map(()=>-1)
 if(question.type==='spot')return []
 if(question.type==='sort')return question.items.map(()=>-1)
 return null
}
const indexes=(answer:GuideAnswer,min:number,max:number):answer is number[]=>Array.isArray(answer)&&answer.every(i=>Number.isInteger(i)&&i>=min&&i<max)
/** Structurally valid for this question, possibly unfinished. Stored partial work survives a reload. */
export function guideAnswerShape(question:GuideChallenge,answer:GuideAnswer):boolean{
 if(question.type==='choice')return typeof answer==='number'&&Number.isInteger(answer)&&answer>=0&&answer<question.options.length
 if(question.type==='number')return typeof answer==='string'
 if(question.type==='order')return indexes(answer,0,question.items.length)&&answer.length===question.items.length&&new Set(answer).size===answer.length
 if(question.type==='build'){if(!indexes(answer,-1,question.bank.length)||answer.length!==question.slots.length)return false;const used=answer.filter(i=>i>=0);return new Set(used).size===used.length}
 if(question.type==='spot')return indexes(answer,0,question.fragments.length)&&answer.every((value,i)=>i===0||value>answer[i-1])
 return indexes(answer,-1,2)&&answer.length===question.items.length
}
/** Complete enough to be checked. */
export function guideAnswerPresent(question:GuideChallenge,answer:GuideAnswer):boolean{
 if(!guideAnswerShape(question,answer))return false
 if(question.type==='number')return (answer as string).trim()!==''
 if(question.type==='build'||question.type==='sort')return (answer as number[]).every(i=>i>=0)
 if(question.type==='spot')return (answer as number[]).length>0
 return true
}
/** The learner already touched this question. An untouched order cannot be told apart from its initial state. */
export function guideAnswerStarted(question:GuideChallenge|undefined,answer:GuideAnswer):boolean{
 if(!question||question.type==='order'||answer==null)return false
 if(question.type==='build'||question.type==='sort')return Array.isArray(answer)&&answer.some(i=>i>=0)
 if(question.type==='spot')return Array.isArray(answer)&&answer.length>0
 return true
}
/** `wrong` lists slots, selected fragments or items to recheck. It never contains the expected answer. */
export function evaluateGuideAnswer(question:GuideChallenge,answer:GuideAnswer):{correct:boolean;explanation:string;wrong?:number[]}{
 if(!guideAnswerPresent(question,answer))return{correct:false,explanation:'Сначала выбери или введи ответ.'}
 if(question.type==='choice'){const i=answer as number;return{correct:i===question.correct,explanation:question.options[i].why}}
 if(question.type==='number'){const raw=String(answer).trim().replace(',','.'),parsed=Number(raw);return{correct:/^-?\d+(?:\.\d+)?$/.test(raw)&&Number.isFinite(parsed)&&parsed===question.answer,explanation:question.explanation}}
 if(question.type==='order')return{correct:JSON.stringify(answer)===JSON.stringify(question.answer),explanation:question.explanation}
 const given=answer as number[]
 if(question.type==='build'){
  const wrong=question.slots.flatMap((slot,i)=>given[i]===slot.card?[]:[i])
  return wrong.length?{correct:false,wrong,explanation:`Проверь блоки: ${wrong.map(i=>`«${question.slots[i].label}»`).join(', ')}. ${question.hint}`}:{correct:true,explanation:question.explanation}
 }
 if(question.type==='spot'){
  const wrong=given.filter(i=>!question.answer.includes(i)),missed=question.answer.filter(i=>!given.includes(i)).length
  return wrong.length||missed?{correct:false,wrong,explanation:`${wrong.length?`Лишних отметок: ${wrong.length}. `:''}${missed?`Не найдено: ${missed}. `:''}${question.hint}`}:{correct:true,explanation:question.explanation}
 }
 const wrong=question.items.flatMap((item,i)=>given[i]===item.group?[]:[i])
 return wrong.length?{correct:false,wrong,explanation:`Не на месте: ${wrong.length} из ${question.items.length}. ${question.hint}`}:{correct:true,explanation:question.explanation}
}
export function moveGuideItem(items:number[],index:number,direction:-1|1):number[]{const target=index+direction;if(!Number.isInteger(index)||index<0||index>=items.length||target<0||target>=items.length)return [...items];const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next}
export type GuideJourneyState={step:number;answers:GuideAnswer[];checked:boolean[];phase?:'concept'|'question'}
const journeys=new Map<string,GuideJourneyState>()
const JOURNEY_STORE='og:guide-journeys:v2',MAX_ENTRIES=40,MAX_BYTES=1000000
/** Exact public exercise content, not a short hash: changed questions/steps never reuse answers. */
export const guideJourneyKey=(scope:string,id:string,revision:unknown='v1')=>JSON.stringify([scope,id,revision])
export function emptyJourney(questions:GuideChallenge[]):GuideJourneyState{return {step:0,answers:questions.map(initialGuideAnswer),checked:questions.map(()=>false)}}
function safeJourney(value:unknown,questions:GuideChallenge[]):GuideJourneyState|null{
 if(!value||typeof value!=='object')return null
 const v=value as GuideJourneyState
 if(!Number.isInteger(v.step)||v.step<0||v.step>questions.length||!Array.isArray(v.answers)||v.answers.length!==questions.length||!Array.isArray(v.checked)||v.checked.length!==questions.length)return null
 const answers=questions.map((q,i)=>{
  const a=v.answers[i]
  if(a===null)return initialGuideAnswer(q)
  if(q.type==='number')return typeof a==='string'&&a.length<=24&&/^-?\d*(?:[.,]\d*)?$/.test(a)?a:null
  return guideAnswerShape(q,a)?a:initialGuideAnswer(q)
 })
 return {step:v.step,phase:v.phase==='question'?'question':'concept',answers,checked:v.checked.map((checked,i)=>checked===true&&guideAnswerPresent(questions[i],v.answers[i])&&JSON.stringify(v.answers[i])===JSON.stringify(answers[i]))}
}
function storedJourneys():[string,GuideJourneyState][]{
 const raw=globalThis.localStorage?.getItem(JOURNEY_STORE)
 if(!raw||raw.length>MAX_BYTES)return []
 let rows:unknown;try{rows=JSON.parse(raw)}catch{return []}
 return Array.isArray(rows)?rows.slice(-MAX_ENTRIES).filter(row=>Array.isArray(row)&&row.length===2&&typeof row[0]==='string'&&row[0].length<=32000):[]
}
export function readSavedGuideJourney(key:string,questions:GuideChallenge[]):GuideJourneyState | null {
 let saved=journeys.get(key)
 try{saved=saved??storedJourneys().find(row=>row[0]===key)?.[1]}catch{/* denied/corrupt storage: memory only */}
 const valid=safeJourney(saved,questions)
 return valid ? structuredClone(valid) : null
}
export function readGuideJourney(key:string,questions:GuideChallenge[]):GuideJourneyState{
 return readSavedGuideJourney(key,questions)??emptyJourney(questions)
}
/** Checked and currently correct tasks of the saved attempt: a place in practice, not a grade. */
export function guideJourneyProgress(key:string,questions:GuideChallenge[]):{correct:number;total:number}{
 const saved=readSavedGuideJourney(key,questions)
 return {total:questions.length,correct:saved?questions.filter((question,i)=>saved.checked[i]&&evaluateGuideAnswer(question,saved.answers[i]).correct).length:0}
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
