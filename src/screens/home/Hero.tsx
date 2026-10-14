import { Check } from 'lucide-react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { GRADIENTS, iconFor } from '../../lib/game'
import { haptic } from '../../lib/tg'
import type { Card } from '../../lib/types'
import { insetOf, useStore } from '../../store'
import { Emoji, Pattern, Tap } from '../../ui'

// Карусель «В фокусе».

export function HeroCarousel({ cards }: { cards: Card[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const scrollX = useMotionValue(0)
  const [active, setActive] = useState(0)
  const [step, setStep] = useState(1)

  const onScroll = () => {
    const el = scroller.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    const width = first.offsetWidth + 12
    scrollX.set(el.scrollLeft)
    if (width !== step) setStep(width)
    const i = Math.round(el.scrollLeft / width)
    if (i !== active) {
      setActive(i)
      haptic.select()
    }
  }

  return (
    <>
      <div ref={scroller} onScroll={onScroll} className="no-bar -mb-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-10">
        {cards.map((c, i) => (
          <HeroCard key={c.id} card={c} active={i === active} single={cards.length === 1} index={i} step={step} scrollX={scrollX} />
        ))}
      </div>
      {cards.length > 1 && (
        <div className="relative mt-3 flex justify-center gap-1.5">
          {cards.map((c, i) => (
            <motion.span key={c.id} animate={{ width: i === active ? 18 : 6, opacity: i === active ? 1 : 0.3 }} className="h-1.5 rounded-full bg-ink" />
          ))}
        </div>
      )}
    </>
  )
}

function Typed({ text, active }: { text: string; active: boolean }) {
  const [n, setN] = useState(text.length)
  useEffect(() => {
    if (!active) return
    let i = 0
    setN(0)
    const t = setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) clearInterval(t)
    }, 26)
    return () => clearInterval(t)
  }, [text, active])
  return (
    <span className="relative block">
      <span className="invisible line-clamp-2">{text}</span>
      <span className={`absolute inset-0 line-clamp-2 ${n < text.length ? 'caret' : ''}`}>{text.slice(0, n)}</span>
    </span>
  )
}

interface HeroProps {
  card: Card
  active: boolean
  single: boolean
  index: number
  step: number
  scrollX: MotionValue<number>
}

function HeroCard({ card, active, single, index, step, scrollX }: HeroProps) {
  const push = useStore((s) => s.push)
  const g = GRADIENTS[card.gradient] ?? GRADIENTS.aurora
  // Параллакс: эмодзи движется медленнее карточки и чуть поворачивается, пока она уезжает.
  const offset = useTransform(scrollX, (x) => (x - index * step) / Math.max(step, 1))
  const emojiX = useTransform(offset, [-1, 0, 1], [-46, 0, 46])
  const emojiRotate = useTransform(offset, [-1, 0, 1], [14, 0, -14])
  return (
    <Tap
      onClick={(e) => push({ type: 'lesson', id: card.id, from: insetOf(e.currentTarget) })}
      className={`relative h-[220px] shrink-0 snap-center overflow-hidden rounded-[30px] p-5 text-left ${single ? 'w-full' : 'w-[86%]'}`}
      style={{ background: g.css, color: g.ink, boxShadow: `0 14px 30px -16px ${g.glow}` }}
    >
      <Pattern name={card.gradient} />
      <motion.div className="absolute -bottom-2 -right-1" style={{ x: emojiX, rotate: emojiRotate }}>
        <div className="floaty">
          <Emoji char={iconFor(card)} size={108} animated={active} />
        </div>
      </motion.div>
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{card.category}</span>
          {card.completed && (
            <span className="flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Check size={12} strokeWidth={3.5} /> пройдено
            </span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-3 max-w-[82%] font-display text-[20px] font-semibold leading-[1.14]">{card.title}</h3>
        {card.subtitle && (
          <p className="mt-2 max-w-[58%] text-[13.5px] font-medium leading-snug opacity-85">
            <Typed text={card.subtitle} active={active} />
          </p>
        )}
        <div className="tabular mt-auto flex items-center gap-2 text-[12.5px] font-bold">
          <span className="rounded-full bg-black/15 px-2.5 py-1">{card.minutes} мин</span>
          {/* Наклейка с наградой: чуть повёрнута и с жёсткой тенью, как ценник на игровом автомате. */}
          <span className="-rotate-3 rounded-[10px] bg-white px-2.5 py-1 text-[#14101f] shadow-[2px_3px_0_rgb(0_0_0/0.28)]">+{card.xp} XP</span>
        </div>
      </div>
    </Tap>
  )
}
