import { ArrowRight, BookOpen } from 'lucide-react'
import { GRADIENTS } from '../../lib/game'
import type { AcademyEntity } from '../../lib/academy-types'
import type { GradientName } from '../../lib/types'
import { Pattern, Tap } from '../../ui'
const themes:Record<string,GradientName>={CORE:'aurora',VC:'ocean',ENG:'mint',AU:'sunset',AG:'candy',CR:'candy',DS:'mint',MK:'sunset',DT:'ocean',BI:'lime'}
export const courseGradient=(code:string)=>({...GRADIENTS[themes[code.split('-')[0]]||'aurora'],ink:'#16122b'})
export const courseTopic=(code:string)=>({CORE:'С чего начать',VC:'Создание приложений',ENG:'Разработка',AU:'Автоматизация',AG:'AI-помощники',CR:'Контент',DS:'Дизайн',MK:'Маркетинг',DT:'Данные',BI:'Бизнес'} as Record<string,string>)[code.split('-')[0]]||'Обучение'
export function LearningCourseCard({course,onClick,compact=false}:{course:AcademyEntity;onClick:()=>void;compact?:boolean}){
 const g=courseGradient(course.code)
 return <Tap onClick={onClick} aria-label={`Открыть курс ${course.title}`} className={`relative block min-h-[182px] overflow-hidden rounded-[28px] p-5 text-left ${compact?'w-[84%] shrink-0 snap-start':'w-full'}`} style={{background:g.css,color:g.ink}}>
  <Pattern name={themes[course.code.split('-')[0]]||'aurora'} full/>
  <span className="relative flex items-center justify-between gap-2 text-xs font-semibold"><span className="rounded-full bg-white/25 px-3 py-1.5">{courseTopic(course.code)}</span><BookOpen size={20}/></span>
  <h3 className="relative mt-3 font-display text-[19px] font-semibold leading-tight">{course.title}</h3>
  <span className="relative mt-5 flex items-center justify-between gap-2 text-xs font-semibold"><span>4 модуля · 16 уроков</span><span className="flex items-center gap-1">Открыть<ArrowRight size={15}/></span></span>
 </Tap>
}
