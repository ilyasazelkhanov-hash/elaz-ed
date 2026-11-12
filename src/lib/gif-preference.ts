import { useSyncExternalStore } from 'react'

const key = 'og:gif-autoplay:v1'
const listeners = new Set<() => void>()
let enabled: boolean | undefined

/** Device-wide display preference, not account data. Storage failure keeps the choice for this session. */
export function gifAutoplayEnabled(): boolean {
  if (enabled === undefined) {
    try { enabled = typeof window === 'undefined' || window.localStorage.getItem(key) !== 'off' }
    catch { enabled = true }
  }
  return enabled
}
export function setGifAutoplayEnabled(value: boolean) {
  enabled = value
  try { window.localStorage.setItem(key, value ? 'on' : 'off') } catch { /* In-memory choice remains usable. */ }
  listeners.forEach(notify => notify())
}
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return
  enabled = undefined
  listeners.forEach(notify => notify())
}
export function subscribeGifAutoplay(notify: () => void) {
  if (!listeners.size && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
    if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}
export function useGifAutoplay() {
  return useSyncExternalStore(subscribeGifAutoplay, gifAutoplayEnabled, () => false)
}
