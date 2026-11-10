// Only visible, unpaused time counts. Stop scheduling frames while suspended.
export function createStoryPlayback(options: {
  duration: number; onProgress: (value: number) => void; onComplete: () => void;
  visibility: { hidden: boolean; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void };
  now: () => number; request: (callback: () => void) => number; cancel: (id: number) => void;
}) {
  let elapsed = 0, started = options.now(), frame: number | null = null
  let paused = false, holding = false, disposed = false, completed = false
  const stop = () => {
    if (frame !== null) {
      elapsed += Math.max(0, options.now() - started)
      options.cancel(frame)
      frame = null
    }
  }
  const tick = () => {
    frame = null
    if (disposed || completed) return
    elapsed += Math.max(0, options.now() - started)
    started = options.now()
    options.onProgress(Math.min(1, elapsed / options.duration))
    if (elapsed >= options.duration) { completed = true; options.onComplete(); return }
    update()
  }
  const update = () => {
    if (disposed || completed || paused || holding || options.visibility.hidden) { stop(); return }
    if (frame === null) { started = options.now(); frame = options.request(tick) }
  }
  options.visibility.addEventListener('visibilitychange', update)
  options.onProgress(0)
  update()
  return {
    setPaused(value: boolean) { paused = value; update() },
    setHolding(value: boolean) { holding = value; update() },
    restart() { stop(); elapsed = 0; completed = false; options.onProgress(0); update() },
    dispose() { disposed = true; stop(); options.visibility.removeEventListener('visibilitychange', update) },
  }
}
