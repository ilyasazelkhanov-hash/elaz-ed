import {useId,useRef,useState} from 'react'
import {Expand, X} from 'lucide-react'
import {lessonVisuals,type LessonScreenshot} from '../../lib/academy-visuals'
import {Tap} from '../../ui'
import {panel} from './shared'
import './lesson-visuals.css'

export function LessonVisuals({code}:{code:string}){
 const visuals=lessonVisuals(code),dialog=useRef<HTMLDialogElement>(null),id=useId(),[selected,setSelected]=useState<LessonScreenshot>()
 if(!visuals)return null
 function enlarge(screenshot:LessonScreenshot){setSelected(screenshot);dialog.current?.showModal()}
 return <section className={`${panel} academy-lesson-visuals`} aria-label="Схема и скриншоты занятия">
  <h2 className="font-display text-[20px] font-semibold">Наглядно: что и в каком порядке</h2>
  <figure className="academy-step-figure">
   <img src={visuals.diagram} alt="Порядок четырёх занятий этого модуля с названиями и номерами" width="720" loading="lazy"/>
   <figcaption>Читай схему сверху вниз. Сейчас ты на шаге {visuals.step} из 4. Прочитай материал, выполни практику и проверь результат перед переходом дальше.</figcaption>
  </figure>
  {visuals.screenshots.length>0&&<div className="academy-screenshot-list"><h3 className="text-sm font-semibold">Как выглядит учебный пример</h3>{visuals.screenshots.map(screenshot=><figure key={screenshot.src}>
   <button type="button" className="academy-screenshot-button" onClick={()=>enlarge(screenshot)} aria-label={`Увеличить скриншот: ${screenshot.alt}`}><img src={screenshot.src} alt={screenshot.alt} loading="lazy"/><span><Expand size={15} aria-hidden="true"/>Увеличить скриншот</span></button>
   <figcaption>{screenshot.caption}</figcaption>
  </figure>)}</div>}
  <dialog ref={dialog} className="academy-image-dialog" aria-labelledby={id} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close()}}>
   <div className="academy-image-dialog-content"><div className="academy-image-dialog-heading"><h3 id={id}>Скриншот учебного примера</h3><Tap aria-label="Закрыть скриншот" className="academy-chip" onClick={()=>dialog.current?.close()}><X size={18}/></Tap></div>{selected&&<figure><img src={selected.src} alt={selected.alt}/><figcaption>{selected.caption}</figcaption></figure>}</div>
  </dialog>
 </section>
}
