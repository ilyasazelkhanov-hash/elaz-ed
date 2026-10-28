import { ArrowLeft, BookOpen } from 'lucide-react'
import { useEffect,useRef,useState } from 'react'
import { LearningProvider } from '../lib/learning-scope'
import { learningPath,learningUrl } from '../lib/learning-entry'
import { useStore } from '../store'
import { Tap } from '../ui'
import { CourseCatalog } from './courses/Catalog'
import { CourseProgram } from './courses/Program'
import { Lesson,MyLearning } from './academy/Learning'
import { Admin } from './academy/Admin'
import { Library } from './academy/Catalog'
import { Empty,useAcademy } from './academy/shared'
import '../academy.css'

export function MainCoursesTab(){return <LearningProvider demo={false}><div className="scroll h-full px-5" data-tab-scroll style={{paddingTop:'calc(var(--top) + 20px)',paddingBottom:'calc(110px + var(--bottom))'}}><CourseCatalog/></div></LearningProvider>}
export function CoursesScreen({path}:{path?:string}){return <LearningProvider demo={false}><CourseWindow initialPath={path}/></LearningProvider>}
function CourseWindow({initialPath}:{initialPath?:string}){
 const [path,setPath]=useState(()=>learningPath(initialPath||location.hash.slice(1),false)),[history,setHistory]=useState<string[]>([])
 const scroller=useRef<HTMLElement>(null),permissions=useAcademy('permissions')
 const parts=path.split('/').filter(Boolean),area=parts[0],code=decodeURIComponent(parts[1]||'')
 const url=(value:string)=>`${location.pathname}${location.search}#${learningUrl(value,false)}`
 function go(next:string){if(next===path)return;setHistory(h=>[...h,path]);setPath(next);window.history.replaceState(null,'',url(next))}
 function close(){const store=useStore.getState();store.pop();store.setTab(store.tab)}
 function back(){
  if(history.length){const previous=history[history.length-1];setHistory(h=>h.slice(0,-1));setPath(previous);window.history.replaceState(null,'',url(previous));return}
  const course=/^(.+)-M\d+-L\d+/.exec(code)?.[1]
  if((area==='lessons'||area==='assessments')&&course){go(`/courses/${course}`);setHistory([])}else close()
 }
 useEffect(()=>{window.history.replaceState(null,'',url(path))},[])
 useEffect(()=>{const listener=()=>back();window.addEventListener('og:courses-back',listener);return()=>window.removeEventListener('og:courses-back',listener)})
 useEffect(()=>{scroller.current?.scrollTo({top:0});scroller.current?.focus({preventScroll:true})},[path])
 useEffect(()=>{const listener=()=>{if(location.hash.startsWith('#/courses')){setPath(learningPath(location.hash,false));setHistory([])}};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener)},[])
 const title=area==='lessons'||area==='assessments'?'Урок курса':area==='my-learning'||area==='projects'?'Моё обучение':area==='admin'?'Управление курсами':'Курсы'
 return <section className="og-course-screen academy absolute inset-0 z-30 flex flex-col bg-bg" aria-label="Курсы OG CRE8R">
  <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 pb-3" style={{paddingTop:'calc(var(--top) + 12px)'}}><Tap onClick={back} aria-label="Назад" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><ArrowLeft size={21}/></Tap><p className="flex-1 font-display text-base font-semibold">{title}</p><Tap onClick={()=>go('/my-learning')} aria-label="Моё обучение" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><BookOpen size={20}/></Tap></header>
  <main ref={scroller} tabIndex={-1} key={path} className="scroll min-h-0 flex-1 px-5 py-5" style={{paddingBottom:'calc(32px + var(--bottom))'}}>
   {area==='courses'&&code?<CourseProgram code={code} go={go}/>:['lessons','assessments'].includes(area)&&code?<Lesson code={code} go={go}/>:area==='my-learning'||area==='projects'?<MyLearning go={go} projectId={area==='projects'?code:undefined}/>:area==='admin'?<Admin section={code} permissions={permissions.data}/>:area==='library'?<Library/>:area==='videos'?<Empty title="Демовидео убраны">Тексты, иллюстрации и практика находятся в уроках курса.</Empty>:<CourseCatalog directionCode={area==='directions'?code:undefined}/>}
  </main>
 </section>
}
