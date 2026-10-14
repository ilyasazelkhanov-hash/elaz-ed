// Темы адвент-календаря: сцена в шапке, вид дверей и как дверь открывается.
// Тему выбирает автор в админке (settings.advent.theme), у всех участников она одна.
// Все эффекты — CSS-анимации transform/opacity: без canvas и JS-циклов, чтобы не грузить слабые телефоны.
import type { CSSProperties, ReactNode } from 'react'
import type { AdventThemeId } from '../../lib/types'

export interface AdventTheme {
  id: AdventThemeId
  label: string
  /** Иконка в переключателе тем. */
  emoji: string
  tagline: string
  /** Класс на корне экрана: перекрашивает карточки, полосы прогресса и акцент под тему. */
  className: string
  hero: string
  ink: string
  /** Подложка под плашками в шапке. */
  chip: string
  /** Как открывается дверь: створка на петлях или слетающая крышка коробки. */
  opening: 'hinge' | 'lid'
  /** Что написано на двери дня. */
  todayLabel: string
}

export const THEMES: Record<AdventThemeId, AdventTheme> = {
  standard: {
    id: 'standard',
    label: 'Стандарт',
    emoji: '✨',
    tagline: 'Фирменная аврора и мерцающие звёзды',
    className: 'advent-standard',
    hero: 'radial-gradient(120% 90% at 85% 0%, #ff8ac9 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, #5fb4ff 0%, transparent 60%), linear-gradient(135deg, #4f3df0 0%, #8b4dff 55%, #c45bd8 100%)',
    ink: '#ffffff',
    chip: 'rgb(0 0 0 / 0.18)',
    opening: 'hinge',
    todayLabel: 'Сегодня',
  },
  halloween: {
    id: 'halloween',
    label: 'Хэллоуин',
    emoji: '🎃',
    tagline: 'Луна, летучие мыши и двери склепа',
    className: 'advent-halloween',
    hero: 'radial-gradient(70% 60% at 78% 18%, #5b2a86 0%, transparent 70%), radial-gradient(120% 80% at 20% 100%, #3a0f1f 0%, transparent 70%), linear-gradient(180deg, #160a26 0%, #0d0716 100%)',
    ink: '#ffeedd',
    chip: 'rgb(255 138 31 / 0.16)',
    opening: 'hinge',
    todayLabel: 'Открой',
  },
  newyear: {
    id: 'newyear',
    label: 'Новый год',
    emoji: '🎄',
    tagline: 'Гирлянда, снег и подарки вместо дверей',
    className: 'advent-newyear',
    hero: 'radial-gradient(90% 70% at 20% 10%, #1d6b8f 0%, transparent 70%), linear-gradient(180deg, #071630 0%, #0d2d55 60%, #134a72 100%)',
    ink: '#ffffff',
    chip: 'rgb(255 255 255 / 0.14)',
    opening: 'lid',
    todayLabel: 'Сегодня',
  },
}

export const THEME_IDS = Object.keys(THEMES) as AdventThemeId[]
export const themeOf = (id: string | null | undefined) => THEMES[(id as AdventThemeId) ?? 'standard'] ?? THEMES.standard

// Стабильный «случайный» разброс по номеру: одинаковый при каждой отрисовке.
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// ---------- Сцены ----------

/** Сцена шапки. compact — для карточки на главной: меньше деталей. */
export function ThemeScene({ theme, compact = false }: { theme: AdventThemeId; compact?: boolean }) {
  if (theme === 'halloween') return <Halloween compact={compact} />
  if (theme === 'newyear') return <NewYear compact={compact} />
  return <Standard compact={compact} />
}

function Layer({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {children}
    </div>
  )
}

function Stars({ count, color = '#fff' }: { count: number; color?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = 1.5 + rnd(i, 3) * 2.5
        return (
          <span
            key={i}
            className="fx-twinkle absolute rounded-full"
            style={{ left: `${rnd(i, 1) * 100}%`, top: `${rnd(i, 2) * 70}%`, width: size, height: size, background: color, animationDelay: `${rnd(i, 4) * 4}s`, animationDuration: `${2.4 + rnd(i, 5) * 3}s` }}
          />
        )
      })}
    </>
  )
}

