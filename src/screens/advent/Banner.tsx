import { Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { dayMonth } from '../../lib/advent'
import { plural } from '../../lib/game'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { themeOf, ThemeScene } from './themes'

// Карточка адвента на главной живёт отдельно от экрана календаря: календарь грузится лениво,
// а баннер нужен сразу и весит немного.

export const doorsWord = (n: number) => plural(n, ['дверь', 'двери', 'дверей'])

/** Карточка на главной: что сегодня с календарём. */
export function AdventBanner() {
  const advent = useStore((s) => s.advent)
  const push = useStore((s) => s.push)
  if (!advent) return null
  const before = advent.today < 1
  const over = advent.today > advent.days
  const line = before
    ? `Старт ${dayMonth(advent.start)} · ${advent.days} ${doorsWord(advent.days)}`
    : over
      ? `Можно догнать пропущенные · открыто ${advent.opened} из ${advent.days}`
      : advent.today_open
        ? `Дверь №${advent.today} открыта${advent.streak > 1 ? ` · серия ${advent.streak}` : ''}. Завтра новая`
        : `Дверь №${advent.today} ждёт тебя${advent.streak > 0 ? ` · серия ${advent.streak}` : ''}`
  const hot = !before && !over && !advent.today_open
  const theme = themeOf(advent.theme)
  return (
    <Tap
      feedback="soft"
      onClick={() => push({ type: 'advent' })}
      className="relative mx-5 mt-5 flex min-h-[104px] w-[calc(100%-40px)] items-center gap-3.5 overflow-hidden rounded-[26px] p-4 text-left"
      style={{ background: theme.hero, color: theme.ink }}
    >
      <ThemeScene theme={theme.id} compact />
      <div className="relative min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider opacity-75">{advent.title}</p>
        <p className="mt-0.5 font-display text-[17px] font-semibold leading-tight">{before ? 'Скоро открытие' : hot ? 'Открой дверь дня' : 'Календарь'}</p>
        <p className="mt-1 text-[13px] font-medium leading-snug opacity-85">{line}</p>
      </div>
      <motion.div
        className="relative grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[20px] backdrop-blur-sm"
        style={{ background: theme.chip }}
        animate={hot ? { rotate: [0, -6, 6, -3, 0] } : {}}
        transition={hot ? { duration: 1.2, repeat: Infinity, repeatDelay: 1.6 } : {}}
      >
        {before ? <Lock size={24} /> : <span className="font-display text-[24px] font-bold">{Math.min(Math.max(advent.today, 1), advent.days)}</span>}
      </motion.div>
    </Tap>
  )
}
