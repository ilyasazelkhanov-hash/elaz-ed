import { ArrowRight, Sparkles } from 'lucide-react'
import { useStore } from '../../store'
import { Tap } from '../../ui'

/** OG's own practical learning path. Client Academy programs stay in their separate workspace. */
export function MainCourses(){
 const push=useStore(s=>s.push)
 const courses=useStore(s=>s.courses)
 const feed=useStore(s=>s.feed)
 const course=courses.find(c=>c.access && c.done>0 && c.done<c.lessons && feed.some(l=>l.course_id===c.id && !l.completed))
 const next=course && feed.filter(l=>l.course_id===course.id && !l.completed).sort((a,b)=>a.position-b.position||a.id-b.id)[0]
 return <section aria-label="Курсы">
  <div className="mb-3 flex items-center justify-between px-5"><h2 className="font-display text-lg font-semibold">Обучение OG</h2><span className="text-xs text-mute">практика по шагам</span></div>
  <div className="px-5 pb-4"><Tap onClick={()=>next?push({type:'lesson',id:next.id}):push({type:'learning',path:'/og-practice'})} className="relative block min-h-48 w-full overflow-hidden rounded-[28px] border border-violet/20 bg-gradient-to-br from-violet/20 via-card to-mint/10 p-5 text-left"><span className="absolute -right-7 -top-8 h-36 w-36 rounded-full bg-violet/10 blur-2xl" aria-hidden="true"/><span className="relative"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet"><Sparkles size={15}/>{next?'Продолжить обучение':'Своя программа'}</span><b className="mt-3 block max-w-xs font-display text-[22px] leading-tight">{next?next.title:'ИИ на практике: от идеи до готового результата'}</b><span className="mt-2 block max-w-sm text-sm leading-relaxed text-mute">{course&&next?`${course.title} · ${course.done} из ${course.lessons} уроков пройдено · ${next.minutes} мин`:'Короткие маршруты по тексту, дизайну, видео и автоматизации. Открой тему и сразу переходи к заданию.'}</span><span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-4 text-sm font-semibold text-white">{next?'Открыть урок':'Выбрать тему'}<ArrowRight size={16}/></span></span></Tap></div>
 </section>
}
