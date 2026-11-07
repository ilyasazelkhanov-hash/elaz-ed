import directory from '../../content/ai-practice-2026-10-25/course-directory.json' with {type:'json'}

export const ogPracticeCourses = directory
export type PracticeCourse = typeof directory[number]
export type PracticeProgress = {done: string[]; lastLesson: string | null}
export const practiceTopics = ['Все', 'С нуля', 'Текст', 'Дизайн', 'Видео', 'Код', 'Автоматизация']
const topics: Record<string, string[]> = {
 foundations: ['С нуля'], text: ['Текст', 'Дизайн'], media: ['Дизайн', 'Видео'],
 coding: ['Код'], automation: ['Автоматизация'],
}
const lessonKeys = new Set(directory.flatMap(course => course.lessons.map(lesson => lesson.key)))
const doneKey = 'og-practice-done-v1', lastKey = 'og-practice-last-v1', changeEvent = 'og:practice-progress'
type ProgressStorage = Pick<Storage, 'getItem'>

function normalize(progress: PracticeProgress): PracticeProgress {
 return {
  done: [...new Set(progress.done.filter(key => lessonKeys.has(key)))],
  lastLesson: progress.lastLesson && lessonKeys.has(progress.lastLesson) ? progress.lastLesson : null,
 }
}
export function readPracticeProgress(storage?: ProgressStorage): PracticeProgress {
 let done: string[] = [], lastLesson: string | null = null
 try {
  const source = storage ?? localStorage
  const value: unknown = JSON.parse(source.getItem(doneKey) || '[]')
  if (Array.isArray(value)) done = value.filter((key): key is string => typeof key === 'string')
  lastLesson = source.getItem(lastKey)
 } catch { /* Private mode or a malformed old value should not block reading. */ }
 return normalize({done, lastLesson})
}
export function writePracticeProgress(progress: PracticeProgress): boolean {
 try {
  const value = normalize(progress)
  localStorage.setItem(doneKey, JSON.stringify(value.done))
  if (value.lastLesson) localStorage.setItem(lastKey, value.lastLesson)
  else localStorage.removeItem(lastKey)
  window.dispatchEvent(new Event(changeEvent))
  return true
 } catch { return false }
}
export function subscribePracticeProgress(listener: () => void) {
 const onStorage = (event: StorageEvent) => { if (!event.key || [doneKey, lastKey].includes(event.key)) listener() }
 window.addEventListener(changeEvent, listener)
 window.addEventListener('storage', onStorage)
 return () => { window.removeEventListener(changeEvent, listener); window.removeEventListener('storage', onStorage) }
}
export function practicePath(courseKey: string, lessonKey?: string) {
 return `/og-practice/${courseKey}${lessonKey ? `/${lessonKey}` : ''}`
}
export function getPracticeResume(progress: PracticeProgress) {
 const {done, lastLesson} = normalize(progress)
 const recent = directory.find(course => course.lessons.some(lesson => lesson.key === lastLesson))
 if (recent) {
  const lesson = recent.lessons.find(lesson => lesson.key === lastLesson && !done.includes(lesson.key))
   ?? recent.lessons.find(lesson => !done.includes(lesson.key))
  if (lesson) return {course: recent, lesson}
 }
 for (const course of directory) {
  if (!course.lessons.some(lesson => done.includes(lesson.key))) continue
  const lesson = course.lessons.find(lesson => !done.includes(lesson.key))
  if (lesson) return {course, lesson}
 }
 return null
}
const searchable = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е')
export function practiceMatches(course: Omit<PracticeCourse, 'search_terms'> & {search_terms?: string[]}, topic: string, query: string) {
 if (topic !== 'Все' && !topics[course.key]?.includes(topic)) return false
 const terms = course.search_terms ?? directory.find(item => item.key === course.key)?.search_terms ?? []
 const text = searchable([course.title, course.goal, course.project, ...course.lessons.map(lesson => lesson.title), ...terms].join(' '))
 return searchable(query).trim().split(/\s+/).every(term => text.includes(term))
}
export type PracticeSection = 'reading' | 'practice' | 'check' | 'resources'
/** Keep complete Markdown sections, including fenced examples, together when switching reader views. */
export function practiceSections(markdown: string): Record<PracticeSection, string> {
 const groups: Record<PracticeSection, string[]> = {reading: [], practice: [], check: [], resources: []}
 let section: PracticeSection = 'reading', fence: {marker: string; length: number} | null = null
 for (const line of markdown.split('\n')) {
  const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
  if (marker) {
   if (!fence) fence = {marker: marker[1][0], length: marker[1].length}
   else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null
  } else if (!fence) {
   const title = /^##\s+(.+)$/.exec(line)?.[1]
   if (title) section = /^(Самостоятельная работа|Сделай по шагам|Для продвинутых|Дополнительная практика|Критерии готовности|Завершение курса)/i.test(title) ? 'practice'
    : /^(Проверь себя|Разбор ответа|Самопроверка)/i.test(title) ? 'check'
    : /^(Ссылки|Какие инструменты|Другие конкретные инструменты)/i.test(title) ? 'resources' : 'reading'
  }
  groups[section].push(line)
 }
 return Object.fromEntries(Object.entries(groups).map(([key, lines]) => [key, lines.join('\n').trim()])) as Record<PracticeSection, string>
}
