import confetti from 'canvas-confetti'
import { AnimatePresence, animate, motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { emojiCode, NOTO } from './lib/emoji'
import { GRADIENTS } from './lib/game'
import { haptic } from './lib/tg'
import type { GradientName } from './lib/types'
import { useStore } from './store'

// ---------- Эмодзи ----------

/**
 * Единые эмодзи на всех платформах: статичный SVG сразу, анимация догружается поверх.
 * Если картинки нет или сеть её не отдала — показываем системный эмодзи.
 */
export function Emoji({ char, size = 24, animated = false, className = '' }: { char: string; size?: number; animated?: boolean; className?: string }) {
  const [stage, setStage] = useState(0)
  const [moving, setMoving] = useState(false)
  const code = emojiCode(char, stage === 0)

  useEffect(() => {
    setStage(0)
    setMoving(false)
  }, [char])

  useEffect(() => {
    if (!animated || stage > 1) return
    let alive = true
    const img = new Image()
    img.onload = () => alive && setMoving(true)
    img.src = `${NOTO}/${code}/512.webp`
    return () => {
      alive = false
    }
  }, [animated, code, stage])

  if (stage > 1) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} style={{ width: size, height: size, fontSize: size * 0.84 }}>
        {char}
      </span>
    )
  }
  return (
    <img
      src={`${NOTO}/${code}/${moving ? '512.webp' : 'emoji.svg'}`}
      width={size}
      height={size}
      alt={char}
      draggable={false}
      className={`pointer-events-none shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      onError={() => (moving ? setMoving(false) : setStage((s) => s + 1))}
    />
  )
}

// ---------- Кнопка с откликом ----------

type TapProps = HTMLMotionProps<'button'> & { feedback?: 'tap' | 'soft' | 'heavy' | 'select' | 'none' }

export function Tap({ feedback = 'tap', onClick, type = 'button', ...rest }: TapProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      onClick={(e) => {
        if (feedback !== 'none') haptic[feedback]()
        onClick?.(e)
      }}
      {...rest}
    />
  )
}

// ---------- Аватар ----------

const AVATAR_GRADIENTS: GradientName[] = ['aurora', 'sunset', 'ocean', 'mint', 'candy', 'lime']

export function Avatar({ name, photo, id = 0, size = 44 }: { name: string; photo?: string | null; id?: number; size?: number }) {
  const [broken, setBroken] = useState(false)
  const g = GRADIENTS[AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length]]
  if (photo && !broken) {
    return <img src={photo} alt="" width={size} height={size} draggable={false} onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-display font-semibold" style={{ width: size, height: size, background: g.css, color: g.ink, fontSize: size * 0.4 }}>
      {[...(name || '?')][0]?.toUpperCase()}
    </div>
  )
}

// ---------- Число с прокруткой ----------

export function Counter({ value, from, className }: { value: number; from?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(from ?? value)
  const first = useRef(from ?? value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [value])

  return (
    <span ref={ref} className={className}>
      {first.current}
    </span>
  )
}

// ---------- Кольцо прогресса ----------

export function Ring({ size, stroke = 5, progress, children }: { size: number; stroke?: number; progress: number; children?: ReactNode }) {
  const id = useId()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8E7BFF" />
            <stop offset="0.6" stopColor="#FF8AC9" />
            <stop offset="1" stopColor="#FFB58A" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.02, Math.min(1, progress))) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Bar({ progress, className = '' }: { progress: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-veil/10 ${className}`}>
      <motion.div
        className="shine h-full rounded-full"
        style={{ background: 'var(--aurora)' }}
        initial={{ width: '0%' }}
        animate={{ width: `${Math.max(4, Math.min(100, progress * 100))}%` }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      />
    </div>
  )
}

// ---------- Шторка ----------

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/65" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[480px] rounded-t-[32px] border-t border-line bg-card2 px-6 pt-3"
            style={{ paddingBottom: 'calc(28px + var(--bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose()
            }}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-veil/15" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- Тосты ----------

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-5" style={{ top: 'calc(var(--top) + 10px)' }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="flex max-w-full items-center gap-2 rounded-full border border-line bg-float/95 py-2.5 pl-3 pr-4 text-[14px] font-medium shadow-[var(--shadow-float)] backdrop-blur-md"
          >
            {t.emoji && <Emoji char={t.emoji} size={20} />}
            <span className="truncate">{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ---------- Конфетти ----------

const COLORS = ['#A58BFF', '#FF8AC9', '#FFB58A', '#7BEBC0', '#86CFFF', '#FFCF6B']

export function burst(el?: Element | null) {
  const r = el?.getBoundingClientRect()
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 }
  confetti({ particleCount: 44, spread: 72, startVelocity: 30, scalar: 0.8, ticks: 130, origin, colors: COLORS, zIndex: 200, disableForReducedMotion: true })
}

export function celebrate() {
  const base = { particleCount: 70, spread: 75, startVelocity: 50, ticks: 230, colors: COLORS, zIndex: 200, disableForReducedMotion: true }
  confetti({ ...base, angle: 60, origin: { x: 0, y: 0.78 } })
  confetti({ ...base, angle: 120, origin: { x: 1, y: 0.78 } })
  setTimeout(() => confetti({ ...base, particleCount: 90, spread: 120, startVelocity: 36, scalar: 1.1, origin: { x: 0.5, y: 0.42 } }), 280)
}

// ---------- Мелочи ----------

export function Spinner({ size = 22 }: { size?: number }) {
  // Цвет берётся из текста кнопки, поэтому крутилку видно и на градиенте, и на карточке.
  return (
    <div
      className="ring-spin rounded-full border-2"
      style={{ width: size, height: size, animationDuration: '0.8s', borderColor: 'color-mix(in srgb, currentColor 22%, transparent)', borderTopColor: 'currentColor' }}
    />
  )
}

/** Плитка с эмодзи на мягкой подложке цвета градиента. */
export function EmojiTile({ emoji, gradient, size = 56, radius = 18 }: { emoji: string; gradient: GradientName; size?: number; radius?: number }) {
  const g = GRADIENTS[gradient] ?? GRADIENTS.aurora
  return (
    <div className="relative grid shrink-0 place-items-center overflow-hidden" style={{ width: size, height: size, borderRadius: radius }}>
      <div className="absolute inset-0 opacity-25" style={{ background: g.css }} />
      <div className="absolute inset-0 border border-line" style={{ borderRadius: radius }} />
      <Emoji char={emoji} size={size * 0.54} className="relative" />
    </div>
  )
}
