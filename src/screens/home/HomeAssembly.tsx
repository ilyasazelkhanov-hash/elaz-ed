import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { startAssemblyLifetime } from '../../lib/home-assembly'
import './home-assembly.css'

const SESSION_KEY = 'og.home-assembly.v1'
const LABELS = ['Идея', 'Практика', 'Готово']
type Frame = { x: number; y: number; width: number; height: number }

/** Decorative choreography only. Never clones, hides or delays the real page. */
export function HomeAssembly({ scroller }: { scroller: RefObject<HTMLDivElement | null> }) {
  const [frames, setFrames] = useState<Frame[]>([])
  const claimed = useRef(false)
  const reveals = useRef<Animation[]>([])
  useEffect(() => {
    const root = scroller.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!root || motion.matches || document.hidden) return
    try {
      if (!claimed.current && sessionStorage.getItem(SESSION_KEY)) return
      claimed.current = true
      sessionStorage.setItem(SESSION_KEY, 'seen')
    } catch { /* Private browsing: animation remains bounded to this mount. */ }
    const bounds = root.getBoundingClientRect()
    const elements = Array.from(root.children).filter(element => {
      if (element.hasAttribute('data-home-assembly')) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 80 && rect.height > 24 && rect.top < bounds.top + Math.min(bounds.height, 650) && rect.bottom > bounds.top
    }).slice(0, 3)
    const targets = elements.map(element => element.getBoundingClientRect())
    reveals.current = elements.map((element, index) => element.animate(
      [{ opacity: .72, translate: '0 6px' }, { opacity: 1, translate: '0 0' }],
      { duration: 650, delay: index * 260, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' },
    ))
    setFrames(targets.map(rect => ({ x: rect.left - bounds.left + root.scrollLeft, y: rect.top - bounds.top + root.scrollTop, width: rect.width, height: Math.min(rect.height, 200) })))
    const dispose = startAssemblyLifetime({
      root, page: document, viewport: window, motion,
      onStop: () => { reveals.current.forEach(animation => animation.cancel()); setFrames([]) },
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer),
    })
    return () => { dispose(); reveals.current.forEach(animation => animation.cancel()) }
  }, [scroller])
  if (!frames.length) return null
  return <div data-home-assembly aria-hidden="true" className="home-assembly">
    <div aria-hidden="true" className="home-assembly__stage">
      {frames.map((frame, index) => <div className="home-assembly__frame" key={index} style={{ left: frame.x + 5, top: frame.y + 4, width: frame.width - 10, height: frame.height - 8, '--assembly-delay': `${index * 260}ms`, '--assembly-color': ['#b6a1ff', '#6ee7cf', '#ffca8a'][index] } as CSSProperties}>
        <span className="home-assembly__trace"/>
        <span className="home-assembly__cursor"><svg viewBox="0 0 24 28" width="19" height="23"><path d="M3 2 21 17 12 18 8 26Z" fill="currentColor" stroke="#171320" strokeWidth="1.5" strokeLinejoin="round"/></svg><span>{LABELS[index]}</span></span>
      </div>)}
    </div>

  </div>
}
