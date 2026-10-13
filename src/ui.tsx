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

// ---------- Объёмная кнопка ----------

type CtaProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'aurora' | 'inverse' | 'quiet'; busy?: boolean }

/** Главное действие экрана. Нижняя грань проседает под пальцем — см. .cta в стилях. */
export function Cta({ tone = 'aurora', busy = false, className = '', onClick, children, disabled, ...rest }: CtaProps) {
  return (
    <button
      type="button"
      className={`cta cta-${tone} ${className}`}
      disabled={disabled || busy}
      onClick={(e) => {
        haptic.heavy()
        onClick?.(e)
      }}
      {...rest}
    >
      {busy ? <Spinner size={20} /> : children}
    </button>
  )
}

// ---------- Узор обложки ----------

// У каждого градиента свой рисунок: обложки различаются не только цветом.
const PATTERNS: Record<GradientName, React.CSSProperties> = {
  aurora: { backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.26) 1.6px, transparent 2.1px)', backgroundSize: '14px 14px' },
  sunset: { backgroundImage: 'repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.16) 0 2px, transparent 2px 13px)' },
  ocean: { backgroundImage: 'repeating-radial-gradient(circle at 88% 12%, rgb(255 255 255 / 0.18) 0 2px, transparent 2px 24px)' },
  mint: {
    backgroundImage: 'linear-gradient(rgb(0 0 0 / 0.08) 1.5px, transparent 1.5px), linear-gradient(90deg, rgb(0 0 0 / 0.08) 1.5px, transparent 1.5px)',
    backgroundSize: '22px 22px',
  },
  candy: {
    backgroundImage: 'radial-gradient(rgb(0 0 0 / 0.1) 3px, transparent 3.6px), radial-gradient(rgb(0 0 0 / 0.1) 3px, transparent 3.6px)',
    backgroundSize: '26px 26px',
    backgroundPosition: '0 0, 13px 13px',
  },
  lime: { backgroundImage: 'repeating-linear-gradient(90deg, rgb(0 0 0 / 0.07) 0 10px, transparent 10px 20px)' },
}

/** Рисунок поверх градиента. Гаснет к левому краю, чтобы не спорить с текстом. */
export function Pattern({ name, full = false }: { name: GradientName; full?: boolean }) {
  const mask = full ? undefined : 'linear-gradient(to left, #000 8%, transparent 78%)'
  return <div className="pointer-events-none absolute inset-0" style={{ ...(PATTERNS[name] ?? PATTERNS.aurora), WebkitMaskImage: mask, maskImage: mask }} />
}

// ---------- Одометр ----------

const DIGITS = '0123456789'.split('')

/** Число, у которого цифры прокручиваются по одной, как на механическом счётчике. */
export function Odometer({ value, className = '' }: { value: number; className?: string }) {
  const digits = String(Math.max(0, Math.round(value))).split('')
  return (
    <span className={`tabular inline-flex overflow-hidden leading-none ${className}`} aria-label={String(value)}>
      {digits.map((d, i) => (
        // Ключ считается от младшего разряда: при росте числа старые цифры остаются на своих местах.
        <span key={digits.length - i} className="relative inline-block h-[1em]" aria-hidden>
          <span className="invisible">0</span>
          <motion.span
            className="absolute left-0 top-0 flex w-full flex-col items-center"
            initial={false}
            animate={{ y: `${-Number(d)}em` }}
            transition={{ type: 'spring', stiffness: 160, damping: 20, delay: (digits.length - i - 1) * 0.05 }}
          >
            {DIGITS.map((n) => (
              <span key={n} className="h-[1em]">
                {n}
              </span>
            ))}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

// ---------- Искры и летящие очки ----------

/** Включает искры от нажатий на кнопки. Возвращает функцию отключения. */
export function enableSparks() {
  const onDown = (e: PointerEvent) => {
    if (!(e.target instanceof Element) || !e.target.closest('button, a, [role="button"]')) return
    const spark = document.createElement('i')
    spark.className = 'spark'
    spark.style.left = `${e.clientX}px`
    spark.style.top = `${e.clientY}px`
    spark.addEventListener('animationend', () => spark.remove())
    document.body.appendChild(spark)
  }
  document.addEventListener('pointerdown', onDown, { passive: true })
  return () => document.removeEventListener('pointerdown', onDown)
}

/** Очки вылетают из кнопки и по дуге прилетают в счётчик XP в шапке. */
export function flyPoints(from: Element | null, count = 7) {
  const target = document.getElementById('xp-pill')
  if (!from || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 }
  const end = { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('i')
    const spread = { x: (Math.random() - 0.5) * 120, y: (Math.random() - 0.5) * 70 - 40 }
    dot.style.cssText = `position:fixed;left:0;top:0;z-index:250;width:10px;height:10px;margin:-5px;border-radius:50%;pointer-events:none;background:var(--aurora);box-shadow:0 0 10px 2px rgb(165 139 255 / 0.7)`
    document.body.appendChild(dot)
    const flight = dot.animate(
      [
        { transform: `translate(${start.x}px, ${start.y}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${start.x + spread.x}px, ${start.y + spread.y}px) scale(1.15)`, opacity: 1, offset: 0.28 },
        { transform: `translate(${end.x}px, ${end.y}px) scale(0.5)`, opacity: 0.9 },
      ],
      { duration: 760, delay: i * 55, easing: 'cubic-bezier(0.5, 0, 0.2, 1)', fill: 'both' },
    )
    flight.onfinish = () => {
      dot.remove()
      target.classList.remove('bump')
      void target.offsetWidth
      target.classList.add('bump')
      if (i === count - 1) haptic.soft()
    }
  }
}
