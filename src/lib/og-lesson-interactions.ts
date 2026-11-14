import {ogTextInteractions} from './og-text-interactions.ts'
import {ogMediaInteractions} from './og-media-interactions.ts'
import {ogAutomationInteractions} from './og-automation-interactions.ts'
import {ogFoundationsCodingInteractions} from './og-foundations-coding-interactions.ts'
import {ogCodingInteraction} from './og-coding-interactions.ts'
import type {GuideChallenge,GuideStep} from './guide-interactions'

/** Original, public formative examples. Never imports or embeds the paid lesson payload. */
export type OGLessonInteraction = {
 id:string
 steps:GuideStep[]
 challenges:GuideChallenge[]
}
const choose=(prompt:string,correct:number,options:[string,string][]):GuideChallenge=>({
 type:'choice',prompt,correct,options:options.map(([text,why])=>({text,why}))
})
export const ogLessonInteractions:Record<string,OGLessonInteraction>={
 ...ogTextInteractions,
 ...ogMediaInteractions,
 ...ogAutomationInteractions,
 ...ogFoundationsCodingInteractions,

 'coding/block-7':ogCodingInteraction,
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
export const reviewedLessonHashes:Record<string,string>={
 "foundations/block-1": "4b3c5aa9ac6b296644917221b2eb0f625fc97b6735ad05bbe34f73bc944ba452",
 "foundations/foundations-context": "b36aaeba2044100fa3ecff2218b8040496535a2a2d38c518b5fc4bd396ebf11a",
 "foundations/block-connections": "a43d218474f36acb662107623ebb8310f614878879ac593833233f5e8a8007e2",
 "foundations/foundations-skill": "1e5ff457f732a79c31cee6592f691164de66143559b2633b2fe50b7f904769f2",
 "foundations/block-openbot": "7a912207fef4db3a0c807f8c9e927f4aec25d7de8104ceddf5e50127c8b4d9c1",
 "foundations/foundations-compare": "1f1c3d826d0e84d08faf711fd227bf409b688544bd63704556718240201877f9",
 "text/block-2": "4ec29121a16cc81e305c640d0b0341da87d0d33ad50049a28301ddbfa91db5f1",
 "text/text-notebook": "7f35dde0a15300b272810d3070a944a46e1921d1bc8324b62faede2b064c9234",
 "text/block-3": "eb5227bb5870791f7d683936313662ebc26b6739178aac4ac5e3db8b756586b5",
 "text/text-report": "069343e70dbb83ea4d45c4b083c9b53dcba687730c4cba6d7b70e57607dbbeec",
 "text/text-deck": "1f4c5c5917019d289a0af08fe58e7870efdd4d63fe20699bb5b9547d79b1bd17",
 "text/text-project": "57aab0c2f1723f84bcf451124a7a14b8c0699d5d47eb8d9c485abd49f5a7c382",
 "text/presentation-brief": "cb34d3cbde13ff2396dfc2aff5f496075b1c3b31a86714f7e9c83dc3d1b5cf6b",
 "text/carousel-brief": "9240566fed0f2001210b73fd64210cd813ed5019101b5a3825ab83b9b8a8550e",
 "media/block-4": "71d8e16f975e559b4add626ddbf58818b489741da2e91dd823bf39ab8591e2be",
 "media/block-5": "c3ebe96cd72dc411ceb445155ae51788692d3a2ec7180809b04b45e72ef6729f",
 "media/block-6": "f12fc8ec100934e2d6cc8d51049f63b24d7699f9e882b4d20b6710210a162eb0",
 "media/block-music": "34071cb7bbcd9e7ce84d2196e93c192f9989b04279a67abf7ea0fb87a8d8f289",
 "media/media-repurpose": "0aff9680c687a022b8494abb73faa04422189b9c007e8dd16dfed205e5730d86",
 "media/media-project": "33051067665eb965c607864111644b6cea4972ccee8cac07cc394d7689c3e62f",
 "coding/block-7": "376d9707d656f6f118dabd957196b3f7a3cf3c7a0ec06da484df12f6ec19a738",
 "coding/coding-spec": "eb7b7054d54585663cc5fd89f40f476b09a5708890869074cbe2d2f0abed76d7",
 "coding/block-opencode": "a873423601ff6a36a5527863047e635ab9883de3fec27909ed4e75cbcca3e21e",
 "coding/coding-mcp": "55fbd0c2559edd3696166eddc454c66dd74027c7ab64dd0a445dbf403d5a7344",
 "coding/coding-version": "b4cd1b0cdc1cffbc121fc1712d72c5d4372e792599515c389d266947acc63c29",
 "coding/block-agent-reach": "2c4cdeac6326994694371e92dcb4b2224c8afa84495ffdd9e2524205106b71a0",
 "automation/block-native-automation": "679ad0706312d2c6114e1150cd1a3c63093121d5c3e9675e8b6a76956a79c657",
 "automation/automation-files": "ea6d7d5e1d8ac79fc9551cf89444baa92bfa51ae9e67ab702584831386388065",
 "automation/automation-connectors": "dfc1ceabd800fffb2c901c1c6eb51997426fd182bd48b45733f1379f6c6ff047",
 "automation/block-8": "2b687ce8f3f06a0da4d8015a49c93c702fcb52faa17fd64965c4625ee01d6cb5",
 "automation/automation-canvas": "e18fe0f4a8d24d504b3ec91e30f672be27ca67890a582be254d45fc8aedf875b",
 "automation/automation-project": "e1792b3bd0f58fa59a2704f2ee72d0689d74085e52557c105914fae0e3a22978",
 "automation/deal-radar": "90aae0a44f5366f805698da44b581fbacd516438fbead10ae7535b7d61fee199"
}
export async function ogLessonInteraction(course:string,lesson:string,body?:string):Promise<OGLessonInteraction|undefined>{
 const key=course+'/'+lesson, expected=reviewedLessonHashes[key]
 if(!expected||!body||!globalThis.crypto?.subtle)return undefined
 try{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))
  const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  return actual===expected ? ogLessonInteractions[key] : undefined
 }catch{return undefined}
}
