import type { Overlay, Tab } from '../store'

export type NavigationSnapshot = { tab: Tab; stack: Overlay[] }
type NavigationStore = {
  getState(): NavigationSnapshot
  setState(state: NavigationSnapshot & { share?: null; reward?: null }): void
  subscribe(listener: (state: NavigationSnapshot, previous: NavigationSnapshot) => void): () => void
}
type Browser = Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>
const stateKey = '__ogNavigation'
const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
let sequence = 0
let activeBack: (() => boolean) | undefined
let activeReplace: ((action: () => void) => void) | undefined

function learningRoute(path = '', academy = false) {
  const root = academy ? '/academy' : '/courses'
  const value = path.replace(/^#/, '').replace(/\/+$/, '')
  return value === root || value.startsWith(`${root}/`) ? value : `${root}${value.startsWith('/') ? value : `/${value}`}`.replace(/\/$/, '')
}

/** Only public route identifiers belong in a URL, never editor drafts or user data. */
export function navigationHash(state: NavigationSnapshot): string {
  for (const overlay of [...state.stack].reverse()) {
    if (overlay.type === 'advent') return '#/advent'
    if (overlay.type === 'advent-season') return '#/ai-practice-season'
    if (overlay.type === 'learning') return `#${learningRoute(overlay.path || '/og-practice')}`
    if (overlay.type === 'academy') return `#${learningRoute(overlay.path, true)}`
    if (overlay.type === 'lesson' && overlay.post) return `#/blog/${overlay.id}`
  }
  return state.tab === 'home' ? '' : `#/${state.tab}`
}

/** A new hash replaces the visible route, including any stale reader/overlay. */
export function navigationFromHash(hash: string): NavigationSnapshot {
  const route = hash.replace(/\/+$/, '')
  if (route === '#/advent') return { tab: 'home', stack: [{ type: 'advent' }] }
  if (route === '#/ai-practice-season') return { tab: 'home', stack: [{ type: 'advent-season' }] }
  const tab = /^#\/(blog|profile|top|courses)$/.exec(route)?.[1] as Tab | undefined
  if (tab) return { tab, stack: [] }
  const post = /^#\/blog\/([1-9]\d*)$/.exec(route)
  if (post && Number.isSafeInteger(Number(post[1]))) return { tab: 'blog', stack: [{ type: 'lesson', id: Number(post[1]), post: true }] }
  if (route.startsWith('#/courses/')) return { tab: 'courses', stack: [{ type: 'learning', path: route.slice(1) }] }
  if (route === '#/academy' || route.startsWith('#/academy/')) return { tab: 'profile', stack: [{ type: 'academy', path: route.slice(1) }] }
  return { tab: 'home', stack: [] }
}

/** App/Telegram Back never leaves the app on a direct entry. */
export function backWithinApp(fallback: () => void) {
  if (!activeBack?.()) { if (activeReplace) activeReplace(fallback); else fallback() }
}

/** One writer owns browser history; screens only update navigation state. */
export function bindAppNavigation(store: NavigationStore, browser: Browser = window) {
  type Entry = { id: string; previous?: string; state: NavigationSnapshot; url: string }
  const entries = new Map<string, Entry>()
  let current: Entry | undefined
  let restoring = false
  let replacing = false
  let pendingBack = false
  let queued: NavigationSnapshot | undefined
  const snapshot = (state: NavigationSnapshot): NavigationSnapshot => ({ tab: state.tab, stack: state.stack })
  const equal = (a: NavigationSnapshot, b: NavigationSnapshot) => a.tab === b.tab && JSON.stringify(a.stack) === JSON.stringify(b.stack)
  const url = (state: NavigationSnapshot) => {
    // An explicit home hash overrides /courses or /academy entry paths on reload.
    const hash = navigationHash(state) || (/^\/(courses|academy)(?:\/|$)/.test(browser.location.pathname) ? '#/' : '')
    return `${browser.location.pathname}${browser.location.search}${hash}`
  }
  const locationUrl = () => `${browser.location.pathname}${browser.location.search}${browser.location.hash}`
  const write = (state: NavigationSnapshot, replace = false) => {
    if (!replace && current && equal(current.state, state) && current.url === locationUrl()) return
    const entry = { id: `${session}:${++sequence}`, previous: replace ? current?.previous : current?.id, state: snapshot(state), url: url(state) }
    entries.set(entry.id, entry)
    current = entry
    // Store just an opaque ID. Reload restores a public route, not stale private overlays.
    browser.history[replace ? 'replaceState' : 'pushState']({ ...browser.history.state, [stateKey]: entry.id }, '', entry.url)
  }
  const apply = (state: NavigationSnapshot) => {
    restoring = true
    store.setState({ ...state, share: null, reward: null })
    restoring = false
  }
  const goBack = () => {
    if (pendingBack) return true
    if (!current?.previous || !entries.has(current.previous)) return false
    pendingBack = true
    browser.history.back()
    return true
  }
  const restore = () => {
    const known = entries.get(browser.history.state?.[stateKey])
    if (known && known.url === locationUrl()) {
      current = known
      apply(known.state)
    } else {
      // hashchange may inherit the previous entry's state. Trust it only with its URL.
      const state = navigationFromHash(browser.location.hash)
      current = undefined
      write(state, true)
      apply(state)
    }
    pendingBack = false
    if (queued) { const next = queued; queued = undefined; write(next); apply(next) }
  }
  write(store.getState(), true)
  activeBack = goBack
  const replace = (action: () => void) => { replacing = true; try { action() } finally { replacing = false } }
  activeReplace = replace
  browser.addEventListener('popstate', restore)
  browser.addEventListener('hashchange', restore)
  const unsubscribe = store.subscribe((next, previous) => {
    if (restoring || equal(next, previous)) return
    if (replacing) { write(next, true); return }
    if (pendingBack) { queued = snapshot(next); return }
    // Resolving a legacy course is a redirect, not another user navigation.
    if (next.stack.length === previous.stack.length && previous.stack.at(-1)?.type === 'course' && next.stack.at(-1)?.type === 'learning') { write(next, true); return }
    // A dismissed overlay returns to its original entry, rather than adding a new
    // entry that Back would immediately reopen. No known parent: normalize in place.
    if (next.tab === previous.tab && next.stack.length < previous.stack.length) {
      let parent = current?.previous && entries.get(current.previous), distance = 1
      while (parent && !equal(parent.state, next)) { parent = parent.previous && entries.get(parent.previous); distance++ }
      if (parent) { pendingBack = true; browser.history.go(-distance) }
      else write(next, true)
    } else write(next)
  })
  return () => {
    unsubscribe()
    browser.removeEventListener('popstate', restore)
    browser.removeEventListener('hashchange', restore)
    if (activeBack === goBack) { activeBack = undefined; activeReplace = undefined }
  }
}
