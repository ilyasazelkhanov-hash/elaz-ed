// Адвент в демо-режиме: те же правила, что на сервере, данные — в localStorage.
// Кампания в демо всегда «идёт седьмой день», чтобы было что открыть, догнать и что ждёт впереди.
import seed from './adventSeed.json'
import { adventStreak, doorXp } from './advent'
import { ApiError } from './errors'
import type { AdminDoor, AdminReward, AdventAdmin, AdventSettings, AdventThemeId, AdventState, AdventSummary, Api, DoorKind, DoorView, Me, NewCode, RedeemCheck, RedeemPoint } from './types'

const KEY = 'elaz-ed-demo-advent-v1'
const DEMO_DAY = 7
const DAYS = 24
const GRACE = 3
const TITLE = 'Адвент вайбкодера'
const DEMO_POINT: RedeemPoint = { id: 1, name: 'Демо-касса' }
const DEMO_PIN = '1234'

interface Door {
  day: number
  kind: DoorKind
  title: string
  subtitle: string
  emoji: string
  xp: number
  body: string
  prize?: string
  quiz?: { q: string; options: string[]; correct: number; explain?: string }[]
  arcade?: { seconds: number; cap: number }
}

interface Opened {
  score: number
  total: number
  xp: number
  late: boolean
}

interface AdventDemo {
  theme?: AdventThemeId
  /** Билеты «догнать»: в демо их можно только купить, и то условно. */
  tickets?: number
  used?: number
  bought?: number
  settings?: AdventSettings
  rewardList?: AdminReward[]
  doorList?: Door[]
  drawn?: number[]
  opens: Record<number, Opened>
  codes: Record<number, { code: string; redeemed: boolean }>
}

const SEED_DOORS = seed.doors as Door[]
// Призы демо показывают разные виды: промокод, сообщение, видео.
const DEMO_KINDS: Pick<AdminReward, 'kind' | 'payload'>[] = [
  { kind: 'message', payload: { text: 'Промпт-пак: «Ты — редактор. Сократи текст на треть, сохрани факты и голос автора».' } },
  { kind: 'video', payload: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'Смотреть разбор' } },
  { kind: 'promo', payload: {} },
  { kind: 'promo', payload: {} },
]
type DemoReward = AdminReward & { id: number }
// Режимы в демо: по порогу, случайный приз и розыгрыш — чтобы было видно все варианты.
const DEMO_MODES: Pick<AdminReward, 'mode' | 'day_from' | 'day_to'>[] = [
  { mode: 'threshold', day_from: null, day_to: null },
  { mode: 'instant', day_from: 1, day_to: 24 },
  { mode: 'draw', day_from: 1, day_to: 14 },
  { mode: 'threshold', day_from: null, day_to: null },
]
const SEED_REWARDS: DemoReward[] = seed.rewards.map((r, i) => ({ ...r, id: i + 1, position: i, ...DEMO_KINDS[i % DEMO_KINDS.length], ...DEMO_MODES[i % DEMO_MODES.length], stock: r.stock ?? (i === 1 ? 13 : i === 2 ? 7 : null) }))
const rewards = (): DemoReward[] => (state.rewardList as DemoReward[] | undefined) ?? SEED_REWARDS

function load(): AdventDemo {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw?.opens && raw?.codes) return raw
  } catch {
    /* повреждённые данные — начинаем заново */
  }
  return { opens: {}, codes: {} }
}

let state = load()
const doors = (): Door[] => state.doorList ?? SEED_DOORS
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* приватный режим */
  }
}

/** Старт кампании в демо: шесть дней назад по локальному календарю. */
function start() {
  const d = new Date()
  d.setDate(d.getDate() - (DEMO_DAY - 1))
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms))
const cap = (d: Door) => d.arcade?.cap ?? 40
const onTime = () => Object.entries(state.opens).filter(([, o]) => !o.late).map(([day]) => Number(day))

function view(d: Door): DoorView {
  const o = state.opens[d.day] ?? null
  return {
    day: d.day,
    kind: d.kind,
    title: d.title,
    subtitle: d.subtitle,
    emoji: d.emoji,
    xp: d.xp,
    late: !o && d.day < DEMO_DAY,
    closed: false,
    opened: o,
    quiz: (d.quiz ?? []).map((q) => ({ q: q.q, options: q.options, ...(o ? { correct: q.correct, explain: q.explain ?? '' } : {}) })),
    arcade: d.kind === 'arcade' ? { seconds: d.arcade?.seconds ?? 30, cap: cap(d) } : null,
    prize: o ? (d.prize ?? '') : null,
    body: o ? d.body : null,
  }
}

