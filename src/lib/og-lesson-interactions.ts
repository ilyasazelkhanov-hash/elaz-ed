import type {GuideChallenge} from './guide-interactions'

/** Original, public formative examples. Never imports or embeds the paid lesson payload. */
export type OGLessonInteraction = {
 id:string
 steps:{title:string;text:string}[]
 challenges:GuideChallenge[]
}
const choose=(prompt:string,correct:number,options:[string,string][]):GuideChallenge=>({
 type:'choice',prompt,correct,options:options.map(([text,why])=>({text,why}))
})
export const ogLessonInteractions:Record<string,OGLessonInteraction>={
 'foundations/block-1':{
  id:'og-foundations-block-1-v1',
  steps:[
   {title:'Сначала критерий, потом генерация',text:'Учебный пример: онлайн-встреча клуба «Фокус», 7 ноября, 19:00 по Алматы, 45 минут, 20 мест, бесплатно. Это вымышленные данные, не анонс события. Задача: написать короткий анонс без дополнительных обещаний.'},
   {title:'Найди добавленное обещание',text:'Черновик: «7 ноября в 19:00 по Алматы научим автоматизации за 45 минут. Бесплатно, всего 20 мест. Каждый гарантированно удвоит доход». Сверяем каждое утверждение с брифом, а не с уверенностью автора.'},
   {title:'Сделай проверку повторяемой',text:'Качественный результат можно проверить ещё раз. Сохрани исходные факты, задание, итог и список проверок. Название модели само по себе не объясняет, почему результат подходит.'}
  ],
  challenges:[
   choose('Какой критерий можно проверить по исходнику?',1,[
    ['Анонс должен быть гениальным','Это субъективная оценка без способа проверки.'],
    ['Дата, время, часовой пояс, длительность и условия совпадают с брифом','Все эти поля заданы. Их можно сверить по одному.'],
    ['Участники точно придут','Посещаемость нельзя гарантировать качеством текста.']
   ]),
   choose('Что нужно убрать из черновика?',2,[
    ['Часовой пояс','Он задан и помогает понять время встречи.'],
    ['Число мест','20 мест явно указаны в учебных данных.'],
    ['Гарантию удвоения дохода','В брифе нет такой гарантии. Красивый текст не разрешает придумывать обещания.']
   ]),
   {type:'order',prompt:'Собери порядок проверки нового анонса.',items:['Сверить итог с обязательными полями','Зафиксировать исходные факты и ограничения','Получить черновик по заданию'],answer:[1,2,0],explanation:'Сначала фиксируем вход и ограничения, затем создаём черновик, после сверяем результат. Исправленный вариант тоже проверяем.'}
  ]
 },
 'foundations/foundations-context':{
  id:'og-foundations-context-v1',
  steps:[
   {title:'Раздели факты и процедуру',text:'brief.md содержит дату и условия встречи. procedure.md задаёт порядок обработки. decision-log.md хранит принятые решения. Один файл не заменяет остальные: процедура не подтверждает дату.'},
   {title:'Не склеивай конфликтующие версии',text:'Учебная папка содержит brief.md с датой 7 ноября и brief-v2.md с датой 14 ноября. Пользователь пока не назначил главный источник. Суффикс v2 полезен, но не заменяет явного правила приоритета.'},
   {title:'Проверь перенос в новый разговор',text:'После уточнения brief-v2.md назначен главным. Новый разговор должен получить нужные файлы и правило приоритета. Попроси выписать дату и неизвестные поля до создания анонса, затем сам сверь с исходником.'}
  ],
  challenges:[
   choose('Помощнику передали только procedure.md. Можно подтвердить дату встречи?',0,[
    ['Нет, нужен источник фактов','Процедура описывает действия, а не подтверждает дату.'],
    ['Да, по памяти вчерашнего чата','Память не заменяет доступный проверяемый вход.'],
    ['Да, если ответ уверенный','Уверенный тон не подтверждает источник.']
   ]),
   choose('Что делать до выбора главного брифа?',1,[
    ['Молча выбрать 14 ноября','Новое имя файла не доказывает согласование даты.'],
    ['Показать конфликт и запросить правило приоритета','Это предотвращает скрытое смешивание версий.'],
    ['Написать две даты в одном анонсе','Так результат становится неоднозначным, а конфликт остаётся.']
   ]),
   choose('Какой результат соответствует уточнению?',2,[
    ['7 ноября из старого чата','После уточнения действует brief-v2.md.'],
    ['14 ноября и придуманная ссылка регистрации','Правильная дата не оправдывает выдуманную ссылку.'],
    ['14 ноября, остальные поля сверены, отсутствующая ссылка отмечена','Так результат опирается на назначенный вход, а неизвестное не выдумано.']
   ])
  ]
 }
}

// Exact UTF-8 SHA-256 of reviewed source bodies. Deliberately no whitespace normalization.
// This guard checks compatibility, NOT authorization: Reader still receives gated bodies.
export const reviewedLessonHashes:Record<string,string>={"foundations/block-1": "4b3c5aa9ac6b296644917221b2eb0f625fc97b6735ad05bbe34f73bc944ba452", "foundations/foundations-context": "b36aaeba2044100fa3ecff2218b8040496535a2a2d38c518b5fc4bd396ebf11a"}
export async function ogLessonInteraction(course:string,lesson:string,body?:string):Promise<OGLessonInteraction|undefined>{
 const key=course+'/'+lesson, expected=reviewedLessonHashes[key]
 if(!expected||!body||!globalThis.crypto?.subtle)return undefined
 try{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))
  const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  return actual===expected ? ogLessonInteractions[key] : undefined
 }catch{return undefined}
}
