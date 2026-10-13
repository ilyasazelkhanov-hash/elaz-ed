import type { GradientName } from './types'

export interface Gradient {
  label: string
  /** Цвет текста поверх градиента. */
  ink: string
  glow: string
  /** Опорные цвета: из них собирается и CSS, и заливка на canvas для картинок в сторис. */
  stops: [color: string, percent: number][]
  css: string
}

function gradient(label: string, ink: string, glow: string, stops: Gradient['stops']): Gradient {
  return { label, ink, glow, stops, css: `linear-gradient(135deg,${stops.map(([c, p]) => `${c} ${p}%`).join(',')})` }
}

export const GRADIENTS: Record<GradientName, Gradient> = {
  aurora: gradient('Аврора', '#FFFFFF', '#9B7BFF', [['#7C6BFF', 0], ['#B26BFF', 50], ['#FF85C0', 100]]),
  sunset: gradient('Закат', '#FFFFFF', '#FF7AA2', [['#FF9F7A', 0], ['#FF7AA2', 55], ['#B57BFF', 100]]),
  ocean: gradient('Океан', '#FFFFFF', '#6F9BFF', [['#5FB4FF', 0], ['#7C7BFF', 100]]),
  mint: gradient('Мята', '#06231C', '#63E6C8', [['#6FF0C2', 0], ['#63CFF5', 100]]),
  candy: gradient('Карамель', '#2A1020', '#FF9A8B', [['#FFD27A', 0], ['#FF9A8B', 50], ['#FF7EC7', 100]]),
  lime: gradient('Лайм', '#10240F', '#A9EF8C', [['#D6F77A', 0], ['#7BE8A5', 100]]),
}

export const GRADIENT_NAMES = Object.keys(GRADIENTS) as GradientName[]

export const LEVELS = [
  { xp: 0, title: 'Новичок', emoji: '🐣' },
  { xp: 100, title: 'Искатель', emoji: '🧭' },
  { xp: 250, title: 'Вайбкодер', emoji: '⚡' },
  { xp: 500, title: 'Промптер', emoji: '🧠' },
  { xp: 900, title: 'Билдер', emoji: '🛠️' },
  { xp: 1500, title: 'Архитектор', emoji: '🚀' },
  { xp: 2500, title: 'Нейромаг', emoji: '🔮' },
  { xp: 4000, title: 'Легенда', emoji: '👑' },
]

export function levelOf(xp: number) {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++
  const cur = LEVELS[i]
  const next = LEVELS[i + 1] ?? null
  return {
    index: i + 1,
    title: cur.title,
    emoji: cur.emoji,
    next,
    left: next ? next.xp - xp : 0,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  }
}

export const ACHIEVEMENTS: { code: string; title: string; desc: string; emoji: string }[] = [
  { code: 'first', title: 'Первый шаг', desc: 'Пройди первый урок', emoji: '🚀' },
  { code: 'perfect', title: 'Без ошибок', desc: 'Ответь на весь квиз верно', emoji: '🎯' },
  { code: 'streak3', title: 'Три подряд', desc: 'Держи стрик три дня', emoji: '✨' },
  { code: 'five', title: 'Разгон', desc: 'Пройди пять уроков', emoji: '🔥' },
  { code: 'streak7', title: 'Неделя', desc: 'Держи стрик семь дней', emoji: '⚡' },
  { code: 'night', title: 'Ночная смена', desc: 'Пройди урок после полуночи', emoji: '🦉' },
  { code: 'invite', title: 'Амбассадор', desc: 'Приведи трёх друзей', emoji: '🤝' },
  { code: 'ten', title: 'Машина', desc: 'Пройди десять уроков', emoji: '🤖' },
  { code: 'streak30', title: 'Месяц', desc: 'Держи стрик тридцать дней', emoji: '💎' },
]

export const achievement = (code: string) => ACHIEVEMENTS.find((a) => a.code === code)

/** Очки за верный ответ: серия без ошибок поднимает награду с 10 до 20. Формула совпадает с серверной. */
export const comboPoints = (combo: number) => 10 + 5 * Math.min(Math.max(combo, 1) - 1, 2)

export function quizScore(correct: number[], answers: number[]) {
  let combo = 0
  let score = 0
  let bonus = 0
  correct.forEach((c, i) => {
    if (answers[i] === c) {
      combo++
      score++
      bonus += comboPoints(combo)
    } else {
      combo = 0
    }
  })
  return { score, bonus }
}

/** Награда за бонус дня при данном стрике — та же формула, что на сервере. */
export const dailyReward = (streak: number) => 10 + Math.min(Math.max(streak, 1), 7) * 5

export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export const days = (n: number) => `${n} ${plural(n, ['день', 'дня', 'дней'])}`
export const lessonsWord = (n: number) => plural(n, ['урок', 'урока', 'уроков'])

/** Слайды сторис разделяются строкой из трёх дефисов. */
export const slidesOf = (body: string | null) =>
  (body ?? '')
    .split(/\n\s*---+\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)

export const readMinutes = (text: string) => Math.max(1, Math.round(text.trim().split(/\s+/).length / 170))
