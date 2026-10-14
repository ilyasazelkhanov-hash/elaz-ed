import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { haptic } from '../../lib/tg'

type Kind = 'gift' | 'star' | 'bomb'

interface Item {
  x: number
  y: number
  speed: number
  kind: Kind
}

const GLYPH: Record<Kind, string> = { gift: '🎁', star: '⭐', bomb: '🧨' }
const POINTS: Record<Kind, number> = { gift: 1, star: 3, bomb: -3 }
const BASKET = 68

/**
 * «Поймай подарки»: корзина ездит за пальцем, подарки падают всё быстрее.
 * 🎁 +1, ⭐ +3, 🧨 −3. Счёт уходит на сервер, а там упирается в потолок двери — накрутка ничего не даёт.
 * Цикл на requestAnimationFrame, без setState на каждый кадр: React обновляет только счёт и таймер.
 */
export function Arcade({ seconds, onEnd }: { seconds: number; onEnd: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { width: W, height: H } = cv.getBoundingClientRect()
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const items: Item[] = []
    const floats: { x: number; y: number; text: string; life: number }[] = []
    let basket = W / 2
    let points = 0
    let spawnIn = 0
    let shownLeft = seconds
    const duration = seconds * 1000
    const t0 = performance.now()
    let last = t0
    let raf = 0

    const follow = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      basket = Math.min(W - BASKET / 2, Math.max(BASKET / 2, e.clientX - r.left))
    }
    cv.addEventListener('pointerdown', follow)
    cv.addEventListener('pointermove', follow)

    const tick = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      const elapsed = now - t0
      const k = Math.min(1, elapsed / duration)

      // Чем ближе конец, тем чаще и быстрее падает, и тем больше петард.
      spawnIn -= dt
      if (spawnIn <= 0) {
        spawnIn = 640 - 360 * k
        const roll = Math.random()
        const kind: Kind = roll < 0.16 + 0.12 * k ? 'bomb' : roll > 0.92 ? 'star' : 'gift'
        items.push({ x: 22 + Math.random() * (W - 44), y: -24, speed: (0.13 + 0.2 * k) * (0.85 + Math.random() * 0.3), kind })
      }

      ctx.clearRect(0, 0, W, H)
      ctx.font = '30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        it.y += it.speed * dt
        const caught = it.y > H - 62 && it.y < H - 18 && Math.abs(it.x - basket) < BASKET / 2 + 6
        if (caught) {
          points = Math.max(0, points + POINTS[it.kind])
          floats.push({ x: it.x, y: H - 70, text: POINTS[it.kind] > 0 ? `+${POINTS[it.kind]}` : `${POINTS[it.kind]}`, life: 1 })
          if (it.kind === 'bomb') {
            haptic.error()
            sfx.bad()
          } else {
            haptic.tap()
            sfx.pop()
          }
          setScore(points)
          items.splice(i, 1)
          continue
        }
        if (it.y > H + 30) {
          items.splice(i, 1)
          continue
        }
        ctx.fillText(GLYPH[it.kind], it.x, it.y)
      }

      ctx.font = '700 16px Unbounded Variable, system-ui, sans-serif'
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]
        f.life -= dt / 700
        f.y -= dt * 0.05
        if (f.life <= 0) {
          floats.splice(i, 1)
          continue
        }
        ctx.globalAlpha = f.life
        ctx.fillStyle = f.text.startsWith('+') ? '#7bebc0' : '#ff7a90'
        ctx.fillText(f.text, f.x, f.y)
        ctx.globalAlpha = 1
      }

      ctx.font = '46px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      ctx.fillText('🧺', basket, H - 34)

      const remain = Math.ceil(Math.max(0, duration - elapsed) / 1000)
      if (remain !== shownLeft) {
        shownLeft = remain
        setLeft(remain)
      }
      if (elapsed >= duration) {
        sfx.win()
        finish.current(points)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      cv.removeEventListener('pointerdown', follow)
      cv.removeEventListener('pointermove', follow)
    }
  }, [seconds])

  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-card">
      <div className="flex items-center justify-between px-4 py-3 font-display text-[15px] font-semibold">
        <span>Счёт: {score}</span>
        <span className={left <= 5 ? 'text-rose' : 'text-mute'}>{left} с</span>
      </div>
      <canvas ref={canvas} className="block h-[380px] w-full" style={{ touchAction: 'none', background: 'linear-gradient(to bottom, transparent, rgb(124 107 255 / 0.12))' }} />
      <p className="px-4 py-2.5 text-center text-[12.5px] text-faint">Веди корзину пальцем · 🎁 +1 · ⭐ +3 · 🧨 −3</p>
    </div>
  )
}
