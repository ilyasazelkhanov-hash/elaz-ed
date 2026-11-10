import { useEffect, useRef, useState } from 'react'
import { createStoryPlayback } from './story-playback.ts'
export function useStoryPlayback(key: string, duration: number, onComplete: () => void, enabled = true) {
  const [progress, setProgress] = useState(0), [paused, setPaused] = useState(false)
  const controller = useRef<ReturnType<typeof createStoryPlayback> | null>(null)
  const latest = useRef(onComplete), explicitPause = useRef(paused)
  latest.current = onComplete
  explicitPause.current = paused
  useEffect(() => {
    if (!enabled) return
    const timer = createStoryPlayback({ duration, onProgress: setProgress, onComplete: () => latest.current(), visibility: document,
      now: () => performance.now(), request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id) })
    controller.current = timer
    timer.setPaused(explicitPause.current)
    return () => { timer.dispose(); controller.current = null }
  }, [key, duration, enabled])
  useEffect(() => { controller.current?.setPaused(paused) }, [paused])
  return { progress, paused, setPaused, setHolding: (value: boolean) => controller.current?.setHolding(value), restart: () => controller.current?.restart() }
}
