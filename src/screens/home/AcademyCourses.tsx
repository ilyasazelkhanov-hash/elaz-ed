import { ArrowUpRight, BookOpen } from 'lucide-react'
import { ogPracticeCourses } from '../../lib/og-practice'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import './free-first.css'

/** Free reading comes first; a paid program is an explicit next step. */
export function MainCourses() {
  const push = useStore(s => s.push)
  const total = ogPracticeCourses.reduce((sum, course) => sum + course.lessons.length, 0)
  return <section aria-label="Курсы" className="reader-course mx-5 rounded-[26px] border border-violet/20 p-5">
    <p className="reader-eyebrow flex items-center gap-2 text-violet"><BookOpen size={15}/>Платные курсы OG</p>
    <h2 className="mt-3 font-display text-[21px] font-semibold leading-snug tracking-tight">Хочешь освоить навык системно?</h2>
    <p className="mt-3 text-base leading-relaxed text-mute">Отдельные программы с последовательными уроками, заданиями и своим проектом. Выбирай направление, когда будешь готов идти глубже.</p>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Направления курсов">{['Основы ИИ', 'Тексты', 'Изображения и видео', 'Код', 'Автоматизация'].map(label => <span key={label} className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-mute">{label}</span>)}</div>
    <p className="mt-4 text-sm text-mute">{ogPracticeCourses.length} курсов · {total} уроков · первый урок для знакомства</p>
    <Tap onClick={() => push({ type: 'learning', path: '/og-practice' })} className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-violet/30 bg-violet/10 px-4 text-base font-semibold text-violet">Посмотреть программы<ArrowUpRight size={19}/></Tap>
  </section>
}
