import {useId,useRef,useState,type ReactNode} from 'react'
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp} from 'lucide-react'
import {Tap} from '../../ui'
import {evaluateGuideAnswer,guideAnswerPresent,guideInteractions,guideJourneyKey,moveGuideItem,readGuideJourney,saveGuideJourney,type GuideAnswer,type GuideJourneyState} from '../../lib/guide-interactions'
import './guide-journey.css'

type Props={scope:string;guide:{id:string;steps:{title:string;text:string}[]};children:ReactNode}
export function GuideJourney(props:Props){return <Journey key={guideJourneyKey(props.scope,props.guide.id)} {...props}/>}
function Journey({scope,guide,children}:Props){
 const questions=guideInteractions[guide.id],key=guideJourneyKey(scope,guide.id),id=useId(),heading=useRef<HTMLHeadingElement>(null)
 const [state,setState]=useState(()=>readGuideJourney(key,questions||[])),[all,setAll]=useState(false)
 if(!questions||questions.length!==guide.steps.length)return <>{guide.steps.map(step=><section key={step.title}><h2>{step.title}</h2><p>{step.text}</p></section>)}{children}</>
 const update=(next:GuideJourneyState)=>{saveGuideJourney(key,next);setState(next)}
 const step=Math.min(state.step,guide.steps.length),practice=step===guide.steps.length,question=questions[step],answer=state.answers[step]
 const result=!practice&&state.checked[step]?evaluateGuideAnswer(question,answer):null
 const change=(value:GuideAnswer)=>update({...state,answers:state.answers.map((old,i)=>i===step?value:old),checked:state.checked.map((old,i)=>i===step?false:old)})
 const go=(next:number)=>{update({...state,step:Math.max(0,Math.min(next,guide.steps.length))});requestAnimationFrame(()=>{const title=heading.current;if(!title)return;title.focus({preventScroll:true});const scroller=title.closest<HTMLElement>('.scroll');if(scroller)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+title.getBoundingClientRect().top-scroller.getBoundingClientRect().top-12),behavior:'instant'})})}
 return <section className="guide-journey" aria-label="Пошаговый урок">
  <div className="guide-journey-top"><span>Шаг {step+1} из {guide.steps.length+1}</span><Tap onClick={()=>setAll(v=>!v)} aria-pressed={all}>{all?'Вернуться к шагам':'Весь материал'}</Tap></div>
  <progress max={guide.steps.length+1} value={step+1} aria-label="Место в уроке, не оценка навыка"/>
  <p className="guide-journey-note">Учебная тренировка без баллов. Шаги сохраняются в памяти до перезагрузки; это не зачёт курса.</p>
  {all?<div className="free-start-steps">{guide.steps.map((item,i)=><section key={item.title}><h2>{i+1}. {item.title}</h2><p>{item.text}</p><Tap onClick={()=>{setAll(false);go(i)}}>Потренироваться на этом шаге</Tap></section>)}</div>:<>
   <h2 ref={heading} tabIndex={-1} className="guide-journey-heading">{practice?'Теперь создай свою работу':guide.steps[step].title}</h2>
   {!practice&&<>
    <p className="guide-journey-concept">{guide.steps[step].text}</p>
    <fieldset className="guide-journey-question"><legend>{question.prompt}</legend>
     {question.type==='choice'&&question.options.map((option,i)=><label key={i}><input type="radio" name={`${id}-answer`} checked={answer===i} onChange={()=>change(i)}/><span>{option.text}</span></label>)}
     {question.type==='number'&&<label className="guide-journey-number"><span>Твой ответ ({question.unit})</span><input inputMode="decimal" type="text" maxLength={24} value={typeof answer==='string'?answer:''} onChange={e=>change(e.target.value)} aria-describedby={`${id}-number-help`}/><small id={`${id}-number-help`}>Введи число без знака процента. Можно использовать запятую или точку.</small></label>}
     {question.type==='order'&&<><p>Переставь действия кнопками. Перетаскивание не требуется.</p><ol className="guide-journey-order">{(Array.isArray(answer)?answer:[]).map((item,index)=><li key={item}><span>{index+1}. {question.items[item]}</span><div><Tap disabled={index===0} aria-label={`Выше: ${question.items[item]}`} onClick={()=>change(moveGuideItem(answer as number[],index,-1))}><ArrowUp size={16}/></Tap><Tap disabled={index===question.items.length-1} aria-label={`Ниже: ${question.items[item]}`} onClick={()=>change(moveGuideItem(answer as number[],index,1))}><ArrowDown size={16}/></Tap></div></li>)}</ol></>}
    </fieldset>
    <Tap className="guide-journey-check" disabled={!guideAnswerPresent(question,answer)} onClick={()=>update({...state,checked:state.checked.map((old,i)=>i===step?true:old)})}>Проверить ответ</Tap>
    {result&&<div className="guide-journey-feedback" role="status"><b>{result.correct?'Верно для этого примера':'Разберём и попробуем ещё раз'}</b><p>{result.explanation}</p>{!result.correct&&<p>Измени ответ и проверь снова. Попытки не ограничены.</p>}</div>}
   </>}
   <div className="guide-journey-nav"><Tap disabled={step===0} onClick={()=>go(step-1)}><ArrowLeft size={17}/>Назад</Tap>{!practice&&<Tap disabled={!result?.correct} onClick={()=>go(step+1)}>{step===guide.steps.length-1?'К своей практике':'Дальше'}<ArrowRight size={17}/></Tap>}</div>
  </>}
  <div hidden={!practice&&!all}>{children}</div>
 </section>
}
