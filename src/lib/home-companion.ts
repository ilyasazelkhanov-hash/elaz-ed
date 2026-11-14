import { adventToday, ADVENT_START, ADVENT_END } from './advent-season.ts'
import type { AdventSummary, Card, Course, Me } from './types'
import { newestPosts } from './discovery.ts'

export type CompanionCue = {
  id: string
  tone: 'learn' | 'read' | 'advent' | 'daily' | 'celebrate'
  line: string
  detail: string
  action: string
  target: { type: 'learning'; path: '/start' | '/og-practice' } | { type: 'lesson'; id: number; post: true } | { type: 'advent' | 'advent-season' } | { type: 'course'; id: number } | { type: 'daily' }
}
type CompanionContext = { me?: Pick<Me, 'daily_claimed'> | null; courses?: Course[]; fresh?: boolean }

/** Authored navigation prompts from available data, not generated advice or a pretend AI. */
export function companionCues(feed: Card[], advent: AdventSummary | null, readIds: number[], now = Date.now(), context: CompanionContext = {}): CompanionCue[] {
  const cues: CompanionCue[] = []
  if (context.me && context.fresh !== false) cues.push(context.me.daily_claimed ? {
    id: 'daily:done', tone: 'celebrate', line: 'Сегодня уже в деле. Красиво!',
    detail: 'Отметка за день получена. Дальше в своём темпе.', action: 'Моя отметка', target: { type: 'daily' },
  } : {
    id: 'daily:ready', tone: 'daily', line: 'Привет! Начнём с маленькой победы?',
    detail: 'Твоя отметка за день прямо подо мной.', action: 'К отметке дня', target: { type: 'daily' },
  })
  // Never tease a missing, future, already-opened or expired door as available.
  if (context.fresh !== false && advent && Number.isInteger(advent.today) && advent.today >= 1 && advent.today <= advent.days && !advent.today_open) cues.push({
    id: `advent:${advent.start}:${advent.today}`, tone: 'advent', line: 'Псс. В адвенте дверь для тебя.',
    detail: `Доступна дверь №${advent.today}. Заглянем?`, action: 'Открыть адвент', target: { type: 'advent' },
  })
  const seasonDay = adventToday(new Date(now))
  if (seasonDay >= ADVENT_START && seasonDay <= ADVENT_END) cues.push({
    id: `season:${seasonDay}`, tone: 'advent', line: 'Есть десять минут на практику?',
    detail: 'Отдельная подборка: 53 AI-практики до 5 января.', action: 'К AI-практикам', target: { type: 'advent-season' },
  })
  const posts = newestPosts(feed, now)
  const post = posts.find(item => !readIds.includes(item.id)) ?? posts[0]
  if (post) cues.push({
    id: `post:${post.id}`, tone: 'read', line: 'Лови идею, не только заголовок.',
    detail: post.title, action: 'Читать статью', target: { type: 'lesson', id: post.id, post: true },
  })
  const course = context.courses?.find(item => item.access && item.lessons > 0 && item.done > 0 && item.done < item.lessons)
  if (course) cues.push({
    id: `course:${course.id}`, tone: 'learn', line: 'Твоя следующая глава ждёт.',
    detail: `${course.title} · ${course.done} из ${course.lessons} пройдено`, action: 'Продолжить курс', target: { type: 'course', id: course.id },
  })
  cues.push({
    id: 'start', tone: 'learn', line: 'Меньше «потом». Больше «умею».',
    detail: 'Один запрос к ИИ. Начни бесплатно.', action: 'Попробовать ИИ', target: { type: 'learning', path: '/start' },
  })
  if (!course && context.courses) cues.push({
    id: 'courses', tone: 'learn', line: 'Любопытство есть. Найдём направление?',
    detail: 'Посмотри программы и выбери свою.', action: 'Выбрать курс', target: { type: 'learning', path: '/og-practice' },
  })
  return cues
}

export const COMPANION_INTERVAL_MS = 14000
export const COMPANION_AUTO_LIMIT = 2
export type CompanionSession = { cueId: string; paused: boolean; autoChanges: number }
export function parseCompanionSession(raw: string | null): CompanionSession {
  const initial = { cueId: '', paused: false, autoChanges: 0 }
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return initial
    return { cueId: typeof value.cueId === 'string' ? value.cueId : '', paused: value.paused === true,
      autoChanges: Number.isInteger(value.autoChanges) ? Math.min(COMPANION_AUTO_LIMIT, Math.max(0, value.autoChanges)) : 0 }
  } catch { return initial }
}
export function nextCompanionCue(cues: CompanionCue[], currentId: string): string {
  return cues[(cues.findIndex(cue => cue.id === currentId) + 1) % cues.length]?.id ?? 'start'
}
const sessionFallback = new Map<number, CompanionSession>()
export function readCompanionSession(userId: number): CompanionSession {
  try { return sessionFallback.get(userId) ?? parseCompanionSession(sessionStorage.getItem(`og:companion:v2:${userId}`)) }
  catch { return sessionFallback.get(userId) ?? parseCompanionSession(null) }
}
export function saveCompanionSession(userId: number, value: CompanionSession) {
  sessionFallback.set(userId, value)
  try { sessionStorage.setItem(`og:companion:v2:${userId}`, JSON.stringify(value)) } catch { /* In-memory session remains usable. */ }
}

export const companionColors = ['violet', 'mint', 'peach', 'sky'] as const
export const companionShapes = ['soft', 'round', 'spark'] as const
export const companionAccessories = ['none', 'glasses', 'sprout', 'headphones'] as const
export type CompanionPreferences = { name: string; color: typeof companionColors[number]; shape: typeof companionShapes[number]; accessory: typeof companionAccessories[number] }
export const defaultCompanionPreferences: CompanionPreferences = { name: 'Dots', color: 'violet', shape: 'soft', accessory: 'none' }
export function companionName(input: string): string {
  return Array.from(input.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 24).join('') || 'Dots'
}
export function parseCompanionPreferences(raw: string | null): CompanionPreferences {
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return { ...defaultCompanionPreferences }
    return { name: typeof value.name === 'string' ? companionName(value.name) : 'Dots',
      color: companionColors.includes(value.color) ? value.color : 'violet',
      shape: companionShapes.includes(value.shape) ? value.shape : 'soft',
      accessory: companionAccessories.includes(value.accessory) ? value.accessory : 'none' }
  } catch { return { ...defaultCompanionPreferences } }
}
export const companionPreferencesKey = (userId: number) => `og:companion:look:v1:${userId}`
const preferencesFallback = new Map<number, CompanionPreferences>()
export function readCompanionPreferences(userId: number): CompanionPreferences {
  try { return preferencesFallback.get(userId) ?? parseCompanionPreferences(localStorage.getItem(companionPreferencesKey(userId))) }
  catch { return preferencesFallback.get(userId) ?? { ...defaultCompanionPreferences } }
}
/** Local, user-scoped appearance only. Nothing is sent to a server or put in analytics. */
export function saveCompanionPreferences(userId: number, value: CompanionPreferences): boolean {
  const safe = parseCompanionPreferences(JSON.stringify(value))
  preferencesFallback.set(userId, safe)
  try { localStorage.setItem(companionPreferencesKey(userId), JSON.stringify(safe)); preferencesFallback.delete(userId); return true } catch { return false }
}
