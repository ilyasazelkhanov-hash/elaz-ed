import { Check, Lock, Star } from 'lucide-react'
import { GRADIENTS, iconFor, lessonsWord } from '../../lib/game'
import type { Card, Course } from '../../lib/types'
import { insetOf, useStore } from '../../store'
import { Emoji, Pattern, Tap } from '../../ui'

export function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <div className="mb-3.5 mt-7 flex items-baseline gap-2 px-5">
      <h2 className="font-display text-[15px] font-semibold">{children}</h2>
      {count != null && count > 0 && <span className="tabular text-[12.5px] font-semibold text-faint">{count}</span>}
    </div>
  )
}

// ---------- Сторис ----------

export function StoryBubble({ card, index }: { card: Card; index: number }) {
  const seen = useStore((s) => s.seen.includes(card.id) || card.completed)
  const push = useStore((s) => s.push)
  const g = GRADIENTS[card.gradient] ?? GRADIENTS.aurora
  return (
    <Tap
      onClick={() => push({ type: 'stories', id: card.id })}
      className="w-[70px] shrink-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      <div className={seen ? 'rounded-full p-[2.5px]' : 'relative rounded-full p-[2.5px]'} style={{ background: seen ? 'var(--track-strong)' : g.css }}>
        <div className="rounded-full bg-bg p-[2.5px]">
          <div className={`relative grid h-[60px] w-[60px] place-items-center overflow-hidden rounded-full ${seen ? 'opacity-60 saturate-50' : ''}`} style={{ background: g.css }}>
            <Pattern name={card.gradient} full />
            <Emoji char={iconFor(card)} size={36} animated={!seen} className="relative drop-shadow-[0_3px_4px_rgb(0_0_0/0.25)]" />
          </div>
        </div>
      </div>
      <p className={`mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight ${seen ? 'text-faint' : 'text-ink'}`}>{card.title}</p>
    </Tap>
  )
}

// ---------- Курсы ----------

export function CourseCard({ course, single }: { course: Course; single: boolean }) {
  const push = useStore((s) => s.push)
  const g = GRADIENTS[course.gradient] ?? GRADIENTS.ocean
  return (
    <Tap
      onClick={(e) => push({ type: 'course', id: course.id, from: insetOf(e.currentTarget) })}
      className={`sheen relative h-[176px] shrink-0 snap-center overflow-hidden rounded-[28px] p-5 text-left ${single ? 'w-full' : 'w-[82%]'}`}
      style={{ background: g.css, color: g.ink, boxShadow: `0 14px 30px -16px ${g.glow}` }}
    >
      <Pattern name={course.gradient} full />
      <div className="floaty absolute -right-2 bottom-1">
        <Emoji char={course.emoji} size={104} />
      </div>
      <div className="relative flex h-full flex-col">
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
          {course.access ? <Check size={12} strokeWidth={3.5} /> : <Lock size={11} strokeWidth={3} />}
          {course.access ? 'Курс открыт' : 'Закрытый курс'}
        </span>
        <h3 className="mt-2.5 max-w-[78%] font-display text-[19px] font-semibold leading-[1.15]">{course.title}</h3>
        <div className="tabular mt-auto flex items-center gap-2 text-[12.5px] font-bold">
          <span className="rounded-full bg-black/15 px-2.5 py-1">{course.access ? `${course.done} из ${course.lessons}` : `${course.lessons} ${lessonsWord(course.lessons)}`}</span>
          {!course.access && course.price_stars > 0 && (
            <span className="flex -rotate-3 items-center gap-1 rounded-[10px] bg-white px-2.5 py-1 text-[#14101f] shadow-[2px_3px_0_rgb(0_0_0/0.28)]">
              <Star size={13} fill="#f5a524" strokeWidth={0} /> {course.price_stars}
            </span>
          )}
          {!course.access && course.request === 'pending' && <span className="rounded-full bg-black/15 px-2.5 py-1">заявка у автора</span>}
        </div>
      </div>
    </Tap>
  )
}
