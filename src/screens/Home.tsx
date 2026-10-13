import { Check, CirclePlay, Lock, Share2, Snowflake, Star } from 'lucide-react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, errorText } from '../lib/api'
import { dailyReward, days, GRADIENTS, lessonsWord, levelOf } from '../lib/game'
import { sfx } from '../lib/sfx'
import { streakCard } from '../lib/shareCard'
import { haptic } from '../lib/tg'
import type { Card, Course } from '../lib/types'
import { insetOf, useStore } from '../store'
import { Avatar, Bar, burst, Counter, Emoji, EmojiTile, flyPoints, Odometer, Pattern, Ring, Tap } from '../ui'

export function Home() {
  const me = useStore((s) => s.me)!
  const feed = useStore((s) => s.feed)
  const courses = useStore((s) => s.courses)
  const setTab = useStore((s) => s.setTab)
  const [cat, setCat] = useState('Все')

  const stories = useMemo(() => feed.filter((c) => c.kind === 'story'), [feed])
  // Уроки закрытых курсов живут на странице курса, а не в общей ленте.
  const lessons = useMemo(() => feed.filter((c) => c.kind === 'lesson' && !c.course_id), [feed])
  const hero = useMemo(() => {
    const pinned = lessons.filter((c) => c.pinned)
    return pinned.length ? pinned : lessons.slice(0, 3)
  }, [lessons])
  const cats = useMemo(() => ['Все', ...new Set(lessons.map((c) => c.category))], [lessons])
  const list = cat === 'Все' ? lessons : lessons.filter((c) => c.category === cat)
  const lvl = levelOf(me.xp)

  return (
    <div className="scroll h-full" style={{ paddingTop: 'calc(var(--top) + 14px)', paddingBottom: 'calc(120px + var(--bottom))' }}>
      <header className="flex items-center gap-3 px-5">
        <Tap feedback="soft" onClick={() => setTab('profile')} aria-label="Профиль">
          <Avatar name={me.name} photo={me.photo} id={me.id} size={44} />
        </Tap>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight text-mute">Привет,</p>
          <p className="truncate font-display text-[17px] font-semibold leading-tight">{me.name}</p>
        </div>
        <div className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card/80 pl-2 pr-3">
          <Emoji char="🔥" size={18} animated={me.streak > 0} className={me.streak > 0 ? '' : 'opacity-40 grayscale'} />
          <Counter value={me.streak} className="tabular font-display text-[13px] font-semibold" />
        </div>
        <div id="xp-pill" className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-card/80 pl-2 pr-3">
          <Emoji char="⚡" size={18} />
          <Odometer value={me.xp} className="font-display text-[13px] font-semibold" />
        </div>
      </header>

      <Tap
        feedback="soft"
        onClick={() => setTab('profile')}
        className="mx-5 mt-5 flex w-[calc(100%-40px)] items-center gap-4 rounded-[26px] border border-line bg-card/80 p-4 text-left"
      >
        <Ring size={68} progress={lvl.progress}>
          <Emoji char={lvl.emoji} size={34} animated />
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wider text-mute">Уровень {lvl.index}</p>
          <p className="font-display text-[18px] font-semibold leading-tight">{lvl.title}</p>
          <Bar progress={lvl.progress} className="mt-2.5" />
          <p className="tabular mt-1.5 text-[12px] text-mute">{lvl.next ? `Ещё ${lvl.left} XP до уровня «${lvl.next.title}»` : 'Максимальный уровень'}</p>
        </div>
      </Tap>

      <div className="mx-5 mt-3">
        <AnimatePresence mode="wait" initial={false}>
          {me.daily_claimed ? <StreakCard key="streak" /> : <DailyCard key="daily" />}
        </AnimatePresence>
      </div>

      {stories.length > 0 && (
        <div className="no-bar mt-6 flex gap-3.5 overflow-x-auto px-5">
          {stories.map((s, i) => (
            <StoryBubble key={s.id} card={s} index={i} />
          ))}
        </div>
      )}

      {hero.length > 0 && (
        <>
          <SectionTitle>В фокусе</SectionTitle>
          <HeroCarousel cards={hero} />
        </>
      )}

      {courses.length > 0 && (
        <>
          <SectionTitle count={courses.length}>Курсы</SectionTitle>
          <div className="no-bar -mb-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-10">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} single={courses.length === 1} />
            ))}
          </div>
        </>
      )}

      <SectionTitle count={lessons.length}>Все уроки</SectionTitle>

      {cats.length > 2 && (
        <div className="no-bar mb-3.5 flex gap-2 overflow-x-auto px-5">
          {cats.map((c) => (
            <Tap key={c} feedback="select" onClick={() => setCat(c)} className={`relative h-10 shrink-0 rounded-full px-4 text-[13.5px] font-semibold ${cat === c ? 'text-on-inverse' : 'text-mute'}`}>
              {cat === c ? (
                <motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-inverse" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              ) : (
                <span className="absolute inset-0 rounded-full border border-line bg-card/70" />
              )}
              <span className="relative">{c}</span>
            </Tap>
          ))}
        </div>
      )}

      {lessons.length > 0 ? (
        <div className="mx-5 overflow-hidden rounded-[24px] border border-line bg-card/80">
          {list.map((c, i) => (
            <LessonRow key={c.id} card={c} index={i} />
          ))}
        </div>
      ) : (
        <div className="mx-5 rounded-[26px] border border-dashed border-veil/15 px-6 py-10 text-center">
          <Emoji char="🛠️" size={44} className="mx-auto" />
          <p className="mt-3 font-display text-[15px] font-semibold">Первый урок уже в работе</p>
          <p className="mt-1.5 text-[13.5px] text-mute">Он появится здесь сразу после анонса в канале.</p>
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <div className="mb-3.5 mt-7 flex items-baseline gap-2 px-5">
      <h2 className="font-display text-[15px] font-semibold">{children}</h2>
      {count != null && count > 0 && <span className="tabular text-[12.5px] font-semibold text-faint">{count}</span>}
    </div>
  )
}

