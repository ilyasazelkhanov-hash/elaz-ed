import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useDocumentVisible, useElementVisible, usePrefersReducedMotion } from '../../../lib/visibility'
import type { CompanionPreferences } from '../../../lib/home-companion'
import { currentAtlasEvent, dotsArt, framePosition } from './raster'
import { createPuppetRig, startPuppetLoop, stepPuppetRig } from './puppet-motion'
import { createPuppetPainter, PUPPET_ASSETS, tintPuppetPixels } from './puppet-renderer'

type Driver = { tick(dt: number): void; still(): void; resume(): void; dispose(): void }
/** A continuous articulated plush. The original remains underneath if Canvas2D/images fail. */
export function DotsCharacter({ look, mood, active, motion, reaction = 0, lantern = false, gaze }: {
  look: CompanionPreferences; mood: string; active: boolean; motion: boolean; reaction?: number; lantern?: boolean; gaze?: RefObject<{ x: number; y: number }>
}) {
  const host = useRef<HTMLSpanElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const visible = useElementVisible(host), documentVisible = useDocumentVisible(), reduce = usePrefersReducedMotion()
  const activeNow = active && visible && documentVisible, moving = activeNow && motion && !reduce
  const latest = useRef({ look, mood, reaction, lantern, gaze }); latest.current = { look, mood, reaction, lantern, gaze }
  const [ready, setReady] = useState(false), [failedPoster, setFailedPoster] = useState(false), [contextEpoch, setContextEpoch] = useState(0)
  const driver = useRef<Driver | null>(null)
  const failDriver = useCallback((value: Driver | null = driver.current) => { value?.dispose(); if (driver.current === value) driver.current = null; setReady(false) }, [])
  const posterSource = dotsArt(look.shape), currentPoster = useRef(posterSource); currentPoster.current = posterSource
  // Assets and tint are prepared once per palette, not on every visibility change.
  useEffect(() => {
    setReady(false)
    let alive = true, contextLost = false, ownDriver: Driver | null = null
    const pending: HTMLImageElement[] = []
    const image = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); pending.push(img); img.decoding = 'async'
      img.onload = () => { img.onload = img.onerror = null; resolve(img) }
      img.onerror = () => { img.onload = img.onerror = null; reject(new Error('companion art unavailable')) }; img.src = url
    })
    const element = canvas.current
    if (!element) return
    let context: CanvasRenderingContext2D | null = null
    try { context = element.getContext('2d', { alpha: true }) } catch { return }
    if (!context) return
    const lost = () => { contextLost = true; if (alive) failDriver(ownDriver) }
    const restored = () => { if (alive) setContextEpoch(epoch => epoch + 1) }
    element.addEventListener('contextlost', lost); element.addEventListener('contextrestored', restored)
    void Promise.all([image(PUPPET_ASSETS.fur), image(PUPPET_ASSETS.props)]).then(([fur, props]) => {
      if (!alive || contextLost) return
      // Fixed <61k-pixel backing store, independent of device DPR. No resize-observer loop.
      const size = 224; element.width = size; element.height = Math.round(size * 1.2)
      let tinted: HTMLCanvasElement | null = null
      if (look.color !== 'violet') {
        tinted = document.createElement('canvas'); tinted.width = fur.width; tinted.height = fur.height
        const tint = tinted.getContext('2d')
        if (tint) {
          tint.drawImage(fur, 0, 0)
          const pixels = tint.getImageData(0, 0, fur.width, fur.height)
          tintPuppetPixels(pixels.data, look.color); tint.putImageData(pixels, 0, 0)
        } else tinted = null
      }
      const painter = createPuppetPainter(context, { fur, props }, size, tinted ?? undefined)
      const rig = createPuppetRig({ reaction: latest.current.reaction })
      ownDriver = {
        tick(dt) {
          const current = latest.current
          const pose = stepPuppetRig(rig, dt, { reaction: current.reaction, mood: current.mood, gaze: current.gaze?.current })
          painter.paint(pose, current.look, current.lantern)
        },
        still() {
          const current = latest.current, staticRig = createPuppetRig({ reaction: current.reaction })
          for (let i = 0; i < 35; i++) stepPuppetRig(staticRig, .04, { reaction: current.reaction, mood: current.mood })
          staticRig.pose.bodyX = staticRig.pose.bodyY = staticRig.pose.bodyRotation = 0
          staticRig.pose.bodyScaleX = staticRig.pose.bodyScaleY = 1
          painter.paint(staticRig.pose, current.look, current.lantern)
        },
        resume() { rig.reaction = latest.current.reaction; rig.reactionAge = 2 },
        dispose() { painter.dispose(); if (tinted) tinted.width = tinted.height = 0 },
      }
      ownDriver.still(); if (!alive || contextLost) { ownDriver.dispose(); return }; driver.current = ownDriver; setReady(true)
    }).catch(() => { if (alive) failDriver(ownDriver) })
    return () => {
      alive = false; for (const img of pending) img.onload = img.onerror = null
      element.removeEventListener('contextlost', lost); element.removeEventListener('contextrestored', restored)
      ownDriver?.dispose(); if (driver.current === ownDriver) driver.current = null
    }
  }, [look.color, contextEpoch, failDriver])
  useEffect(() => {
    const current = driver.current
    if (!ready || !current) return
    let stop: (() => void) | undefined, failed = false
    const safeDraw = (dt: number) => { try { current.tick(dt) } catch { failed = true; stop?.(); failDriver(current) } }
    if (moving) { current.resume(); safeDraw(0); if (!failed) stop = startPuppetLoop(safeDraw) }
    else { try { current.still() } catch { failDriver(current) } }
    return () => stop?.()
  }, [moving, ready, failDriver])
  useEffect(() => { if (ready && !moving) { try { driver.current?.still() } catch { failDriver() } } }, [ready, moving, look.shape, look.accessory, lantern, mood, failDriver])
  useEffect(() => setFailedPoster(false), [look.shape])
  return <span ref={host} className="og-dots-character" data-renderer={ready ? 'puppet-2d' : 'poster'} data-ready={ready} data-active={activeNow} data-motion={moving} data-mood={mood} data-color={look.color} data-shape={look.shape} data-accessory={look.accessory} aria-hidden="true">
    <span className="og-dots-puppet-stage">
      {!ready && (failedPoster ? <span className="og-dots-image-unavailable">✦</span> : <span className="og-dots-static-fallback"><img key={look.shape} src={posterSource} alt="" width="1536" height="1024" draggable={false} decoding="async" loading="lazy" style={framePosition(0)} onError={event => { if (currentAtlasEvent(posterSource, currentPoster.current, event.currentTarget.getAttribute('src'))) setFailedPoster(true) }}/></span>)}
      <canvas ref={canvas} className="og-dots-puppet-canvas" width="224" height="269" data-visible={ready}/>
    </span>
  </span>
}
