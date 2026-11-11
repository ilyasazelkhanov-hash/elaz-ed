import type { AdventSummary, Card } from './types'
import { newestPosts } from './discovery.ts'

export type CompanionCue = {
  id: string
  tone: 'learn' | 'read' | 'advent'
  line: string
  detail: string
  action: string
  target: { type: 'learning'; path: '/start' } | { type: 'lesson'; id: number; post: true } | { type: 'advent' }
}

/** Authored navigation prompts, not generated advice or a pretend conversational AI. */
export function companionCues(feed: Card[], advent: AdventSummary | null, readIds: number[], now = Date.now()): CompanionCue[] {
  const cues: CompanionCue[] = [{
    id: 'start', tone: 'learn', line: 'Меньше «потом». Больше «умею».',
    detail: 'Один запрос к ИИ. Начни бесплатно.', action: 'Попробовать ИИ', target: { type: 'learning', path: '/start' },
  }]
  const posts = newestPosts(feed, now)
  const post = posts.find(item => !readIds.includes(item.id)) ?? posts[0]
  if (post) cues.push({
    id: `post:${post.id}`, tone: 'read', line: 'Лови идею. Не только лайк.',
    detail: post.title, action: 'Читать статью', target: { type: 'lesson', id: post.id, post: true },
  })
  // Never tease a missing, future, already-opened or expired door as available.
  if (advent && advent.today >= 1 && advent.today <= advent.days && !advent.today_open) cues.push({
    id: `advent:${advent.start}:${advent.today}`, tone: 'advent', line: 'Тук-тук. Там что-то для тебя.',
    detail: `В адвенте доступна дверь №${advent.today}.`, action: 'Открыть адвент', target: { type: 'advent' },
  })
  return cues
}

export const COMPANION_INTERVAL_MS = 14000
export const COMPANION_AUTO_LIMIT = 2
export type CompanionSession = { cueId: string; collapsed: boolean; paused: boolean; autoChanges: number }
export function parseCompanionSession(raw: string | null): CompanionSession {
  const initial = { cueId: 'start', collapsed: false, paused: false, autoChanges: 0 }
  try {
    const value = JSON.parse(raw ?? 'null')
    if (!value || typeof value !== 'object') return initial
    return { cueId: typeof value.cueId === 'string' ? value.cueId : 'start', collapsed: value.collapsed === true,
      paused: value.paused === true, autoChanges: Number.isInteger(value.autoChanges) ? Math.min(COMPANION_AUTO_LIMIT, Math.max(0, value.autoChanges)) : 0 }
  } catch { return initial }
}
export function nextCompanionCue(cues: CompanionCue[], currentId: string): string {
  return cues[(Math.max(0, cues.findIndex(cue => cue.id === currentId)) + 1) % cues.length]?.id ?? 'start'
}

const sessionFallback = new Map<number, CompanionSession>()
export function readCompanionSession(userId: number): CompanionSession {
  try { return sessionFallback.get(userId) ?? parseCompanionSession(sessionStorage.getItem(`og:companion:v1:${userId}`)) }
  catch { return sessionFallback.get(userId) ?? parseCompanionSession(null) }
}
export function saveCompanionSession(userId: number, value: CompanionSession) {
  sessionFallback.set(userId, value)
  try { sessionStorage.setItem(`og:companion:v1:${userId}`, JSON.stringify(value)) } catch { /* Private mode still keeps this page's choice. */ }
}
