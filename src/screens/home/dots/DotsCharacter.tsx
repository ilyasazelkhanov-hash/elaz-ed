import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useElementVisible } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { DOTS_ART, currentAtlasEvent, dotsArt, dotsFrame, framePosition, startDotsBlink } from './raster'

/** The same rendered plush on every device. No GPU-dependent version or geometric fallback. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, lantern = false }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gaze?: RefObject<{ x: number; y: number }>
}) {
  const host = useRef<HTMLSpanElement>(null), touch = useRef<HTMLSpanElement>(null)
  const visible = useElementVisible(host), activeNow = active && visible
  const lastReaction = useRef(reaction)
  const [greeting, setGreeting] = useState(false), [blink, setBlink] = useState(false)
  const [errors, setErrors] = useState<string[]>([]), [loaded, setLoaded] = useState('')
  const preferred = dotsArt(look.shape)
  const source = !errors.includes(preferred) ? preferred : !errors.includes(DOTS_ART.soft) ? DOTS_ART.soft : ''
  const latestSource = useRef(source); latestSource.current = source
  const ready = source !== '' && loaded === source
  const frame = dotsFrame(mood, greeting && motion && activeNow)
  const moving = activeNow && motion && ready
  const [previousFrame, setPreviousFrame] = useState(frame)
  useEffect(() => { const timer = window.setTimeout(() => setPreviousFrame(frame), 170); return () => window.clearTimeout(timer) }, [frame])
  const id = useId().replace(/:/g, '')
  useEffect(() => {
    setBlink(false)
    if (!moving || mood === 'wink' || mood === 'surprised') return
    return startDotsBlink(setBlink)
  }, [moving, mood, source])
  useEffect(() => {
    if (lastReaction.current === reaction) return
    lastReaction.current = reaction
    if (!moving) return
    setGreeting(mood === 'happy')
    const reset = window.setTimeout(() => setGreeting(false), 820)
    let animation: Animation | undefined
    try { animation = touch.current?.animate([
      { transform: 'translateY(0) scale(1)' }, { transform: 'translateY(2px) scale(1.025,.975)', offset: .18 },
      { transform: 'translateY(-4px) scale(.985,1.015)', offset: .5 }, { transform: 'translateY(0) scale(1)' },
    ], { duration: 680, easing: 'cubic-bezier(.22,.7,.22,1)' }) } catch { /* Authored expression still changes without animation support. */ }
    return () => { window.clearTimeout(reset); animation?.cancel(); setGreeting(false) }
  }, [reaction, moving, mood])
  const image = (cell: number, className: string) => <span key={`${source}:${cell}:${className}`} className={`og-dots-raster-frame ${className}`}><img key={source} src={source} alt="" width="1536" height="1024" draggable={false} decoding="async" loading="lazy" style={framePosition(cell)} onLoad={event => { if (currentAtlasEvent(source, latestSource.current, event.currentTarget.getAttribute('src'))) setLoaded(source) }} onError={event => { if (currentAtlasEvent(source, latestSource.current, event.currentTarget.getAttribute('src'))) setErrors(current => current.includes(source) ? current : [...current, source]) }}/></span>
  return <span ref={host} className="og-dots-character" data-renderer="raster" data-ready={ready} data-active={activeNow} data-motion={motion} data-mood={mood} data-color={look.color} data-shape={look.shape} data-accessory={look.accessory} aria-hidden="true">
    <span className="og-dots-raster-stage"><span className="og-dots-raster-tilt"><span className="og-dots-raster-breath"><span ref={touch} className="og-dots-raster-touch">
      {source ? <span className="og-dots-fur-tint">{moving && previousFrame !== frame && image(previousFrame, 'og-dots-raster-previous')}{image(frame, moving && previousFrame !== frame ? 'og-dots-raster-expression og-dots-raster-enter' : 'og-dots-raster-expression')}<span className="og-dots-raster-blink" data-closed={blink && moving}>{image(1, '')}</span></span> : <span className="og-dots-image-unavailable">✦</span>}
      <svg className="og-dots-props" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <defs><linearGradient id={`${id}-metal`} x1="30" y1="25" x2="65" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#78697f"/><stop offset=".4" stopColor="#332b3b"/><stop offset=".7" stopColor="#70627a"/><stop offset="1" stopColor="#282131"/></linearGradient><linearGradient id={`${id}-cream`} x1="20" y1="12" x2="78" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#fff1d3"/><stop offset="1" stopColor="#b89a7b"/></linearGradient><radialGradient id={`${id}-light`}><stop stopColor="#ffebb6" stopOpacity=".65"/><stop offset="1" stopColor="#ffeabb" stopOpacity="0"/></radialGradient></defs>
        {ready && look.accessory === 'glasses' && <g stroke={`url(#${id}-metal)`} strokeWidth="1.65"><circle cx="40" cy="35" r="8"/><circle cx="61" cy="35" r="8"/><path d="M48 34.4Q50.5 32.5 53 34.4M32 34L28 32M69 34L73 32"/></g>}
        {ready && look.accessory === 'headphones' && <g><path d="M23 47V33C23 4 77 4 77 33V47" stroke="#8c7696" strokeWidth="4"/><path d="M24 34C24 6 76 6 76 34" stroke={`url(#${id}-cream)`} strokeWidth="2.5"/><rect x="17" y="32" width="10" height="21" rx="5" fill={`url(#${id}-cream)`}/><rect x="73" y="32" width="10" height="21" rx="5" fill={`url(#${id}-cream)`}/><path d="M20 36V48M76 36V48" stroke="#fff6de" strokeWidth="1.2" opacity=".7"/></g>}
        {ready && look.accessory === 'sprout' && <g><path d="M50 17Q51 8 54 5" stroke="#5a8d69" strokeWidth="1.7"/><path d="M51 10C42 12 40 7 40 3C47 2 51 5 51 10Z" fill="#9dbb8a"/><path d="M52 8C53 1 60 1 64 2C63 8 59 11 52 8Z" fill="#749f71"/><path d="M43 5L50 10M54 8L61 4" stroke="#c2d5ac" strokeWidth=".7"/></g>}
        {ready && lantern && <g><ellipse cx="84" cy="75" rx="16" ry="20" fill={`url(#${id}-light)`}/><path d="M80 69V66a4 4 0 0 1 8 0v3" stroke="#9c7654" strokeWidth="1.5"/><rect x="77" y="68" width="14" height="19" rx="4" fill={`url(#${id}-cream)`}/><rect x="79" y="71" width="10" height="12" rx="3" fill="#ffedb9"/><path d="M84 73C80 77 82 81 84 82C87 79 86 77 84 73Z" fill="#fffce6"/><path d="M78 86H90" stroke="#97704f" strokeWidth="2" strokeLinecap="round"/></g>}
      </svg>
    </span></span></span></span>
  </span>
}
