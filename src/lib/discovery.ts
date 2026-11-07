import type { Card } from './types'
import { isNewsPost } from './content.ts'
import { topicForPost } from './knowledge.ts'

export type NewsFilters = { query: string; category: string; topic: string; filter: 'new' | 'unread' | 'saved' }

/** Apply the same selection on Home and in the archive, after each appended page. */
export function filterNewsPosts<T extends Card>(cards: T[], selection: NewsFilters, readIds: number[], savedIds: number[], now = Date.now()): T[] {
 const read = new Set(readIds), saved = new Set(savedIds), query = selection.query.trim().toLocaleLowerCase('ru')
 return newestPosts(cards, now).filter(post =>
  (selection.category === 'Все' || post.category === selection.category) &&
  (selection.topic === 'all' || topicForPost(post) === selection.topic) &&
  (selection.filter !== 'unread' || !read.has(post.id)) &&
  (selection.filter !== 'saved' || saved.has(post.id)) &&
  `${post.title} ${post.subtitle} ${post.category}`.toLocaleLowerCase('ru').includes(query)
 )
}

/** Actual publication order, separate from editorial promotion. Never label a future draft "new". */
export function newestPosts<T extends Card>(cards: T[], now = Date.now()): T[] {
 return cards.filter(card => isNewsPost(card) && card.published !== false && (!Number.isFinite(Date.parse(card.published_at || '')) || Date.parse(card.published_at!) <= now))
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
