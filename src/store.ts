import { create } from 'zustand'
import { api, ApiError, isDemo } from './lib/api'
import { achievement } from './lib/game'
import { projectProgress } from './lib/journey'
import { demoPlatformXp } from './lib/experience'
import type { ShareCard } from './lib/shareCard'
import type { AdminCourse, AdventSummary, Card, CompleteResult, Course, Kind, Lesson, Me, Meta } from './lib/types'

export type Tab = 'home' | 'courses' | 'blog' | 'top' | 'profile'

/** Отступы карточки от краёв приложения — из неё раскрывается экран урока. */
export interface Inset {
  top: number
  right: number
  bottom: number
  left: number
}

export function insetOf(el: Element): Inset {
  const r = el.getBoundingClientRect()
  const root = (document.getElementById('app') ?? document.body).getBoundingClientRect()
  return { top: r.top - root.top, right: root.right - r.right, bottom: root.bottom - r.bottom, left: r.left - root.left }
}

export type Overlay =
  | { type: 'lesson'; id: number; from?: Inset }
  | { type: 'stories'; id: number }
  | { type: 'course'; id: number; from?: Inset }
  | { type: 'lab' }
  | { type: 'journey' | 'club' | 'services' }
  | { type: 'academy' | 'learning'; path?: string }
  | { type: 'admin' }
  | { type: 'analytics' }
  | { type: 'courses-admin' }
  | { type: 'course-editor'; course: AdminCourse | null }
  | { type: 'editor'; lesson: Lesson | null; kind: Kind }
  | { type: 'advent' }
  | { type: 'certifications'; focusId?: string }
  | { type: 'door'; day: number }
  | { type: 'advent-admin' }

export interface Reward {
  result: CompleteResult
  fromXp: number
  lessonId: number
}

export interface Toast {
  id: number
  text: string
  emoji?: string
}

type Phase = 'loading' | 'outside' | 'ok' | 'locked' | 'setup' | 'error'

interface Store {
  phase: Phase
  errorCode: string | null
  me: Me | null
  feed: Card[]
  courses: Course[]
  /** Сводка адвента для главной; null — календарь выключен или закончился. */
  advent: AdventSummary | null
  meta: Meta
  tab: Tab
  stack: Overlay[]
  reward: Reward | null
  /** Карточка, для которой открыта шторка «Поделиться». */
  share: ShareCard | null
  toasts: Toast[]
  seen: number[]
  boot: (force?: boolean) => Promise<Phase>
  setPhase: (phase: Phase) => void
  setTab: (tab: Tab) => void
  push: (overlay: Overlay) => void
  pop: () => void
  setMe: (me: Me) => void
  setAdvent: (advent: AdventSummary | null) => void
  patchCard: (id: number, patch: Partial<Card>) => void
  setReward: (reward: Reward | null) => void
  toast: (text: string, emoji?: string) => void
  unlocked: (codes: string[]) => void
  markSeen: (id: number) => void
  /** Сервер сказал, что подписки больше нет — закрываем приложение воротами. */
  guard: (e: unknown) => void
}

const SEEN_KEY = 'elaz-ed-seen'

function loadSeen(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    return []
  }
}

let toastId = 0
const isDemoProgress = (me: Me) => isDemo ? projectProgress(me, demoPlatformXp()) : me

declare global {
  interface Window {
    __store?: unknown
  }
}

export const useStore = create<Store>((set, get) => ({
  phase: 'loading',
  errorCode: null,
  me: null,
  feed: [],
  courses: [],
  advent: null,
  meta: { channel: { title: null, invite: null }, bot: { username: null, main_app: false } },
  tab: 'home',
  stack: [],
  reward: null,
  share: null,
  toasts: [],
  seen: loadSeen(),

  boot: async (force) => {
    try {
      const b = await api.boot(force)
      const meta = { channel: b.channel, bot: b.bot }
      if (b.status === 'ok') {
        set({ phase: 'ok', me: isDemoProgress(b.me), feed: b.feed, courses: b.courses ?? [], advent: b.advent ?? null, meta, errorCode: null })
        if (b.new_achievements?.length) get().unlocked(b.new_achievements)
      } else set({ phase: b.status, meta, stack: [], reward: null })
      return b.status
    } catch (e) {
      set({ phase: 'error', errorCode: e instanceof ApiError ? e.code : 'server' })
      return 'error'
    }
  },

  setPhase: (phase) => set({ phase }),
  setTab: (tab) => {
    const hash=tab==='home'?'':`#/${tab}`
    window.history.replaceState(null,'',`${location.pathname}${location.search}${hash}`)
    set({tab})
  },
  push: (overlay) => set((s) => ({ stack: [...s.stack, overlay] })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  setMe: (me) => set({ me: isDemoProgress(me) }),
  setAdvent: (advent) => set({ advent }),
  patchCard: (id, patch) => set((s) => ({ feed: s.feed.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  setReward: (reward) => set({ reward }),

  toast: (text, emoji) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, emoji }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600)
  },

  unlocked: (codes) => {
    codes.forEach((code, i) => {
      const a = achievement(code)
      if (a) setTimeout(() => get().toast(`Ачивка: ${a.title}`, a.emoji), 500 + i * 900)
    })
  },

  markSeen: (id) => {
    if (get().seen.includes(id)) return
    const seen = [...get().seen, id]
    set({ seen })
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-300)))
    } catch {
      /* приватный режим */
    }
  },

  guard: (e) => {
    if (e instanceof ApiError && e.code === 'locked') set({ phase: 'locked', stack: [], reward: null })
  },
}))

// Только в разработке: позволяет переключать состояния приложения из консоли.
if (import.meta.env.DEV) window.__store = useStore
