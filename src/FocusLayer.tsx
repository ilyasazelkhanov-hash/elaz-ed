import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'

const controls = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"], video[controls]'

/** One focus scope for the top screen, including loading and exiting screens. */
export function FocusLayer({ active, label, children, onClose, className = 'absolute inset-0 z-30' }: {
  active: boolean; label: string; children: ReactNode; onClose?: () => void; className?: string
}) {
  const node = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const restored = useRef(false)
  const present = useIsPresent()
  const enabled = active && present
  const restore = () => {
    if (restored.current) return
    restored.current = true
    const previous = opener.current
    requestAnimationFrame(() => {
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    })
  }
  useLayoutEffect(() => {
    restored.current = false
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return restore
  }, [])
  // Exit animations may keep the old screen mounted after it stops owning focus.
  useLayoutEffect(() => { if (!present) restore() }, [present])
  useLayoutEffect(() => {
    const root = node.current
    if (!root || !enabled) return
    const available = () => [...root.querySelectorAll<HTMLElement>(controls)].filter(el =>
      el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length > 0)
    const focus = () => (available()[0] ?? root).focus({ preventScroll: true })
    if (!root.contains(document.activeElement)) focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) { event.preventDefault(); event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = available(), index = items.indexOf(document.activeElement as HTMLElement)
      if (!items.length || index < 0 || (!event.shiftKey && index === items.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault()
        ;(event.shiftKey ? items.at(-1) ?? root : items[0] ?? root).focus({ preventScroll: true })
      }
    }
    const focusin = (event: FocusEvent) => { if (!root.contains(event.target as Node)) focus() }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
    }
  }, [enabled, onClose])
  return <motion.div ref={node} className={className} data-focus-layer role="dialog" aria-modal={enabled || undefined} aria-label={label} tabIndex={-1} inert={!enabled} initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
    <AnimatePresence>{children}</AnimatePresence>
  </motion.div>
}
