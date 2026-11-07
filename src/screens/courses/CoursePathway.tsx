import {ArrowRight, Compass} from 'lucide-react'
import {useId, useState} from 'react'
import {academyPathway, practiceGoals, practicePathway, readPathwayChoice, writePathwayChoice, type PathwayChoice, type PathwayCourse} from '../../lib/course-pathways'
import {Tap} from '../../ui'

type Props = {scope: string; go: (path: string) => void} & ({mode: 'practice'} | {mode: 'academy'; courses: PathwayCourse[]; directions: {id: string; label: string}[]; directionCode?: string})
const control = 'min-h-11 rounded-xl border border-line bg-card px-3 py-2 text-sm'

/** Put the same scope in the React key so an account change resets the in-memory selection. */
export function CoursePathway(props: Props) {
 const id = useId(), [saved, setSaved] = useState(() => readPathwayChoice(props.scope))
 const goals = props.mode === 'practice' ? practiceGoals : props.directions
 const fixedGoal = props.mode === 'academy' ? props.directionCode : undefined
 const choice = {...saved, goal: fixedGoal || (goals.some(goal => goal.id === saved.goal) ? saved.goal : '')}
 const change = (patch: Partial<PathwayChoice>) => {const next = {...choice, ...patch}; setSaved(next); writePathwayChoice(props.scope, next)}
 const steps = props.mode === 'practice' ? practicePathway(choice) : academyPathway(props.courses, choice)
 return <section className="my-5 rounded-[24px] border border-violet/25 bg-violet/5 p-4 sm:p-5" aria-labelledby={`${id}-title`} data-course-pathway>
  <h2 id={`${id}-title`} className="flex items-center gap-2 font-display text-lg font-semibold"><Compass size={21} className="shrink-0 text-violet"/>В каком порядке учиться?</h2>
  <p className="mt-2 text-sm leading-relaxed text-mute">Выбери свою точку старта и нужный результат.</p>
  <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold">Мой опыт</legend><div className="flex flex-wrap gap-2">{([['beginner', 'Начинаю с нуля'], ['experienced', 'Уже есть опыт']] as const).map(([value, label]) => <Tap key={value} aria-pressed={choice.audience === value} onClick={() => change({audience: value})} className={`${control} ${choice.audience === value ? 'border-violet bg-violet/10 font-semibold text-violet' : 'text-mute'}`}>{label}</Tap>)}</div></fieldset>
  {!fixedGoal && <label className="mt-4 block text-xs font-semibold">{props.mode === 'practice' ? 'Что хочу получить' : 'Направление'}<select value={choice.goal} onChange={event => change({goal: event.target.value})} className={`${control} mt-2 block w-full font-normal`}><option value="">Выбрать направление…</option>{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select></label>}
  {props.mode === 'academy' && choice.audience === 'experienced' && <label className="mt-4 block text-xs font-semibold">С какого уровня сравнить программы<select value={choice.entry} onChange={event => change({entry: event.target.value === 'deep' ? 'deep' : 'practice'})} className={`${control} mt-2 block w-full font-normal`}><option value="practice">Практика · Middle</option><option value="deep">Углубление · Senior</option></select></label>}
  <p className="mb-3 mt-4 text-xs leading-relaxed text-mute" role="status">{choice.audience === 'beginner' ? props.mode === 'practice' ? 'Начни с бесплатного разбора. Основы помогут освоиться, затем переходи к выбранному проекту.' : 'Сначала общий фундамент, затем начальный курс выбранного направления и дальнейшая практика.' : props.mode === 'practice' ? 'Сравни программу выбранного курса со своей задачей. Если основы уже знакомы, их можно пропустить.' : 'Опыт не заменяет условия входа: сравни их со своими навыками перед выбором курса.'}</p>
  {steps.length > 0 && <ol className="grid gap-2" aria-label="Рекомендуемый порядок">{steps.map((step, index) => <li key={step.id} className="rounded-2xl border border-line bg-card p-3" data-pathway-step={step.id}>
   <div className="flex items-start gap-3"><span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet/10 text-xs font-semibold text-violet">{index + 1}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wide text-violet">{props.mode === 'practice' ? step.id === 'free-start' ? 'Бесплатно' : 'Платный курс · доступ отдельно' : step.id}</p><h3 className="mt-1 text-sm font-semibold leading-snug">{step.title}</h3><p className="mt-2 text-xs leading-relaxed text-mute">{step.note}</p>{step.requirements && <p className="mt-2 text-xs leading-relaxed"><b>Условия в программе: </b>{step.requirements}</p>}<Tap onClick={() => props.go(step.path)} aria-label={`Открыть: ${step.title}`} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet">{step.id === 'free-start' ? 'Попробовать бесплатно' : 'Смотреть программу'}<ArrowRight size={15}/></Tap></div></div>
  </li>)}</ol>}
  {!choice.goal && <p className="mt-3 text-sm text-mute">Выбери направление, чтобы увидеть {choice.audience === 'beginner' ? 'следующие курсы' : 'подходящие программы'}.</p>}
  {choice.goal && !steps.length && <p role="status" className="mt-3 text-sm text-mute">Для этой точки входа в каталоге пока нет курса. Сравни другие уровни или открой полный список ниже.</p>}
  <p className="mt-4 text-xs leading-relaxed text-mute">Это рекомендация, а не обязательная цепочка. Любую программу можно открыть из списка ниже. Выбор не подтверждает уровень и не открывает доступ к курсам.</p>
 </section>
}
