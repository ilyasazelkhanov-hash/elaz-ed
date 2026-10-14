import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { haptic } from '../../lib/tg'
import { useStore } from '../../store'

type Kind = 'good' | 'rare' | 'bad' | 'time'

interface Item {
  x: number
  y: number
  speed: number
  kind: Kind
  spin: number
  wobble: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

// Предметы под тему календаря: на Хэллоуин ловим конфеты и тыквы, на Новый год — подарки и звёзды.
const SKINS = {
  standard: { good: '💎', rare: '⭐', bad: '💣', time: '⏱️', catcher: '🧺', spark: '#a58bff' },
  halloween: { good: '🍬', rare: '🎃', bad: '💀', time: '⏳', catcher: '🧺', spark: '#ff8a1f' },
  newyear: { good: '🎁', rare: '⭐', bad: '🧨', time: '⏱️', catcher: '🛷', spark: '#ffd166' },
} as const

const POINTS: Record<Kind, number> = { good: 1, rare: 3, bad: -3, time: 0 }
const CATCHER = 74
const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/** Множитель серии: 5 поимок подряд — ×2, 12 — ×3. Петарда или пропущенный подарок сбрасывают серию. */
const multiplier = (combo: number) => (combo >= 12 ? 3 : combo >= 5 ? 2 : 1)

/**
 * Аркада: корзина плавно едет за пальцем, предметы падают всё быстрее.
 * Обратный отсчёт перед стартом, серия с множителем, редкие часы добавляют время, пауза при сворачивании.
 * Счёт уходит на сервер и там упирается в потолок двери — накрутка ничего не даёт.
 * Цикл на requestAnimationFrame, без setState на каждый кадр: React обновляет только счёт, таймер и серию.
 */
export function Arcade({ seconds, onEnd }: { seconds: number; onEnd: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const finish = useRef(onEnd)
  finish.current = onEnd
  const theme = useStore((s) => s.advent?.theme ?? 'standard')
  const skin = SKINS[theme] ?? SKINS.standard
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(seconds)
  const [combo, setCombo] = useState(0)
  const [count, setCount] = useState(3)

  // Обратный отсчёт: палец успевает лечь на экран до первых подарков.
  useEffect(() => {
    if (count <= 0) return
    haptic.select()
    sfx.pop()
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [count])

  useEffect(() => {
    if (count > 0) return
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    haptic.heavy()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { width: W, height: H } = cv.getBoundingClientRect()
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const items: Item[] = []
    const sparks: Spark[] = []
    const floats: { x: number; y: number; text: string; life: number; color: string }[] = []
    let target = W / 2
    let basket = W / 2
    let tilt = 0
    let bounce = 0
    let flash = 0
    let points = 0
    let streak = 0
    let spawnIn = 0
    let shownLeft = seconds
    let duration = seconds * 1000
    let elapsed = 0
    let last = performance.now()
    let raf = 0
    let paused = false

    const follow = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      target = Math.min(W - CATCHER / 2, Math.max(CATCHER / 2, e.clientX - r.left))
    }
    cv.addEventListener('pointerdown', follow)
    cv.addEventListener('pointermove', follow)

    // Свернул приложение — время стоит, а не утекает.
    const onVisibility = () => {
      paused = document.visibilityState === 'hidden'
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const burstAt = (x: number, y: number, color: string, n = 10) => {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.5
        const v = 0.08 + Math.random() * 0.12
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.06, life: 1, color })
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (paused) return
      const dt = Math.min(48, now - last)
      last = now
      elapsed += dt
      const k = Math.min(1, elapsed / duration)

      // Чем ближе конец, тем чаще и быстрее падает и тем больше опасного.
      spawnIn -= dt
      if (spawnIn <= 0) {
        spawnIn = 620 - 360 * k
        const roll = Math.random()
        const kind: Kind = roll < 0.15 + 0.12 * k ? 'bad' : roll > 0.985 ? 'time' : roll > 0.9 ? 'rare' : 'good'
        items.push({ x: 24 + Math.random() * (W - 48), y: -26, speed: (0.13 + 0.21 * k) * (0.85 + Math.random() * 0.3), kind, spin: (Math.random() - 0.5) * 0.004, wobble: Math.random() * Math.PI * 2 })
      }

      // Корзина догоняет палец плавно и чуть наклоняется по ходу движения.
      const dx = target - basket
      basket += dx * Math.min(1, dt / 70)
      tilt = Math.max(-0.35, Math.min(0.35, dx / 160))
      bounce = Math.max(0, bounce - dt / 180)
      flash = Math.max(0, flash - dt / 300)

      ctx.clearRect(0, 0, W, H)
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 80, 100, ${flash * 0.25})`
        ctx.fillRect(0, 0, W, H)
      }

      ctx.font = `32px ${EMOJI_FONT}`
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]
        it.y += it.speed * dt
        it.wobble += dt * 0.004
        const x = it.x + Math.sin(it.wobble) * 4
        const caught = it.y > H - 72 && it.y < H - 16 && Math.abs(x - basket) < CATCHER / 2 + 8
        if (caught) {
          items.splice(i, 1)
          if (it.kind === 'bad') {
            points = Math.max(0, points - 3)
            streak = 0
            flash = 1
            haptic.error()
            sfx.bad()
            floats.push({ x, y: H - 80, text: '−3', life: 1, color: '#ff7a90' })
            burstAt(x, H - 50, '#ff7a90', 8)
          } else if (it.kind === 'time') {
            duration += 3000
            haptic.success()
            sfx.coin()
            floats.push({ x, y: H - 80, text: '+3 с', life: 1, color: '#86cfff' })
            burstAt(x, H - 50, '#86cfff', 12)
          } else {
            streak++
            const gain = POINTS[it.kind] * multiplier(streak)
            points += gain
            bounce = 1
            const milestone = streak === 5 || streak === 12
            if (milestone) {
              haptic.success()
              sfx.coin()
            } else {
              haptic.tap()
              sfx.pop()
            }
            floats.push({ x, y: H - 80, text: `+${gain}`, life: 1, color: it.kind === 'rare' ? '#ffcf6b' : '#7bebc0' })
            burstAt(x, H - 50, it.kind === 'rare' ? '#ffcf6b' : skin.spark, it.kind === 'rare' ? 14 : 8)
          }
          setScore(points)
          setCombo(streak)
          continue
        }
        if (it.y > H + 30) {
          items.splice(i, 1)
          // Пропустил хорошее — серия сгорает; бомбу пропускать как раз правильно.
          if (it.kind === 'good' || it.kind === 'rare') {
            streak = 0
            setCombo(0)
          }
          continue
        }
        ctx.save()
        ctx.translate(x, it.y)
        ctx.rotate(Math.sin(it.wobble) * 0.25)
        if (it.kind === 'rare' || it.kind === 'time') {
          ctx.shadowColor = it.kind === 'rare' ? '#ffcf6b' : '#86cfff'
          ctx.shadowBlur = 16
        }
        ctx.fillText(skin[it.kind], 0, 0)
        ctx.restore()
      }

      // Искры
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.life -= dt / 520
        if (p.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 0.0004 * dt
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5 * p.life + 1, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.font = `700 17px Unbounded Variable, system-ui, sans-serif`
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]
        f.life -= dt / 750
        f.y -= dt * 0.05
        if (f.life <= 0) {
          floats.splice(i, 1)
          continue
        }
        ctx.globalAlpha = f.life
        ctx.fillStyle = f.color
        ctx.fillText(f.text, f.x, f.y)
      }
      ctx.globalAlpha = 1

      // Корзина: подпрыгивает при поимке, наклоняется на ходу
      ctx.save()
      ctx.translate(basket, H - 36 - bounce * 6)
      ctx.rotate(tilt)
      ctx.scale(1 + bounce * 0.12, 1 - bounce * 0.08)
      ctx.font = `50px ${EMOJI_FONT}`
      ctx.fillText(skin.catcher, 0, 0)
      ctx.restore()

      const remain = Math.ceil(Math.max(0, duration - elapsed) / 1000)
      if (remain !== shownLeft) {
        shownLeft = remain
        setLeft(remain)
        if (remain <= 3 && remain > 0) haptic.select()
      }
      if (elapsed >= duration) {
        cancelAnimationFrame(raf)
        sfx.win()
        haptic.success()
        finish.current(points)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      cv.removeEventListener('pointerdown', follow)
      cv.removeEventListener('pointermove', follow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // Тема и длительность не меняются посреди раунда.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count === 0])

  const mult = multiplier(combo)
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-line bg-card">
      <div className="flex items-center justify-between px-4 py-3 font-display text-[15px] font-semibold">
        <span className="tabular">Счёт: {score}</span>
        {mult > 1 ? (
          <span key={mult} className="tabular rounded-full px-2.5 py-0.5 text-[13px] text-white" style={{ background: 'var(--aurora)' }}>
            ×{mult} · серия {combo}
          </span>
        ) : (
          combo > 0 && <span className="tabular text-[13px] text-mute">серия {combo}</span>
        )}
        <span className={`tabular ${left <= 5 ? 'text-rose' : 'text-mute'}`}>{left} с</span>
      </div>
      <div className="relative">
        <canvas ref={canvas} className="block h-[400px] w-full" style={{ touchAction: 'none', background: 'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-violet) 14%, transparent))' }} />
        {count > 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span key={count} className="font-display text-[86px] font-bold text-ink" style={{ animation: 'bump 0.6s ease-out' }}>
              {count}
            </span>
          </div>
        )}
      </div>
      <p className="px-4 py-2.5 text-center text-[12.5px] leading-snug text-faint">
        Веди {skin.catcher} пальцем · {skin.good} +1 · {skin.rare} +3 · {skin.bad} −3 · {skin.time} +3 с
        <br />5 подряд — ×2, 12 подряд — ×3. Пропущенный {skin.good} сбрасывает серию.
      </p>
    </div>
  )
}
