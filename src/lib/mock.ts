// Демо-режим: тот же интерфейс, что у сервера, но всё живёт в localStorage. К настоящей базе не обращается.
import seed from './seed.json'
import { ApiError } from './errors'
import { adventSummaryDemo, makeAdventMock, resetAdventDemo } from './mockAdvent'
import { dailyReward } from './game'
import { demoPlatformXp } from './experience'
import { tgUser } from './tg'
import type { AdminCourse, Analytics, Api, Boot, Card, CompleteResult, Course, DailyResult, Lesson, LessonDraft, LessonQuizAttempt, Me, Payment, QuizQuestion, TopUser } from './types'

const KEY = 'elaz-ed-demo-v2'

interface DemoState {
  lessons: Lesson[]
  courses: AdminCourse[]
  nextId: number
  xp: number
  streak: number
  best: number
  freezes: number
  lastClaim: string | null
  done: Record<number, number>
  liked: number[]
  achievements: string[]
  access: number[]
  requests: number[]
  /** Условные покупки в демо. В старом сохранённом состоянии поля может не быть. */
  payments?: Payment[]
  quizAttempts?: (LessonQuizAttempt & { lessonId: number; privateQuiz: QuizQuestion[] })[]
}

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms))

// Пример закрытого курса для демо. В настоящем приложении курсы создаёт админ.
const DEMO_COURSE: AdminCourse = {
  id: 1,
  title: 'Мини-апп за выходные',
  subtitle: 'От пустой папки до приложения в Telegram',
  description: 'Три урока о том, как собрать своё приложение внутри Telegram: каркас, доступ по подписке и первые платежи звёздами.\n\nПервый урок открыт всем. Остальные открываются вместе с курсом.',
  emoji: '🛠️',
  gradient: 'ocean',
  price_stars: 150,
  invite_unlock: 3,
  position: 0,
  published: true,
  students: 42,
}

const COURSE_LESSONS: Pick<Lesson, 'title' | 'subtitle' | 'emoji' | 'body' | 'free_preview'>[] = [
  {
    title: 'Что такое мини-апп и зачем он каналу',
    subtitle: 'Сайт, который открывается прямо в чате',
    emoji: '📱',
    free_preview: true,
    body: 'Мини-апп — обычная веб-страница, которую Telegram открывает внутри себя. Человеку не нужно ничего ставить и нигде регистрироваться: Telegram сам сообщает приложению, кто его открыл.\n\n## Что это даёт каналу\n\n- **Контент не тонет в ленте.** Уроки лежат по полкам, а не между мемами.\n- **Видно, кто что прошёл.** У каждого свой прогресс.\n- **Можно продавать.** Звёзды Telegram оплачиваются в два тапа.\n\n## Из чего он состоит\n\nБот, сервер и страница. Бот открывает страницу, страница разговаривает с сервером, сервер проверяет подпись Telegram и решает, что показать.',
  },
  {
    title: 'Каркас: бот, сервер, экран',
    subtitle: 'Три части и как они разговаривают',
    emoji: '🧱',
    free_preview: false,
    body: 'Бот создаётся в @BotFather за минуту. Дальше ему нужен адрес страницы и сервер, который умеет проверять подпись.\n\n## Подпись\n\nTelegram передаёт странице строку `initData`. Сервер пересчитывает её хеш токеном бота. Совпало — запрос настоящий.\n\n```\nпроверка = HMAC(данные, ключ_из_токена)\n```\n\nБез этой проверки любой может назваться кем угодно.',
  },
  {
    title: 'Доступ по подписке и первые деньги',
    subtitle: 'Проверка канала и оплата звёздами',
    emoji: '⭐',
    free_preview: false,
    body: 'Бот-админ канала может спросить у Telegram, состоит ли человек в канале. На этом держится доступ по подписке.\n\n## Звёзды\n\nСчёт создаётся одним запросом, оплата проходит внутри Telegram. Серверу остаётся дождаться уведомления и открыть доступ.',
  },
]

