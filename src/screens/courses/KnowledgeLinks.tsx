import {ArrowUpRight,Lightbulb} from 'lucide-react'
import type {CourseGuide} from '../../lib/knowledge'
import {useStore} from '../../store'
import {Tap} from '../../ui'
export function KnowledgeLinks({guides,title='Разобрать тему по шагам'}:{guides:CourseGuide[];title?:string}){
 const push=useStore(s=>s.push)
 if(!guides.length)return null
 return <section aria-label={title} className="mt-6 rounded-2xl border border-line bg-card p-5"><h2 className="flex items-center gap-2 text-base font-semibold"><Lightbulb size={18} className="text-violet"/>{title}</h2><p className="mb-3 mt-2 text-xs leading-relaxed text-mute">Публикация даёт идею. Курс помогает освоить приём и проверить себя на практике.</p>{guides.map(guide=><Tap key={guide.code} onClick={()=>push({type:'learning',path:`/courses/${guide.code}`})} className="flex min-h-16 w-full items-start gap-3 border-b border-line py-4 text-left last:border-0"><span className="min-w-0 flex-1"><b className="block text-sm">{guide.plainTitle}</b><span className="mt-1 block text-xs leading-relaxed text-mute">{guide.outcome}</span><span className="mt-2 block text-xs text-violet">Попробуй: {guide.tryNow}</span></span><ArrowUpRight size={18} className="shrink-0 text-violet"/></Tap>)}</section>
}
