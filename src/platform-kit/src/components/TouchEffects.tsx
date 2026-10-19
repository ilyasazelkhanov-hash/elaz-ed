import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '../platform/client.ts'

/** Touch-first feedback: works on phones without hover or sensor permissions. */
export default function TouchEffects() {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]),
    counter = useRef(0),
    last = useRef(0),
    reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return
    const root = document.querySelector('.az-app')
    if (!root) return
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const down = (event: Event) => {
      const e = event as PointerEvent,
        target = e.target as HTMLElement
      const button = target.closest('button')
      if (!button || button.disabled || e.pointerType === 'mouse') return
      const id = ++counter.current
      setRipples((r) => [...r.slice(-5), { id, x: e.clientX, y: e.clientY }])
      if (performance.now() - last.current > 90) {
        haptic()
        last.current = performance.now()
      }
      const timer = setTimeout(() => {
        setRipples((r) => r.filter((v) => v.id !== id))
        timers.delete(timer)
      }, 650)
      timers.add(timer)
    }
    root.addEventListener('pointerdown', down, { passive: true })
    return () => {
      root.removeEventListener('pointerdown', down)
      timers.forEach(clearTimeout)
    }
  }, [reduce])
  return (
    <div className="az-touch-layer" aria-hidden="true">
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.i
            key={r.id}
            style={{ left: r.x, top: r.y }}
            initial={{ scale: 0.1, opacity: 0.45 }}
            animate={{ scale: 2.1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