function Standard({ compact }: { compact: boolean }) {
  return (
    <Layer>
      <Stars count={compact ? 10 : 26} />
      {/* Мягкое сияние, медленно переливается за текстом */}
      <span className="fx-aurora absolute -left-1/4 top-[-40%] h-[140%] w-[80%] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(255 255 255 / 0.22), transparent)' }} />
      {!compact && <Sparkle className="absolute right-[12%] top-[22%]" size={22} delay={0} />}
      {!compact && <Sparkle className="absolute right-[30%] top-[48%]" size={14} delay={1.2} />}
      <Sparkle className="absolute right-[8%] bottom-[18%]" size={16} delay={0.6} />
    </Layer>
  )
}

function Sparkle({ className, size, delay }: { className: string; size: number; delay: number }) {
  return (
    <svg className={`fx-sparkle ${className}`} width={size} height={size} viewBox="0 0 24 24" style={{ animationDelay: `${delay}s` }}>
      <path d="M12 0c.6 6 1.9 9.4 12 12-10.1 2.6-11.4 6-12 12-.6-6-1.9-9.4-12-12C10.1 9.4 11.4 6 12 0z" fill="#fff" />
    </svg>
  )
}

// ---------- Хэллоуин ----------

const BAT = 'M12 9.6c-.9-1.6-2.3-2.2-3.3-1.4C8 6.5 6.3 6 4.6 7 3.7 5.6 2 4.9 0 5.4c2 .9 3 2.6 3 4.6 1.2-.9 2.8-.7 3.6.4.8-.8 2-.8 2.8 0C10 9.6 11 9.4 12 11.2c1-1.8 2-1.6 2.6-.8.8-.8 2-.8 2.8 0 .8-1.1 2.4-1.3 3.6-.4 0-2 1-3.7 3-4.6-2-.5-3.7.2-4.6 1.6-1.7-1-3.4-.5-4.1 1.2-1-.8-2.4-.2-3.3 1.4z'

function Bat({ top, delay, duration, size, reverse }: { top: string; delay: number; duration: number; size: number; reverse?: boolean }) {
  return (
    <span className={reverse ? 'fx-bat-rev absolute' : 'fx-bat absolute'} style={{ top, animationDelay: `${delay}s`, animationDuration: `${duration}s` }}>
      <svg className="fx-flap" width={size} height={size * 0.6} viewBox="0 0 24 14" style={{ animationDelay: `${delay * 0.3}s` }}>
        <path d={BAT} fill="#06030c" />
      </svg>
    </span>
  )
}

