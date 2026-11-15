/** Owns the lifetime of a decorative animation, including live accessibility changes. */
export function bindSculptureMotion(
  media: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  forcedReduced: boolean,
  setLoop: (callback: (() => void) | null) => void,
  animate: () => void,
  drawStatic: () => void,
) {
  let visible = true
  let disposed = false
  const sync = () => {
    if (disposed) return
    setLoop(null)
    if (forcedReduced || media.matches) drawStatic()
    else if (visible && !page.hidden) setLoop(animate)
  }
  media.addEventListener('change', sync)
  page.addEventListener('visibilitychange', sync)
  sync()
  return {
    setVisible(value: boolean) { visible = value; sync() },
    dispose() {
      disposed = true
      setLoop(null)
      media.removeEventListener('change', sync)
      page.removeEventListener('visibilitychange', sync)
    },
  }
}
