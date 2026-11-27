import { ArrowUpRight, BookOpen } from 'lucide-react'
import { lessonsWord, plural } from '../../lib/game'
import { isDemo } from '../../lib/api'
import { visiblePracticeCourses } from '../../lib/og-practice'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import './free-first.css'

/** Free reading comes first; a paid program is an explicit next step. */
export function MainCourses() {
  const push = useStore(s => s.push)
  const courses = useStore(s => s.courses)
  const visible = visiblePracticeCourses(courses, isDemo)
  const total = visible.reduce((sum, course) => sum + course.lessons.length, 0)
  return <section aria-label="Курсы" className="reader-course mx-5 rounded-[26px] border border-violet/20 p-5">
    <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><BookOpen size={18} className="text-violet"/>Курсы с практикой</h2>
    <p className="mt-2 text-sm leading-relaxed text-mute">{visible.length} {plural(visible.length, ['платная программа', 'платные программы', 'платных программ'])} · {total} {lessonsWord(total)}</p>
    <Tap onClick={() => push({ type: 'learning', path: '/og-practice' })} className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-violet/30 bg-violet/10 px-4 text-base font-semibold text-violet">Посмотреть программы<ArrowUpRight size={19}/></Tap>
  </section>
}
