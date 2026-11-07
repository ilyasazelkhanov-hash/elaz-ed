import { useSyncExternalStore } from 'react'

const event = 'og:blog-library', memory = new Map<string,string>()
const idsKey = (user: number) => 'og:blog:saved:' + user
const topicsKey = (user: number) => 'og:blog:topics:' + user
export function parseSavedPosts(value: string | null): number[] {
 try { const data: unknown = JSON.parse(value || '[]'); return Array.isArray(data) ? [...new Set(data.filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0))].slice(-500) : [] } catch { return [] }
}
export function parseFollowedTopics(value: string | null): string[] {
 try { const data: unknown = JSON.parse(value || '[]'); return Array.isArray(data) ? [...new Set(data.filter((topic): topic is string => typeof topic === 'string' && !!topic.trim() && topic.length <= 80).map(topic => topic.trim()))].slice(-30) : [] } catch { return [] }
}
function snapshot(key: string) {
 if (memory.has(key)) return memory.get(key)!
 try { return localStorage.getItem(key) || '[]' } catch { return '[]' }
}
function write(key: string, value: unknown) {
 const body = JSON.stringify(value)
 memory.set(key,body)
 try { localStorage.setItem(key,body) } catch { /* Session memory keeps the UI usable in private/blocked storage. */ }
 if (typeof window !== 'undefined') window.dispatchEvent(new Event(event))
}
function subscribe(listener: () => void) {
 const onStorage = (change: StorageEvent) => {
  if (!change.key) memory.clear()
  else if (change.key.startsWith('og:blog:')) memory.delete(change.key)
  else return
  listener()
 }
 window.addEventListener(event,listener)
 window.addEventListener('storage',onStorage)
 return () => {window.removeEventListener(event,listener);window.removeEventListener('storage',onStorage)}
}
export function readSavedPosts(user: number) { return parseSavedPosts(snapshot(idsKey(user))) }
export function readFollowedTopics(user: number) { return parseFollowedTopics(snapshot(topicsKey(user))) }
export function toggleSavedPost(user: number, id: number, onChange?: (saved: boolean) => void) {
 if (!Number.isSafeInteger(id) || id <= 0) return false
 const current = readSavedPosts(user), selected = !current.includes(id)
 write(idsKey(user), selected ? [...current,id].slice(-500) : current.filter(value => value !== id))
 onChange?.(selected)
 return selected
}
export function toggleFollowedTopic(user: number, topic: string) {
 const valid = parseFollowedTopics(JSON.stringify([topic]))[0]
 if (!valid) return false
 const current = readFollowedTopics(user), selected = !current.includes(valid)
 write(topicsKey(user), selected ? [...current,valid].slice(-30) : current.filter(value => value !== valid))
 return selected
}
export function useSavedPosts(user: number) {
 const value = useSyncExternalStore(subscribe, () => snapshot(idsKey(user)), () => '[]')
 return parseSavedPosts(value)
}
export function useFollowedTopics(user: number) {
 const value = useSyncExternalStore(subscribe, () => snapshot(topicsKey(user)), () => '[]')
 return parseFollowedTopics(value)
}
