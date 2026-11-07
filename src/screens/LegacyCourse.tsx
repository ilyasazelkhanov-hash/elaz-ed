import { useEffect, useState } from 'react'
import { practiceKeyForCourse } from '../lib/og-course-access'
import { useStore, type Overlay } from '../store'

type Target = 'checking' | 'hidden' | string

/**
 * The old course screen is admin-only. Buttons across the app (a locked lesson, course cards,
 * the Lab, advent catch-up) still open it by course id. For an OG practice course, send the
 * student to its program, where access is bought or requested; keep the notice only for
 * courses that really were retired.
 */
export function LegacyCourse({ overlay }: { overlay: Extract<Overlay, { type: 'course' }> }) {
  const courses = useStore(s => s.courses)
  const [target, setTarget] = useState<Target>('checking')

  useEffect(() => {
    let alive = true
    // The outline list ships with the courses chunk; load it only when this screen opens.
    void import('../lib/og-practice').then(({ ogPracticeCourses, practicePath }) => {
      if (!alive) return
      const key = practiceKeyForCourse(overlay.id, courses, ogPracticeCourses)
      if (!key) return setTarget('hidden')
      setTarget(key)
      const next: Overlay = { type: 'learning', path: `/courses${practicePath(key)}` }
      // Replace exactly this overlay so Back returns to where the student tapped.
      useStore.setState(s => ({ stack: s.stack.map(item => item === overlay ? next : item) }))
    }).catch(() => { if (alive) setTarget('hidden') })
    return () => { alive = false }
  }, [overlay, courses])

  if (target !== 'hidden') return <div className="absolute inset-0 z-30 bg-bg" aria-busy="true" />
  return <div className="absolute inset-0 z-30 flex flex-col justify-center bg-bg p-6"><h1 className="font-display text-xl">Старый курс скрыт</h1><p className="mt-3 text-sm text-mute">Актуальные материалы находятся в разделе «Курсы». Твои предыдущие результаты сохранены.</p><button className="mt-5 text-violet" onClick={()=>{useStore.getState().pop();useStore.getState().setTab('courses')}}>Открыть курсы →</button></div>
}