// ---------- Бонус дня: зажми и заряди ----------

const CHARGE_SEC = 1.15

function DailyCard() {
  const me = useStore((s) => s.me)!
  const { setMe, toast, unlocked, guard } = useStore.getState()
  const progress = useMotionValue(0)
  const scale = useTransform(progress, [0, 1], [1, 1.18])
  const rotate = useTransform(progress, (p) => Math.sin(p * 40) * p * 9)
  const dash = useTransform(progress, (p) => 1 - p)
  const glow = useTransform(progress, [0, 1], [0, 1])
  const orb = useRef<HTMLDivElement>(null)
  const anim = useRef<ReturnType<typeof animate> | null>(null)
  const ticker = useRef<number>(0)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(false)
  const reward = dailyReward(me.streak + 1)

  const stop = () => {
    anim.current?.stop()
    clearInterval(ticker.current)
  }
  useEffect(() => stop, [])

  const claim = async () => {
    setBusy(true)
    try {
      const res = await api.daily()
      burst(orb.current)
      flyPoints(orb.current)
      sfx.coin()
      haptic.success()
      if (res.froze) toast('Заморозка спасла стрик: вчерашний пропуск не считается', '🧊')
      else if (res.gained > 0) toast(`+${res.gained} XP · стрик ${days(res.me.streak)}`, '🔥')
      unlocked(res.new_achievements)
      // Карточка меняется на стрик не сразу: очки успевают долететь до счётчика.
      setTimeout(() => setMe(res.me), 620)
    } catch (e) {
      guard(e)
      toast(errorText(e))
      animate(progress, 0, { duration: 0.3 })
      setBusy(false)
    }
  }

  const press = () => {
    if (busy) return
    stop()
    haptic.soft()
    ticker.current = window.setInterval(() => {
      haptic.soft()
      sfx.charge(progress.get())
    }, 110)
    anim.current = animate(progress, 1, {
      duration: CHARGE_SEC * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => {
        clearInterval(ticker.current)
        void claim()
      },
    })
  }

  const release = () => {
    if (busy || progress.get() >= 1) return
    stop()
    if (progress.get() < 0.25) {
      setHint(true)
      setTimeout(() => setHint(false), 1800)
    }
    animate(progress, 0, { type: 'spring', stiffness: 260, damping: 26 })
  }

  const g = GRADIENTS.candy
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="relative flex items-center gap-3 overflow-hidden rounded-[26px] p-4 pl-5"
      style={{ background: g.css, color: g.ink }}
    >
      <Pattern name="candy" />
      <div className="relative min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider opacity-70">Бонус дня</p>
        <p className="tabular font-display text-[19px] font-semibold leading-tight">+{reward} XP</p>
        <p className="mt-1 text-[13px] font-medium opacity-80">{hint ? 'Не отпускай, пока не зарядится' : me.streak > 0 ? `Стрик ${days(me.streak)} — не обрывай` : 'Зажми кнопку и держи'}</p>
      </div>
      <motion.div
        ref={orb}
        role="button"
        aria-label="Зажми, чтобы забрать бонус дня"
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        style={{ scale, touchAction: 'none', WebkitTouchCallout: 'none' }}
        className="relative grid h-[76px] w-[76px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#2a1020]"
      >
        <motion.div className="absolute inset-0 rounded-full" style={{ opacity: glow, boxShadow: '0 0 34px 6px rgb(255 255 255 / 0.75)' }} />
        <svg width="76" height="76" className="absolute inset-0 -rotate-90">
          <circle cx="38" cy="38" r="34" fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="4" />
          <motion.circle cx="38" cy="38" r="34" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: dash }} />
        </svg>
        <motion.div style={{ rotate }} className="relative">
          <Emoji char="🎁" size={38} animated />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function StreakCard() {
  const me = useStore((s) => s.me)!
  const filled = me.streak > 0 ? ((me.streak - 1) % 7) + 1 : 0
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-[26px] border border-line bg-card/80 p-4">
      <div className="flex items-center gap-3">
        <Emoji char="🔥" size={34} animated />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-semibold leading-tight">Стрик {days(me.streak)}</p>
          <p className="tabular mt-0.5 text-[12.5px] text-mute">
            Завтра +{dailyReward(me.streak + 1)} XP · рекорд {me.best_streak}
          </p>
        </div>
        {me.freezes > 0 && (
          <span className="tabular flex h-9 items-center gap-1 rounded-full bg-sky/15 px-2.5 text-[12.5px] font-semibold text-sky">
            <Snowflake size={15} /> {me.freezes}
          </span>
        )}
        <Tap onClick={() => useStore.setState({ share: streakCard(me) })} aria-label="Поделиться стриком" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-veil/8 text-mute">
          <Share2 size={16} />
        </Tap>
      </div>
      <div className="mt-3.5 flex gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0.4, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.05 * i }}
            className="h-2 flex-1 rounded-full"
            style={{ background: i < filled ? 'var(--aurora)' : 'var(--track)' }}
          />
        ))}
      </div>
      <p className="mt-2.5 text-[12px] leading-snug text-faint">
        {filled === 7 ? 'Неделя закрыта. Заморозка в запасе: она спасёт стрик, если пропустишь день.' : `Ещё ${days(7 - filled)} до заморозки — она спасает стрик, если пропустишь день.`}
      </p>
    </motion.div>
  )
}

