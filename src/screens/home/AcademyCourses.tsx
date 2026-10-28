import { ChevronRight } from 'lucide-react'
import courses from '../../../content/ai-academy/course-directory.json'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { SectionTitle } from './parts'

/** Primary course catalog; legacy products stay in the administrator tools. */
export function MainCourses() {
  const push = useStore(s => s.push)
  const open = (path = '/courses') => push({ type: 'learning', path })
  return <section aria-label="Курсы">
    <div className="flex items-center justify-between pr-5"><SectionTitle count={courses.length}>Курсы</SectionTitle><div className="mt-6 flex items-center gap-3"><Tap className="flex items-center gap-1 text-xs font-semibold text-violet" onClick={() => open()}>Все курсы<ChevronRight size={15}/></Tap></div></div>
    <p className="mx-5 mb-4 text-[12px] leading-relaxed text-mute">От первых шагов с ИИ до своего проекта. Выбери курс — внутри программа, примеры и подсказки.</p>
    <div className="no-bar -mb-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-5">
      {courses.map(course => <Tap key={course.code} onClick={() => open(`/courses/${course.code}`)} className="flex w-[82%] shrink-0 snap-start flex-col overflow-hidden rounded-[26px] border border-line bg-card text-left" aria-label={`Открыть курс ${course.title}`}>
        <img src={`/learning/academy/${course.code.split('-')[0].toLowerCase()}.svg`} alt="" loading="lazy" width={720} height={360} className="aspect-[2/1] w-full object-cover"/>
        <span className="flex flex-1 flex-col p-4"><span className="text-[10px] font-semibold uppercase tracking-wider text-violet">{course.code} · {course.data.level || 'Core'}</span><b className="mt-2 block font-display text-[15px] leading-snug">{course.title}</b><span className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-mute">{course.data.outcome}</span><span className="mt-4 flex items-center justify-between text-[11px] font-semibold text-violet"><span>4 модуля · 16 занятий</span><span>Открыть курс →</span></span></span>
      </Tap>)}
    </div>
    <Tap className="mx-5 mt-4 text-xs text-mute underline" onClick={()=>push({type:'academy',path:'/academy'})}>Попробовать демо Академии</Tap>
  </section>
}
