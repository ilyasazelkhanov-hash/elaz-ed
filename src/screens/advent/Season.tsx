import { ArrowLeft, ArrowRight, Check, Copy, Lock, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import missionsData from '../../../content/advent/ai-winter-2026.json'
import { ADVENT_END, ADVENT_START, localSeasonStorage, missionAvailable, readSeasonProgress, saveSeasonProgress, seasonScope, type AdventMission } from '../../lib/advent-season'
import { isDemo } from '../../lib/api'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { AdventBanner } from './Banner'
import { useSeasonToday } from './useSeason'
import { DoorSkin, OpeningLeaf, ThemeScene, themeOf, doorInk } from './themes'
import './season.css'

const missions = missionsData as AdventMission[]
const kindNames: Record<string, string> = { challenge: 'Челлендж', prompt: 'Промпт в дело', experiment: 'Эксперимент', remix: 'Ремикс', audit: 'Проверка на прочность', reflection: 'Перезагрузка' }
const dateLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
export function AdventSeasonScreen() {
  const me = useStore(s => s.me)
  return me ? <Season key={`${isDemo}:${me.id}`} userId={me.id}/> : null
}
function Season({ userId }: { userId: number }) {
  const pop = useStore(s => s.pop)
  const today = useSeasonToday()
  const key = seasonScope(userId, isDemo)
  const [done, setDone] = useState(() => readSeasonProgress(localSeasonStorage(), key))
  const [selected, setSelected] = useState(() => today < ADVENT_START ? ADVENT_START : today > ADVENT_END ? ADVENT_END : today)
  const [revealed, setRevealed] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [memoryOnly, setMemoryOnly] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const mission = missions.find(m => m.date === selected)!
  const available = missionAvailable(selected, today)
  const completed = done.includes(selected)
  const current = missions.indexOf(mission)
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setDone(readSeasonProgress(localSeasonStorage(), key)) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  const pick = (date: string) => { setSelected(date); setRevealed(true); setFeedback(''); requestAnimationFrame(() => { heading.current?.closest('section')?.scrollIntoView({ block: 'start', behavior: 'instant' }); heading.current?.focus({ preventScroll: true }) }) }
  const mark = () => {
    if (!available) return
    const fresh = memoryOnly ? done : readSeasonProgress(localSeasonStorage(), key)
    const next = completed ? fresh.filter(d => d !== selected) : [...new Set([...fresh, selected])]
    setDone(next)
    const saved = saveSeasonProgress(localSeasonStorage(), key, next)
    setMemoryOnly(!saved)
    setFeedback(saved ? (completed ? 'Отметка снята' : 'Сделано. Результат твой, не нейросети.') : 'Сейчас отметка сохранена только до закрытия экрана: хранилище устройства недоступно.')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(mission.prompt); setFeedback('Промпт скопирован. Подставь свои данные без личной информации.') }
    catch { setFeedback('Не получилось скопировать. Выдели текст промпта вручную.') }
  }
  const totalDone = done.filter(d => missionAvailable(d, today)).length
  return <div className="absolute inset-0 z-30 bg-bg advent-newyear">
    <div ref={scroller} className="scroll h-full" style={{ paddingBottom: 'calc(40px + var(--bottom))', paddingTop: 'calc(12px + var(--top))' }}>
      <header className="flex items-center justify-between gap-3 px-5 pb-4"><Tap onClick={pop} aria-label="Назад" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line"><ArrowLeft size={20}/></Tap><span className="text-xs text-mute">14.11.2026 - 05.01.2027</span><Sparkles size={20} className="text-violet" aria-hidden="true"/></header>
      <section className="season-hero mx-5" style={{ background: themeOf('newyear').hero }} aria-label="Новогодний AI-адвент">
        <ThemeScene theme="newyear"/>
        <div className="season-hero-copy"><span className="season-eyebrow">OG CRE8R / НОВЫЙ ГОД</span><h1 className="font-display text-[27px] font-semibold leading-tight">Подарки, которые<br/>прокачивают тебя.</h1><p className="mt-3 text-sm leading-relaxed">Открывай коробки. Забирай идеи, промпты и маленькие AI-приключения до 5 января.</p><div className="mt-4 flex items-center justify-between text-xs"><span>Выполнено: {totalDone} / 53</span><span>UTC+5</span></div><progress className="season-progress mt-2" value={totalDone} max={53} aria-label={`Выполнено ${totalDone} из 53 заданий`}/></div>
      </section>
      <section className="px-5 pt-6" aria-label="Все дни адвента"><h2 className="font-display text-lg font-semibold">Выбери свой подарок</h2><p className="mt-1 text-xs text-mute">Внутри практические задания, не денежные призы. Пропущенные дни остаются открытыми.</p>{['2026-11', '2026-12', '2027-01'].map(month => <div key={month} className="mt-5"><h3 className="mb-3 text-sm text-mute">{month === '2026-11' ? 'Ноябрь · разогреваем магию' : month === '2026-12' ? 'Декабрь · собираем новый год' : 'Январь · забираем в будущее'}</h3><div className="season-grid">{missions.filter(m => m.date.startsWith(month)).map(m => {
          const state = !missionAvailable(m.date, today) ? 'locked' : done.includes(m.date) ? 'open' : m.date === today ? 'today' : 'late'
          return <Tap key={m.date} onClick={() => pick(m.date)} aria-label={`${dateLabel(m.date)}: ${m.title}${state === 'open' ? ', выполнено' : ''}${state === 'locked' ? ', ещё закрыто' : ''}`} aria-pressed={revealed && m.date === selected} className={`season-date ${revealed && m.date === selected ? 'is-selected' : ''}`} style={{ color: doorInk('newyear', state) }}><DoorSkin theme="newyear" state={state} day={missions.indexOf(m) + 1}/><span className="season-gift-number">{Number(m.date.slice(-2))}</span><span className="season-gift-state">{state === 'open' ? <Check size={14}/> : state === 'locked' ? <Lock size={12}/> : m.date === today ? 'Сегодня' : 'Открыть'}</span></Tap>
        })}</div></div>)}</section>
      {revealed && <section key={selected} className="season-unwrapped px-5 pt-5" aria-label="Задание дня">
        {available && <div className="season-opening" aria-hidden="true"><DoorSkin theme="newyear" state="today" day={current + 1}/><span className="season-opening-lid"><OpeningLeaf theme="newyear"/></span></div>}
        <div className="flex items-center justify-between gap-3 text-xs text-mute"><span>{dateLabel(selected)} · день {current + 1}</span><span>{mission.minutes} мин</span></div>
        <h2 ref={heading} tabIndex={-1} className="mt-2 font-display text-[24px] font-semibold leading-tight outline-none">{mission.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">{mission.teaser}</p>
        {!available ? <div className="season-panel mt-5"><Lock size={23} className="text-violet"/><p className="mt-3">Откроется {dateLabel(selected)} в 00:00 по времени Казахстана.</p><p className="mt-2 text-sm text-mute">До этого можно выбрать уже доступный подарок в календаре выше.</p></div> : <>
          <div className="season-panel mt-5"><p className="season-label">{kindNames[mission.kind] || 'Практика'}</p><ol className="mt-3 space-y-3">{mission.body.map((step, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="season-step" aria-hidden="true">{i + 1}</span><span>{step}</span></li>)}</ol></div>
          <div className="season-panel mt-3"><div className="flex items-center justify-between gap-2"><h3 className="season-label">Забери промпт</h3><Tap onClick={copy} className="flex min-h-11 items-center gap-2 text-sm text-violet"><Copy size={16}/>Копировать</Tap></div><p className="select-text whitespace-pre-wrap text-[14px] leading-relaxed">{mission.prompt}</p></div>
          <div className="season-panel mt-3"><h3 className="season-label">Что забираешь с собой</h3><p className="mt-2 text-[15px] leading-relaxed">{mission.deliverable}</p><h3 className="season-label mt-4">Проверка результата</h3><p className="mt-2 text-sm leading-relaxed text-mute">{mission.check}</p></div>
          <details className="season-panel mt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Уже умеешь? Усложни.</summary><p className="mt-2 text-sm leading-relaxed text-mute">{mission.advanced}</p></details>
          <Tap onClick={mark} aria-pressed={completed} className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold ${completed ? 'border border-line bg-card text-ink' : 'bg-violet text-on-violet'}`}><Check size={18}/>{completed ? 'Выполнено · снять отметку' : 'Сделал. Отметить для себя'}</Tap>
        </>}
        <p role="status" aria-live="polite" className="mt-3 text-sm text-mute">{feedback}</p>
        <p className="mt-2 text-xs leading-relaxed text-faint">Отметки хранятся на этом устройстве и могут исчезнуть при очистке браузера. Они не дают XP, призы или зачёт курса. Новое задание открывается в 00:00 UTC+5 по часам устройства.</p>
        <div className="mt-4 flex justify-between gap-3"><Tap disabled={current === 0} onClick={() => pick(missions[current - 1].date)} className="flex min-h-11 items-center gap-2 text-sm disabled:opacity-40"><ArrowLeft size={16}/>Раньше</Tap><Tap disabled={current === missions.length - 1} onClick={() => pick(missions[current + 1].date)} className="flex min-h-11 items-center gap-2 text-sm disabled:opacity-40">Дальше<ArrowRight size={16}/></Tap></div>
      </section>}
      <div className="mt-6"><AdventBanner/></div>
    </div>
  </div>
}
