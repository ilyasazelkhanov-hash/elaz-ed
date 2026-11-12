import type { Card } from './types'
import { readingWords } from '../../supabase/functions/_shared/reading-time.ts'
const validDay = (value: string | undefined): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
/** Offers require a recent editorial check. review_due is a recheck boundary, not a claimed merchant deadline. */
export function activeStories(cards: Card[], now = new Date()): Card[] {
 const today = now.toISOString().slice(0, 10)
 return cards.filter(card => {
  if (card.kind !== 'story' || !card.published || card.course_id != null) return false
  if (!/^(?:акции|выгода|скидки)$/i.test(card.category.trim())) return true
  const e = card.editorial
  return validDay(e?.checked_on) && e.checked_on <= today && validDay(e.review_due) && e.review_due > today && !!e.sources?.length && !e.outdated_note
 })
}
/** Longer slides get enough time to read; readers can always pause or advance manually. */
export function storySlideDuration(body: string): number {
 return Math.max(6000, Math.min(30000, Math.ceil(readingWords(body) / 3) * 1000))
}
