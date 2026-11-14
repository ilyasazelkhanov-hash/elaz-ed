import {useId,useRef,useState,type ReactNode} from 'react'
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,BookOpen,Check,Lightbulb,RotateCcw} from 'lucide-react'
import {Tap} from '../../ui'
import {evaluateGuideAnswer,guideAnswerPresent,guideInteractions,guideJourneyKey,moveGuideItem,readGuideJourney,saveGuideJourney,type GuideAnswer,type GuideChallenge,type GuideJourneyState,type GuideStep,type GuideStepVisual} from '../../lib/guide-interactions'
import './guide-journey.css'

type Props={scrollInset?:number;initialPractice?:boolean;scope:string;guide:{id:string;steps:GuideStep[]};children:ReactNode;challenges?:GuideChallenge[]}
export function GuideStepEvidence({visual}:{visual?:GuideStepVisual}) {
 if(!visual)return null
 return <div className="guide-journey-evidence"><table><caption>{visual.caption}</caption><thead><tr>{visual.columns.map((column,index)=><th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{visual.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
}
export function GuideJourney(props:Props){return <Journey key={`${guideJourneyKey(props.scope,props.guide.id)}:${props.initialPractice ? 'work' : 'lesson'}`} {...props}/>}
function Journey({scope,guide,children,challenges,initialPractice=false,scrollInset=12}:Props){
 const questions=challenges??guideInteractions[guide.id],key=guideJourneyKey(scope,guide.id),id=useId(),heading=useRef<HTMLHeadingElement>(null)
 const [state,setState]=useState(()=>{const saved=readGuideJourney(key,questions||[]);return initialPractice ? {...saved,step:guide.steps.length} : saved}),[all,setAll]=useState(false)
 const [phase,setPhase]=useState<'concept'|'question'>(()=>state.checked[state.step]||(questions?.[state.step]?.type!=='order'&&state.answers[state.step]!=null)?'question':'concept')
 if(!questions||questions.length!==guide.steps.length)return <>{guide.steps.map(step=><section key={step.title}><h2>{step.title}</h2><p>{step.text}</p><GuideStepEvidence visual={step.visual}/></section>)}{children}</>
 const update=(next:GuideJourneyState)=>{saveGuideJourney(key,next);setState(next)}
 const step=Math.min(state.step,guide.steps.length),practice=step===guide.steps.length,question=questions[step],answer=state.answers[step]
 const result=!practice&&state.checked[step]?evaluateGuideAnswer(question,answer):null
 const change=(value:GuideAnswer)=>update({...state,answers:state.answers.map((old,i)=>i===step?value:old),checked:state.checked.map((old,i)=>i===step?false:old)})
 const focusStep=()=>requestAnimationFrame(()=>{const title=heading.current;if(!title)return;title.focus({preventScroll:true});const scroller=title.closest<HTMLElement>('.scroll');if(scroller)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+title.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scrollInset),behavior:'instant'})})
 const go=(next:number)=>{const target=Math.max(0,Math.min(next,guide.steps.length));update({...state,step:target});setPhase(state.checked[target]||(questions?.[target]?.type!=='order'&&state.answers[target]!=null)?'question':'concept');focusStep()}
 const ask=()=>{setPhase('question');focusStep()}
 const retry=()=>{update({...state,checked:state.checked.map((old,i)=>i===step?false:old)});focusStep()}
 return <section className="guide-journey" aria-label="Пошаговый урок" data-phase={practice?'practice':phase}>
  <div className="guide-journey-top"><span><span className="guide-journey-kicker">{practice?'Своя работа':'Тренировка'}</span><b>Шаг {step+1} <span>из {guide.steps.length+1}</span></b></span><Tap onClick={()=>setAll(v=>!v)} aria-pressed={all}><BookOpen size={16} aria-hidden="true"/>{all?'Вернуться к шагам':'Весь материал'}</Tap></div>
  <progress max={guide.steps.length+1} value={step+1} aria-label="Место в уроке, не оценка навыка"/>
  <p className="guide-journey-note">{practice?'Твой результат важнее правильного варианта.':'Одна идея. Одна попытка. Понятный разбор.'}</p>
  {all?<div className="free-start-steps">{guide.steps.map((item,i)=><section key={item.title}><h2>{i+1}. {item.title}</h2><p>{item.text}</p><GuideStepEvidence visual={item.visual}/><Tap onClick={()=>{setAll(false);go(i)}}>Потренироваться на этом шаге<ArrowRight size={16} aria-hidden="true"/></Tap></section>)}</div>:<>
   <div className="guide-journey-stage" key={`${step}:${phase}`}>
    <span className="guide-journey-stage-label">{practice?'Примени на своей задаче':phase==='concept'?'Разберись в идее':'Попробуй решить'}</span>
    <h2 ref={heading} tabIndex={-1} className="guide-journey-heading">{practice?'Теперь создай свою работу':phase==='concept'?guide.steps[step].title:question.prompt}</h2>
    {!practice&&phase==='concept'&&<><p className="guide-journey-concept">{guide.steps[step].text}</p><GuideStepEvidence visual={guide.steps[step].visual}/></>}
    {!practice&&phase==='question'&&<>
     <details className="guide-journey-reminder"><summary tabIndex={0}><Lightbulb size={16} aria-hidden="true"/>Вспомнить объяснение</summary><p>{guide.steps[step].text}</p><GuideStepEvidence visual={guide.steps[step].visual}/></details>
     <fieldset className="guide-journey-question"><legend className="sr-only">{question.prompt}</legend>
      {question.type==='choice'&&question.options.map((option,i)=><label key={i} className={'guide-journey-option'+(answer===i?' is-selected':'')}><input type="radio" name={`${id}-answer`} checked={answer===i} onChange={()=>change(i)}/><span>{option.text}</span></label>)}
      {question.type==='number'&&<label className="guide-journey-number"><span>Твой ответ ({question.unit})</span><input inputMode="decimal" type="text" maxLength={24} value={typeof answer==='string'?answer:''} onChange={e=>change(e.target.value)} aria-describedby={`${id}-number-help`}/><small id={`${id}-number-help`}>Введи только число, без единицы измерения. Можно использовать запятую или точку.</small></label>}
      {question.type==='order'&&<><p className="guide-journey-order-help">Расставь по порядку. Используй стрелки рядом с действием.</p><ol className="guide-journey-order">{(Array.isArray(answer)?answer:[]).map((item,index)=><li key={item}><span><b aria-hidden="true">{index+1}</b>{question.items[item]}</span><div><Tap disabled={index===0} aria-label={`Выше: ${question.items[item]}`} onClick={()=>change(moveGuideItem(answer as number[],index,-1))}><ArrowUp size={17} aria-hidden="true"/></Tap><Tap disabled={index===question.items.length-1} aria-label={`Ниже: ${question.items[item]}`} onClick={()=>change(moveGuideItem(answer as number[],index,1))}><ArrowDown size={17} aria-hidden="true"/></Tap></div></li>)}</ol></>}
     </fieldset>
     {result&&<div className="guide-journey-feedback" data-correct={result.correct} role="status" aria-live="polite"><span className="guide-journey-feedback-icon" aria-hidden="true">{result.correct?<Check size={19}/>:<RotateCcw size={19}/>}</span><div><b>{result.correct?'Верно для этого примера':'Разберём и попробуем ещё раз'}</b><p>{result.explanation}</p>{!result.correct&&<small>Ошибаться можно. Измени ответ и проверь снова.</small>}</div></div>}
    </>}
    {practice&&<p className="guide-journey-concept">Сделай свой вариант, проверь его по критериям и сохрани результат. Ответы в тренировке не подтверждают освоение навыка.</p>}
   </div>
   <div className="guide-journey-nav">
    <Tap className="guide-journey-back" disabled={step===0&&phase==='concept'} aria-label={!practice&&phase==='question'?'К объяснению':'Предыдущий шаг'} onClick={()=>{if(!practice&&phase==='question'){setPhase('concept');focusStep()}else go(step-1)}}><ArrowLeft size={18} aria-hidden="true"/><span>Назад</span></Tap>
    {!practice&&(phase==='concept'?<Tap className="guide-journey-primary" onClick={ask}>К вопросу<ArrowRight size={18} aria-hidden="true"/></Tap>:result?.correct?<Tap className="guide-journey-primary" onClick={()=>go(step+1)}>{step===guide.steps.length-1?'К своей практике':'Дальше'}<ArrowRight size={18} aria-hidden="true"/></Tap>:result?<Tap className="guide-journey-primary" onClick={retry}>Попробовать ещё<RotateCcw size={17} aria-hidden="true"/></Tap>:<Tap className="guide-journey-primary" disabled={!guideAnswerPresent(question,answer)} onClick={()=>update({...state,checked:state.checked.map((old,i)=>i===step?true:old)})}>Проверить ответ<Check size={18} aria-hidden="true"/></Tap>)}
   </div>
  </>}
  <div hidden={!practice&&!all}>{children}</div>
  <details className="guide-journey-boundary"><summary tabIndex={0}>Тренировка без оценки · как сохраняются шаги</summary><p>Учебная тренировка без баллов. Шаги сохраняются в памяти до перезагрузки; это не зачёт курса. Своя работа сохраняется отдельно по кнопке в задании.</p></details>
 </section>
}
