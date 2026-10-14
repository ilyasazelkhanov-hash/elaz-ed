import { Share2, Snowflake } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../../lib/api'
import { dailyReward, days, GRADIENTS } from '../../lib/game'
import { sfx } from '../../lib/sfx'
import { streakCard } from '../../lib/shareCard'
import { haptic } from '../../lib/tg'
import { useStore } from '../../store'
import { burst, Emoji, flyPoints, Pattern, Tap } from '../../ui'

// Бонус дня: зажми и заряди. После получения карточка меняется на стрик.

const CHARGE_SEC = 1.15

export function DailyCard() {
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

export function StreakCard() {
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
        {/* Заморозок не бывает больше двух — при полном запасе не обещаем новую. */}
        {me.freezes >= 2
          ? 'Две заморозки в запасе — это максимум. Каждая спасёт стрик, если пропустишь день.'
          : filled === 7
            ? 'Неделя закрыта. Заморозка в запасе: она спасёт стрик, если пропустишь день.'
            : `Ещё ${days(7 - filled)} до заморозки — она спасает стрик, если пропустишь день.`}
      </p>
    </motion.div>
  )
}
