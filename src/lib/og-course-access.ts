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

export function practiceOffer(course: Course | null): {label: string; action: string; available: boolean} {
 if (!course) return {label: 'Пока недоступен', action: 'Продажи пока не открыты', available: false}
 if (course.access) return {label: 'Доступ открыт', action: 'Продолжить обучение', available: true}
 if (Number.isFinite(course.price_stars) && course.price_stars > 0) return {label: `${course.price_stars} ⭐`, action: `Открыть курс за ${course.price_stars} ⭐`, available: true}
 return {label: course.request === 'pending' ? 'Заявка отправлена' : 'Доступ по заявке', action: 'Условия доступа', available: true}
}
