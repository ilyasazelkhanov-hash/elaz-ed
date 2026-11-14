import { ArrowUpRight, Sparkles } from 'lucide-react'
import { ADVENT_END, ADVENT_START, seasonDates } from '../../lib/advent-season'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { useSeasonToday } from './useSeason'
import './season.css'
export function SeasonBanner() {
  const push = useStore(s => s.push)
  const today = useSeasonToday()
  const index = seasonDates().indexOf(today)
  return <Tap onClick={() => push({ type: 'advent-season' })} className="season-banner mx-5 mt-4" aria-label="Открыть AI-адвент: 14 ноября - 5 января">
    <span className="season-orbit" aria-hidden="true"><Sparkles size={28}/></span>
    <span className="min-w-0 flex-1 text-left"><span className="season-eyebrow">14 ноября - 5 января</span><strong className="block font-display text-[18px]">Адвент. Без скучных дверей.</strong><span className="mt-1 block text-xs opacity-85">{today < ADVENT_START ? '53 идеи. Первая откроется 14 ноября' : today > ADVENT_END ? 'Все 53 задания доступны. Забирай пропущенное' : `День ${index + 1} из 53 · ИИ, который пригодится тебе`}</span></span>
    <ArrowUpRight size={22} className="shrink-0" aria-hidden="true"/>
  </Tap>
}
