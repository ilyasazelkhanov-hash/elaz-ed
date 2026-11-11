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
export type PracticeProgressScope = {userId: string | number | undefined; mode: 'demo' | 'live'}
const changeEvent = 'og:practice-progress'
// Bump when the lesson sequence or completion meaning changes. Unowned v1 data is never adopted.
const catalogVersion = '2026-11-11'
type ProgressStorage = Pick<Storage, 'getItem'>
type WritableProgressStorage = ProgressStorage & Pick<Storage, 'setItem'>

export function practiceProgressStorageKey(scope: PracticeProgressScope): string | null {
 const user = scope.userId
 if (scope.mode === 'live' && (user === undefined || user === '' || user === 0)) return null
 return `og-practice-v2:${scope.mode}:${encodeURIComponent(String(user ?? 'guest'))}`
}
function normalize(progress: PracticeProgress): PracticeProgress {
 return {
  done: [...new Set(progress.done.filter(key => lessonKeys.has(key)))],
  lastLesson: progress.lastLesson && lessonKeys.has(progress.lastLesson) ? progress.lastLesson : null,
 }
}
export function readPracticeProgress(scope: PracticeProgressScope, storage?: ProgressStorage): PracticeProgress {
 const empty: PracticeProgress = {done: [], lastLesson: null}, key = practiceProgressStorageKey(scope)
 if (!key) return empty
 try {
  const value: unknown = JSON.parse((storage ?? localStorage).getItem(key) || 'null')
  if (!value || typeof value !== 'object') return empty
  const record = value as Record<string, unknown>
  if (record.version !== 2 || record.catalogVersion !== catalogVersion || record.mode !== scope.mode || record.userId !== String(scope.userId ?? 'guest') || typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return empty
  const lastLesson = typeof record.lastLesson === 'string' ? record.lastLesson : null
  const course = directory.find(course => course.lessons.some(lesson => lesson.key === lastLesson))
  return normalize({
   // Server progress is authoritative in live mode. Local data can only suggest a reading position.
   done: scope.mode === 'demo' && Array.isArray(record.done) ? record.done.filter((key): key is string => typeof key === 'string') : [],
   lastLesson: course && course.key === record.courseKey ? lastLesson : null,
  })
 } catch { return empty }
}
export function writePracticeProgress(scope: PracticeProgressScope, progress: PracticeProgress, storage?: WritableProgressStorage): boolean {
 const key = practiceProgressStorageKey(scope)
 if (!key) return false
 try {
  const value = normalize(progress), course = directory.find(course => course.lessons.some(lesson => lesson.key === value.lastLesson))
  ;(storage ?? localStorage).setItem(key, JSON.stringify({version: 2, catalogVersion, userId: String(scope.userId ?? 'guest'), mode: scope.mode, ...value, done: scope.mode === 'demo' ? value.done : [], courseKey: course?.key ?? null, updatedAt: Date.now()}))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(changeEvent))
  return true
 } catch { return false }
}
export function subscribePracticeProgress(scope: PracticeProgressScope, listener: () => void) {
 const key = practiceProgressStorageKey(scope)
 const onStorage = (event: StorageEvent) => { if (key && (!event.key || event.key === key)) listener() }
 window.addEventListener(changeEvent, listener)
 window.addEventListener('storage', onStorage)
 return () => { window.removeEventListener(changeEvent, listener); window.removeEventListener('storage', onStorage) }
}
/** The project assignment is not necessarily the last lesson: some courses have extra applications. */
const projectLessons: Record<string, string> = {foundations: 'foundations-compare', text: 'text-project', media: 'media-project', coding: 'block-agent-reach', automation: 'automation-project'}
export function practiceProjectLesson(course: PracticeCourse) {
 return course.lessons.find(lesson => lesson.key === projectLessons[course.key]) ?? null
}
export function practicePath(courseKey: string, lessonKey?: string) {
 return `/og-practice/${courseKey}${lessonKey ? `/${lessonKey}` : ''}`
}
export function getPracticeResume(progress: PracticeProgress, canOpen: (course: PracticeCourse, lesson: PracticeCourse['lessons'][number]) => boolean = () => true) {
 const {done, lastLesson} = normalize(progress)
 const recent = directory.find(course => course.lessons.some(lesson => lesson.key === lastLesson))
 if (recent) {
  const lesson = recent.lessons.find(lesson => lesson.key === lastLesson && !done.includes(lesson.key) && canOpen(recent, lesson))
   ?? recent.lessons.find(lesson => !done.includes(lesson.key) && canOpen(recent, lesson))
  if (lesson) return {course: recent, lesson}
 }
 for (const course of directory) {
  if (!course.lessons.some(lesson => done.includes(lesson.key))) continue
  const lesson = course.lessons.find(lesson => !done.includes(lesson.key) && canOpen(course, lesson))
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
