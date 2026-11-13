import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MainNav } from './MainNav'
import { bindNavigationScroll } from './lib/navigation-scroll'
import type { Tab } from './store'

/** One dock belongs to the active screen and its existing keyboard focus scope. */
export function NavigationFrame({ active, routeKey, currentTab, overlay = false, children }: {
  active: boolean; routeKey: string; currentTab: Tab; overlay?: boolean; children: ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null), dock = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)
  const [height, setHeight] = useState<number>()
  useEffect(() => {
    setHidden(false)
    if (active && frame.current) return bindNavigationScroll(frame.current, setHidden)
  }, [active, routeKey])
  useEffect(() => {
    if (!active || !dock.current || typeof ResizeObserver === 'undefined') return
    const node = dock.current
    const measure = () => setHeight(node.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [active])
  return <div ref={frame} className="navigation-frame" data-navigation-hidden={hidden} style={height ? { '--navigation-height': `${height}px` } as CSSProperties : undefined}>
    <div className="navigation-content">{children}</div>
    {active && <div ref={dock} className="navigation-dock" onFocusCapture={() => setHidden(false)}>
      <MainNav currentTab={currentTab} overlay={overlay} scope={frame} />
    </div>}
  </div>
}
