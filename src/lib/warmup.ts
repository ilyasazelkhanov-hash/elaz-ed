import { beginnerGuides } from './beginner-content.ts'
import type { GuideChallenge } from './guide-interactions.ts'

/**
 * AI-разминка: five original formative tasks, one per free guide. Answers are public and the result
 * is a warm-up, never an assessment: it only suggests where to start and is kept in this browser.
 */
export type WarmupTask = {guide:string; topic:string; question:GuideChallenge}
export const warmupTasks:WarmupTask[] = [
 {guide:'first-request',topic:'Запрос',question:{type:'choice',prompt:'Ты попросил анонс встречи. ИИ добавил ссылку на регистрацию, которой не было в твоих данных. Что делать?',correct:2,options:[
  {text:'Оставить: с ней текст выглядит убедительнее',why:'Выдуманная ссылка отправит людей не туда. Убедительный вид не делает факт точным.'},
  {text:'Спросить у другого ИИ, верная ли она',why:'Вторая модель не знает, существует ли твоя регистрация. Повтор ответа не является проверкой.'},
  {text:'Убрать ссылку и отметить, что её пока нет',why:'В ответе остаются только факты из исходника, а недостающее названо прямо.'},
 ]}},
 {guide:'check-answer',topic:'Проверка',question:{type:'number',prompt:'В отчёте 45 заявок из 900 просмотров. ИИ написал «конверсия 20%». Сколько процентов на самом деле?',answer:5,unit:'%',explanation:'45 / 900 × 100 = 5%. Уверенно названную цифру стоит пересчитать самому: это быстрее, чем исправлять вывод после отправки.'}},
 {guide:'choose-tool',topic:'Инструмент',question:{type:'sort',prompt:'Что подойдёт для задачи: текстовый помощник или поиск с источниками?',groups:['Помощник','Поиск'],items:[
  {text:'Черновик письма клиенту',group:0},{text:'Действующая редакция правила',group:1},{text:'План встречи на 30 минут',group:0},{text:'Цена тарифа на сегодня',group:1},{text:'Пересказ своей заметки',group:0},
 ],explanation:'Письмо, план и пересказ создаются из твоих данных. Правило и цена меняются со временем: для них нужен первоисточник с датой, а не правдоподобный пересказ.',hint:'Спроси себя: ответ собирается из того, что ты дал, или его нужно найти и сверить с актуальным источником?'}},
 {guide:'image-brief',topic:'Визуал',question:{type:'build',prompt:'Собери бриф обложки для карточки в телефоне. Две карточки лишние.',slots:[{label:'Где будет стоять',card:2},{label:'Главная идея',card:3},{label:'Ограничения',card:0}],bank:[
  'Без букв, логотипов и мелких деталей','Сделай красиво, как в кино','Карточка в ленте телефона, вертикальный формат','Человек превращает три строки задания в черновик','Добавь побольше деталей для богатства',
 ],explanation:'Бриф называет место использования, одну идею и ограничения. «Красиво» и «побольше деталей» нельзя проверить, а детали пропадут в маленьком размере.',hint:'Место отвечает на вопрос «где», идея одна, ограничения говорят, чего на картинке быть не должно.'}},
 {guide:'safe-workflow',topic:'Данные',question:{type:'spot',prompt:'Отметь строки, которые нельзя отправлять в ИИ-сервис в таком виде.',source:'Заметка для запроса',fragments:[
  'Нужно письмо клиенту о переносе встречи.','Клиент: Айдар С., телефон +7 700 000 00 00.','Тон спокойный, до 600 знаков.','Договор 4471-К, долг 380 000 тенге.','Новая дата: четверг, 15:00.',
 ],answer:[1,3],explanation:'Имя с телефоном и номер договора с суммой указывают на конкретного человека и документ. Для письма достаточно роли «клиент» и условных данных, остальное подставляется после генерации.',hint:'Ищи то, по чему можно узнать человека или документ и что не нужно для самого текста.'}},
]
export const WARMUP_TOTAL = warmupTasks.length

/** Human-readable expected answer, shown only after the single attempt is spent. */
export function warmupSolution(question:GuideChallenge):string {
 if (question.type === 'choice') return question.options[question.correct].text
 if (question.type === 'number') return `${question.answer} ${question.unit}`.replace(' %','%')
 if (question.type === 'order') return question.answer.map(i => question.items[i]).join(' → ')
 if (question.type === 'build') return question.slots.map(slot => `${slot.label}: ${question.bank[slot.card]}`).join('; ')
 if (question.type === 'spot') return question.answer.map(i => `«${question.fragments[i]}»`).join(' ')
 return question.groups.map((group,index) => `${group}: ${question.items.filter(item => item.group === index).map(item => item.text.toLocaleLowerCase('ru')).join(', ')}`).join('. ')
}

export type WarmupSummary = {score:number; total:number; title:string; text:string; next:string|null}
/** The first missed topic becomes the starting guide. A full score earns no title beyond the count. */
export function warmupSummary(correct:readonly boolean[]):WarmupSummary {
 const marks = warmupTasks.map((_,i) => correct[i] === true), score = marks.filter(Boolean).length
 const missed = warmupTasks.find((_,i) => !marks[i])
 const next = missed && beginnerGuides.some(guide => guide.id === missed.guide) ? missed.guide : null
 const guide = beginnerGuides.find(item => item.id === next)
 if (!guide) return {score,total:WARMUP_TOTAL,next:null,title:'Все пять с первой попытки',text:'Основа есть. Разборы пригодятся как практика на своей задаче: в каждом ты собираешь собственный результат.'}
 return {score,total:WARMUP_TOTAL,next,title:score >= 3 ? 'Хорошая база' : 'Отличный момент начать',text:`Начни с разбора «${guide.title}»: это ${guide.minutes} минут и тема, где ответ не сошёлся.`}
}

type WarmupStorage = Pick<Storage,'getItem'|'setItem'>
export type WarmupRecord = {score:number; total:number; marks:boolean[]}
const recordKey = (scope:string) => `og:warmup:v1:${scope}`
const memory = new Map<string,WarmupRecord>()
/** Last finished run of this account and mode in this browser. No history, no timestamps, no answers. */
export function readWarmup(scope:string, storage?:WarmupStorage):WarmupRecord|null {
 let value:unknown = memory.get(scope)
 try {const raw = (storage ?? globalThis.localStorage)?.getItem(recordKey(scope)); if (raw && raw.length < 400) value = JSON.parse(raw)} catch {/* blocked or corrupt storage: session memory only */}
 if (!value || typeof value !== 'object') return null
 const row = value as Record<string,unknown>
 if (row.total !== WARMUP_TOTAL || !Array.isArray(row.marks) || row.marks.length !== WARMUP_TOTAL || !row.marks.every(mark => typeof mark === 'boolean')) return null
 const marks = row.marks as boolean[]
 return {score:marks.filter(Boolean).length,total:WARMUP_TOTAL,marks:[...marks]}
}
export function saveWarmup(scope:string, marks:readonly boolean[], storage?:WarmupStorage):boolean {
 const safe = warmupTasks.map((_,i) => marks[i] === true), record = {score:safe.filter(Boolean).length,total:WARMUP_TOTAL,marks:safe}
 memory.set(scope,record)
 try {const target = storage ?? globalThis.localStorage; if (!target) return false; target.setItem(recordKey(scope),JSON.stringify(record)); return true} catch {return false}
}
