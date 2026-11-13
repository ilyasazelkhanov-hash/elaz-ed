export type NavigationScroll = { top: number; direction: number; distance: number; hidden: boolean }
export const initialNavigationScroll = (top = 0): NavigationScroll => ({ top, direction: 0, distance: 0, hidden: false })

/** Hysteresis ignores small direction changes and never hides near a short page's end. */
export function nextNavigationScroll(state: NavigationScroll, top: number, maximum: number, pinned = false): NavigationScroll {
  top = Math.max(0, Math.min(top, Math.max(0, maximum)))
  if (pinned || top < 24 || maximum < 96) return initialNavigationScroll(top)
  const delta = top - state.top, direction = Math.sign(delta)
  if (!direction) return { ...state, top }
  const distance = (direction === state.direction ? state.distance : 0) + Math.abs(delta)
  const hidden = direction < 0 && distance >= 8 ? false : direction > 0 && distance >= 32 && top > 64 && maximum - top > 96 ? true : state.hidden
  return { top, direction, distance, hidden }
}

/** Watches only the active screen's outer vertical scroller, never textareas or dialogs. */
export function bindNavigationScroll(root: HTMLElement, setHidden: (hidden: boolean) => void) {
  const eligible = (target: EventTarget | null): target is HTMLElement => {
    if (!(target instanceof HTMLElement) || !target.matches('.scroll, [data-tab-scroll], [data-navigation-scroll]') || target.closest('[inert]')) return false
    const parent = target.parentElement?.closest('.scroll, [data-tab-scroll], [data-navigation-scroll]')
    return !(parent && root.contains(parent)) && target.closest('[data-focus-layer]') === root.closest('[data-focus-layer]')
  }
  let scroller = [...root.querySelectorAll<HTMLElement>('.scroll, [data-tab-scroll], [data-navigation-scroll]')].find(eligible) ?? null
  let state = initialNavigationScroll(scroller?.scrollTop ?? 0), keyboard = false
  const reveal = () => { state = initialNavigationScroll(scroller?.scrollTop ?? 0); setHidden(false) }
  const scroll = (event: Event) => {
    const target = event.target
    if (!eligible(target)) return
    // A lazy-loaded/replaced screen has no previous sample. Never treat its
    // restored position as a downward gesture from the top of the page.
    if (scroller !== target) { scroller = target; reveal(); return }
    const active = target.ownerDocument.activeElement
    const pinned = keyboard || (active instanceof HTMLElement && root.contains(active) && (!!active.closest('input, textarea, select, [contenteditable="true"]') || !!active.closest('[data-main-nav]') && active.matches(':focus-visible')))
    state = nextNavigationScroll(state, target.scrollTop, target.scrollHeight - target.clientHeight, pinned)
    setHidden(state.hidden)
  }
  const keydown = (event: KeyboardEvent) => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) { keyboard = true; reveal() }
  }
  const pointer = () => { keyboard = false }
  const focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement && (keyboard || event.target.closest('[data-main-nav], input, textarea, select, [contenteditable="true"]'))) reveal()
  }
  root.addEventListener('scroll', scroll, true)
  root.addEventListener('keydown', keydown, true)
  root.addEventListener('pointerdown', pointer, true)
  root.addEventListener('wheel', pointer, { passive: true })
  root.addEventListener('focusin', focus)
  return () => {
    root.removeEventListener('scroll', scroll, true)
    root.removeEventListener('keydown', keydown, true)
    root.removeEventListener('pointerdown', pointer, true)
    root.removeEventListener('wheel', pointer)
    root.removeEventListener('focusin', focus)
  }
}
