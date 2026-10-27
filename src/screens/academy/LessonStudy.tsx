import {useEffect,useId,useState,type ReactNode} from 'react'
import {ArrowRight,CheckCircle2,Lightbulb,TriangleAlert} from 'lucide-react'
import {Tap} from '../../ui'
import {openLink} from '../../lib/tg'
import {panel} from './shared'
import './lesson-study.css'

export type StudyCase={title?:string;concept?:string;situation?:string;input_text?:string;steps?:string[];result_text?:string;mistake?:string;check?:string;diagram_src?:string}
export const studySections=(code:string)=>['reading','example','practice','check'].map(key=>`lesson-${code}-${key}`)
export function LessonStudyNav({code}:{code:string}){
 const ids=studySections(code),[active,setActive]=useState(ids[0])
 useEffect(()=>{
  const root=document.querySelector('.academy main')
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)setActive(entry.target.id)},{root,rootMargin:'-5% 0px -65% 0px'})
  for(const id of ids){const element=document.getElementById(id);if(element)observer.observe(element)}
  return()=>observer.disconnect()
 },[code])
 function jump(id:string){const element=document.getElementById(id);setActive(id);element?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});element?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})}
 return <nav className="academy-study-nav" aria-label="Разделы урока">{['Разбор','Пример','Практика','Проверка'].map((label,index)=><Tap key={label} onClick={()=>jump(ids[index])} aria-current={active===ids[index]?'location':undefined}><span>{index+1}</span>{label}</Tap>)}</nav>
}
export function StudyHeading({number,title,description}:{number:string;title:string;description?:string}){
 return <div className="academy-study-heading"><span aria-hidden="true">{number}</span><div><h2 tabIndex={-1}>{title}</h2>{description&&<p>{description}</p>}</div></div>
}
export function StudyExample({data,showConcept=true}:{data:StudyCase;showConcept?:boolean}){
 const steps=(data.steps||[]).filter(item=>typeof item==='string'),id=useId()
 return <article className={`${panel} academy-worked-example`} aria-labelledby={id}>
  <p className="academy-kicker">Разберём на учебном случае</p><h3 id={id}>{data.title||'Один маленький пример'}</h3>
  {showConcept&&data.concept&&<p className="academy-example-concept">{data.concept}</p>}
  {data.diagram_src&&/^\/learning\/academy\/concepts\/[A-Z]+-\d{3}-M[1-4]\.svg$/.test(data.diagram_src)&&<figure className="academy-concept-figure"><img src={data.diagram_src} alt="Связь исходных данных, действия, результата и проверки в этом примере" width="720" loading="lazy"/></figure>}
  {data.situation&&<p>{data.situation}</p>}
  {data.input_text&&<div className="academy-example-input"><b>Что есть в начале</b><p>{data.input_text}</p></div>}
  {steps.length>0&&<ol className="academy-example-actions">{steps.map((step,index)=><li key={index}><span>{index+1}</span><p>{step}</p></li>)}</ol>}
  {data.result_text&&<div className="academy-example-result"><CheckCircle2 aria-hidden="true" size={20}/><div><b>Что должно получиться</b><p>{data.result_text}</p></div></div>}
  {data.mistake&&<aside className="academy-example-mistake"><TriangleAlert aria-hidden="true" size={20}/><div><b>Где легко ошибиться</b><p>{data.mistake}</p></div></aside>}
  {data.check&&<p className="academy-example-verification"><Lightbulb aria-hidden="true" size={18}/><span><b>Проверь себя:</b> {data.check}</span></p>}
  <p className="academy-example-note">Это вымышленный пример для разбора. Свою практику выполни отдельно и сохрани проверку результата.</p>
 </article>
}
export function LessonTask({artifact,criteria,children}:{artifact:string;criteria:string[];children?:ReactNode}){
 return <section className={`${panel} academy-lesson-task`} aria-label="Задание и результат"><p className="academy-kicker">Теперь попробуй сам</p><h3>Что нужно сделать</h3><p className="academy-task-deliverable">{artifact||'Выполни задание из материала и сохрани результат с объяснением.'}</p>{criteria.length>0&&<><h4>Как понять, что работа готова</h4><ul>{criteria.map((criterion,index)=><li key={index}><ArrowRight size={16} aria-hidden="true"/>{criterion}</li>)}</ul></>}{children}</section>
}
export function LessonChecks({criteria}:{criteria:string[]}){
 const id=useId()
 return criteria.length?<fieldset className="academy-study-checks"><legend>Проверь перед завершением</legend>{criteria.map((criterion,index)=><label key={index} htmlFor={`${id}-${index}`}><input id={`${id}-${index}`} type="checkbox"/><span>{criterion}</span></label>)}<p>Отметки помогают проверить себя. Зачёт зависит от квиза или проверки работы.</p></fieldset>:null
}
export function LessonResources({blocks}:{blocks:any[]}){
 const links=new Map<string,string>()
 for(const block of blocks){const value=block.data||block;for(const match of String(value.text||value.body||'').matchAll(/\[([^\]]+)\]\((\/learning\/academy\/[a-z0-9/-]+\.zip)\)/g))links.set(match[2],match[1])}
 return links.size?<section className={`${panel} academy-study-downloads`} aria-label="Файлы для практики"><h3>Учебные файлы</h3><p className="mt-2 text-sm leading-relaxed text-mute">Скачай архив, распакуй его и начни с README. Внутри — учебные данные и команды запуска.</p>{[...links].map(([src,label])=><Tap key={src} className="academy-chip mt-4" onClick={()=>openLink(src)}>{label} · ZIP</Tap>)}</section>:null
}
