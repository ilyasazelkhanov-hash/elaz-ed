import type { CompanionPreferences } from '../../../lib/home-companion'

/** Generated original artwork, not OpenAI's characters. The lower row is the same limbless shape with a static face, not an animation. */
export const DOTS_ART = {
  soft: '/companion/abstract-forms-v3.webp',
  round: '/companion/abstract-forms-v3.webp',
  spark: '/companion/abstract-forms-v3.webp',
} as const
export const dotsArt = (shape: CompanionPreferences['shape']) => DOTS_ART[shape] ?? DOTS_ART.soft
export const posterCell = (shape: CompanionPreferences['shape']) => shape === 'round' ? 4 : shape === 'spark' ? 5 : 3
export const currentAtlasEvent = (requested: string, current: string, nodeSource: string | null) => requested !== '' && requested === current && nodeSource === requested
export function framePosition(frame: number) {
  const safe = Number.isInteger(frame) && frame >= 0 && frame <= 5 ? frame : 0
  return { left: `${-(safe % 3) * 100}%`, top: `${-Math.floor(safe / 3) * 100}%` }
}
