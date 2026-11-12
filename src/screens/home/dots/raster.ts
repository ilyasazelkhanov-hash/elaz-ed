import type { CompanionPreferences } from '../../../lib/home-companion'

/** Generated original artwork, not OpenAI's characters. All six frames share one cached atlas. */
export const DOTS_ART = {
  soft: '/companion/plush-soft-v1.webp',
  round: '/companion/plush-round-v1.webp',
  spark: '/companion/plush-spark-v1.webp',
} as const
export const dotsArt = (shape: CompanionPreferences['shape']) => DOTS_ART[shape] ?? DOTS_ART.soft
export function dotsFrame(mood: string, greeting = false): number {
  if (greeting) return 5
  if (mood === 'happy') return 2
  if (mood === 'wink') return 3
  if (mood === 'surprised') return 4
  return 0
}
export const currentAtlasEvent = (requested: string, current: string, nodeSource: string | null) => requested !== '' && requested === current && nodeSource === requested
export function framePosition(frame: number) {
  const safe = Number.isInteger(frame) && frame >= 0 && frame <= 5 ? frame : 0
  return { left: `${-(safe % 3) * 100}%`, top: `${-Math.floor(safe / 3) * 100}%` }
}
type Clock = { setTimeout(fn: () => void, ms: number): number; clearTimeout(id: number): void }
/** Two quiet frames per blink. No RAF, polling, canvas or hidden-page loop. */
export function startDotsBlink(change: (closed: boolean) => void, clock: Clock = window) {
  let cancelled = false, timer = 0
  const open = () => { if (cancelled) return; change(false); timer = clock.setTimeout(close, 6100) }
  const close = () => { if (cancelled) return; change(true); timer = clock.setTimeout(open, 135) }
  timer = clock.setTimeout(close, 4700)
  return () => { cancelled = true; clock.clearTimeout(timer) }
}
