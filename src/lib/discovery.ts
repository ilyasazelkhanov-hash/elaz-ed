import type { Card } from './types'
import { isBlogPost } from './content.ts'

/** Actual publication order, separate from editorial promotion. Never label a future draft "new". */
export function newestPosts<T extends Card>(cards: T[], now = Date.now()): T[] {
 return cards.filter(card => isBlogPost(card) && card.published !== false && (!Number.isFinite(Date.parse(card.published_at || '')) || Date.parse(card.published_at!) <= now))
  .slice().sort((a,b) => (Date.parse(b.published_at || '') || 0) - (Date.parse(a.published_at || '') || 0) || b.id - a.id)
}
export function updateSummary(cards: Card[], readIds: number[], now = Date.now()) {
 const posts = newestPosts(cards, now), read = new Set(readIds)
 return {posts, unread: posts.filter(post => !read.has(post.id)).length, latest: posts.find(post => Number.isFinite(Date.parse(post.published_at || '')))?.published_at || null}
}
export function beginnerPicks(cards: Card[], limit = 3, now = Date.now()) {
 const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3
 const rank = (card: Card) => {
  const value = (card.title + ' ' + card.subtitle).toLowerCase()
  return (/первый|первого|начать|с нуля|нович/.test(value) ? 3 : 0) + (/прост|основ|провер|запрос|промпт/.test(value) ? 1 : 0)
 }
 return newestPosts(cards, now).sort((a,b) => rank(b)-rank(a)).slice(0,count)
}
export function postTeaser(card: Card) {
 return (card.subtitle || card.title).replace(/\s+/g, ' ').trim()
}
