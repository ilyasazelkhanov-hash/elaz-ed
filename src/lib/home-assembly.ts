export const HOME_ASSEMBLY_DURATION = 3600

/** Finite decorative lifetime. Every exit releases every listener and timer. */
export function startAssemblyLifetime({ root, page, viewport, motion, onStop, schedule, cancel }: {
  root: EventTarget
  page: EventTarget & { readonly hidden: boolean }
  viewport: EventTarget
  motion: EventTarget
  onStop: () => void
  schedule: (callback: () => void, delay: number) => number
  cancel: (timer: number) => void
}) {
  let disposed = false
  let timer: number | undefined
  const listeners: [EventTarget, string, EventListener][] = []
  const dispose = () => {
    if (disposed) return
    disposed = true
    if (timer !== undefined) cancel(timer)
    listeners.forEach(([target, event, listener]) => target.removeEventListener(event, listener))
  }
  const stop = () => {
    if (disposed) return
    dispose()
    onStop()
  }
  const listen = (target: EventTarget, event: string, listener: EventListener = stop) => {
    target.addEventListener(event, listener, { passive: true })
    listeners.push([target, event, listener])
  }
  listen(root, 'scroll')
  listen(root, 'pointerdown')
  listen(page, 'keydown')
  listen(page, 'visibilitychange', () => { if (page.hidden) stop() })
  listen(viewport, 'resize')
  listen(motion, 'change')
  timer = schedule(stop, HOME_ASSEMBLY_DURATION)
  return dispose
}
