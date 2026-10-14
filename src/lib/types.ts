export type Kind = 'lesson' | 'story'
export type GradientName = 'aurora' | 'sunset' | 'mint' | 'ocean' | 'candy' | 'lime'

export interface QuizQuestion {
  q: string
  options: string[]
  correct: number
  explain?: string
}

export interface Card {
  id: number
  kind: Kind
  title: string
  subtitle: string
  category: string
  emoji: string
  gradient: GradientName
  cover_url: string | null
  minutes: number
  xp: number
  pinned: boolean
  published: boolean
  published_at: string | null
  views: number
  likes: number
  quiz_count: number
  has_video: boolean
  /** Тело приходит в ленте только у сторис. */
  body: string | null
  /** Урок закрытого курса: в общей ленте не показывается. */
  course_id: number | null
  position: number
  /** Открыт всем, даже без доступа к курсу. */
  free_preview: boolean
  completed: boolean
  liked: boolean
}

export interface Lesson extends Card {
  body: string
  video_url: string | null
  copy_text: string | null
  quiz: QuizQuestion[]
  score?: number | null
}

export interface Me {
  id: number
  name: string
  username: string | null
  photo: string | null
  xp: number
  streak: number
  best_streak: number
  daily_claimed: boolean
  lessons_done: number
  is_admin: boolean
  achievements: string[]
  rank: number
  invited: number
  /** Заморозки стрика: каждая спасает один пропущенный день. */
  freezes: number
}

export interface Meta {
  channel: { title: string | null; invite: string | null }
  bot: { username: string | null; main_app: boolean }
}

export interface Course {
  id: number
  title: string
  subtitle: string
  description: string
  emoji: string
  gradient: GradientName
  /** 0 — курс не продаётся, доступ только по заявке или приглашениям. */
  price_stars: number
  /** Сколько друзей нужно привести, чтобы курс открылся сам. 0 — выключено. */
  invite_unlock: number
  lessons: number
  done: number
  access: boolean
  request: 'pending' | 'approved' | 'declined' | null
}

export interface AdminCourse {
  id: number
  title: string
  subtitle: string
  description: string
  emoji: string
  gradient: GradientName
  price_stars: number
  invite_unlock: number
  position: number
  published: boolean
  students: number
}

export type CourseDraft = Omit<AdminCourse, 'id' | 'students'> & { id?: number }

export interface AccessRequest {
  user_id: number
  course_id: number
  created_at: string
  name: string
  username: string | null
}

/** Покупка курса за звёзды — для списка в админке. */
export interface Payment {
  id: number
  user_id: number | null
  course_id: number | null
  stars: number
  created_at: string
  refunded: boolean
  name: string
  username: string | null
  /** Название курса на момент запроса. */
  course: string
}

export type Boot = (
  | { status: 'ok'; me: Me; feed: Card[]; courses: Course[]; advent?: AdventSummary | null; new_achievements?: string[] }
  | { status: 'locked' | 'setup' }
) &
  Meta

// ---------- Адвент-календарь ----------

/** Оформление календаря: выбирает автор, у всех участников одно. */
export type AdventThemeId = 'standard' | 'halloween' | 'newyear'

/** Короткая сводка для главной: есть ли календарь, какой сегодня день, открыта ли дверь. */
export interface AdventSummary {
  title: string
  /** Старый сервер тему не присылает — тогда стандартная. */
  theme?: AdventThemeId
  start: string
  days: number
  /** Номер дня кампании: 1 — первый день, 0 и меньше — до старта. */
  today: number
  opened: number
  today_open: boolean
  streak: number
}

export type DoorKind = 'quiz' | 'scratch' | 'arcade' | 'story'
/** open — открыта; today — дверь сегодняшнего дня; late — пропущена, можно догнать; missed — кампания закрыта; locked — ещё не наступила. */
export type DoorState = 'open' | 'today' | 'late' | 'missed' | 'locked'

export interface AdventCell {
  day: number
  kind: DoorKind
  /** У будущих дверей тема и иконка скрыты. */
  title: string | null
  emoji: string | null
  state: DoorState
  xp: number | null
}

export interface AdventReward {
  id: number
  doors: number
  title: string
  description: string
  emoji: string
  stock: number | null
  code: string | null
  redeemed: boolean
}

export interface AdventState {
  title: string
  theme?: AdventThemeId
  start: string
  days: number
  today: number
  closed: boolean
  opened: number
  streak: number
  doors: AdventCell[]
  rewards: AdventReward[]
}

export interface DoorQuestion {
  q: string
  options: string[]
  /** Приходят только после того, как дверь открыта. */
  correct?: number
  explain?: string
}

export interface DoorView {
  day: number
  kind: DoorKind
  title: string
  subtitle: string
  emoji: string
  xp: number
  late: boolean
  closed: boolean
  opened: { score: number; total: number; xp: number; late: boolean } | null
  quiz: DoorQuestion[]
  arcade: { seconds: number; cap: number } | null
  prize: string | null
  body: string | null
}

export interface NewCode {
  reward_id: number
  code: string
  title: string
  emoji: string
}