function Halloween({ compact }: { compact: boolean }) {
  return (
    <Layer>
      <Stars count={compact ? 8 : 22} color="#ffe9c9" />
      {/* Луна с кратерами и ореолом */}
      <div
        className="fx-moon absolute rounded-full"
        style={{
          right: compact ? '6%' : '8%',
          top: compact ? '-30%' : '9%',
          width: compact ? 92 : 118,
          height: compact ? 92 : 118,
          background: 'radial-gradient(circle at 35% 32%, #fffaf0 0%, #ffe7a8 45%, #f2b350 100%)',
          boxShadow: '0 0 40px 12px rgb(255 196 92 / 0.35), 0 0 120px 40px rgb(255 140 40 / 0.18)',
        }}
      >
        <span className="absolute rounded-full" style={{ left: '22%', top: '48%', width: '18%', height: '18%', background: 'rgb(214 150 60 / 0.35)' }} />
        <span className="absolute rounded-full" style={{ left: '56%', top: '24%', width: '12%', height: '12%', background: 'rgb(214 150 60 / 0.3)' }} />
        <span className="absolute rounded-full" style={{ left: '60%', top: '62%', width: '22%', height: '22%', background: 'rgb(214 150 60 / 0.25)' }} />
      </div>
      <Bat top="18%" delay={0} duration={9} size={34} />
      <Bat top="34%" delay={3.2} duration={11} size={24} reverse />
      {!compact && <Bat top="10%" delay={6} duration={13} size={18} />}
      {!compact && <Bat top="44%" delay={8.5} duration={10} size={28} reverse />}
      {/* Туман тянется слоями у земли */}
      <span className="fx-fog absolute bottom-[6%] left-[-30%] h-24 w-[90%] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(200 180 230 / 0.22), transparent)' }} />
      <span className="fx-fog-rev absolute bottom-[-4%] right-[-30%] h-28 w-[100%] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(170 150 210 / 0.2), transparent)' }} />
      {!compact && <Spider />}
      {/* Кладбище на холме */}
      <svg className="absolute bottom-0 left-0 w-full" height={compact ? 34 : 64} viewBox="0 0 400 64" preserveAspectRatio="none">
        <path
          d="M0 40 Q60 26 120 36 T240 32 T400 38 V64 H0Z M58 34 v-14 a7 7 0 0 1 14 0 v14z M96 36 v-10 h4 v-5 h4 v5 h4 v10z M300 34 v-16 a8 8 0 0 1 16 0 v16z M338 36 v-11 a6 6 0 0 1 12 0 v11z"
          fill="#07040d"
        />
        {/* Сухое дерево */}
        <path d="M196 36 C196 22 194 16 188 8 M195 22 C200 16 206 14 212 10 M191 14 C186 12 182 8 180 3 M201 18 C204 12 204 8 202 2" stroke="#07040d" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </Layer>
  )
}

function Spider() {
  return (
    <span className="fx-spider absolute left-[46%] top-0 block" style={{ transformOrigin: '50% 0' }}>
      <span className="mx-auto block h-[58px] w-px bg-white/45" />
      <svg width="22" height="18" viewBox="0 0 22 18" className="-mt-1 block">
        <g stroke="#120a1c" strokeWidth="1.4" fill="none" strokeLinecap="round">
          <path d="M8 8 L2 4 M8 10 L1 10 M8 12 L2 16 M14 8 L20 4 M14 10 L21 10 M14 12 L20 16" />
        </g>
        <ellipse cx="11" cy="10" rx="4.2" ry="5" fill="#120a1c" />
        <circle cx="9.6" cy="8.6" r="0.9" fill="#ff8a1f" />
        <circle cx="12.4" cy="8.6" r="0.9" fill="#ff8a1f" />
      </svg>
    </span>
  )
}

// ---------- Новый год ----------

const BULBS = ['#ff4d6d', '#ffd166', '#3ee08f', '#5ab8ff', '#ff9f43']

function Garland({ compact }: { compact: boolean }) {
  const n = compact ? 9 : 13
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: 40 }}>
      <svg className="absolute inset-x-0 top-0 h-full w-full" viewBox="0 0 400 40" preserveAspectRatio="none">
        <path d="M-10 6 Q50 34 100 12 T200 12 T300 12 T410 8" stroke="#1d2b3f" strokeWidth="2" fill="none" />
      </svg>
      {Array.from({ length: n }, (_, i) => {
        const x = (i + 0.5) / n
        // Лампочки висят на той же волне, что и провод
        const y = 9 + Math.abs(Math.sin(x * Math.PI * 2 + 0.6)) * 14
        const color = BULBS[i % BULBS.length]
        return (
          <span key={i} className="absolute" style={{ left: `${x * 100}%`, top: y, transform: 'translateX(-50%)' }}>
            <span className="block h-1.5 w-1 rounded-sm bg-[#2b3a4f]" style={{ marginLeft: 3 }} />
            <span className="fx-bulb block h-[13px] w-[10px] rounded-full" style={{ background: color, color, animationDelay: `${(i % 4) * 0.35}s` }} />
          </span>
        )
      })}
    </div>
  )
}

