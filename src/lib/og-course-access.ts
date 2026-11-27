import type { Card, Course, PracticeLessonOutline } from './types'

type CourseIdentity = {key: string; title: string}
type LessonIdentity = {key: string; title: string}
const normalizedTitle = (title: string) => title.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('ru').replaceAll('ё', 'е')
const validId = (id: number) => Number.isSafeInteger(id) && id > 0

/** Identity matching never grants access: every body is fetched through api.lesson. */
export function resolvePracticeCourse(outline: CourseIdentity, courses: Course[]): Course | null {
 const mapped = courses.filter(course => course.practice_key === outline.key && validId(course.id))
 if (mapped.length) return mapped.length === 1 ? mapped[0] : null
 // Compatibility with a server deployed before practice_key existed. Do not guess IDs or use fuzzy titles.
 const legacy = courses.filter(course => course.practice_key === undefined && validId(course.id) && normalizedTitle(course.title) === normalizedTitle(outline.title))
 return legacy.length === 1 ? legacy[0] : null
}

/** Which OG practice course a server course id is, using the same matching as the practice screens. */
export function practiceKeyForCourse(id: number, courses: Course[], outlines: CourseIdentity[]): string | null {
 if (!validId(id)) return null
 const matches = outlines.filter(outline => resolvePracticeCourse(outline, courses)?.id === id)
 return matches.length === 1 ? matches[0].key : null
}

export function resolvePracticeLesson(course: Course | null, outline: LessonIdentity, feed: Card[]): PracticeLessonOutline | null {
 if (!course) return null
 if (course.practice_lessons !== undefined) {
  const matches = course.practice_lessons.filter(lesson => lesson.key === outline.key && validId(lesson.id))
  return matches.length === 1 ? matches[0] : null
 }
 const legacy = feed.filter(lesson => lesson.kind === 'lesson' && lesson.published && lesson.course_id === course.id && validId(lesson.id) && normalizedTitle(lesson.title) === normalizedTitle(outline.title))
 return legacy.length === 1 ? {key: outline.key, id: legacy[0].id, title: legacy[0].title, minutes: legacy[0].minutes, free_preview: legacy[0].free_preview, completed: legacy[0].completed} : null
}

export function canOpenPracticeLesson(course: Course | null, lesson: PracticeLessonOutline | null): boolean {
 return !!course && !!lesson && (course.access || lesson.free_preview)
}

const friendsWord = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'друг' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'друга' : 'друзей'}`

export type FriendUnlock = {need: number; have: number; left: number; ready: boolean}

/**
 * The only way to open a course without paying that the server verifies: it grants access on the next
 * load once enough invited friends have opened the app. The counter itself comes from the server.
 */
export function friendUnlock(course: Pick<Course, 'access' | 'invite_unlock'> | null, invited: number): FriendUnlock | null {
 if (!course || course.access || !Number.isSafeInteger(course.invite_unlock) || course.invite_unlock <= 0) return null
 const have = Math.min(course.invite_unlock, Math.max(0, Math.floor(Number(invited)) || 0))
 return {need: course.invite_unlock, have, left: course.invite_unlock - have, ready: have >= course.invite_unlock}
}

export function practiceOffer(course: Course | null): {label: string; action: string; available: boolean} {
 if (!course) return {label: 'Пока недоступен', action: 'Продажи пока не открыты', available: false}
 if (course.access) return {label: 'Доступ открыт', action: 'Продолжить обучение', available: true}
 const friends = friendUnlock(course, 0)
 if (Number.isFinite(course.price_stars) && course.price_stars > 0) return {label: `${course.price_stars} ⭐${friends ? ` или ${friendsWord(friends.need)}` : ''}`, action: `Открыть курс за ${course.price_stars} ⭐`, available: true}
 return {label: course.request === 'pending' ? 'Заявка отправлена' : friends ? `Заявка или ${friendsWord(friends.need)}` : 'Доступ по заявке', action: 'Условия доступа', available: true}
}

export type AccessTiers = {
 /** Lessons the server marks as open before any access is granted. */
 previews: number
 friends: {title: string; need: number; left: number}[]
 /** Lowest and highest Stars price among courses the learner has not opened yet. */
 stars: {from: number; to: number; count: number} | null
 opened: number
}

/** What is free, what opens for invited friends and what is sold, from live server data only. */
export function accessTiers(courses: Course[], invited: number): AccessTiers {
 const closed = courses.filter(course => !course.access)
 const prices = closed.map(course => course.price_stars).filter(price => Number.isFinite(price) && price > 0)
 return {
  previews: courses.reduce((sum, course) => sum + (course.practice_lessons ?? []).filter(lesson => lesson.free_preview).length, 0),
  friends: closed.flatMap(course => {
   const unlock = friendUnlock(course, invited)
   return unlock ? [{title: course.title, need: unlock.need, left: unlock.left}] : []
  }),
  stars: prices.length ? {from: Math.min(...prices), to: Math.max(...prices), count: prices.length} : null,
  opened: courses.filter(course => course.access).length,
 }
}
