import { ArrowRight, Sparkles } from 'lucide-react'
import { useStore } from '../../store'
import { Tap } from '../../ui'

/** OG's own practical learning path. Client Academy programs stay in their separate workspace. */
export function MainCourses(){
 const push=useStore(s=>s.push)
 return <section aria-label="Курсы">
  <div className="mb-3 flex items-center justify-between px-5"><h2 className="font-display text-lg font-semibold">Обучение OG</h2><span className="text-xs text-mute">практика по шагам</span></div>
  <div className="px-5 pb-4"><Tap onClick={()=>push({type:'learning',path:'/og-practice'})} className="relative block min-h-48 w-full overflow-hidden rounded-[28px] border border-violet/20 bg-gradient-to-br from-violet/20 via-card to-mint/10 p-5 text-left"><span className="absolute -right-7 -top-8 h-36 w-36 rounded-full bg-violet/10 blur-2xl" aria-hidden="true"/><span className="relative"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet"><Sparkles size={15}/>Своя программа</span><b className="mt-3 block max-w-xs font-display text-[22px] leading-tight">ИИ на практике: от идеи до готового результата</b><span className="mt-2 block max-w-sm text-sm leading-relaxed text-mute">Короткие маршруты по тексту, дизайну, видео и автоматизации. Открой тему и сразу переходи к заданию.</span><span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-4 text-sm font-semibold text-white">Выбрать тему<ArrowRight size={16}/></span></span></Tap></div>
 </section>
}