function initial(): DemoState {
  const now = Date.now()
  const base = { published: true, cover_url: null, video_url: null, copy_text: null, completed: false, liked: false, views: 0, likes: 0, has_video: false }
  const lessons = (seed as unknown as LessonDraft[]).map((l, i) => ({
    ...base,
    ...l,
    id: i + 1,
    published_at: new Date(now - i * 86_400_000).toISOString(),
    views: 120 - i * 17,
    likes: 34 - i * 5,
    quiz_count: l.quiz.length,
    course_id: null,
    position: 0,
    free_preview: false,
  })) as Lesson[]
  const offset = lessons.length
  COURSE_LESSONS.forEach((l, i) => {
    lessons.push({
      ...base,
      ...l,
      id: offset + i + 1,
      kind: 'lesson',
      category: 'Курс',
      gradient: 'ocean',
      pinned: false,
      minutes: 3,
      xp: 60,
      quiz: [],
      quiz_count: 0,
      published_at: new Date(now - (20 + i) * 86_400_000).toISOString(),
      views: 64 - i * 20,
      likes: 12 - i * 3,
      course_id: DEMO_COURSE.id,
      position: i + 1,
    })
  })
  return { lessons, courses: [DEMO_COURSE], nextId: lessons.length + 1, xp: 0, streak: 0, best: 0, freezes: 0, lastClaim: null, done: {}, liked: [], achievements: [], access: [], requests: [] }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* приватный режим */
  }
  return initial()
}

let state = load()
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* приватный режим */
  }
}

const RIVALS: TopUser[] = [
  { id: 101, name: 'Алина', photo: null, xp: 1240, streak: 21 },
  { id: 102, name: 'Тимур', photo: null, xp: 980, streak: 12 },
  { id: 103, name: 'Даша', photo: null, xp: 760, streak: 9 },
  { id: 104, name: 'Марк', photo: null, xp: 540, streak: 4 },
  { id: 105, name: 'Айгерим', photo: null, xp: 410, streak: 7 },
  { id: 106, name: 'Никита', photo: null, xp: 280, streak: 2 },
  { id: 107, name: 'Соня', photo: null, xp: 165, streak: 3 },
  { id: 108, name: 'Арман', photo: null, xp: 90, streak: 1 },
  { id: 109, name: 'Лера', photo: null, xp: 45, streak: 1 },
]

function me(): Me {
  const gap = state.lastClaim ? dayDiff(today(), state.lastClaim) : Infinity
  const platformXp = demoPlatformXp()
  return {
    id: tgUser.id ?? 1,
    name: tgUser.first_name ?? 'Гость',
    username: null,
    photo: tgUser.photo_url ?? null,
    xp: state.xp + platformXp,
    base_xp: state.xp,
    platform_xp: platformXp,
    streak: gap <= 1 || (gap === 2 && state.freezes > 0) ? state.streak : 0,
    best_streak: state.best,
    daily_claimed: state.lastClaim === today(),
    lessons_done: state.lessons.filter((l) => l.kind === 'lesson' && l.id in state.done).length,
    // В опубликованном демо админки нет: она только у владельцев в настоящем приложении.
    is_admin: import.meta.env.DEV,
    achievements: state.achievements,
    rank: RIVALS.filter((r) => r.xp > state.xp + platformXp).length + 1,
    invited: 0,
    freezes: state.freezes,
  }
}

function card(l: Lesson): Card {
  const { quiz: _q, video_url: _v, copy_text: _c, score: _s, ...rest } = l
  return {
    ...rest,
    body: l.kind === 'story' ? l.body : null,
    quiz_count: l.quiz.length,
    has_video: !!l.video_url,
    completed: l.id in state.done,
    liked: state.liked.includes(l.id),
  }
}

function courses(): Course[] {
  return state.courses
    .filter((c) => c.published)
    .map((c) => {
      const lessons = state.lessons.filter((l) => l.course_id === c.id && l.published)
      return {
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        emoji: c.emoji,
        gradient: c.gradient,
        price_stars: c.price_stars,
        invite_unlock: c.invite_unlock,
        lessons: lessons.length,
        done: lessons.filter((l) => l.id in state.done).length,
        access: state.access.includes(c.id),
        request: state.requests.includes(c.id) ? 'pending' : null,
      }
    })
}

