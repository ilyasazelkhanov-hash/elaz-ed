import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  Gift,
  NotebookPen,
  Orbit,
  Palette,
  ShoppingBag,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react'
import QRCode from 'qrcode'
import { createPortal } from 'react-dom'
import { usePlatform } from '../platform/store.ts'
import { useBrand } from '../platform/brand-context.ts'
const Sculpture = lazy(() => import('./Sculpture.tsx'))
export function Button({
  children,
  className = '',
  tone = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'dark' | 'soft' | 'lime' | 'ghost' }) {
  return (
    <button {...props} className={`az-button az-button-${tone} ${className}`}>
      {children}
    </button>
  )
}
export function IconButton({
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  badge?: number
}) {
  return (
    <button className="az-icon-button" aria-label={label} onClick={onClick}>
      <Icon size={20} />
      {!!badge && <span className="az-badge">{badge}</span>}
    </button>
  )
}
export function Art({ kind = 'orbit', className = '' }: { kind?: string; className?: string }) {
  const Icon =
    (
      {
        cup: Coffee,
        bag: ShoppingBag,
        notebook: NotebookPen,
        ticket: Ticket,
        flower: CalendarDays,
        gift: Gift,
        peach: Camera,
        lime: Compass,
        lilac: Palette,
      } as Record<string, LucideIcon>
    )[kind] ?? Orbit
  return (
    <div className={`az-art az-art-${kind} ${className}`} aria-hidden="true">
      <Icon className="az-cover-icon" strokeWidth={1.4} />
    </div>
  )
}
export function Scene({ variant = 'orbit' }: { variant?: string }) {
  const brand = useBrand()
  const el = useRef<HTMLDivElement>(null)
  const [colors, setColors] = useState({ color: '#245BFF', accent: '#C5F277' })
  useEffect(() => {
    if (el.current) {
      const css = getComputedStyle(el.current)
      setColors({
        color: css.getPropertyValue('--az-primary').trim(),
        accent: css.getPropertyValue('--az-accent').trim(),
      })
    }
  }, [brand])
  return (
    <div className="az-scene" ref={el}>
      <Suspense fallback={<Art kind="orbit" />}>
        {brand.illustration === 'flat' ? (
          <Art kind="orbit" />
        ) : (
          <Sculpture {...colors} variant={variant} reduced={brand.motion === 'reduced'} />
        )}
      </Suspense>
    </div>
  )
}
export function SectionTitle({
  eyebrow,
  title,
  action,
  onClick,
}: {
  eyebrow?: string
  title: string
  action?: string
  onClick?: () => void
}) {
  return (
    <div className="az-section-title">
      <div>
        {eyebrow && <span className="az-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button onClick={onClick} className="az-text-link">
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  )
}
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const back = usePlatform((s) => s.back)
  return (
    <div className="az-page-heading">
      <button className="az-back" onClick={back} aria-label="Назад">
        <ChevronLeft size={23} />
      </button>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
export function Empty({ title, body, icon: Icon = ArrowDownLeft }: { title: string; body: string; icon?: LucideIcon }) {
  return (
    <div className="az-empty">
      <Icon size={34} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}
export function Pill({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button className={`az-pill ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
export function QR({ value }: { value: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current)
      void QRCode.toCanvas(canvas.current, value, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0B1020', light: '#ffffff' },
      })
  }, [value])
  return <canvas ref={canvas} aria-label={`QR-код ${value}`} role="img" />
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const all = ref.current?.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href]')
        if (!all?.length) return
        const first = all[0],
          last = all[all.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      original?.focus()
    }
  }, [onClose])
  return createPortal(
    <div className="az-modal-backdrop" onClick={onClose}>
      <motion.div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="az-modal"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="az-modal-title">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.querySelector('.az-app') ?? document.body,
  )
}
export function Toast() {
  const toast = usePlatform((s) => s.toast)
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          role="status"
          className="az-toast"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Check size={17} />
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
export function Celebration() {
  const brand = useBrand()
  const text = usePlatform((s) => s.celebration),
    celebrate = usePlatform((s) => s.celebrate)
  useEffect(() => {
    if (!text) return
    let active = true
    void import('canvas-confetti').then(({ default: confetti }) => {
      if (active && brand.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        void confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.65 },
          colors: [
            brand.colors.primary,
            brand.colors.accent,
            brand.colors.surface,
            brand.colors.lilac ?? brand.colors.primary,
          ],
        })
    })
    return () => {
      active = false
    }
  }, [text, brand])
  return (
    <AnimatePresence>
      {text && (
        <Modal title="Готово" onClose={() => celebrate('')}>
          <div className="az-celebration">
            <Scene variant="gift" />
            <h2>{text}</h2>
            <p>Результат сохранён.</p>
            <Button onClick={() => celebrate('')}>
              Продолжить <Check size={18} />
            </Button>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )
}
export const money = (amount: number, currency = 'KZT') =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
export function ArrowLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="az-list-link">
      {children}
      <ChevronRight size={18} />
    </button>
  )
}
export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  return (
    <div className="az-meter-wrap">
      {label && <span>{label}</span>}
      <div className="az-meter">
        <motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  )
}
export type StyleVars = CSSProperties & Record<`--${string}`, string | number>
