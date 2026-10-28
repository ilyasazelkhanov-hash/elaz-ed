import { ArrowRight } from 'lucide-react'
import { GRADIENTS } from '../../lib/game'
import type { AcademyEntity } from '../../lib/academy-types'
import type { GradientName } from '../../lib/types'
import { CourseArtwork } from './CourseArtwork'
import { Tap } from '../../ui'
const themes:Record<string,GradientName>={CORE:'aurora',VC:'ocean',ENG:'mint',AU:'sunset',AG:'candy',CR:'candy',DS:'mint',MK:'sunset',DT:'ocean',BI:'lime'}
export const courseGradient=(code:string)=>({...GRADIENTS[themes[code.split('-')[0]]||'aurora'],ink:'#16122b'})
export const courseTopic=(code:string)=>({CORE:'С чего начать',VC:'Создание приложений',ENG:'Разработка',AU:'Автоматизация',AG:'AI-помощники',CR:'Контент',DS:'Дизайн',MK:'Маркетинг',DT:'Данные',BI:'Бизнес'} as Record<string,string>)[code.split('-')[0]]||'Обучение'
export function LearningCourseCard({course,onClick,compact=false}:{course:AcademyEntity;onClick:()=>void;compact?:boolean}){
 const g=courseGradient(course.code)
 return <Tap onClick={onClick} aria-label={`Открыть курс ${course.title}`} className={`block overflow-hidden rounded-[28px] border border-line text-left ${compact?'w-[84%] shrink-0 snap-start':'w-full'}`}>
  <CourseArtwork code={course.code}/>
  <div className="p-5" style={{background:g.css,color:g.ink}}><span className="rounded-full bg-white/25 px-3 py-1.5 text-xs font-semibold">{courseTopic(course.code)}</span><h3 className="mt-3 font-display text-[19px] font-semibold leading-tight">{course.title}</h3><span className="mt-5 flex items-center justify-between gap-2 text-xs font-semibold"><span>4 модуля · 16 уроков</span><span className="flex items-center gap-1">Открыть<ArrowRight size={15}/></span></span></div>
 </Tap>
}
