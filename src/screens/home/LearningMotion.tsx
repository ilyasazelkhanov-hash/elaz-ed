import {useEffect, useRef, type ReactNode} from 'react'
import {bindEditorialReveal, bindLearningScene} from '../../lib/editorial-motion'
import './learning-motion.css'

/** An abstract, bounded illustration of the learning workflow, not online agents. */
export function LearningScene() {
 const ref = useRef<HTMLDivElement>(null)
 useEffect(() => ref.current ? bindLearningScene(ref.current) : undefined, [])
 return <div ref={ref} className="learning-scene" role="img" aria-label="Учебный маршрут: сформулировать запрос, проверить ответ, собрать свой проект">
  <div aria-hidden="true" className="learning-scene-track"><span>Запрос</span><i/><span>Проверка</span><i/><span>Проект</span></div>
  <div aria-hidden="true" className="learning-scene-cursors">
   <span className="learning-scene-cursor learning-scene-cursor-author"><Cursor/><b>ты</b></span>
   <span className="learning-scene-cursor learning-scene-cursor-review"><Cursor/><b>проверка</b></span>
   <span className="learning-scene-result">✓</span>
  </div>
 </div>
}

function Cursor() { return <svg viewBox="0 0 20 24" fill="currentColor"><path d="M2 2 18 11 11 13 7 21Z" stroke="var(--color-card)" strokeWidth="1.5" strokeLinejoin="round"/></svg> }

export function EditorialCards({children, revision}: {children: ReactNode; revision: string}) {
 const ref = useRef<HTMLDivElement>(null)
 useEffect(() => ref.current ? bindEditorialReveal(ref.current) : undefined, [revision])
 return <div ref={ref} className="grid gap-4 editorial-cards">{children}</div>
}
