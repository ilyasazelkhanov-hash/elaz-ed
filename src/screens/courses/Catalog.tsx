import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { useAcademy, FetchState } from '../academy/shared'
import type { AcademyEntity } from '../../lib/academy-types'
import { LearningCourseCard,courseTopic } from './CourseCard'

export function CourseCatalog({directionCode}:{directionCode?:string}){
 const resource=useAcademy('catalog',{limit:100}),push=useStore(s=>s.push)
 const [q,setQ]=useState(''),[topic,setTopic]=useState('Все')
 const courses:AcademyEntity[]=(resource.data?.courses||[]).filter((c:AcademyEntity)=>!directionCode||c.parent_code===directionCode)
 const topics=['Все',...new Set(courses.map(c=>courseTopic(c.code)))]
 const found=courses.filter(c=>(topic==='Все'||courseTopic(c.code)===topic)&&`${c.title} ${c.code} ${c.data.outcome||''}`.toLowerCase().includes(q.trim().toLowerCase()))
 return <section data-course-catalog>
  <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[28px] font-semibold">Курсы</h1><Tap onClick={()=>push({type:'learning',path:'/courses/my-learning'})} className="min-h-11 rounded-full border border-line bg-card px-4 text-xs font-semibold text-violet">Моё обучение</Tap></div>
  <p className="mb-5 mt-2 text-sm leading-relaxed text-mute">Выбери курс, открой программу и начни с первого урока.</p>
  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск курсов" placeholder="Какой навык хочешь освоить?" value={q} onChange={e=>setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/>{q&&<Tap aria-label="Очистить поиск курсов" onClick={()=>setQ('')} className="grid h-11 w-11 place-items-center"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1">{topics.map(t=><Tap key={t} aria-pressed={topic===t} onClick={()=>setTopic(t)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${topic===t?'border-violet bg-violet/10 text-violet':'border-line bg-card text-mute'}`}>{t}</Tap>)}</div>
  <FetchState {...resource}/>
  {resource.data?.preview_only&&<p role="status" className="mb-4 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-mute">Материалы курсов уже доступны для чтения. Проверки работ и зачёт подключаются отдельно.</p>}
  {resource.data&&!resource.loading&&!resource.error&&(found.length?<div className="grid gap-4 md:grid-cols-2">{found.map(course=><LearningCourseCard key={course.code} course={course} onClick={()=>push({type:'learning',path:`/courses/${course.code}`})}/>)}</div>:<div className="rounded-2xl border border-dashed border-line p-6 text-center"><p>По этому запросу курсов нет.</p><Tap onClick={()=>{setQ('');setTopic('Все')}} className="mt-3 min-h-11 text-violet">Сбросить поиск и фильтр</Tap></div>)}
 </section>
}