export function Snowfall({ count, big = false }: { count: number; big?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = (big ? 3 : 2) + rnd(i, 7) * (big ? 5 : 3)
        return (
          <span
            key={i}
            className="fx-snow absolute top-[-12px] rounded-full bg-white"
            style={{ left: `${rnd(i, 8) * 100}%`, width: size, height: size, opacity: 0.55 + rnd(i, 9) * 0.45, animationDelay: `${-rnd(i, 10) * 9}s`, animationDuration: `${6 + rnd(i, 11) * 7}s` }}
          />
        )
      })}
    </>
  )
}

function NewYear({ compact }: { compact: boolean }) {
  return (
    <Layer>
      <Stars count={compact ? 6 : 16} color="#cfe8ff" />
      {/* Северное сияние: две полосы медленно колышутся */}
      <span className="fx-aurora absolute left-[-20%] top-[8%] h-[46%] w-[90%] rounded-[50%]" style={{ background: 'radial-gradient(closest-side, rgb(62 224 143 / 0.35), transparent)' }} />
      <span className="fx-aurora-rev absolute right-[-25%] top-[0%] h-[40%] w-[80%] rounded-[50%]" style={{ background: 'radial-gradient(closest-side, rgb(90 184 255 / 0.3), transparent)' }} />
      <Garland compact={compact} />
      <Snowfall count={compact ? 16 : 34} />
      {/* Сугробы и ёлки */}
      <svg className="absolute bottom-0 left-0 w-full" height={compact ? 30 : 58} viewBox="0 0 400 58" preserveAspectRatio="none">
        <path d="M300 40 l14 -28 l14 28z M318 40 l10 -20 l10 20z M44 42 l12 -24 l12 24z" fill="#0b3b37" />
        <path d="M0 40 Q70 22 140 38 T280 34 T400 36 V58 H0Z" fill="#eaf6ff" />
        <path d="M0 48 Q90 36 180 48 T400 44 V58 H0Z" fill="#cfe6f7" />
      </svg>
    </Layer>
  )
}

// ---------- Двери ----------

export type DoorLook = 'today' | 'open' | 'late' | 'locked' | 'missed'

const GIFTS = [
  ['#e8334a', '#b81d34'],
  ['#1fae6a', '#13804c'],
  ['#2f6fe0', '#1f4fb0'],
  ['#14a3a8', '#0d7a7e'],
  ['#a64bd8', '#7a2fae'],
]

/** Фон и украшения двери. Номер, эмодзи и подписи рисует ячейка — здесь только «корпус». */
export function DoorSkin({ theme, state, day }: { theme: AdventThemeId; state: DoorLook; day: number }) {
  if (theme === 'halloween') {
    const bg: Record<DoorLook, string> = {
      today: 'radial-gradient(circle at 50% 62%, #ffcc66 0%, #ff8a1f 45%, #b8430b 100%)',
      open: 'linear-gradient(180deg, #3a1d5c 0%, #22113a 100%)',
      late: 'linear-gradient(180deg, #23182f 0%, #170f20 100%)',
      locked: 'linear-gradient(180deg, #2a2135 0%, #17111f 100%)',
      missed: 'linear-gradient(180deg, #1a1422 0%, #110c17 100%)',
    }
    return (
      <span className="absolute inset-0" style={{ borderRadius: 'inherit', background: bg[state] }}>
        {/* Каменная кладка */}
        {state !== 'today' && (
          <span
            className="absolute inset-0 opacity-60"
            style={{ borderRadius: 'inherit', backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0 / 0.25) 1px, transparent 1px)', backgroundSize: '100% 14px, 22px 14px' }}
          />
        )}
        {state === 'today' && <span className="fx-flicker absolute inset-0" style={{ borderRadius: 'inherit', background: 'radial-gradient(circle at 50% 60%, rgb(255 240 180 / 0.55), transparent 60%)' }} />}
        {(state === 'locked' || state === 'missed') && <Cobweb />}
      </span>
    )
  }
  if (theme === 'newyear') {
    const [a, b] = GIFTS[day % GIFTS.length]
    const unwrapped = state === 'open'
    return (
      <span
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: 'inherit',
          background: unwrapped ? 'linear-gradient(180deg, #13294a 0%, #0c1d38 100%)' : state === 'today' ? 'linear-gradient(160deg, #ffe08a 0%, #f2b33d 55%, #c98a17 100%)' : `linear-gradient(160deg, ${a} 0%, ${b} 100%)`,
          opacity: state === 'missed' ? 0.4 : 1,
        }}
      >
        {!unwrapped && (
          <>
            {/* Лента крест-накрест */}
            <span className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2" style={{ background: state === 'today' ? '#e8334a' : 'rgb(255 236 170 / 0.9)' }} />
            <span className="absolute inset-x-0 top-[38%] h-[14%]" style={{ background: state === 'today' ? '#e8334a' : 'rgb(255 236 170 / 0.9)' }} />
            {/* Блик на упаковке */}
            <span className="absolute -left-1/3 top-0 h-full w-1/3 rotate-12" style={{ background: 'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.18), transparent)' }} />
          </>
        )}
        {unwrapped && <Snowfall count={4} />}
      </span>
    )
  }
  const bg: Record<DoorLook, string> = {
    today: 'var(--aurora)',
    open: 'var(--color-card)',
    late: 'var(--color-card)',
    locked: 'color-mix(in srgb, var(--color-card) 55%, transparent)',
    missed: 'color-mix(in srgb, var(--color-card) 40%, transparent)',
  }
  return (
    <span className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit', background: bg[state] }}>
      {state === 'today' && <span className="fx-shine absolute inset-y-0 -left-1/2 w-1/2" style={{ background: 'linear-gradient(100deg, transparent, rgb(255 255 255 / 0.45), transparent)' }} />}
    </span>
  )
}

