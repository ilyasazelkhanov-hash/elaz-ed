import guides from '../../content/knowledge/course-guides.json' with {type:'json'}
import type {Card} from './types'

export type KnowledgeTopicId='tools'|'vibecoding'|'automation'|'agents'|'creative'|'design'|'marketing'|'data'|'business'
export type CourseGuide={code:string;plainTitle:string;forWhom:string;outcome:string;tryNow:string;nextCodes:string[]}
export type KnowledgeTopic={id:KnowledgeTopicId;label:string;beginner:string;practitioner:string;courseCodes:string[]}

/** These are reading paths, not prerequisites, grades, or claims about the reader's expertise. */
export const knowledgeTopics:KnowledgeTopic[]=[
 {id:'tools',label:'ИИ и инструменты',beginner:'Понять возможности ИИ, поставить задачу и проверить ответ.',practitioner:'Сравнить подходы на своей задаче и перенести полезный приём в работу.',courseCodes:['CORE-000','BI-101']},
 {id:'vibecoding',label:'Вайбкодинг и разработка',beginner:'Собрать первый экран и разобраться, что изменил ИИ.',practitioner:'Управлять кодовым агентом, проверками, данными и выпуском.',courseCodes:['VC-101','ENG-101','VC-201','ENG-201','VC-301','ENG-301']},
 {id:'automation',label:'Автоматизация',beginner:'Связать несколько действий в одну проверяемую цепочку.',practitioner:'Разобрать API, повторы, очереди и восстановление после сбоя.',courseCodes:['AU-101','AU-201','AU-301']},
 {id:'agents',label:'Помощники и агенты',beginner:'Сделать помощника с источниками и понятными ограничениями.',practitioner:'Проверить поиск, инструменты, подтверждения и состояние агентов.',courseCodes:['AG-101','AG-201','AG-301']},
 {id:'creative',label:'Контент и визуалы',beginner:'Превратить бриф в согласованные изображения и короткие ролики.',practitioner:'Собрать кампанию и наладить процесс студии с проверкой качества.',courseCodes:['CR-101','CR-201','CR-301']},
 {id:'design',label:'Дизайн и интерфейсы',beginner:'Сделать понятный экран и проверить его на реальной задаче.',practitioner:'Связать исследования, компоненты и проверку реализации.',courseCodes:['DS-101','DS-201','DS-301']},
 {id:'marketing',label:'Маркетинг',beginner:'Разобраться с аудиторией, сообщением и планом публикаций.',practitioner:'Проверить воронку, эксперимент, метрики и экономику продвижения.',courseCodes:['MK-101','MK-201','MK-301']},
 {id:'data',label:'Данные и аналитика',beginner:'Очистить таблицу и объяснить вывод без выдуманных данных.',practitioner:'Перепроверить SQL, метрики, эксперименты и прогнозы.',courseCodes:['DT-101','DT-201','DT-301']},
 {id:'business',label:'ИИ в работе и команде',beginner:'Найти полезный рабочий сценарий и измерить результат.',practitioner:'Спланировать пилот, оценить стоимость и управлять внедрением.',courseCodes:['BI-101','BI-201','BI-301']},
]
const byCode=new Map((guides as CourseGuide[]).map(guide=>[guide.code,guide]))
const prefixTopics:Record<string,KnowledgeTopicId>={CORE:'tools',VC:'vibecoding',ENG:'vibecoding',AU:'automation',AG:'agents',CR:'creative',DS:'design',MK:'marketing',DT:'data',BI:'business'}
export function courseGuide(code:string):CourseGuide|undefined{return byCode.get(code)}
export function topicForCourse(code:string):KnowledgeTopic{return knowledgeTopics.find(topic=>topic.id===(prefixTopics[code.split('-')[0]]??'tools'))!}

