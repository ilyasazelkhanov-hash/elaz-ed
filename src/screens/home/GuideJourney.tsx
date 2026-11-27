import {useId,useRef,useState,type ReactNode} from 'react'
import {ArrowLeft,ArrowRight,BookOpen,Check,Lightbulb,RotateCcw,Sparkles} from 'lucide-react'
import {Tap} from '../../ui'
import {emptyJourney,evaluateGuideAnswer,guideAnswerPresent,guideAnswerStarted,guideInteractions,guideJourneyKey,readGuideJourney,readSavedGuideJourney,saveGuideJourney,type GuideAnswer,type GuideChallenge,type GuideJourneyState,type GuideStep,type GuideStepVisual} from '../../lib/guide-interactions'
import {scoreAnswer,scoreFinish,sparkKey,sparksEnabled,sparksWord,SPARK_RULES} from '../../lib/practice-sparks'
import {useSparks} from '../../lib/use-practice-sparks'
import {GuideTaskInput} from './GuideTask'
import {answerEffect,finishEffect} from './practice-effects'
import './guide-journey.css'

type Props={scrollInset?:number;initialPractice?:boolean;scope:string;guide:{id:string;steps:GuideStep[]};children:ReactNode;challenges?:GuideChallenge[];onProgress?:(correct:number,total:number)=>void}
export function GuideStepEvidence({visual}:{visual?:GuideStepVisual}) {
 if(!visual)return null
 return <div className="guide-journey-evidence"><table><caption>{visual.caption}</caption><thead><tr>{visual.columns.map((column,index)=><th key={index} scope="col">{column}</th>)}</tr></thead><tbody>{visual.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
}
export function GuideJourney(props:Props){return <Journey key={`${guideJourneyKey(props.scope,props.guide.id,[props.guide.steps,props.challenges??guideInteractions[props.guide.id]])}:${props.initialPractice ? 'work' : 'lesson'}`} {...props}/>}
function Journey({scope,guide,children,challenges,onProgress,initialPractice=false,scrollInset=12}:Props){
 const questions=challenges??guideInteractions[guide.id],revision=[guide.steps,questions],key=guideJourneyKey(scope,guide.id,revision),id=useId(),heading=useRef<HTMLHeadingElement>(null)
 const [state,setState]=useState(()=>{const saved=readGuideJourney(key,questions||[]);return initialPractice ? {...saved,step:guide.steps.length} : saved}),[all,setAll]=useState(false)
 const previousKey=key+':previous'
 const [previous,setPrevious]=useState(()=>readSavedGuideJourney(previousKey,questions??[]))
 const [durable,setDurable]=useState<boolean|null>(null)
 const [phase,setPhase]=useState<'concept'|'question'>(()=>state.phase??(state.checked[state.step]||guideAnswerStarted(questions?.[state.step],state.answers[state.step])?'question':'concept'))
 // Local practice points of the last check. Never XP: see practice-sparks.
 const [gain,setGain]=useState<{amount:number;combo:number;finish:number}|null>(null)
 const sparks=useSparks(scope)
 if(!questions||questions.length!==guide.steps.length)return <>{guide.steps.map(step=><section key={step.title}><h2>{step.title}</h2><p>{step.text}</p><GuideStepEvidence visual={step.visual}/></section>)}{children}</>
 const solved=(value:GuideJourneyState)=>questions.filter((item,i)=>value.checked[i]&&evaluateGuideAnswer(item,value.answers[i]).correct).length
 const update=(next:GuideJourneyState)=>{setDurable(saveGuideJourney(key,next,questions));setState(next);onProgress?.(solved(next),questions.length)}
 const step=Math.min(state.step,guide.steps.length),practice=step===guide.steps.length,question=questions[step],answer=state.answers[step]
 const result=!practice&&state.checked[step]?evaluateGuideAnswer(question,answer):null
 const change=(value:GuideAnswer)=>{setGain(null);update({...state,answers:state.answers.map((old,i)=>i===step?value:old),checked:state.checked.map((old,i)=>i===step?false:old)})}
 const check=()=>{
  const next={...state,checked:state.checked.map((old,i)=>i===step?true:old)},outcome=evaluateGuideAnswer(question,answer)
  update(next)
  // An already earned task gives nothing again; a mistake before the first success halves its award.
  const scored=scoreAnswer(scope,sparkKey(guide.id,revision,step),outcome.correct),complete=outcome.correct&&solved(next)===questions.length
  setGain({amount:scored.gained,combo:scored.combo,finish:complete?scoreFinish(scope,sparkKey(guide.id,revision,'finish')).gained:0})
  answerEffect(outcome.correct,scored.combo)
  if(complete)finishEffect(heading.current)
 }
 const focusStep=()=>requestAnimationFrame(()=>{const title=heading.current;if(!title)return;title.focus({preventScroll:true});const scroller=title.closest<HTMLElement>('.scroll');if(scroller)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+title.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scrollInset),behavior:'instant'})})
 const go=(next:number)=>{const target=Math.max(0,Math.min(next,guide.steps.length));const nextPhase=state.checked[target]||guideAnswerStarted(questions[target],state.answers[target])?'question':'concept';setGain(null);update({...state,step:target,phase:nextPhase});setPhase(nextPhase);focusStep()}
 const ask=()=>{update({...state,phase:'question'});setPhase('question');focusStep()}
 const restart=()=>{
  const saved={...state,phase}
  saveGuideJourney(previousKey,saved,questions)
  setPrevious(saved);setGain(null)
  update({...emptyJourney(questions),phase:'question'})
  setPhase('question');setAll(false);focusStep()
 }
 const restore=()=>{
  if(!previous)return
  const current={...state,phase}
  saveGuideJourney(previousKey,current,questions)
  setGain(null);update(previous)
  setPhase(previous.phase??'concept');setPrevious(current);setAll(false);focusStep()
 }
 const retry=()=>{setGain(null);update({...state,checked:state.checked.map((old,i)=>i===step?false:old)});focusStep()}
 const earned=result?.correct&&gain?[gain.amount?`+${gain.amount} ${sparksWord(gain.amount)}`:'',gain.combo>=2?`серия ${gain.combo}`:'',gain.finish?`+${gain.finish} за всю тренировку`:''].filter(Boolean).join(' · '):''
 return <section className="guide-journey" aria-label="Пошаговый урок" data-phase={practice?'practice':phase}>
  <div className="guide-journey-top"><span><span className="guide-journey-kicker">{practice?'Своя работа':'Тренировка'}</span><b>Шаг {step+1} <span>из {guide.steps.length+1}</span></b></span><Tap onClick={()=>setAll(v=>!v)} aria-pressed={all}><BookOpen size={16} aria-hidden="true"/>{all?'Вернуться к шагам':'Весь материал'}</Tap></div>
  <div className="guide-journey-meter"><progress max={guide.steps.length+1} value={step+1} aria-label="Место в уроке, не оценка навыка"/>{sparksEnabled()&&<span className="guide-journey-sparks" title="Искры практики: локальные очки этого браузера, не XP"><Sparkles size={14} aria-hidden="true"/><span className="sr-only">Искры практики, локальные очки: </span>{sparks.total}</span>}</div>
  <p className="guide-journey-note">{practice?'Твой результат важнее правильного варианта.':'Одна идея. Одна попытка. Понятный разбор.'}</p>
  {all?<div className="free-start-steps">{guide.steps.map((item,i)=><section key={item.title}><h2>{i+1}. {item.title}</h2><p>{item.text}</p><GuideStepEvidence visual={item.visual}/><Tap onClick={()=>{setAll(false);go(i)}}>Потренироваться на этом шаге<ArrowRight size={16} aria-hidden="true"/></Tap></section>)}</div>:<>
   <div className="guide-journey-stage" key={`${step}:${phase}`}>
    <span className="guide-journey-stage-label">{practice?'Примени на своей задаче':phase==='concept'?'Разберись в идее':'Попробуй решить'}</span>
    <h2 ref={heading} tabIndex={-1} className="guide-journey-heading">{practice?'Теперь создай свою работу':phase==='concept'?guide.steps[step].title:question.prompt}</h2>
    {!practice&&phase==='concept'&&<><p className="guide-journey-concept">{guide.steps[step].text}</p><GuideStepEvidence visual={guide.steps[step].visual}/></>}
    {!practice&&phase==='question'&&<>
     <details className="guide-journey-reminder"><summary tabIndex={0}><Lightbulb size={16} aria-hidden="true"/>Вспомнить объяснение</summary><p>{guide.steps[step].text}</p><GuideStepEvidence visual={guide.steps[step].visual}/></details>
     <fieldset className="guide-journey-question" data-task={question.type}><legend className="sr-only">{question.prompt}</legend>
      <GuideTaskInput id={id} question={question} answer={answer} onChange={change} wrong={result&&!result.correct?result.wrong:undefined}/>
     </fieldset>
     {result&&<div className="guide-journey-feedback" data-correct={result.correct} role="status" aria-live="polite"><span className="guide-journey-feedback-icon" aria-hidden="true">{result.correct?<Check size={19}/>:<RotateCcw size={19}/>}</span><div><b>{result.correct?'Верно для этого примера':'Разберём и попробуем ещё раз'}</b><p>{result.explanation}</p>{earned&&<p className="guide-journey-gain"><Sparkles size={15} aria-hidden="true"/>{earned}</p>}{!result.correct&&<small>Ошибаться можно. Измени ответ и проверь снова.</small>}</div></div>}
    </>}
    {practice&&solved(state)===questions.length&&<p className="guide-journey-trained"><Check size={16} aria-hidden="true"/>Тренировка пройдена: {questions.length} из {questions.length}</p>}
    {practice&&<p className="guide-journey-concept">Теперь твоя очередь: сделай свой вариант и проверь его по критериям ниже.</p>}
   </div>
   <div className="guide-journey-nav">
    <Tap className="guide-journey-back" disabled={step===0&&phase==='concept'} aria-label={!practice&&phase==='question'?'К объяснению':'Предыдущий шаг'} onClick={()=>{if(!practice&&phase==='question'){update({...state,phase:'concept'});setPhase('concept');focusStep()}else go(step-1)}}><ArrowLeft size={18} aria-hidden="true"/><span>Назад</span></Tap>
    {!practice&&(phase==='concept'?<Tap className="guide-journey-primary" onClick={ask}>К вопросу<ArrowRight size={18} aria-hidden="true"/></Tap>:result?.correct?<Tap className="guide-journey-primary" onClick={()=>go(step+1)}>{step===guide.steps.length-1?'К своей практике':'Дальше'}<ArrowRight size={18} aria-hidden="true"/></Tap>:result?<Tap className="guide-journey-primary" onClick={retry}>Попробовать ещё<RotateCcw size={17} aria-hidden="true"/></Tap>:<Tap className="guide-journey-primary" feedback="none" disabled={!guideAnswerPresent(question,answer)} onClick={check}>Проверить ответ<Check size={18} aria-hidden="true"/></Tap>)}
   </div>
  </>}
  {state.checked.some(Boolean)&&<Tap onClick={restart}><RotateCcw size={17} aria-hidden="true"/>Попробовать заново без подсказок</Tap>}
  {previous&&<Tap onClick={restore}><RotateCcw size={17} aria-hidden="true"/>Вернуться к предыдущей попытке</Tap>}
  <div hidden={!practice&&!all}>{children}</div>
  <details className="guide-journey-boundary"><summary tabIndex={0}>{sparksEnabled()?'Тренировка без оценки · шаги и искры':'Тренировка без оценки · как сохраняются шаги'}</summary><p>Тренировка не ставит оценку и не засчитывает урок. Ответы в тренировке не подтверждают освоение навыка. {durable===false?'Браузер не сохранил шаги: они доступны до перезагрузки.':durable===true?'Шаги сохранены в этом браузере.':'Шаги сохраняются в этом браузере.'} Между устройствами они не переносятся, а свою работу ты сохраняешь отдельно, кнопкой в задании.</p>{sparksEnabled()&&<p>Искры - очки практики в этом браузере: {SPARK_RULES.first} за верный ответ с первой попытки, {SPARK_RULES.retry} после ошибки, за повтор решённого задания их нет. Это не XP, не уровень и не подтверждение навыка.</p>}</details>
 </section>
}