const locked = (l: Lesson) => !!l.course_id && !l.free_preview && !state.access.includes(l.course_id)

function grant(codes: string[]) {
  const fresh = codes.filter((c) => !state.achievements.includes(c))
  state.achievements.push(...fresh)
  return fresh
}

export const mockApi: Api = {
  async boot(): Promise<Boot> {
    await wait(500)
    return {
      status: 'ok',
      me: me(),
      feed: state.lessons
        .filter((l) => l.published)
        .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
        .map(card),
      courses: courses(),
      advent: adventSummaryDemo(),
      channel: { title: 'Elaz', invite: 'https://t.me/+k36WMjkFf6BmNDYy' },
      bot: { username: 'elazart_bot', main_app: false },
    }
  },

  async lesson(id) {
    await wait()
    const l = state.lessons.find((x) => x.id === id)
    if (!l) throw new Error('not_found')
    if (locked(l)) throw new ApiError('course_locked', 403)
    return { ...l, quiz: l.quiz.map(q => ({ q: q.q, options: [...q.options] })), completed: id in state.done, liked: state.liked.includes(id), score: state.done[id] ?? null }
  },

  async quizStart(id) {
    await wait()
    const l = state.lessons.find(x => x.id === id)
    if (!l) throw new ApiError('not_found', 404)
    if (locked(l)) throw new ApiError('course_locked', 403)
    if (!l.quiz.length) throw new ApiError('quiz_not_found', 404)
    const practice = id in state.done
    const attempts = state.quizAttempts ??= []
    let attempt = attempts.find(a => a.lessonId === id && a.practice === practice && (!practice || !a.done))
    if (!attempt) {
      attempt = { attemptId: crypto.randomUUID(), lessonId: id, privateQuiz: structuredClone(l.quiz), questions: l.quiz.map(q => ({ q: q.q, options: [...q.options] })), answers: [], feedback: [], practice, done: false, score: 0, bonus: 0, combo: 0 }
      attempts.push(attempt)
      save()
    }
    const { privateQuiz: _private, lessonId: _lesson, ...publicAttempt } = attempt
    return structuredClone(publicAttempt)
  },

  async quizAnswer(attemptId, index, answer) {
    await wait(150)
    const attempt = state.quizAttempts?.find(a => a.attemptId === attemptId)
    if (!attempt) throw new ApiError('quiz_not_found', 404)
    const q = attempt.privateQuiz[index]
    if (!Number.isInteger(index) || !Number.isInteger(answer) || !q || answer < 0 || answer >= q.options.length) throw new ApiError('quiz_answer_invalid', 400)
    if (index < attempt.answers.length) {
      if (attempt.answers[index] !== answer) throw new ApiError('quiz_answer_locked', 409)
      return structuredClone(attempt.feedback[index])
    }
    if (index !== attempt.answers.length) throw new ApiError('quiz_sequence', 409)
    const correct = answer === q.correct
    attempt.combo = correct ? attempt.combo + 1 : 0
    const gained = correct ? 10 + 5 * Math.min(attempt.combo - 1, 2) : 0
    attempt.score += correct ? 1 : 0
    attempt.bonus += gained
    attempt.answers.push(answer)
    attempt.done = attempt.answers.length === attempt.questions.length
    const feedback = { attemptId, index, answer, correct, correctIndex: q.correct ?? -1, explain: q.explain ?? '', done: attempt.done, score: attempt.score, bonus: attempt.bonus, combo: attempt.combo, gained }
    attempt.feedback.push(feedback)
    save()
    return structuredClone(feedback)
  },

  async complete(id, answers, attemptId): Promise<CompleteResult> {
    await wait(350)
    const l = state.lessons.find((x) => x.id === id)
    if (!l) throw new Error('not_found')
    if (id in state.done && !attemptId) return { already: true, gained: 0, base: 0, bonus: 0, score: state.done[id], total: l.quiz.length, new_achievements: [], me: me() }
    const attempt = state.quizAttempts?.find(a => a.lessonId === id && !a.practice && (!attemptId || a.attemptId === attemptId))
    if ((l.quiz.length || attemptId) && !attempt?.done) throw new ApiError('quiz_required', 409)
    if (attempt && (answers.length !== attempt.answers.length || answers.some((a, i) => a !== attempt.answers[i]))) throw new ApiError('quiz_answers_mismatch', 409)
    const score = attempt?.score ?? 0
    const bonus = attempt?.bonus ?? 0
    if (id in state.done) return { already: true, gained: 0, base: 0, bonus: 0, score: state.done[id], total: l.quiz.length, new_achievements: [], me: me() }
    state.done[id] = score
    state.xp += l.xp + bonus
    const earned: string[] = []
    if (l.kind === 'lesson') {
      const n = state.lessons.filter((x) => x.kind === 'lesson' && x.id in state.done).length
      if (n >= 1) earned.push('first')
      if (n >= 5) earned.push('five')
      if (n >= 10) earned.push('ten')
      if (l.quiz.length > 0 && score === l.quiz.length) earned.push('perfect')
      if (new Date().getHours() < 5) earned.push('night')
    }
    const fresh = grant(earned)
    save()
    return { already: false, gained: l.xp + bonus, base: l.xp, bonus, score, total: l.quiz.length, new_achievements: fresh, me: me() }
  },

  async daily(): Promise<DailyResult> {
    await wait(300)
    const t = today()
    if (state.lastClaim === t) return { gained: 0, froze: false, new_achievements: [], me: me() }
    const gap = state.lastClaim ? dayDiff(t, state.lastClaim) : Infinity
    const froze = gap === 2 && state.freezes > 0
    if (froze) state.freezes -= 1
    state.streak = gap === 1 || froze ? state.streak + 1 : 1
    if (state.streak % 7 === 0 && state.freezes < 2) state.freezes += 1
    state.best = Math.max(state.best, state.streak)
    state.lastClaim = t
    const gained = dailyReward(state.streak)
    state.xp += gained
    const earned: string[] = []
    if (state.streak >= 3) earned.push('streak3')
    if (state.streak >= 7) earned.push('streak7')
    if (state.streak >= 30) earned.push('streak30')
    const fresh = grant(earned)
    save()
    return { gained, froze, new_achievements: fresh, me: me() }
  },

  async like(id) {
    const l = state.lessons.find((x) => x.id === id)
    if (!l) throw new Error('not_found')
    const liked = !state.liked.includes(id)
    state.liked = liked ? [...state.liked, id] : state.liked.filter((x) => x !== id)
    l.likes = Math.max(0, l.likes + (liked ? 1 : -1))
    save()
    return { liked, likes: l.likes }
  },

  async top() {
    await wait(400)
    const m = me()
    const all = [...RIVALS, { id: m.id, name: m.name, photo: m.photo, xp: m.xp, streak: m.streak }]
      .filter((u) => u.xp > 0)
      .sort((a, b) => b.xp - a.xp)
    return { top: all, rank: m.rank }
  },

  async track() {},

  async shareUpload() {
    return null
  },

  async shareMessage() {
    return null
  },

  async courseRequest(id) {
    await wait(300)
    if (!state.requests.includes(id)) state.requests.push(id)
    save()
  },

  // В демо оплата условная: курс открывается сразу, звёзды не списываются.
  async courseInvoice(id) {
    await wait(500)
    const course = state.courses.find((c) => c.id === id)
    if (course && !state.access.includes(id)) {
      state.access.push(id)
      state.payments = [
        { id: Date.now(), user_id: tgUser.id ?? 1, course_id: id, stars: course.price_stars, created_at: new Date().toISOString(), refunded: false, name: tgUser.first_name ?? 'Гость', username: null, course: course.title },
        ...(state.payments ?? []),
      ]
    }
    state.requests = state.requests.filter((x) => x !== id)
    save()
    return null
  },

  async adminAnalytics(): Promise<Analytics> {
    await wait(400)
    const active = [18, 22, 19, 27, 31, 24, 20, 29, 36, 41, 38, 44, 52, 47]
    const day = (i: number) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10)
    return {
      totals: { users: 248, subscribed: 231, new7: 37, dau: 47, wau: 126, mau: 204 },
      series: active.map((a, i) => ({ d: day(i), active: a, fresh: Math.round(a / 7) + (i % 3), done: Math.round(a * 0.6) })),
      funnel: { opened: 248, subscribed: 231, done1: 164, done3: 71, streak3: 58 },
      retention: { d1: 46, d1n: 112, d7: 21, d7n: 90 },
      lessons: state.lessons
        .filter((l) => l.published)
        .slice(0, 6)
        .map((l, i) => ({ id: l.id, title: l.title, emoji: l.emoji, kind: l.kind, opens: 150 - i * 24, done: 104 - i * 21, quiz: l.quiz.length ? 82 - i * 7 : null, likes: l.likes, shares: Math.max(0, 12 - i * 2) })),
      shares: [
        { kind: 'lesson', channel: 'native', n: 31 },
        { kind: 'level', channel: 'tg_story', n: 14 },
        { kind: 'streak', channel: 'save', n: 9 },
        { kind: 'lesson', channel: 'link', n: 6 },
      ],
      invited: 23,
      stars: { total: 6300, count: 42 },
    }
  },

  async adminCourses() {
    await wait()
    return {
      courses: state.courses,
      requests: state.requests.length
        ? [{ user_id: 105, course_id: state.requests[0], created_at: new Date().toISOString(), name: 'Айгерим', username: 'aigerim' }]
        : [{ user_id: 104, course_id: 1, created_at: new Date(Date.now() - 3_600_000).toISOString(), name: 'Марк', username: 'mark_dev' }],
    }
  },

  async adminCourseSave(draft) {
    await wait(300)
    const prev = draft.id ? state.courses.find((c) => c.id === draft.id) : undefined
    const saved: AdminCourse = { students: 0, ...prev, ...draft, id: prev?.id ?? Math.max(0, ...state.courses.map((c) => c.id)) + 1 }
    state.courses = prev ? state.courses.map((c) => (c.id === saved.id ? saved : c)) : [...state.courses, saved]
    save()
    return saved
  },

  async adminCourseDelete(id) {
    await wait()
    state.courses = state.courses.filter((c) => c.id !== id)
    state.lessons = state.lessons.map((l) => (l.course_id === id ? { ...l, course_id: null } : l))
    save()
  },

  async adminRequest() {
    await wait(300)
  },

  async adminGrant(_courseId, username) {
    await wait(300)
    return username.replace(/^@/, '')
  },

  async adminPayments() {
    await wait()
    const sample: Payment = { id: 1, user_id: 104, course_id: DEMO_COURSE.id, stars: DEMO_COURSE.price_stars, created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(), refunded: false, name: 'Марк', username: 'mark_dev', course: DEMO_COURSE.title }
    return [...(state.payments ?? []), sample]
  },

  async adminRefund(id) {
    await wait(400)
    const paid = state.payments?.find((p) => p.id === id)
    if (!paid) return
    paid.refunded = true
    state.access = state.access.filter((c) => c !== paid.course_id)
    save()
  },

  async adminList() {
    await wait()
    return {
      lessons: [...state.lessons].sort((a, b) => b.id - a.id),
      stats: { users: 248, subscribed: 231, active: 64, completions: 512 + Object.keys(state.done).length },
    }
  },

  async adminSave(draft) {
    await wait(350)
    const prev = draft.id ? state.lessons.find((l) => l.id === draft.id) : undefined
    const saved: Lesson = {
      views: 0,
      likes: 0,
      completed: false,
      liked: false,
      ...prev,
      ...draft,
      id: prev?.id ?? state.nextId++,
      quiz_count: draft.quiz.length,
      has_video: !!draft.video_url,
      published_at: prev?.published_at ?? (draft.published ? new Date().toISOString() : null),
    }
    state.lessons = prev ? state.lessons.map((l) => (l.id === saved.id ? saved : l)) : [...state.lessons, saved]
    save()
    return saved
  },

  async adminDelete(id) {
    await wait()
    state.lessons = state.lessons.filter((l) => l.id !== id)
    delete state.done[id]
    save()
  },

  async adminAnnounce() {
    await wait(400)
  },

  ...makeAdventMock(me, (xp) => {
    state.xp += xp
    save()
  }),
}

export function resetDemo() {
  state = initial()
  save()
  resetAdventDemo()
}
