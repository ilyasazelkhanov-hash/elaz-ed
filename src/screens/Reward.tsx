import { motion } from 'motion/react'
import { useEffect } from 'react'
import { achievement, levelOf } from '../lib/game'
import { sfx } from '../lib/sfx'
import { lessonCard, levelCard } from '../lib/shareCard'
import { haptic } from '../lib/tg'
import { useStore, type Reward } from '../store'
import { Bar, celebrate, Counter, Emoji, Tap } from '../ui'

/**
 * Экран награды после урока: конфетти, XP, новый уровень, ачивки.
 * Награда приходит пропсом, а не из стора: во время анимации закрытия в сторе её уже нет.
 */
export function RewardModal({ reward }: { reward: Reward }) {
  const { setReward, pop } = useStore.getState()
  const { result, fromXp, lessonId } = reward
  const before = levelOf(fromXp)
  const after = levelOf(result.me.xp)
  const levelUp = after.index > before.index

  useEffect(() => {
    celebrate()
    haptic.success()
    if (levelUp) sfx.levelUp()
    else sfx.win()
  }, [levelUp])

  const close = () => {
    setReward(null)
    pop()
  }

  // Новый уровень — повод сильнее, чем один урок: им и делимся.
  const share = () => {
    const lesson = useStore.getState().feed.find((c) => c.id === lessonId)
    useStore.setState({ share: levelUp || !lesson ? levelCard(result.me) : lessonCard(lesson, result) })
  }

  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-bg/95 px-6 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div
        className="ring-spin pointer-events-none absolute left-1/2 top-[34%] h-[150vmax] w-[150vmax] -translate-x-1/2 -translate-y-1/2 opacity-[0.13]"
        style={{ background: 'repeating-conic-gradient(from 0deg, #a58bff 0deg 9deg, transparent 9deg 22deg)', animationDuration: '50s' }}
      />

      <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }} className="relative">
        <div className="absolute inset-0 scale-150 rounded-full" style={{ background: 'radial-gradient(circle, rgb(165 139 255 / 0.5), transparent 65%)' }} />
        <Emoji char={levelUp ? after.emoji : '🏆'} size={132} animated className="relative" />
      </motion.div>

      <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="relative mt-5 text-[12.5px] font-semibold uppercase tracking-[0.2em] text-mute">
        {levelUp ? 'Новый уровень' : 'Урок пройден'}
      </motion.p>

      {levelUp && (
        <motion.p initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.4 }} className="relative mt-1 font-display text-[30px] font-bold leading-tight">
          {after.title}
        </motion.p>
      )}

      <motion.p initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: levelUp ? 0.55 : 0.4 }} className={`relative font-display font-bold leading-none text-aurora ${levelUp ? 'mt-2 text-[30px]' : 'mt-1.5 text-[52px]'}`}>
        +<Counter value={result.gained} from={0} /> XP
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="relative mt-5 flex flex-wrap justify-center gap-1.5 text-[13px] font-semibold">
        <span className="rounded-full bg-veil/8 px-3 py-1.5">Урок +{result.base}</span>
        {result.total > 0 && (
          <span className={`rounded-full px-3 py-1.5 ${result.score === result.total ? 'bg-mint/15 text-mint' : 'bg-veil/8'}`}>
            Квиз {result.score}/{result.total} · +{result.bonus}
          </span>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="relative mt-7 w-full max-w-[340px] rounded-[24px] border border-line bg-card p-4">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span className="flex items-center gap-1.5">
            <Emoji char={after.emoji} size={17} /> {after.title}
          </span>
          <span className="text-mute">{after.next ? `ещё ${after.left} XP` : 'максимум'}</span>
        </div>
        <Bar progress={after.progress} className="mt-2.5" />
      </motion.div>

      {result.new_achievements.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="relative mt-3 flex w-full max-w-[340px] flex-col gap-2">
          {result.new_achievements.map((code) => {
            const a = achievement(code)
            if (!a) return null
            return (
              <div key={code} className="flex items-center gap-3 rounded-[20px] border border-violet/30 bg-violet/10 p-3">
                <Emoji char={a.emoji} size={34} animated />
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-violet">Ачивка</p>
                  <p className="text-[15px] font-semibold leading-tight">{a.title}</p>
                </div>
              </div>
            )
          })}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="relative mt-8 flex w-full max-w-[340px] flex-col gap-2.5">
        <Tap onClick={close} className="shine h-[54px] rounded-[20px] font-display text-[14px] font-semibold text-white" style={{ background: 'var(--aurora)', boxShadow: '0 12px 30px -10px #9b7bff' }}>
          Дальше
        </Tap>
        <Tap onClick={share} className="h-[50px] rounded-[20px] text-[14.5px] font-semibold text-mute">
          Поделиться
        </Tap>
      </motion.div>
    </motion.div>
  )
}
