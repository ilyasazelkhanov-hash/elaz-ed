// Isolated demo fixtures: these short synthetic exercises are not the authored paid lessons.
import {ogPracticeCourses} from './og-practice.ts'
import type {AdminCourse, Lesson, PracticeLessonOutline} from './types'

type DemoCourse = AdminCourse & {practice_key?: string}
const gradients = ['aurora', 'sunset', 'candy', 'ocean', 'mint'] as const
const fixture = ogPracticeCourses.map((course, courseIndex) => ({
 course,
 id: 9_000_001 + courseIndex,
 lessons: course.lessons.map((lesson, lessonIndex) => ({...lesson, id: 9_100_001 + courseIndex * 100 + lessonIndex})),
}))

export function demoPracticeContent(now = Date.now()): {courses: DemoCourse[]; lessons: Lesson[]} {
 return {
  courses: fixture.map(({course, id}, index) => ({id, practice_key: course.key, title: course.title, subtitle: 'Демонстрационный курс · оплата без списания звёзд', description: `Это демонстрация программы «${course.title}». В ней показаны короткие учебные примеры для проверки интерфейса. Полные авторские уроки доступны только в настоящем приложении после получения доступа.\n\nРезультат полной программы: ${course.project}`, emoji: course.emoji, gradient: gradients[index], price_stars: 250, invite_unlock: 0, position: index + 1, published: true, students: 0})),
  lessons: fixture.flatMap(({course, id: courseId, lessons}, courseIndex) => lessons.map((lesson, index) => ({
   id: lesson.id, kind: 'lesson' as const, title: lesson.title, subtitle: 'Короткий синтетический пример для знакомства с интерфейсом курса.',
   body: `> Демонстрационный урок. Это отдельный короткий пример, а не материал платной программы.\n\n## Попробуй на своей задаче\n\nВыбери небольшую задачу по теме «${course.title}» и запиши, какой результат хочешь получить. Возьми вымышленный проект или открытые учебные данные.\n\n## Сделай по шагам\n\n1. Опиши цель одним предложением.\n2. Добавь два известных факта и нужный формат ответа.\n3. Попроси ИИ сначала уточнить недостающие данные.\n4. Сравни ответ с исходными фактами.\n\n## Самостоятельная работа\n\nИзмени один входной факт и повтори запрос. Сохрани два результата и коротко опиши разницу.\n\n## Проверь себя\n\nКакой факт модель могла додумать? Как проверить его по исходнику?\n\n## Разбор ответа\n\nСравни каждое утверждение с тем, что передал модели. Неизвестное должно быть обозначено как вопрос или предположение.\n\n## Критерии готовности\n\nУ тебя есть цель, исходные данные, два результата и один исправленный недочёт. В полной программе здесь будут подробный разбор и задания курса.`,
   category: 'Демонстрация', emoji: course.emoji, gradient: gradients[courseIndex], cover_url: null, minutes: lesson.minutes, xp: 20,
   pinned: false, published: true, published_at: new Date(now - (40 + courseIndex) * 86_400_000).toISOString(), views: 0, likes: 0, quiz_count: 0, has_video: false,
   course_id: courseId, position: index + 1, free_preview: index === 0, completed: false, liked: false, video_url: null, copy_text: null, quiz: [],
  }))),
 }
}

/** Add fixtures to an existing demo without clearing saved progress, purchases or editor changes. */
export function addDemoPractice<T extends {courses: DemoCourse[]; lessons: Lesson[]; nextId: number}>(state: T): T {
 const content = demoPracticeContent()
 const newCourses = content.courses.filter(course => !state.courses.some(existing => existing.id === course.id || existing.practice_key === course.practice_key))
 const newIds = new Set(newCourses.map(course => course.id))
 const newLessons = content.lessons.filter(lesson => newIds.has(lesson.course_id!) && !state.lessons.some(existing => existing.id === lesson.id))
 return {...state, courses: [...state.courses, ...newCourses], lessons: [...state.lessons, ...newLessons], nextId: Math.max(state.nextId, ...newLessons.map(lesson => lesson.id + 1))}
}

export function demoPracticeOutline(course: DemoCourse, lessons: Lesson[], done: Record<number, number>): PracticeLessonOutline[] | undefined {
 const source = fixture.find(item => item.course.key === course.practice_key && item.id === course.id)
 if (!source) return undefined
 return source.lessons.flatMap(outline => {
  const lesson = lessons.find(item => item.id === outline.id && item.course_id === course.id && item.published)
  return lesson ? [{key: outline.key, id: lesson.id, title: lesson.title, minutes: lesson.minutes, free_preview: lesson.free_preview, completed: lesson.id in done}] : []
 })
}