export interface DoorResult {
  already: boolean
  gained: number
  score: number
  total: number
  opened: number | null
  new_codes: NewCode[]
  door: DoorView
  me: Me
}

export interface AdventAdmin {
  theme?: AdventThemeId
  participants: number
  opens: number
  by_day: { day: number; title: string; kind: DoorKind; opens: number; late: number }[]
  rewards: { id: number; title: string; doors: number; stock: number | null; issued: number; redeemed: number }[]
  points: { name: string; redeemed: number }[]
}

export interface RedeemPoint {
  id: number
  name: string
}

export interface RedeemCheck {
  status: 'issued' | 'redeemed'
  redeemed_at: string | null
  title: string
  emoji: string
}

export interface CompleteResult {
  already: boolean
  gained: number
  base: number
  bonus: number
  score: number
  total: number
  new_achievements: string[]
  me: Me
}

export interface DailyResult {
  gained: number
  /** Пропущенный день закрыла заморозка. */
  froze: boolean
  new_achievements: string[]
  me: Me
}

export interface TopUser {
  id: number
  name: string
  photo: string | null
  xp: number
  streak: number
}

export interface TopResult {
  top: TopUser[]
  rank: number
}

export interface AdminStats {
  users: number
  subscribed: number
  active: number
  completions: number
}

export type ShareKind = 'level' | 'lesson' | 'streak' | 'achievement'

export interface ClientEvent {
  name: 'share' | 'copy' | 'story_open' | 'theme' | 'lab'
  lesson_id?: number
  props?: Record<string, string | number | boolean>
}

export interface Analytics {
  totals: { users: number; subscribed: number; new7: number; dau: number; wau: number; mau: number }
  series: { d: string; active: number; fresh: number; done: number }[]
  funnel: { opened: number; subscribed: number; done1: number; done3: number; streak3: number }
  /** d1/d7 — сколько вернулось, d1n/d7n — сколько человек в когорте. */
  retention: { d1: number; d1n: number; d7: number; d7n: number }
  lessons: { id: number; title: string; emoji: string; kind: Kind; opens: number; done: number; quiz: number | null; likes: number; shares: number }[]
  shares: { kind: string; channel: string; n: number }[]
  invited: number
  /** Выручка в звёздах Telegram за всё время. */
  stars: { total: number; count: number }
}

export type LessonDraft = Omit<Lesson, 'id' | 'completed' | 'liked' | 'views' | 'likes' | 'quiz_count' | 'has_video' | 'published_at' | 'score'> & {
  id?: number
}

export interface Api {
  boot(force?: boolean): Promise<Boot>
  lesson(id: number): Promise<Lesson>
  complete(id: number, answers: number[]): Promise<CompleteResult>
  daily(): Promise<DailyResult>
  like(id: number): Promise<{ liked: boolean; likes: number }>
  top(): Promise<TopResult>
  track(events: ClientEvent[]): Promise<void>
  /** Кладёт картинку в хранилище и возвращает публичную ссылку; в демо-режиме — null. */
  shareUpload(image: string, kind: ShareKind): Promise<string | null>
  /** Готовит сообщение с картинкой и кнопкой; возвращает его id для Telegram. */
  shareMessage(kind: ShareKind, lessonId?: number): Promise<string | null>
  courseRequest(id: number): Promise<void>
  /** Ссылка на счёт в звёздах; null — демо-режим, оплата условная. */
  courseInvoice(id: number): Promise<string | null>
  adminAnalytics(): Promise<Analytics>
  adminCourses(): Promise<{ courses: AdminCourse[]; requests: AccessRequest[] }>
  adminCourseSave(course: CourseDraft): Promise<AdminCourse>
  adminCourseDelete(id: number): Promise<void>
  adminRequest(userId: number, courseId: number, approve: boolean): Promise<void>
  /** Возвращает имя человека, которому открыт доступ. */
  adminGrant(courseId: number, username: string): Promise<string>
  adminPayments(): Promise<Payment[]>
  /** Возвращает звёзды через Telegram и закрывает доступ, выданный за эту оплату. */
  adminRefund(id: number): Promise<void>
  adminList(): Promise<{ lessons: Lesson[]; stats: AdminStats }>
  adminSave(lesson: LessonDraft): Promise<Lesson>
  adminDelete(id: number): Promise<void>
  adminAnnounce(id: number): Promise<void>
  advent(): Promise<AdventState>
  adventDoor(day: number): Promise<DoorView>
  /** answers — для квиза, score — для аркады; скретч и сторис открываются без данных. */
  adventOpen(day: number, input?: { answers?: number[]; score?: number }): Promise<DoorResult>
  adminAdvent(): Promise<AdventAdmin>
  /** Меняет оформление календаря у всех участников. */
  adminAdventTheme(theme: AdventThemeId): Promise<void>
  redeemPoints(): Promise<RedeemPoint[]>
  /** check — только проверить код, не гасить. */
  redeemCheck(point: number, pin: string, code: string): Promise<RedeemCheck>
  redeem(point: number, pin: string, code: string): Promise<{ title: string; emoji: string }>
}
