import type { CompanionPreferences } from '../../../lib/home-companion'

/** Generated original artwork, not OpenAI's characters. Only the neutral cell is retained as a static fallback. */
export const DOTS_ART = {
  soft: '/companion/plush-soft-v1.webp',
  round: '/companion/plush-round-v1.webp',
  spark: '/companion/plush-spark-v1.webp',
} as const
export const dotsArt = (shape: CompanionPreferences['shape']) => DOTS_ART[shape] ?? DOTS_ART.soft
export const currentAtlasEvent = (requested: string, current: string, nodeSource: string | null) => requested !== '' && requested === current && nodeSource === requested
export function framePosition(frame: number) {
  const safe = Number.isInteger(frame) && frame >= 0 && frame <= 5 ? frame : 0
  return { left: `${-(safe % 3) * 100}%`, top: `${-Math.floor(safe / 3) * 100}%` }
}
