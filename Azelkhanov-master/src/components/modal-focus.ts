const controls = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"], audio[controls], video[controls]'
const scopes: HTMLElement[] = []

function available(element: HTMLElement) {
  if (!element.isConnected || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  const style = getComputedStyle(element)
  return style.visibility !== 'hidden' && style.visibility !== 'collapse' && element.getClientRects().length > 0
}

/** A mounted dialog owns focus until close, not until its callback next changes. */
export function mountModalFocus(root: HTMLElement, close: () => void) {
  const ownerDocument = root.ownerDocument
  const opener = ownerDocument.activeElement instanceof HTMLElement ? ownerDocument.activeElement : null
  scopes.push(root)
  const isTop = () => scopes.at(-1) === root
  const items = () => [...root.querySelectorAll<HTMLElement>(controls)]
    .filter(element => element.tabIndex >= 0 && available(element))
    .sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity))
  const focus = (last = false) => {
    const candidates = items()
    ;(last ? candidates.at(-1) ?? root : candidates[0] ?? root).focus({ preventScroll: true })
  }
  const keydown = (event: KeyboardEvent) => {
    if (!isTop()) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const candidates = items()
    const index = candidates.indexOf(ownerDocument.activeElement as HTMLElement)
    if (index < 0 || (event.shiftKey ? index === 0 : index === candidates.length - 1)) {
      event.preventDefault()
      focus(event.shiftKey)
    }
  }
  const focusin = (event: FocusEvent) => {
    if (isTop() && !root.contains(event.target as Node)) focus()
  }
  ownerDocument.addEventListener('keydown', keydown, true)
  ownerDocument.addEventListener('focusin', focusin)
  root.focus({ preventScroll: true })
  return () => {
    const wasTop = isTop()
    scopes.splice(scopes.indexOf(root), 1)
    ownerDocument.removeEventListener('keydown', keydown, true)
    ownerDocument.removeEventListener('focusin', focusin)
    // Closing a background dialog must not steal focus from its child.
    if (wasTop && opener && available(opener)) opener.focus({ preventScroll: true })
  }
}
