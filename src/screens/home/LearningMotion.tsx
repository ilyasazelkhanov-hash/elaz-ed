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
  <div aria-hidden="true" className="learning-scene-track"><span>Запрос</span><i/><span>Проверка</span><i/><span>Проект</span></div>
  <div aria-hidden="true" className="learning-scene-cursors">
   <span className="learning-scene-cursor learning-scene-cursor-author"><Cursor/><b>ты</b></span>
   <span className="learning-scene-cursor learning-scene-cursor-review"><Cursor/><b>проверка</b></span>
   <span className="learning-scene-result">✓</span>
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
