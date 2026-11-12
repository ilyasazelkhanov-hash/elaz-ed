import { beginnerGuides } from './beginner-content.ts'
import { getPracticeResume, ogPracticeCourses, practicePath, type PracticeProgress } from './og-practice.ts'
import { canOpenPracticeLesson, resolvePracticeCourse, resolvePracticeLesson } from './og-course-access.ts'
import type { Card, Course } from './types'
import type { PathwayChoice } from './course-pathways.ts'

type ReadStorage = Pick<Storage, 'getItem'>
export function learningScope(user: number, demo: boolean) { return `practice:${demo ? 'demo' : 'live'}:${user}` }
export function freeAttemptKey(user: number, demo: boolean) { return `og:free-start:v2:${demo ? 'demo' : 'live'}:${user}` }
export function readFreeAttempts(user: number, demo: boolean, storage?: ReadStorage): string[] {
 try { const value: unknown = JSON.parse((storage ?? localStorage).getItem(freeAttemptKey(user, demo)) || '[]'); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && beginnerGuides.some(guide => guide.id === id)))] : [] } catch { return [] }
}
export function readLastFreeGuide(user: number, demo: boolean, storage?: ReadStorage): string | null {
 try { const value = (storage ?? localStorage).getItem(`og:last-free-guide:v1:${demo ? 'demo' : 'live'}:${user}`); return beginnerGuides.some(guide => guide.id === value) ? value : null } catch { return null }
}
export function saveLastFreeGuide(user: number, demo: boolean, id: string) {
 if (!beginnerGuides.some(guide => guide.id === id)) return
 try {localStorage.setItem(`og:last-free-guide:v1:${demo ? 'demo' : 'live'}:${user}`, id)} catch { /* Reading works without storage. */ }
}
export type LearningNextStep = {path: string; title: string; label: string; reason: string; detail: string}
/** A recommendation is not a credential or an access grant. Paid access always comes from the server. */
export function learningNextStep(input: {choice: PathwayChoice; attempts: string[]; lastFree: string | null; progress: PracticeProgress; courses: Course[]; feed: Card[]}): LearningNextStep {
 const {choice, attempts, lastFree, progress, courses, feed} = input
 const serverDone = ogPracticeCourses.flatMap(course => course.lessons.filter(lesson => resolvePracticeLesson(resolvePracticeCourse(course, courses), lesson, feed)?.completed).map(lesson => lesson.key))
 const resume = getPracticeResume({...progress, done: serverDone}, (course, lesson) => canOpenPracticeLesson(resolvePracticeCourse(course, courses), resolvePracticeLesson(resolvePracticeCourse(course, courses), lesson, feed)))
 if (resume) return {path: practicePath(resume.course.key, resume.lesson.key), title: resume.lesson.title, label: 'Продолжить урок', reason: 'Открытый урок или следующий шаг в начатом курсе.', detail: resume.course.title}
 const order = choice.audience === 'experienced' ? ['check-answer'] : beginnerGuides.map(guide => guide.id)
 const current = lastFree && order.includes(lastFree) && !attempts.includes(lastFree) ? lastFree : order.find(id => !attempts.includes(id))
 const guide = beginnerGuides.find(item => item.id === current)
 if (guide) return {path: '/start/' + guide.id, title: guide.title, label: lastFree === guide.id ? 'Продолжить разбор' : choice.audience === 'experienced' ? 'Проверить себя на задаче' : 'Попробовать бесплатно', reason: choice.audience === 'experienced' ? 'Без повторения основ: проверь ответ, источник и расчёт на одной задаче. Это самопроверка, не экзамен.' : 'Короткая последовательность для первого полезного результата. Можно выбрать другой шаг.', detail: `${guide.minutes} минут практики · ${guide.result}`}
 const course = ogPracticeCourses.find(item => item.key === choice.goal)
 return course ? {path: practicePath(course.key), title: course.title, label: 'Посмотреть следующий проект', reason: 'По выбранной цели. Программа платная, условия и доступ проверяются отдельно.', detail: course.project} : {path: '/og-practice', title: 'Выбери задачу для следующего проекта', label: 'Сравнить программы', reason: 'Бесплатный шаг попробован. Самоотметка не подтверждает освоение навыка.', detail: 'Условия платных программ доступны до покупки.'}
}
