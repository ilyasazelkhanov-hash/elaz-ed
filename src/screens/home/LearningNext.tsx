import { ArrowRight, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isDemo } from '../../lib/api'
import { practiceGoals, readPathwayChoice, writePathwayChoice, type PathwayChoice } from '../../lib/course-pathways'
import { learningNextStep, learningScope, readFreeAttempts, readLastFreeGuide } from '../../lib/learning-next'
import { readPracticeProgress, subscribePracticeProgress } from '../../lib/og-practice'
import { useStore } from '../../store'
import { Tap } from '../../ui'

/** One next action; existing screens remain the authority for access and completion. */
export function LearningNext() {
 const user = useStore(s => s.me?.id ?? 0)
 return <LearningNextSession key={learningScope(user, isDemo)} user={user}/>
}
function LearningNextSession({user}: {user: number}) {
 const scope = learningScope(user, isDemo)
 const courses = useStore(s => s.courses), feed = useStore(s => s.feed), stack = useStore(s => s.stack), push = useStore(s => s.push)
 const [choice, setChoice] = useState(() => readPathwayChoice(scope))
 const [, refresh] = useState(0)
 useEffect(() => {
  const update = () => {setChoice(readPathwayChoice(scope)); refresh(n => n + 1)}
  update()
  const unsubscribe = subscribePracticeProgress({userId: user, mode: isDemo ? 'demo' : 'live'}, update)
  window.addEventListener('storage', update)
  return () => {unsubscribe(); window.removeEventListener('storage', update)}
 }, [scope, user, stack.length])
 const change = (patch: Partial<PathwayChoice>) => {const value = {...choice, ...patch}; setChoice(value); writePathwayChoice(scope, value)}
 const next = learningNextStep({choice, courses, feed, attempts: readFreeAttempts(user, isDemo), lastFree: readLastFreeGuide(user, isDemo), progress: readPracticeProgress({userId: user, mode: isDemo ? 'demo' : 'live'})})
 return <section className="mx-5 mt-5 rounded-2xl border border-violet/20 bg-card p-4" aria-labelledby="learning-next-title" data-learning-next>
  <p className="text-xs font-semibold text-violet">Следующий учебный шаг</p>
  <h2 id="learning-next-title" className="mt-2 text-base font-semibold leading-snug">{next.title}</h2>
  <p className="mt-2 text-xs leading-relaxed text-mute">{next.detail}</p>
  <Tap className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-violet px-3 py-2 text-left text-sm font-semibold text-on-violet" onClick={() => push({type: 'learning', path: next.path})}>{next.label}<ArrowRight size={18} className="shrink-0" aria-hidden="true"/></Tap>
  <details className="group mt-1">
   <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs text-mute [&::-webkit-details-marker]:hidden">Почему этот шаг · изменить маршрут<ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180"/></summary>
   <p className="text-xs leading-relaxed text-mute">{next.reason}</p>
   <fieldset className="mt-3"><legend className="text-xs font-semibold">Моя точка старта</legend><div className="mt-2 flex flex-wrap gap-2">{([['beginner', 'Начинаю с нуля'], ['experienced', 'Уже есть опыт']] as const).map(([value,label]) => <Tap key={value} aria-pressed={choice.audience === value} onClick={() => change({audience: value})} className={`min-h-11 rounded-xl border px-3 text-xs ${choice.audience === value ? 'border-violet text-violet' : 'border-line text-mute'}`}>{label}</Tap>)}</div></fieldset>
   <label className="mt-3 block text-xs font-semibold">Моя цель<select className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-card px-3 text-sm font-normal" value={practiceGoals.some(goal => goal.id === choice.goal) ? choice.goal : ''} onChange={event => change({goal: event.target.value})}><option value="">Пока выбираю</option>{practiceGoals.map(goal => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select></label>
   <Tap className="mt-2 min-h-11 text-left text-xs font-semibold text-violet" onClick={() => push({type: 'learning', path: '/start'})}>Выбрать другой бесплатный разбор</Tap>
   <p className="text-xs leading-relaxed text-mute">Маршрут и место чтения хранятся на этом устройстве. Выбор опыта и отметка «попробовал» не подтверждают навык и не открывают платный доступ.</p>
  </details>
 </section>
}
