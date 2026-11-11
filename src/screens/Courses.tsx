import { ArrowLeft, BookOpen } from 'lucide-react'
import { lazy,Suspense,useEffect,useRef } from 'react'
import { LearningProvider } from '../lib/learning-scope'
import { learningPath,learningUrl } from '../lib/learning-entry'
import { useStore } from '../store'
import { backWithinApp } from '../lib/app-navigation'
import { Tap } from '../ui'
import { OGPractice } from './home/OGPractice'
import { FreeStart } from './home/FreeStart'
import { Empty,useAcademy } from './academy/shared'
import '../academy.css'

// Free discovery and OG offers do not need to load the separate Academy editor or books.
const CourseCatalog=lazy(()=>import('./courses/Catalog').then(module=>({default:module.CourseCatalog})))
const CourseMaterial=lazy(()=>import('./courses/Material').then(module=>({default:module.CourseMaterial})))
const CourseProgram=lazy(()=>import('./courses/Program').then(module=>({default:module.CourseProgram})))
const Lesson=lazy(()=>import('./academy/Learning').then(module=>({default:module.Lesson})))
const MyLearning=lazy(()=>import('./academy/Learning').then(module=>({default:module.MyLearning})))
const Admin=lazy(()=>import('./academy/Admin').then(module=>({default:module.Admin})))
const Library=lazy(()=>import('./academy/Catalog').then(module=>({default:module.Library})))

export function MainCoursesTab(){
 const push=useStore(s=>s.push)
 return <LearningProvider demo={false}><div className="scroll h-full px-5" data-tab-scroll style={{paddingTop:'calc(var(--top) + 20px)',paddingBottom:'calc(110px + var(--bottom))'}}><OGPractice path="/og-practice" go={path=>push({type:'learning',path})}/></div></LearningProvider>
}
export function CoursesScreen({path}:{path?:string}){return <LearningProvider demo={false}><CourseWindow initialPath={path}/></LearningProvider>}
function CourseWindow({initialPath}:{initialPath?:string}){
 const path=learningPath(initialPath||'/og-practice',false)||'/og-practice'
 const scroller=useRef<HTMLElement>(null)
 const parts=path.split('/').filter(Boolean),area=parts[0]
 let code='';try{code=decodeURIComponent(parts[1]||'')}catch{code=parts[1]||''}
 const permissions=useAcademy('permissions',{},area==='admin')
 function go(next:string){if(next===path)return;useStore.setState(s=>({stack:s.stack.map((o,i)=>i===s.stack.length-1&&o.type==='learning'?{...o,path:learningUrl(next,false)}:o)}))}
 function back(){backWithinApp(()=>{
  const parent=area==='start'?(parts[1]?'/start':null):area==='og-practice'?(parts[2]?`/og-practice/${parts[1]}`:parts[1]?'/og-practice':null):null
  const course=/^(.+)-M\d+-L\d+/.exec(code)?.[1]
  if(parent)go(parent)
  else if((area==='lessons'||area==='assessments'||area==='read')&&course)go(`/courses/${course}`)
  else useStore.getState().pop()
 })}
 useEffect(()=>{const listener=()=>back();window.addEventListener('og:courses-back',listener);return()=>window.removeEventListener('og:courses-back',listener)})
 useEffect(()=>{scroller.current?.scrollTo({top:0});scroller.current?.focus({preventScroll:true})},[path])
 const title=area==='start'?'Бесплатный старт':area==='og-practice'?'Платные курсы':area==='lessons'||area==='assessments'||area==='read'?'Урок курса':area==='my-learning'||area==='projects'?'Моё обучение':area==='admin'?'Управление курсами':'Курсы'
 return <section className="og-course-screen academy absolute inset-0 z-30 flex flex-col bg-bg" aria-label="Курсы OG CRE8R">
  <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 pb-3" style={{paddingTop:'calc(var(--top) + 12px)'}}><Tap onClick={back} aria-label="Назад" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><ArrowLeft size={21}/></Tap><p className="flex-1 font-display text-base font-semibold">{title}</p>{area!=='og-practice'&&area!=='start'&&<Tap onClick={()=>go('/my-learning')} aria-label="Моё обучение" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><BookOpen size={20}/></Tap>}</header>
  <main ref={scroller} tabIndex={-1} key={path} className="scroll min-h-0 flex-1 px-5 py-5" style={{paddingBottom:'calc(32px + var(--bottom))'}}>
   <Suspense fallback={<p role="status" className="py-5 text-sm text-mute">Загружаем материалы…</p>}>{area==='start'?<FreeStart path={path} go={go}/>:area==='og-practice'?<OGPractice path={path} go={go}/>:area==='courses'&&code?<CourseProgram code={code} go={go}/>:area==='read'&&code?<CourseMaterial code={code} go={go}/>:['lessons','assessments'].includes(area)&&code?<Lesson code={code} go={go}/>:area==='my-learning'||area==='projects'?<MyLearning go={go} projectId={area==='projects'?code:undefined}/>:area==='admin'?<Admin section={code} permissions={permissions.data}/>:area==='library'?<Library/>:area==='videos'?<Empty title="Демовидео убраны">Тексты, иллюстрации и практика находятся в уроках курса.</Empty>:area==='catalog'||area==='directions'?<CourseCatalog directionCode={area==='directions'?code:undefined} go={go}/>:<OGPractice path="/og-practice" go={go}/>}</Suspense>
  </main>
 </section>
}