// ---------- Сторис ----------

function StoryBubble({ card, index }: { card: Card; index: number }) {
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
      <div className="rounded-full p-[2.5px]" style={{ background: seen ? 'var(--track-strong)' : g.css }}>
        <div className="rounded-full bg-bg p-[2.5px]">
          <EmojiTile emoji={card.emoji} gradient={card.gradient} size={60} radius={30} />
        </div>
      </div>
      <p className={`mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-tight ${seen ? 'text-faint' : 'text-ink'}`}>{card.title}</p>
    </Tap>
  )
}

// ---------- Карусель ----------

function HeroCarousel({ cards }: { cards: Card[] }) {
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
      <span className="invisible">{text}</span>
      <span className={`absolute inset-0 ${n < text.length ? 'caret' : ''}`}>{text.slice(0, n)}</span>
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
      {card.cover_url ? (
        <img src={card.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 mix-blend-luminosity" />
      ) : (
        <motion.div className="absolute -bottom-2 -right-1" style={{ x: emojiX, rotate: emojiRotate }}>
          <div className="floaty">
            <Emoji char={card.emoji} size={128} animated={active} />
          </div>
        </motion.div>
      )}
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">{card.category}</span>
          {card.completed && (
            <span className="flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Check size={12} strokeWidth={3.5} /> пройдено
            </span>
          )}
        </div>
        <h3 className="mt-3 max-w-[82%] font-display text-[21px] font-semibold leading-[1.14]">{card.title}</h3>
        {card.subtitle && (
          <p className="mt-2 max-w-[64%] text-[13.5px] font-medium leading-snug opacity-85">
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

// ---------- Курсы ----------

function CourseCard({ course, single }: { course: Course; single: boolean }) {
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

// ---------- Список ----------

function LessonRow({ card, index }: { card: Card; index: number }) {
  const push = useStore((s) => s.push)
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        haptic.tap()
        push({ type: 'lesson', id: card.id, from: insetOf(e.currentTarget) })
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="flex w-full items-center gap-3.5 border-b border-line p-3 text-left last:border-b-0 active:bg-veil/5"
    >
      <EmojiTile emoji={card.emoji} gradient={card.gradient} size={54} radius={17} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{card.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-mute">
          <span className="tabular truncate">
            {card.category} · {card.minutes} мин{card.quiz_count > 0 ? ' · квиз' : ''}
          </span>
          {card.has_video && <CirclePlay size={13} className="shrink-0" />}
        </p>
      </div>
      {card.completed ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint/15 text-mint">
          <Check size={16} strokeWidth={3} />
        </span>
      ) : (
        <span className="tabular shrink-0 rounded-full bg-violet/15 px-2.5 py-1 text-[12px] font-bold text-violet">+{card.xp}</span>
      )}
    </motion.button>
  )
}