function door(day: number) {
  const d = doors().find((x) => x.day === day)
  if (!d) throw new ApiError('not_found', 404)
  if (day > DEMO_DAY) throw new ApiError('door_locked', 403)
  return d
}

function code() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const s = Array.from(crypto.getRandomValues(new Uint32Array(8)), (b) => abc[b % abc.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

function issue(lastDay: number): NewCode[] {
  const opened = Object.keys(state.opens).length
  const fresh: NewCode[] = []
  for (const r of rewards()) {
    if (state.codes[r.id]) continue
    const inWin = (d: number) => d >= (r.day_from ?? 1) && d <= (r.day_to ?? 60)
    const issuedCount = Object.keys(state.codes).filter((k) => Number(k) === r.id).length
    // В демо один участник: случайный приз выпадает с шансом 35%, розыгрыш — только по кнопке в админке.
    const take = r.mode === 'threshold' ? r.doors <= opened : r.mode === 'day' ? inWin(lastDay) : r.mode === 'instant' ? inWin(lastDay) && (r.stock ?? 1) > issuedCount && Math.random() < 0.35 : false
    if (!take) continue
    const c = code()
    state.codes[r.id] = { code: c, redeemed: false }
    fresh.push({ reward_id: r.id, code: r.kind === 'promo' ? c : null, kind: r.kind, mode: r.mode, title: r.title, emoji: r.emoji, content: r.kind === 'promo' ? null : r.payload })
  }
  return fresh
}

export function adventSummaryDemo(): AdventSummary {
  return {
    title: TITLE,
    theme: state.theme ?? 'halloween',
    start: start(),
    days: DAYS,
    today: DEMO_DAY,
    opened: Object.keys(state.opens).length,
    today_open: !!state.opens[DEMO_DAY],
    streak: adventStreak(onTime(), DEMO_DAY),
  }
}

export function resetAdventDemo() {
  state = { theme: state.theme, opens: {}, codes: {} }
  save()
}

function settings(): AdventSettings {
  return state.settings ?? { enabled: true, title: TITLE, start: start(), days: DAYS, catchup: { methods: ['quiz', 'invite', 'story', 'stars'], stars: 50 } }
}

/** В демо тему можно менять прямо из календаря — она хранится вместе с демо-прогрессом. */
export function setAdventThemeDemo(theme: AdventThemeId) {
  state.theme = theme
  save()
}

type AdventApi = Pick<Api, 'advent' | 'adventDoor' | 'adventOpen' | 'adminAdvent' | 'adminAdventTheme' | 'adventTicketInvoice' | 'adminAdventSave' | 'adminAdventRewardSave' | 'adminAdventRewardDelete' | 'adminAdventDraw' | 'adminAdventDoors' | 'adminAdventDoorSave' | 'adminAdventDoorDelete' | 'adminAdventPulse' | 'adminAdventWinners' | 'adminAdventTicketGrant' | 'adminAdventPoints' | 'adminAdventPointSave' | 'adminAdventPointDelete' | 'redeemPoints' | 'redeemCheck' | 'redeem'>

/** me и addXp приходят из основного демо: XP у человека общий. */
export function makeAdventMock(me: () => Me, addXp: (n: number) => void): AdventApi {
  const findCode = (raw: string) => {
    const want = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const hit = Object.entries(state.codes).find(([, c]) => c.code.replace('-', '') === want)
    if (!hit) throw new ApiError('code_not_found', 404)
    const reward = rewards().find((r) => r.id === Number(hit[0]))!
    return { entry: hit[1], reward }
  }
  const checkPin = (point: number, pin: string) => {
    if (point !== DEMO_POINT.id) throw new ApiError('point_not_found', 404)
    if (pin !== DEMO_PIN) throw new ApiError('bad_pin', 403)
  }

  return {
    async advent(): Promise<AdventState> {
      await wait()
      return {
        ...adventSummaryDemo(),
        closed: false,
        doors: doors().map((d) => {
          const o = state.opens[d.day]
          const visible = d.day <= DEMO_DAY
          const st = o ? 'open' : d.day > DEMO_DAY ? 'locked' : d.day === DEMO_DAY ? 'today' : 'late'
          return { day: d.day, kind: d.kind, title: visible ? d.title : null, emoji: visible ? d.emoji : null, state: st, xp: o?.xp ?? null }
        }),
        rewards: rewards().map((r) => {
          const c = state.codes[r.id]
          const entries = Object.keys(state.opens).filter((d) => Number(d) >= (r.day_from ?? 1) && Number(d) <= (r.day_to ?? 60)).length
          return {
            id: r.id,
            doors: r.doors,
            title: r.title,
            description: r.description,
            emoji: r.emoji,
            stock: r.stock,
            kind: r.kind,
            issued: !!c,
            code: c && r.kind === 'promo' ? c.code : null,
            redeemed: !!c?.redeemed,
            content: c && r.kind !== 'promo' ? r.payload : null,
            mode: r.mode,
            day_from: r.day_from,
            day_to: r.day_to,
            // Демо: будто другие участники уже забрали часть.
            left: r.stock != null ? Math.max(0, r.stock - (c ? 1 : 0) - (r.mode === 'instant' ? 4 : 0)) : null,
            drawn: !!state.drawn?.includes(r.id),
            entries: r.mode === 'draw' ? entries : null,
          }
        }),
        catchup: { methods: settings().catchup.methods, stars: settings().catchup.stars, tickets: state.tickets ?? 0, used: state.used ?? 0, earned: { stars: state.bought ?? 0 } },
      }
    },

    async adventDoor(day) {
      await wait(200)
      return view(door(day))
    },

    async adventOpen(day, input) {
      await wait(420)
      const d = door(day)
      const prev = state.opens[day]
      if (prev) return { already: true, gained: 0, score: prev.score, total: prev.total, opened: null, new_codes: [], door: view(d), me: me() }
      const late = day < DEMO_DAY
      // Пропущенная дверь — только за билет, как на сервере.
      if (late) {
        if (!state.tickets) throw new ApiError('need_ticket', 402)
        state.tickets -= 1
        state.used = (state.used ?? 0) + 1
      }
      let score = 0
      let total = 0
      if (d.kind === 'quiz') {
        const quiz = d.quiz ?? []
        total = quiz.length
        score = quiz.filter((q, i) => input?.answers?.[i] === q.correct).length
      } else if (d.kind === 'arcade') {
        total = cap(d)
        score = Math.min(Math.max(0, Math.round(input?.score ?? 0)), total)
      }
      const xp = doorXp(d, score, cap(d), late)
      state.opens[day] = { score, total, xp, late }
      addXp(xp)
      const fresh = issue(day)
      save()
      return { already: false, gained: xp, score, total, opened: Object.keys(state.opens).length, new_codes: fresh, door: view(d), me: me() }
    },

    async adventTicketInvoice() {
      await wait(400)
      state.tickets = (state.tickets ?? 0) + 1
      state.bought = (state.bought ?? 0) + 1
      save()
      return null
    },

    async adminAdventSave(next) {
      await wait(250)
      state.settings = { ...settings(), ...next, catchup: { ...settings().catchup, ...next.catchup } }
      save()
    },

    async adminAdventRewardSave(reward) {
      await wait(250)
      const list = [...rewards()]
      const saved: DemoReward = { ...reward, id: reward.id ?? Math.max(0, ...list.map((r) => r.id ?? 0)) + 1 }
      state.rewardList = reward.id ? list.map((r) => (r.id === reward.id ? saved : r)) : [...list, saved]
      save()
      return saved
    },

    async adminAdventRewardDelete(id) {
      await wait(200)
      if (state.codes[id]) throw new ApiError('reward_issued', 409)
      state.rewardList = rewards().filter((r) => r.id !== id)
      save()
    },

    async adminAdventDraw(id) {
      await wait(400)
      if (state.drawn?.includes(id)) throw new ApiError('already_drawn', 409)
      state.drawn = [...(state.drawn ?? []), id]
      const r = rewards().find((x) => x.id === id)
      const mine = Object.keys(state.opens).some((d) => Number(d) >= (r?.day_from ?? 1) && Number(d) <= (r?.day_to ?? 60))
      // Демо: единственный участник с шансами — выигрывает.
      if (r && mine && !state.codes[id]) state.codes[id] = { code: code(), redeemed: false }
      save()
      return mine ? 1 : 0
    },

    async adminAdventPulse() {
      await wait()
      return {
        today: DEMO_DAY,
        days: settings().days,
        catchup: { sheet_users: 41, tries: { stars: 12, invite: 9, quiz: 17, story: 6 }, sources: { quiz: { earned: 14, used: 11, revoked: 0 }, invite: { earned: 5, used: 4, revoked: 0 }, story: { earned: 3, used: 2, revoked: 0 }, stars: { earned: 9 + (state.bought ?? 0), used: 8, revoked: 1 } } },
        pacing: rewards().map((r) => {
          const span = (r.day_to ?? 24) - (r.day_from ?? 1) + 1
          const elapsed = Math.min(Math.max(DEMO_DAY - (r.day_from ?? 1) + 1, 0), span)
          return { id: r.id, title: r.title, emoji: r.emoji, mode: r.mode, stock: r.stock, day_from: r.day_from, day_to: r.day_to, drawn: !!state.drawn?.includes(r.id), issued: r.mode === 'instant' ? 4 : r.doors <= 7 ? 120 : 0, redeemed: r.mode === 'instant' ? 2 : 60, expected: r.mode === 'instant' && r.stock ? Math.round((r.stock * elapsed) / span) : null }
        }),
      }
    },

    async adminAdventWinners(rewardId) {
      await wait()
      const all = [
        { code: 'K7PM-3QXA', status: 'redeemed' as const, issued_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), redeemed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), reward_id: 1, reward: rewards()[0]?.title ?? 'Приз', emoji: rewards()[0]?.emoji ?? '🎁', kind: rewards()[0]?.kind ?? 'promo', user_id: 104, name: 'Марк', username: 'mark_dev', point: DEMO_POINT.name },
        { code: 'H2RD-9WTN', status: 'issued' as const, issued_at: new Date(Date.now() - 86_400_000).toISOString(), redeemed_at: null, reward_id: 2, reward: rewards()[1]?.title ?? 'Приз', emoji: rewards()[1]?.emoji ?? '🎁', kind: rewards()[1]?.kind ?? 'promo', user_id: 105, name: 'Айгерим', username: 'aigerim', point: null },
      ]
      return rewardId ? all.filter((w) => w.reward_id === rewardId) : all
    },

    async adminAdventTicketGrant(username, count) {
      await wait(300)
      state.tickets = (state.tickets ?? 0) + count
      save()
      return username.replace(/^@/, '')
    },

    async adminAdventPoints() {
      await wait()
      return [{ id: DEMO_POINT.id, name: DEMO_POINT.name, locked: false, redeemed: 37 }]
    },

    async adminAdventPointSave() {
      await wait(250)
    },

    async adminAdventPointDelete() {
      await wait(200)
      throw new ApiError('point_used', 409)
    },

    async adminAdventDoors() {
      await wait()
      return doors().map((d) => ({ day: d.day, kind: d.kind, title: d.title, subtitle: d.subtitle ?? '', emoji: d.emoji, body: d.body ?? '', quiz: d.quiz ?? [], prize: d.prize ?? '', arcade: d.arcade ?? {}, xp: d.xp }))
    },

    async adminAdventDoorSave(door: AdminDoor) {
      await wait(250)
      const next = doors().filter((d) => d.day !== door.day)
      state.doorList = [...next, door as unknown as Door].sort((a, b) => a.day - b.day)
      save()
      return door
    },

    async adminAdventDoorDelete(day) {
      await wait(200)
      if (state.opens[day]) throw new ApiError('door_opened', 409)
      state.doorList = doors().filter((d) => d.day !== day)
      save()
    },

    async adminAdventTheme(theme) {
      await wait(200)
      setAdventThemeDemo(theme)
    },

    async adminAdvent(): Promise<AdventAdmin> {
      await wait()
      return {
        theme: state.theme ?? 'halloween',
        participants: 312,
        opens: 2140 + Object.keys(state.opens).length,
        by_day: doors().filter((d) => d.day <= DEMO_DAY).map((d) => ({ day: d.day, title: d.title, kind: d.kind, opens: Math.max(40, 300 - d.day * 22), late: 6 + d.day })),
        rewards: rewards().map((r) => ({ id: r.id, title: r.title, doors: r.doors, stock: r.stock, issued: r.doors <= 7 ? 180 - r.doors * 12 : 0, redeemed: r.doors <= 7 ? 90 - r.doors * 8 : 0 })),
        points: [{ name: DEMO_POINT.name, redeemed: 37 }],
        settings: settings(),
        doors_defined: doors().length,
        reward_list: rewards(),
      }
    },

    async redeemPoints() {
      await wait(150)
      return [DEMO_POINT]
    },

    async redeemCheck(point, pin, raw): Promise<RedeemCheck> {
      await wait()
      checkPin(point, pin)
      const { entry, reward } = findCode(raw)
      return { status: entry.redeemed ? 'redeemed' : 'issued', redeemed_at: null, title: reward.title, emoji: reward.emoji }
    },

    async redeem(point, pin, raw) {
      await wait(350)
      checkPin(point, pin)
      const { entry, reward } = findCode(raw)
      if (entry.redeemed) throw new ApiError('code_used', 409)
      entry.redeemed = true
      save()
      return { title: reward.title, emoji: reward.emoji }
    },
  }
}
