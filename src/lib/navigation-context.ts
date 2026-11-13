import type { Card } from './types'
import type { Overlay, Tab } from '../store'

export function navigationTab(tab: Tab, overlay?: Overlay, feed: Card[] = []): Tab {
  if (!overlay) return tab
  if (overlay.type === 'lesson') return overlay.post || feed.some(card => card.id === overlay.id && card.kind === 'lesson' && card.course_id == null) ? 'blog' : 'courses'
  if (['learning', 'academy', 'course', 'certifications'].includes(overlay.type)) return 'courses'
  if (overlay.type === 'stories') return 'blog'
  return 'profile'
}

export function mayDiscardEditor(stack: Overlay[]) {
  return stack.some(overlay => overlay.type === 'editor' || overlay.type === 'course-editor' || overlay.type === 'advent-admin' ||
    (overlay.type === 'learning' || overlay.type === 'academy') && /(?:^|\/)admin(?:\/|$)/.test(overlay.path ?? ''))
}
