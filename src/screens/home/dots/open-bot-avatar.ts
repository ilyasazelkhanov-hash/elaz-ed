import { validateAvatar, type AvatarDefinition, type AvatarMood, type AvatarState } from 'open-bot-avatar'
import type { CompanionPreferences } from '../../../lib/home-companion'
import cloud from './open-bot-avatar/cloud.json' with { type: 'json' }
import egg from './open-bot-avatar/egg.json' with { type: 'json' }
import star from './open-bot-avatar/star.json' with { type: 'json' }

// Original Open Bot Avatar gallery silhouettes, MIT (see /licenses/open-bot-avatar.txt).
const definitions = { soft: cloud, round: egg, spark: star } as const
const checked = (input: unknown): AvatarDefinition => {
  const result = validateAvatar(input)
  if (!result.ok) throw new Error('Invalid bundled Open Bot Avatar definition: ' + result.errors.join(', '))
  return result.value
}
export const dotsDefinitions = { soft: checked(definitions.soft), round: checked(definitions.round), spark: checked(definitions.spark) }
export const dotsPalette: Record<CompanionPreferences['color'], string> = { violet: '#ad8bff', mint: '#83d9b9', peach: '#ffb590', sky: '#8bcaf3' }
export const dotsEyeColor = '#291b3c'

export function dotsExpression(mood: string): { state: AvatarState; mood: AvatarMood } {
  // These are local reactions, never a claim that a bot is processing or finished a task.
  return {
    state: 'idle',
    mood: mood === 'happy' || mood === 'wink' || mood === 'surprised' ? 'happy' : 'neutral',
  }
}
export type DotsGaze = { x: number; y: number } | null

export function dotsGaze(value: DotsGaze): DotsGaze {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null
  return { x: Math.max(-1, Math.min(1, value.x)), y: Math.max(-1, Math.min(1, value.y)) }
}
