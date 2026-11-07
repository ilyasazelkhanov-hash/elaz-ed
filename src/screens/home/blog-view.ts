import { create } from 'zustand'
import { useStore } from '../../store'

export type BlogFilter = 'new' | 'unread' | 'saved'
export const useBlogView = create<{
  filter: BlogFilter
  topic: string
  query: string
  category: string
  set: (value: Partial<{ filter: BlogFilter; topic: string; query: string; category: string }>) => void
}>((set) => ({ filter: 'new', topic: 'all', query: '', category: 'Все', set }))

/** A reading shortcut opens the same filters used by the full updates screen. */
export function openBlogLibrary(filter: BlogFilter = 'new', topic = 'all') {
  useBlogView.getState().set({ filter, topic, query: '', category: 'Все' })
  useStore.getState().setTab('blog')
}
