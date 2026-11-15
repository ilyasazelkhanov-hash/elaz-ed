import { ADVENT_START, seasonDates } from '../../lib/advent-season'
import { useSeasonToday } from './useSeason'
import { Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { dayMonth } from '../../lib/advent'
import { plural } from '../../lib/game'
import type { AdventSummary, AdventThemeId } from '../../lib/types'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { themeOf, ThemeScene } from './themes'

// Карточка адвента на главной живёт отдельно от экрана календаря: календарь грузится лениво,
// а баннер нужен сразу и весит немного.

export const doorsWord = (n: number) => plural(n, ['дверь', 'двери', 'дверей'])

/**
 * Карточка на главной. Если сервер ведёт календарь, показывается он: с дверями, серией, XP и призами.
 * Пока сезон на сервере не включён, остаётся локальный календарь практик, чтобы вход не пропадал.
 */
export function AdventBanner() {
  const advent = useStore((s) => s.advent)
  return advent ? <ServerBanner advent={advent} /> : <PracticeBanner />
}

function ServerBanner({ advent }: { advent: AdventSummary }) {
  const push = useStore((s) => s.push)
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
  return <BannerCard title={advent.title} line={line} hot={hot} before={before} day={Math.min(Math.max(advent.today, 1), advent.days)} themeId={advent.theme} onOpen={() => push({ type: 'advent' })} />
}

function PracticeBanner() {
  const today = useSeasonToday()
  const dates = seasonDates()
  const day = today < ADVENT_START ? 0 : dates.indexOf(today) === -1 ? 54 : dates.indexOf(today) + 1
  const advent = { title: 'Новогодний AI-адвент', theme: 'newyear' as const, start: ADVENT_START, days: 53, today: day, opened: 0, today_open: false, streak: 0 }
  const push = useStore((s) => s.push)
  const before = advent.today < 1
  const over = advent.today > advent.days
  const line = before
    ? `Старт ${dayMonth(advent.start)} · ${advent.days} ${doorsWord(advent.days)}`
    : over
      ? '53 AI-практики · все подарки доступны'
      : `Практика дня ${advent.today} · подарок с AI-задачей`
  const hot = !before && !over
  return <BannerCard title={advent.title} line={line} hot={hot} before={before} day={Math.min(Math.max(advent.today, 1), advent.days)} themeId={advent.theme} onOpen={() => push({ type: 'advent-season' })} />
}

function BannerCard({ title, line, hot, before, day, themeId, onOpen }: { title: string; line: string; hot: boolean; before: boolean; day: number; themeId?: AdventThemeId; onOpen: () => void }) {
  const theme = themeOf(themeId)
  return (
    <Tap
      aria-label="Адвент-календарь"
      feedback="soft"
      onClick={onOpen}
      className="relative mx-5 mt-5 flex min-h-[88px] w-[calc(100%-40px)] items-center gap-3.5 overflow-hidden rounded-[26px] p-4 text-left"
      style={{ background: theme.hero, color: theme.ink }}
    >
      <ThemeScene theme={theme.id} compact />
      <div className="relative min-w-0 flex-1">
        <p className="font-display text-[17px] font-semibold leading-tight">{title}</p>
        <p className="mt-1 text-[13px] font-medium leading-snug opacity-85">{line}</p>
      </div>
      <motion.div
        className="relative grid h-[64px] w-[64px] shrink-0 place-items-center rounded-[20px] backdrop-blur-sm"
        style={{ background: theme.chip }}
        animate={hot ? { rotate: [0, -6, 6, -3, 0] } : {}}
        transition={hot ? { duration: 1.2, repeat: Infinity, repeatDelay: 1.6 } : {}}
      >
        {before ? <Lock size={24} /> : <span className="font-display text-[24px] font-bold">{day}</span>}
      </motion.div>
    </Tap>
  )
}