// Specific work comes before general tool names: "SQL в ChatGPT" belongs to data.
const topicKeywords:{id:KnowledgeTopicId;pattern:RegExp}[]=[
 {id:'data',pattern:/\b(?:sql|csv|excel|pandas)\b|статистик|\bpython\b.{0,20}(?:данн|анализ)|аналитик|датасет|таблиц|метрик|дашборд|\bdashboard\b|\bbacktest|прогноз|\bpower\s?bi\b/i},
 {id:'vibecoding',pattern:/вайб.?код|vibe.?cod|\bcodex\b|\bcursor\b|claude\s+code|\breact\b|\bvite\b|\bgithub\b|\bgit\b|\bide\b|программир|разработк|репозитори|pull\s?request|код(?!екс)|мини.?апп|приложен/i},
 {id:'automation',pattern:/автоматизац|\bn8n\b|\bzapier\b|\bmake\.com\b|вебхук|\bwebhook\b|интеграц|\bworkflow\b|очеред|повтор.{0,12}запрос/i},
 {id:'agents',pattern:/\brag\b|\bretrieval\b|\bmcp\b|агент|agent|ассистент|assistant|помощник|чат.?бот|база.{0,8}знаний|базы.{0,8}знаний/i},
 {id:'design',pattern:/дизайн|\bdesign\b|\bfigma\b|прототип|интерфейс|\bux\b|\bui\b|компонент|доступност|клавиатур/i},
 {id:'marketing',pattern:/маркетинг|\bmarketing\b|\bseo\b|\bgeo\b|\bcrm\b|growth|лидогенерац|воронк|сегмент|продаж|аудитори|продвижен/i},
 {id:'creative',pattern:/контент|визуал|изображен|картин|ролик|монтаж|\bmidjourney\b|\bflux\b|\bsora\b|\bveo\b|\brunway\b|\bkling\b|генерац.{0,15}(?:видео|фото)|звук|субтитр/i},
 {id:'business',pattern:/внедрен|команд|бизнес|процесс|встреч|протокол|повестк|экономик|поставщик|портфел.{0,12}проект|управлен/i},
]
export function topicForPost(post:Pick<Card,'title'|'subtitle'|'category'>):KnowledgeTopicId{
 const text=`${post.title??''} ${post.subtitle??''} ${post.category??''}`
 return topicKeywords.find(topic=>topic.pattern.test(text))?.id??(/^(?:данные|анализ данных|исследования)$/i.test(post.category?.trim()??'')?'data':'tools')
}
export function relatedCourseGuides(post:Pick<Card,'title'|'subtitle'|'category'>,limit=2):CourseGuide[]{
 const topic=knowledgeTopics.find(topic=>topic.id===topicForPost(post))!
 const text=`${post.title??''} ${post.subtitle??''}`
 let codes=topic.courseCodes
 if(topic.id==='vibecoding'&&/codex|claude\s+code|кодовый\s+агент|кодовым\s+агент|pull\s?request|ревью|\bgit\b/i.test(text))codes=['ENG-101','ENG-201','VC-101','ENG-301']
 else if(/эксплуатац|архитектур|восстановлен|governance|backtest|агентн.{0,8}систем|дизайн.?систем/i.test(text))codes=[...codes.filter(code=>code.endsWith('301')),...codes.filter(code=>!code.endsWith('301'))]
 const count=Number.isFinite(limit)?Math.min(28,Math.max(0,Math.floor(limit))):2
 return codes.map(code=>byCode.get(code)).filter((guide):guide is CourseGuide=>!!guide).slice(0,count)
}
const goals:Record<string,string[]>={
 'goal:tools':['CORE-000','BI-101','AG-101'],
 'goal:content':['CORE-000','CR-101','MK-101'],
 'goal:apps':['CORE-000','VC-101','ENG-101'],
 'goal:services':['CORE-000','BI-101','MK-101'],
}
export function curatedGoalCourses(goal:string):CourseGuide[]{return(goals[goal]??goals['goal:tools']).map(code=>byCode.get(code)!)}
