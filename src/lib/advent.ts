// Правила адвента, общие для интерфейса и демо-режима.
// Формулы продублированы в Edge Function (doorXp, adventStreak) — менять в обоих местах.
import type { DoorKind } from './types'

export const QUIZ_POINT = 10
export const LATE_RATE = 0.5

/** XP за дверь: база + 10 за верный ответ квиза или половина очков аркады (не выше потолка). Опоздание — вдвое меньше. */
export function doorXp(door: { kind: DoorKind; xp: number }, score: number, cap: number, late: boolean) {
  const bonus = door.kind === 'quiz' ? score * QUIZ_POINT : door.kind === 'arcade' ? Math.floor(Math.min(score, cap) / 2) : 0
  return Math.round((door.xp + bonus) * (late ? LATE_RATE : 1))
}

/** Серия: дни подряд, когда дверь открыта в свой день, считая от сегодня (или вчера, если сегодня ещё нет). */
export function adventStreak(onTimeDays: number[], today: number) {
  const set = new Set(onTimeDays)
  let d = set.has(today) ? today : today - 1
  let n = 0
  while (d >= 1 && set.has(d)) {
    n++
    d--
  }
  return n
}

export const KIND_LABEL: Record<DoorKind, string> = { quiz: 'Квиз', scratch: 'Скретч', arcade: 'Аркада', story: 'История' }

/** «8 декабря» из ISO-даты, без сдвига часового пояса. */
export function dayMonth(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

/** Код награды показываем крупно и группами: ABCD-EF23. */
export const formatCode = (raw: string) => {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s
}
