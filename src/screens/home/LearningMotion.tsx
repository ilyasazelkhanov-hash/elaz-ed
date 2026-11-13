import {useEffect, useRef, useState, type ReactNode} from 'react'
import {bindEditorialReveal, bindLearningScene} from '../../lib/editorial-motion'
import {Pause, Play} from 'lucide-react'
import './learning-motion.css'

/** An abstract, bounded illustration of the learning workflow, not online agents. */
export function LearningScene() {
 const ref = useRef<HTMLDivElement>(null)
 const [paused, setPaused] = useState(false)
 useEffect(() => ref.current ? bindLearningScene(ref.current) : undefined, [])
 return <div className="learning-scene-shell">
 <div ref={ref} data-user-paused={paused} className="learning-scene" role="img" aria-label="Учебный маршрут: сформулировать запрос, проверить ответ, собрать свой проект">
  <div aria-hidden="true" className="learning-scene-board">
   <div className="learning-scene-guide"/>
   <div className="learning-scene-module learning-scene-module-idea"><span className="learning-scene-kicker">Идея</span><div className="learning-scene-wire"><i/><i/><i/></div></div>
   <div className="learning-scene-module learning-scene-module-build"><span className="learning-scene-kicker">Практика</span><div className="learning-scene-tiles"><i/><i/><i/><i/></div></div>
   <div className="learning-scene-module learning-scene-module-result"><span className="learning-scene-kicker">Результат</span><div className="learning-scene-output"><i/><span>✓</span><i/></div></div>
   <span className="learning-scene-cursor learning-scene-cursor-author"><Cursor/><b>идея</b></span>
   <span className="learning-scene-cursor learning-scene-cursor-review"><Cursor/><b>сборка</b></span>
   <span className="learning-scene-cursor learning-scene-cursor-finish"><Cursor/><b>готово</b></span>
  </div>
 </div>
 <button type="button" className="learning-scene-toggle" aria-label={paused ? 'Продолжить анимацию маршрута' : 'Приостановить анимацию маршрута'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} aria-hidden="true"/> : <Pause size={14} aria-hidden="true"/>}</button>
 </div>
}

function Cursor() { return <svg viewBox="0 0 20 24" fill="currentColor"><path d="M2 2 18 11 11 13 7 21Z" stroke="var(--color-card)" strokeWidth="1.5" strokeLinejoin="round"/></svg> }

export function EditorialCards({children, revision}: {children: ReactNode; revision: string}) {
 const ref = useRef<HTMLDivElement>(null)
 useEffect(() => ref.current ? bindEditorialReveal(ref.current) : undefined, [revision])
 return <div ref={ref} className="grid gap-4 editorial-cards">{children}</div>
}
