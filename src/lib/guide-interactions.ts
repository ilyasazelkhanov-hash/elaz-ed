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
export type GuideJourneyState={step:number;answers:GuideAnswer[];checked:boolean[]}
const journeys=new Map<string,GuideJourneyState>()
export const guideJourneyKey=(scope:string,id:string)=>JSON.stringify([scope,id,'v1'])
export function readGuideJourney(key:string,questions:GuideChallenge[]):GuideJourneyState{
 const saved=journeys.get(key)
 return saved?structuredClone(saved):{step:0,answers:questions.map(initialGuideAnswer),checked:questions.map(()=>false)}
}
export function saveGuideJourney(key:string,value:GuideJourneyState){journeys.delete(key);journeys.set(key,structuredClone(value));while(journeys.size>20)journeys.delete(journeys.keys().next().value!)}
