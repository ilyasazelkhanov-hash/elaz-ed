import { Search, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { useAcademy, FetchState } from '../academy/shared'
import type { AcademyEntity } from '../../lib/academy-types'
import { LearningCourseCard,courseTopic } from './CourseCard'
import {CoursePathway} from './CoursePathway'
import {matchesCourseLevel,orderedPathwayCourses} from '../../lib/course-pathways'

export function CourseCatalog({directionCode,go}:{directionCode?:string;go:(path:string)=>void}){
 const resource=useAcademy('catalog',{limit:100}),user=useStore(s=>s.me?.id??0)
 const [q,setQ]=useState(''),[topic,setTopic]=useState('Все'),[level,setLevel]=useState('all')
 const allCourses:AcademyEntity[]=resource.data?.courses||[]
 const courses=orderedPathwayCourses(allCourses.filter(c=>!directionCode||c.parent_code===directionCode))
 const directions=[...new Set(allCourses.filter(c=>c.parent_code).map(c=>c.parent_code!))].map(code=>({id:code,label:courseTopic(`${code}-101`)}))
 const topics=['Все',...new Set(courses.map(c=>courseTopic(c.code)))]
 const found=courses.filter(c=>(topic==='Все'||courseTopic(c.code)===topic)&&matchesCourseLevel(c,level)&&`${c.title} ${c.code} ${c.data.outcome||''}`.toLowerCase().includes(q.trim().toLowerCase()))
 return <section data-course-catalog>
  <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[28px] font-semibold">Курсы</h1><Tap onClick={()=>go('/my-learning')} className="min-h-11 rounded-full border border-line bg-card px-4 text-xs font-semibold text-violet">Моё обучение</Tap></div>
  <p className="mb-5 mt-2 text-sm leading-relaxed text-mute">Подбери порядок под свой опыт или выбери курс из полного списка.</p>
  {resource.data&&!resource.loading&&!resource.error&&<CoursePathway key={`academy:${user}:${directionCode||''}`} scope={`academy:${user}:${directionCode||''}`} mode="academy" courses={allCourses} directions={directions} directionCode={directionCode} go={go}/>}
  <h2 className="mb-3 font-display text-lg font-semibold">Все программы{directionCode?' направления':''}</h2>
  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск курсов" placeholder="Какой навык хочешь освоить?" value={q} onChange={e=>setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/>{q&&<Tap aria-label="Очистить поиск курсов" onClick={()=>setQ('')} className="grid h-11 w-11 place-items-center"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1">{topics.map(t=><Tap key={t} aria-pressed={topic===t} onClick={()=>setTopic(t)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${topic===t?'border-violet bg-violet/10 text-violet':'border-line bg-card text-mute'}`}>{t}</Tap>)}</div>
  <div className="no-bar mb-4 flex gap-2 overflow-x-auto" aria-label="Уровень курса">{[['all','Все уровни'],['start','С нуля'],['practice','Есть опыт'],['deep','Углубление']].map(([id,label])=><Tap key={id} aria-pressed={level===id} onClick={()=>setLevel(id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs ${level===id?'border-violet text-violet':'border-line text-mute'}`}>{label}</Tap>)}</div>
  <FetchState {...resource}/>
  {resource.data?.preview_only&&<p role="status" className="mb-4 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-mute">Материалы курсов уже доступны для чтения. Проверки работ и зачёт подключаются отдельно.</p>}
  {resource.data&&!resource.loading&&!resource.error&&(found.length?<div className="grid gap-4 md:grid-cols-2">{found.map(course=><LearningCourseCard key={course.code} course={course} onClick={()=>go(`/courses/${course.code}`)}/>)}</div>:<div className="rounded-2xl border border-dashed border-line p-6 text-center"><p>По этому запросу курсов нет.</p><Tap onClick={()=>{setQ('');setTopic('Все');setLevel('all')}} className="mt-3 min-h-11 text-violet">Сбросить поиск и фильтры</Tap></div>)}
 </section>
}
