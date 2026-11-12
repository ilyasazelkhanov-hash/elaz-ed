/** Progressive enhancement: content is visible even without observers or JS. */
export function bindEditorialReveal(root: HTMLElement) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let observer: IntersectionObserver | undefined
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-editorial-card]'))
  function stop() {
    observer?.disconnect()
    observer = undefined
    cards.forEach(card => delete card.dataset.reveal)
  }
  function start() {
    stop()
    if (media.matches || !('IntersectionObserver' in window)) return
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const card = entry.target as HTMLElement
        // No hidden state: a missed callback can never hide navigation or content.
        if (!card.contains(document.activeElement)) card.dataset.reveal = 'enter'
        observer?.unobserve(card)
      })
    }, {threshold: 0.08})
    cards.forEach(card => observer?.observe(card))
  }
  const focus = (event: Event) => {
    const target = event.target as HTMLElement | null
    const card = target?.closest<HTMLElement>('[data-editorial-card]')
    if (card) { delete card.dataset.reveal; observer?.unobserve(card) }
  }
  start()
  media.addEventListener('change', start)
  root.addEventListener('focusin', focus)
  return () => { stop(); media.removeEventListener('change', start); root.removeEventListener('focusin', focus) }
}

/** A bounded looping illustration; CSS pauses its timeline outside the visible page. */
export function bindLearningScene(root: HTMLElement) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false
  let started = false
  let observer: IntersectionObserver | undefined
  const update = () => {
    if (media.matches) {
      root.dataset.scene = 'still'
      return
    }
    if (!started && visible && document.visibilityState === 'visible') started = true
    root.dataset.scene = started ? 'play' : 'still'
    root.dataset.paused = String(!visible || document.visibilityState !== 'visible')
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting)
      update()
    }, {threshold: 0.25})
    observer.observe(root)
  }
  update()
  media.addEventListener('change', update)
  document.addEventListener('visibilitychange', update)
  return () => {
    observer?.disconnect()
    media.removeEventListener('change', update)
    document.removeEventListener('visibilitychange', update)
    delete root.dataset.scene
    delete root.dataset.paused
  }
}
