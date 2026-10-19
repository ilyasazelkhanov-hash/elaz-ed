import { useEffect, useState } from 'react'
import { Art } from './ui.tsx'
import { useBrand } from '../platform/brand-context.ts'
export function SharedArtTransition() {
  const [item, setItem] = useState<{ kind: string; rect: DOMRect } | null>(null)
  const brand = useBrand()
  useEffect(() => {
    const handler = (event: Event) => {
      if (brand.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      setItem((event as CustomEvent).detail)
    }
    window.addEventListener('az:art-transition', handler)
    return () => window.removeEventListener('az:art-transition', handler)
  }, [brand.motion])
  useEffect(() => {
    if (!item) return
    let frame = 0
    let count = 0
    let animation: Animation | undefined
    const tick = () => {
      const target = document.querySelector('.az-detail-art')
      const overlay = document.querySelector<HTMLElement>('.az-transition-art')
      if (target && overlay) {
        const to = target.getBoundingClientRect()
        animation = overlay.animate(
          [
            {
              left: item.rect.left + 'px',
              top: item.rect.top + 'px',
              width: item.rect.width + 'px',
              height: item.rect.height + 'px',
              opacity: 1,
            },
            { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', opacity: 1 },
          ],
          { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
        )
        animation.onfinish = () => setItem(null)
      } else if (count++ < 90) frame = requestAnimationFrame(tick)
      else setItem(null)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      animation?.cancel()
    }
  }, [item])
  return item ? (
    <div
      className="az-transition-art"
      style={{ left: item.rect.left, top: item.rect.top, width: item.rect.width, height: item.rect.height }}
    >
      <Art kind={item.kind} />
    </div>
  ) : null
}
