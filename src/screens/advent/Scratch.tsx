import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/tg'
import { Spinner } from '../../ui'

const BRUSH = 24
/** Сколько слоя нужно стереть, чтобы приз открылся целиком. */
const REVEAL_AT = 0.5

/**
 * Скретч-карта. Приз приходит с сервера только после открытия двери: первое касание вызывает onStart,
 * а пока ответ в пути, под слоем крутится загрузка — подсмотреть приз в коде страницы нельзя.
 */
export function Scratch({ prize, onStart, onRevealed }: { prize: string | null; onStart: () => void; onRevealed: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [revealed, setRevealed] = useState(false)
  const started = useRef(false)
  const done = useRef(false)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { width, height } = cv.getBoundingClientRect()
    cv.width = Math.round(width * dpr)
    cv.height = Math.round(height * dpr)
    ctx.scale(dpr, dpr)

    // Защитный слой: «фольга» с блёстками и подсказкой.
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, '#d9d3f5')
    g.addColorStop(0.5, '#a99ee6')
    g.addColorStop(1, '#c7bff0')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = 'rgb(255 255 255 / 0.35)'
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % width
      const y = (i * 53) % height
      ctx.fillRect(x, y, 2, 2)
    }
    ctx.fillStyle = '#2b2350'
    ctx.font = '700 18px Unbounded Variable, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('СОТРИ ПАЛЬЦЕМ', width / 2, height / 2)

    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = BRUSH * 2

    let last: { x: number; y: number } | null = null
    let moves = 0

    // Доля стёртого: смотрим альфу в сетке точек, а не каждый пиксель.
    const cleared = () => {
      const img = ctx.getImageData(0, 0, cv.width, cv.height).data
      const step = Math.round(10 * dpr)
      let total = 0
      let clear = 0
      for (let y = 0; y < cv.height; y += step) {
        for (let x = 0; x < cv.width; x += step) {
          total++
          if (img[(y * cv.width + x) * 4 + 3] < 40) clear++
        }
      }
      return clear / Math.max(1, total)
    }

    const point = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const down = (e: PointerEvent) => {
      if (done.current) return
      cv.setPointerCapture(e.pointerId)
      if (!started.current) {
        started.current = true
        onStart()
      }
      last = point(e)
      ctx.beginPath()
      ctx.arc(last.x, last.y, BRUSH, 0, Math.PI * 2)
      ctx.fill()
    }

    const move = (e: PointerEvent) => {
      if (!last || done.current) return
      const p = point(e)
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      last = p
      if (++moves % 6 === 0) haptic.select()
      if (moves % 12 === 0 && cleared() >= REVEAL_AT) {
        done.current = true
        setRevealed(true)
      }
    }

    const up = () => {
      last = null
    }

    cv.addEventListener('pointerdown', down)
    cv.addEventListener('pointermove', move)
    cv.addEventListener('pointerup', up)
    cv.addEventListener('pointercancel', up)
    return () => {
      cv.removeEventListener('pointerdown', down)
      cv.removeEventListener('pointermove', move)
      cv.removeEventListener('pointerup', up)
      cv.removeEventListener('pointercancel', up)
    }
    // Слой рисуется один раз; onStart берём из первого рендера — он только запускает открытие.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Приз открывается, когда стёрта половина слоя И сервер уже прислал текст.
  useEffect(() => {
    if (revealed && prize !== null) {
      haptic.success()
      onRevealed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, prize])

  return (
    <div className="relative h-[210px] overflow-hidden rounded-[24px] border border-line bg-card">
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        {prize === null ? <Spinner /> : <p className="selectable font-display text-[17px] font-semibold leading-snug">{prize}</p>}
      </div>
      <motion.canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full cursor-pointer"
        style={{ touchAction: 'none' }}
        animate={{ opacity: revealed && prize !== null ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      />
    </div>
  )
}
