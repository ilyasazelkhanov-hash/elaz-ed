import { useEffect, useRef, useState, type RefObject } from 'react'
import { useElementVisible } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import type { DotsScene, DotsSceneState } from './renderer'
import { DotsPoster } from './DotsPoster'

/** The native button/CTA never depends on this optional renderer. SVG is a complete fallback. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, gaze, lantern = false }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gaze?: RefObject<{ x: number; y: number }>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLSpanElement>(null)
  const visible = useElementVisible(host)
  const activeNow = active && visible
  const controller = useRef<DotsScene | null>(null)
  const neutral = useRef({ x: 0, y: 0 })
  const [activated, setActivated] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const latest = useRef<DotsSceneState>({ look, mood, active: activeNow, motion, reaction, lantern, gaze: gaze?.current ?? neutral.current })
  latest.current = { look, mood, active: activeNow, motion, reaction, lantern, gaze: gaze?.current ?? neutral.current }
  useEffect(() => { if (activeNow && motion) setActivated(true) }, [activeNow, motion])
  useEffect(() => {
    if (!activated || !motion || failed) { setReady(false); return }
    let cancelled = false, scene: DotsScene | null = null
    // This chunk is not requested for reduced-motion/paused users or before first visibility.
    import('./renderer').then(({ createDotsScene }) => {
      if (cancelled || !canvas.current) return
      try {
        scene = createDotsScene(canvas.current, latest.current, () => { if (!cancelled) { setFailed(true); setReady(false) } })
        if (cancelled) { scene.dispose(); return }
        controller.current = scene; setReady(true)
      } catch { if (!cancelled) { setFailed(true); setReady(false) } }
    }).catch(() => { if (!cancelled) { setFailed(true); setReady(false) } })
    return () => { cancelled = true; controller.current = null; scene?.dispose() }
  }, [activated, motion, failed])
  useEffect(() => {
    try { controller.current?.update(latest.current) } catch { setFailed(true); setReady(false) }
  }, [look, mood, activeNow, motion, reaction, lantern])
  return <span ref={host} className="og-dots-character" data-renderer={ready && motion ? 'webgl' : 'poster'} data-active={activeNow} data-motion={motion} data-color={look.color} data-shape={look.shape} data-accessory={look.accessory} aria-hidden="true">
    <span className="og-dots-poster"><DotsPoster look={look} mood={mood} lantern={lantern}/></span>
    <canvas ref={canvas} className="og-dots-canvas" aria-hidden="true"/>
  </span>
}
