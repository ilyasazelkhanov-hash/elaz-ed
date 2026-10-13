// Демо-режим: тот же интерфейс, что у сервера, но всё живёт в localStorage. К настоящей базе не обращается.
import seed from './seed.json'
import { dailyReward, quizScore } from './game'
import { tgUser } from './tg'
import type { Analytics, Api, Boot, Card, CompleteResult, DailyResult, Lesson, LessonDraft, Me, TopUser } from './types'

const KEY = 'elaz-ed-demo-v1'

interface DemoState {
  lessons: Lesson[]
  nextId: number
  xp: number
  streak: number
  best: number
  lastClaim: string | null
  done: Record<number, number>
  liked: number[]
  achievements: string[]
}

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms))

function initial(): DemoState {
  const now = Date.now()
  const lessons = (seed as unknown as LessonDraft[]).map((l, i) => ({
    ...l,
    id: i + 1,
    published: true,
    published_at: new Date(now - i * 86_400_000).toISOString(),
    views: 120 - i * 17,
    likes: 34 - i * 5,
    quiz_count: l.quiz.length,
    has_video: !!l.video_url,
    completed: false,
    liked: false,
  })) as Lesson[]
  return { lessons, nextId: lessons.length + 1, xp: 0, streak: 0, best: 0, lastClaim: null, done: {}, liked: [], achievements: [] }
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
  const alive = !!state.lastClaim && dayDiff(today(), state.lastClaim) <= 1
  return {
    id: tgUser.id ?? 1,
    name: tgUser.first_name ?? 'Гость',
    username: null,
    photo: tgUser.photo_url ?? null,
    xp: state.xp,
    streak: alive ? state.streak : 0,
    best_streak: state.best,
    daily_claimed: state.lastClaim === today(),
    lessons_done: state.lessons.filter((l) => l.kind === 'lesson' && l.id in state.done).length,
    // В опубликованном демо админки нет: она только у владельцев в настоящем приложении.
    is_admin: import.meta.env.DEV,
    achievements: state.achievements,
    rank: RIVALS.filter((r) => r.xp > state.xp).length + 1,
    invited: 0,
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
      channel: { title: 'Elaz', invite: 'https://t.me/+k36WMjkFf6BmNDYy' },
      bot: { username: 'elazart_bot', main_app: false },
    }
  },

  async lesson(id) {
    await wait()
    const l = state.lessons.find((x) => x.id === id)
    if (!l) throw new Error('not_found')
    return { ...l, completed: id in state.done, liked: state.liked.includes(id), score: state.done[id] ?? null }
  },

  async complete(id, answers): Promise<CompleteResult> {
    await wait(350)
    const l = state.lessons.find((x) => x.id === id)
    if (!l) throw new Error('not_found')
    const { score, bonus } = quizScore(
      l.quiz.map((q) => q.correct),
      answers,
    )
    if (id in state.done) return { already: true, gained: 0, base: 0, bonus: 0, score, total: l.quiz.length, new_achievements: [], me: me() }
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
    if (state.lastClaim === t) return { gained: 0, new_achievements: [], me: me() }
    state.streak = state.lastClaim && dayDiff(t, state.lastClaim) === 1 ? state.streak + 1 : 1
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
    return { gained, new_achievements: fresh, me: me() }
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
        .map((l, i) => ({ id: l.id, title: l.title, emoji: l.emoji, kind: l.kind, opens: 150 - i * 24, done: 104 - i * 21, quiz: l.quiz.length ? 82 - i * 7 : null, likes: l.likes, shares: 12 - i * 2 })),
      shares: [
        { kind: 'lesson', channel: 'native', n: 31 },
        { kind: 'level', channel: 'tg_story', n: 14 },
        { kind: 'streak', channel: 'save', n: 9 },
        { kind: 'lesson', channel: 'link', n: 6 },
      ],
      invited: 23,
    }
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
}

export function resetDemo() {
  state = initial()
  save()
}
