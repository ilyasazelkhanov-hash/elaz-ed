import {ogPracticeCourses, practicePath} from './og-practice.ts'

export type PathwayChoice = {audience: 'beginner' | 'experienced'; goal: string; entry: 'practice' | 'deep'}
export type PathwayStep = {id: string; title: string; path: string; note: string; requirements?: string}
export type PathwayCourse = {code: string; title: string; parent_code?: string | null; position?: number; data: {level?: string; prerequisites?: string; outcome?: string}}
export const defaultPathwayChoice: PathwayChoice = {audience: 'beginner', goal: '', entry: 'practice'}
export const practiceGoals = [
 {id: 'foundations', label: 'Разобраться с ИИ'},
 {id: 'text', label: 'Текст и исследования'},
 {id: 'media', label: 'Изображения, видео и звук'},
 {id: 'coding', label: 'Своё приложение'},
 {id: 'automation', label: 'Автоматизация задачи'},
]

/** Recommendations only. This module never grants access, marks progress, or creates prerequisites. */
export function practicePathway(choice: PathwayChoice): PathwayStep[] {
 const steps: PathwayStep[] = choice.audience === 'beginner' ? [{id: 'free-start', title: 'Бесплатный старт с ИИ', path: '/start', note: 'Попробуй первый запрос и проверку ответа без покупки курса.'}] : []
 const keys = choice.audience === 'beginner' ? ['foundations', choice.goal] : [choice.goal]
 for (const key of new Set(keys)) {
  const course = ogPracticeCourses.find(item => item.key === key)
  if (course) steps.push({id: course.key, title: course.title, path: practicePath(course.key), note: course.project})
 }
 return steps
}

const levels = ['Core', 'Junior', 'Middle', 'Senior']
export function orderedPathwayCourses<T extends PathwayCourse>(courses: T[]): T[] {
 const rank = (course: T) => levels.includes(course.data.level || '') ? levels.indexOf(course.data.level!) : levels.length
 return [...courses].sort((a, b) => rank(a) - rank(b) || (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code, 'en', {numeric: true}))
}
export function matchesCourseLevel(course: PathwayCourse, level: string) {
 return level === 'all' || (level === 'start' ? ['Core', 'Junior'].includes(course.data.level || '') : course.data.level === (level === 'practice' ? 'Middle' : level === 'deep' ? 'Senior' : ''))
}
/** Use declared levels within one direction; show original entry conditions, not inferred locks. */
export function academyPathway(courses: PathwayCourse[], choice: PathwayChoice): PathwayStep[] {
 const target = choice.audience === 'beginner' ? ['Junior', 'Middle', 'Senior'] : choice.entry === 'deep' ? ['Senior'] : ['Middle', 'Senior']
 const selected = courses.filter(course => choice.audience === 'beginner' && course.data.level === 'Core' || !!choice.goal && course.parent_code === choice.goal && target.includes(course.data.level || ''))
 return orderedPathwayCourses(selected).map(course => ({id: course.code, title: course.title, path: `/courses/${course.code}`, note: course.data.outcome || 'Открой программу и сравни её со своей задачей.', requirements: course.data.prerequisites || 'Условия входа не указаны в каталоге.'}))
}

type StorageRead = Pick<Storage, 'getItem'>
type StorageWrite = Pick<Storage, 'setItem'>
const memory = new Map<string, PathwayChoice>()
const key = (scope: string) => `og:course-pathway:v1:${scope}`
function normalize(value: unknown): PathwayChoice {
 const candidate = value && typeof value === 'object' ? value as Partial<PathwayChoice> : {}
 return {audience: candidate.audience === 'experienced' ? 'experienced' : 'beginner', goal: typeof candidate.goal === 'string' && candidate.goal.length <= 64 ? candidate.goal : '', entry: candidate.entry === 'deep' ? 'deep' : 'practice'}
}
/** Session-only preferences, scoped by catalog and signed-in user; not evidence of competence. */
export function readPathwayChoice(scope: string, storage?: StorageRead): PathwayChoice {
 if (memory.has(scope)) return {...memory.get(scope)!}
 try {return normalize(JSON.parse((storage ?? sessionStorage).getItem(key(scope)) || 'null'))} catch {return {...defaultPathwayChoice}}
}
export function writePathwayChoice(scope: string, choice: PathwayChoice, storage?: StorageWrite) {
 const value = normalize(choice)
 memory.set(scope, value)
 try {(storage ?? sessionStorage).setItem(key(scope), JSON.stringify(value))} catch { /* Keep navigation usable if session storage is blocked. */ }
}