function Cobweb() {
  return (
    <svg className="absolute left-0 top-0 opacity-50" width="30" height="30" viewBox="0 0 30 30">
      <g stroke="#d9cfe6" strokeWidth="0.7" fill="none">
        <path d="M0 0 L30 6 M0 0 L22 22 M0 0 L6 30" />
        <path d="M0 9 Q6 7 8 2 M0 16 Q11 13 14 3 M0 23 Q15 19 20 5" />
      </g>
    </svg>
  )
}

/** Форма двери: у склепа — арка, у подарка — коробка, у стандартной — скруглённый квадрат. */
export function doorShape(theme: AdventThemeId): CSSProperties {
  if (theme === 'halloween') return { borderRadius: '46% 46% 12px 12px / 30% 30% 12px 12px' }
  if (theme === 'newyear') return { borderRadius: 12 }
  return { borderRadius: 20 }
}

/** Цвет подписи и номера на двери. */
export function doorInk(theme: AdventThemeId, state: DoorLook) {
  if (theme === 'halloween') return state === 'today' ? '#3a1204' : state === 'late' ? '#a3ff4f' : '#e9d9f5'
  if (theme === 'newyear') return state === 'today' ? '#5a2a00' : '#ffffff'
  return state === 'today' ? '#ffffff' : undefined
}

/** Створка или крышка, которая слетает при открытии. */
export function OpeningLeaf({ theme }: { theme: AdventThemeId }) {
  if (theme === 'newyear') {
    return (
      <span className="absolute inset-x-[-6%] top-[-4%] h-[34%]" style={{ borderRadius: 10, background: 'linear-gradient(180deg, #ffe08a, #e0a52c)', boxShadow: '0 6px 12px rgb(0 0 0 / 0.3)' }}>
        <span className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2 bg-[#e8334a]" />
      </span>
    )
  }
  const wood = theme === 'halloween'
  return (
    <span
      className="absolute inset-0"
      style={{
        borderRadius: 'inherit',
        background: wood ? 'repeating-linear-gradient(90deg, #4a2c1a 0 9px, #3a2214 9px 10px)' : 'linear-gradient(135deg, rgb(255 255 255 / 0.9), rgb(220 210 255 / 0.85))',
        boxShadow: 'inset 0 0 0 2px rgb(0 0 0 / 0.15)',
      }}
    >
      <span className="absolute right-[14%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ background: wood ? '#d9a432' : '#8b6cff' }} />
    </span>
  )
}
