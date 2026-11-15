import { ChevronLeft, Copy, Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import missionsData from '../../../content/advent/ai-winter-2026.json'
import { ADVENT_START, localSeasonStorage, missionAvailable, readSeasonProgress, saveSeasonProgress, seasonDates, seasonScope, type AdventMission } from '../../lib/advent-season'
import { isDemo } from '../../lib/api'
import type { AdventCell } from '../../lib/types'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { AdventScreen, DoorCell, slide } from './Advent'
import { useSeasonToday } from './useSeason'
import { ThemeScene, themeOf } from './themes'

const missions = missionsData as AdventMission[]
export function AdventSeasonScreen() {
  const me = useStore(s => s.me)
  return me ? <Season key={`${isDemo}:${me.id}`} userId={me.id}/> : null
}
function Season({ userId }: { userId: number }) {
  const pop = useStore(s => s.pop)
  const scroller = useRef<HTMLDivElement>(null)
  const today = useSeasonToday()
  const dates = seasonDates()
  const key = seasonScope(userId, isDemo)
  const [done, setDone] = useState(() => readSeasonProgress(localSeasonStorage(), key))
  const [selected, setSelected] = useState<string | null>(null)
  const [archive, setArchive] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [memoryOnly, setMemoryOnly] = useState(false)
  const theme = themeOf('newyear')
  const mission = missions.find(m => m.date === selected && missionAvailable(m.date, today))
  const day = dates.indexOf(today) + 1
  const completed = !!selected && done.includes(selected)
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [selected])
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setDone(readSeasonProgress(localSeasonStorage(), key)) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  const copy = async () => {
    if (!mission) return
    try { await navigator.clipboard.writeText(mission.prompt); setFeedback('Промпт скопирован') }
    catch { setFeedback('Выдели и скопируй текст вручную') }
  }
  const mark = () => {
    if (!selected || !missionAvailable(selected, today)) return
    const fresh = memoryOnly ? done : readSeasonProgress(localSeasonStorage(), key)
    const next = fresh.includes(selected) ? fresh.filter(d => d !== selected) : [...new Set([...fresh, selected])]
    setDone(next)
    const saved = saveSeasonProgress(localSeasonStorage(), key, next)
    setMemoryOnly(!saved)
    setFeedback(saved ? 'Отметка сохранена на этом устройстве.' : 'Хранилище недоступно. Отметка сохранена только до закрытия экрана.')
  }
  if (archive) return <><AdventScreen/><Tap onClick={() => setArchive(false)} className="absolute right-4 z-40 rounded-full bg-card px-4 py-3 text-sm" style={{ top: 'calc(var(--top) + 10px)' }}>Новый сезон</Tap></>
  const cells: AdventCell[] = missions.map((m, i) => ({ day: i + 1, title: m.title, xp: 0, kind: 'story', emoji: '🎁', state: !missionAvailable(m.date, today) ? 'locked' : done.includes(m.date) ? 'open' : m.date === today ? 'today' : 'late' }))
  return <motion.div {...slide} className={`${slide.className} ${theme.className}`}>
    <div ref={scroller} className="scroll h-full" style={{ paddingBottom: 'calc(48px + var(--bottom))' }}>
      <div className="relative overflow-hidden px-5 pb-20" style={{ background: theme.hero, color: theme.ink, paddingTop: 'calc(var(--top) + 58px)' }}>
        <ThemeScene theme="newyear"/>
        <div className="relative">
          <p className="w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: theme.chip }}>{mission ? `Подарок ${dates.indexOf(mission.date) + 1} из 53` : day > 0 ? `День ${day} из 53` : today < ADVENT_START ? 'Старт 14 ноября' : 'Все подарки доступны'}</p>
          <h1 className="mt-3 max-w-[85%] font-display text-[27px] font-semibold leading-[1.1] drop-shadow-[0_2px_10px_rgb(0_0_0_/_0.35)]">{mission?.title ?? 'Новогодний AI-адвент'}</h1>
          <p className="mt-4 text-[13px] font-semibold">{mission ? `${mission.date.split('-').reverse().join('.')} · ${mission.minutes} мин` : `14 ноября - 5 января · выполнено ${done.filter(d => missionAvailable(d, today)).length} из 53`}</p>
        </div>
      </div>
      <div className="relative -mt-7 rounded-t-[30px] bg-bg px-5 pt-6">
        {!mission ? <>
          <div className="grid grid-cols-4 gap-2.5">{cells.map((cell, i) => <DoorCell key={missions[i].date} cell={cell} index={i} theme="newyear" needTicket={false} onNeedTicket={() => {}} completedLabel="Сделано" onOpen={() => { setSelected(missions[i].date); setFeedback('') }} onLocked={() => setFeedback(`Подарок откроется ${missions[i].date.split('-').reverse().join('.')} в 00:00 UTC+5`)}/>)}</div>
          <p className="mt-3 text-center text-xs text-faint">Каждый день новый подарок. Пропущенные задания доступны без билета.</p>
          <Tap onClick={() => setArchive(true)} className="mt-5 min-h-11 w-full rounded-2xl border border-line px-4 text-sm">Архив прежнего календаря и награды</Tap>
        </> : <>
          <p className="text-sm text-mute">{mission.teaser}</p>
          <ol className="mt-5 space-y-4">{mission.body.map((step, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="font-bold text-violet">{i + 1}.</span><span>{step}</span></li>)}</ol>
          <div className="mt-5 rounded-[24px] border border-line bg-card p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Промпт в дело</h2><Tap aria-label="Копировать промпт" className="grid h-11 w-11 place-items-center" onClick={() => { void copy() }}><Copy size={18}/></Tap></div><p className="select-text whitespace-pre-wrap text-sm leading-relaxed">{mission.prompt}</p></div>
          <h2 className="mt-5 font-semibold">Твой результат</h2><p className="mt-2 text-sm leading-relaxed">{mission.deliverable}</p>
          <h2 className="mt-4 font-semibold">Проверь себя</h2><p className="mt-2 text-sm leading-relaxed text-mute">{mission.check}</p>
          <details className="mt-4 rounded-2xl border border-line p-4"><summary className="min-h-7 cursor-pointer font-semibold">Усложни задачу</summary><p className="mt-3 text-sm">{mission.advanced}</p></details>
          <Tap onClick={mark} aria-pressed={completed} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet p-3 font-semibold text-on-violet"><Check size={18}/>{completed ? 'Выполнено · снять отметку' : 'Задание выполнено'}</Tap>
        </>}
        <p role="status" aria-live="polite" className="mt-3 text-sm text-mute">{feedback}</p>
        <p className="mt-4 text-xs leading-relaxed text-faint">Учебный сезон. Отметки только на этом устройстве, без синхронизации и начисления XP или призов. Старые открытия и награды не изменены. Даты открываются по часам устройства, UTC+5.</p>
      </div>
    </div>
    <Tap onClick={() => mission ? setSelected(null) : pop()} aria-label={mission ? 'К календарю' : 'Назад'} className="absolute left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md" style={{ top: 'calc(var(--top) + 10px)' }}><ChevronLeft size={22}/></Tap>
  </motion.div>
}
