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
    // Observe the targets while the short animation is active. Text and images
    // can reflow inside Telegram after the first measurement.
    function measure() {
      const viewport = root!.getBoundingClientRect()
      setFrames(elements.map(element => {
        const rect = element.getBoundingClientRect()
        return {
          x: rect.left - viewport.left + root!.scrollLeft,
          y: rect.top - viewport.top + root!.scrollTop,
          width: rect.width,
          height: rect.height,
        }
      }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    elements.forEach(element => observer.observe(element))
    reveals.current = elements.map((element, index) => element.animate(
      [{ opacity: .72 }, { opacity: 1 }],
      { duration: 650, delay: index * 260, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' },
    ))
    const dispose = startAssemblyLifetime({
      root, page: document, viewport: window, motion,
      onStop: () => { observer.disconnect(); reveals.current.forEach(animation => animation.cancel()); setFrames([]) },
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer),
    })
    return () => { observer.disconnect(); dispose(); reveals.current.forEach(animation => animation.cancel()) }
  }, [scroller])
  if (!frames.length) return null
  return <div data-home-assembly aria-hidden="true" className="home-assembly">
    {frames.map((frame, index) => <AssemblyFrame key={index} frame={frame} index={index}/>)}
  </div>
}

function AssemblyFrame({frame, index}: {frame: Frame; index: number}) {
  // Start at the top centre so each quarter of the symmetric path ends at
  // the midpoint of a side. This also gives the label room to turn inward.
  const w = frame.width, h = frame.height
  const r = Math.min(20, w / 4, h / 4)
  const path = [
    `M ${w / 2} 1 H ${w-r-1} q ${r} 0 ${r} ${r}`,
    `V ${h-r-1} q 0 ${r} -${r} ${r}`,
    `H ${r+1} q -${r} 0 -${r} -${r}`,
    `V ${r+1} q 0 -${r} ${r} -${r} Z`,
  ].join(' ')
  const begin = `${index * .26}s`
  const duration = 2.25
  const style = {
    left:frame.x, top:frame.y, width:w, height:h,
    '--assembly-delay':begin,
    '--assembly-color':['#b6a1ff','#6ee7cf','#ffca8a'][index],
  } as CSSProperties
  return <svg className="home-assembly__frame" style={style} width={w} height={h}>
    <path d={path} pathLength="1" fill="none" stroke="currentColor" strokeDasharray="1 1" strokeDashoffset="1">
      <animate attributeName="stroke-dashoffset" from="1" to="0" dur={duration} begin={begin} fill="freeze"/>
    </path>
    <g className="home-assembly__cursor">
      <animateMotion path={path} dur={duration} begin={begin} fill="freeze"/>
      <g>
        <path d="M0 0 -15 6 -8 9 -5 16 Z" fill="currentColor" stroke="#171320" strokeLinejoin="round"/>
        <animateTransform attributeName="transform" type="scale" values="1 1;1 -1;-1 -1;-1 1;-1 1" keyTimes="0;.25;.5;.75;1" calcMode="discrete" begin={begin} dur={duration} fill="freeze"/>
      </g>
      <g>
        <rect x="-60" y="10" width="55" height="19" rx="5" fill="currentColor"/>
        <text x="-32.5" y="23" textAnchor="middle">{LABELS[index]}</text>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -39;65 -39;65 0;65 0" keyTimes="0;.25;.5;.75;1" calcMode="discrete" begin={begin} dur={duration} fill="freeze"/>
      </g>
    </g>
  </svg>
}
