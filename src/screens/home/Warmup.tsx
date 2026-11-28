import {ArrowLeft,ArrowRight,Check,RotateCcw,Share2,Sparkles,X,Zap} from 'lucide-react'
import {useId,useRef,useState} from 'react'
import {beginnerGuides} from '../../lib/beginner-content'
import {WARMUP_ID} from '../../lib/discovery-events'
import {evaluateGuideAnswer,guideAnswerPresent,initialGuideAnswer,type GuideAnswer} from '../../lib/guide-interactions'
import {freeStartLink} from '../../lib/links'
import {scoreAnswer,scoreFinish,sparkKey,sparksEnabled,sparksWord} from '../../lib/practice-sparks'
import {warmupCard} from '../../lib/shareCard'
import {useSparks} from '../../lib/use-practice-sparks'
import {readWarmup,saveWarmup,warmupSolution,warmupSummary,warmupTasks,WARMUP_TOTAL} from '../../lib/warmup'
import {useStore} from '../../store'
import {Tap} from '../../ui'
import {GuideTaskInput} from './GuideTask'
import {answerEffect,finishEffect} from './practice-effects'
import './guide-journey.css'

type Props={scope:string;go:(path:string)=>void;openGuide:(id:string)=>void}
type Run={step:number;answers:GuideAnswer[];marks:boolean[];checked:boolean;gained:number;last:{amount:number;combo:number}|null}
const freshRun=():Run=>({step:0,answers:warmupTasks.map(task=>initialGuideAnswer(task.question)),marks:[],checked:false,gained:0,last:null})
/** AI-разминка: one attempt per task, an honest count and a suggested first guide. Not an assessment. */
export function Warmup(props:Props){return <WarmupSession key={props.scope} {...props}/>}
function WarmupSession({scope,go,openGuide}:Props){
 const id=useId(),heading=useRef<HTMLHeadingElement>(null)
 const [record,setRecord]=useState(()=>readWarmup(scope))
 const [run,setRun]=useState<Run|null>(null)
 // Sparks of the run that has just finished. A stored result from an earlier visit shows none.
 const [earned,setEarned]=useState(0)
 const sparks=useSparks(scope)
 const focusTop=()=>requestAnimationFrame(()=>{const title=heading.current;if(!title)return;title.focus({preventScroll:true});title.closest<HTMLElement>('.scroll')?.scrollTo({top:0,behavior:'instant'})})
 const start=()=>{setRun(freshRun());setEarned(0);focusTop()}
 if(run){
  const task=warmupTasks[run.step],question=task.question,answer=run.answers[run.step],final=run.step===WARMUP_TOTAL-1
  const result=run.checked?evaluateGuideAnswer(question,answer):null
  const check=()=>{
   const outcome=evaluateGuideAnswer(question,answer),scored=scoreAnswer(scope,sparkKey(WARMUP_ID,warmupTasks,run.step),outcome.correct)
   setRun({...run,checked:true,marks:[...run.marks,outcome.correct],gained:run.gained+scored.gained,last:scored.gained?{amount:scored.gained,combo:scored.combo}:null})
   answerEffect(outcome.correct,scored.combo)
  }
  const next=()=>{
   if(!final){setRun({...run,step:run.step+1,checked:false,last:null});focusTop();return}
   const bonus=run.marks.every(Boolean)?scoreFinish(scope,sparkKey(WARMUP_ID,warmupTasks,'finish')).gained:0
   saveWarmup(scope,run.marks);setRecord({score:run.marks.filter(Boolean).length,total:WARMUP_TOTAL,marks:run.marks});setEarned(run.gained+bonus);setRun(null)
   finishEffect(heading.current);focusTop()
  }
  return <article className="free-start free-start-article" data-warmup="run">
   <section className="guide-journey" aria-label="AI-разминка">
    <div className="guide-journey-top"><span><span className="guide-journey-kicker">AI-разминка · {task.topic}</span><b>Задание {run.step+1} <span>из {WARMUP_TOTAL}</span></b></span><Tap onClick={()=>{setRun(null);focusTop()}}><X size={16} aria-hidden="true"/>Выйти</Tap></div>
    <div className="guide-journey-meter"><progress max={WARMUP_TOTAL} value={run.step+1} aria-label="Место в разминке, не оценка навыка"/>{sparksEnabled()&&<span className="guide-journey-sparks" title="Искры практики: локальные очки этого браузера, не XP"><Sparkles size={14} aria-hidden="true"/><span className="sr-only">Искры практики, локальные очки: </span>{sparks.total}</span>}</div>
    <p className="guide-journey-note">Одна попытка на задание. После ответа будет разбор.</p>
    <div className="guide-journey-stage" key={run.step}>
     <span className="guide-journey-stage-label">Попробуй решить</span>
     <h2 ref={heading} tabIndex={-1} className="guide-journey-heading">{question.prompt}</h2>
     <fieldset className="guide-journey-question" data-task={question.type}><legend className="sr-only">{question.prompt}</legend>
      <GuideTaskInput id={id} question={question} answer={answer} locked={run.checked} onChange={value=>setRun({...run,answers:run.answers.map((old,i)=>i===run.step?value:old)})}/>
     </fieldset>
     {result&&<div className="guide-journey-feedback" data-correct={result.correct} role="status" aria-live="polite"><span className="guide-journey-feedback-icon" aria-hidden="true">{result.correct?<Check size={19}/>:<X size={19}/>}</span><div>
      <b>{result.correct?'Верно':'Не сошлось'}</b>
      <p>{question.type==='choice'?result.explanation:question.explanation}</p>
      {!result.correct&&<p className="warmup-solution"><b>Верный ответ: </b>{warmupSolution(question)}</p>}
      {result.correct&&run.last&&<p className="guide-journey-gain"><Sparkles size={15} aria-hidden="true"/>+{run.last.amount} {sparksWord(run.last.amount)}{run.last.combo>=2?` · серия ${run.last.combo}`:''}</p>}
     </div></div>}
    </div>
    <div className="guide-journey-nav">{run.checked
     ?<Tap className="guide-journey-primary" onClick={next}>{final?'К результату':'Дальше'}<ArrowRight size={18} aria-hidden="true"/></Tap>
     :<Tap className="guide-journey-primary" feedback="none" disabled={!guideAnswerPresent(question,answer)} onClick={check}>Проверить ответ<Check size={18} aria-hidden="true"/></Tap>}</div>
   </section>
  </article>
 }
 if(record){
  const summary=warmupSummary(record.marks),guide=beginnerGuides.find(item=>item.id===summary.next)
  return <article className="free-start free-start-article" data-warmup="result">
   <Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>Все бесплатные разборы</Tap>
   <div className="warmup-score" role="status"><span className="free-start-kicker"><Zap size={15} aria-hidden="true"/>AI-разминка</span>
    <p className="warmup-score-number" aria-label={`${summary.score} из ${summary.total} с первой попытки`}><b>{summary.score}</b><span>из {summary.total}</span></p>
    <h1 ref={heading} tabIndex={-1}>{summary.title}</h1><p>{summary.text}</p>
    {earned>0&&<p className="guide-journey-gain"><Sparkles size={15} aria-hidden="true"/>+{earned} {sparksWord(earned)} за эту разминку</p>}
   </div>
   <ul className="warmup-topics" aria-label="Темы разминки">{warmupTasks.map((task,i)=>{const ok=record.marks[i],target=beginnerGuides.find(item=>item.id===task.guide)!;return <li key={task.guide}><Tap onClick={()=>openGuide(task.guide)} aria-label={`${task.topic}: ${ok?'верно':'не сошлось'}. Открыть разбор «${target.title}»`}><span className="warmup-mark" data-ok={ok||undefined} aria-hidden="true">{ok?<Check size={15}/>:<X size={15}/>}</span><span><b>{task.topic}</b><small>{target.title}</small></span><ArrowRight size={16} aria-hidden="true"/></Tap></li>})}</ul>
   <Tap className="free-start-finale-next" onClick={()=>guide?openGuide(guide.id):go('/start')}><span><small>{guide?`Твой первый шаг · ${guide.minutes} мин`:'Дальше'}</small>{guide?guide.title:'Выбрать разбор для практики'}</span><ArrowRight size={19} aria-hidden="true"/></Tap>
   <div className="free-start-task free-start-finale" data-done>
    <h2>Сравни с другом</h2><p>Отправь разминку: по ссылке он начнёт с тех же пяти заданий.</p>
    <Tap className="free-start-finale-secondary" onClick={()=>useStore.setState({share:warmupCard(summary.score,summary.total,freeStartLink(WARMUP_ID))})}><Share2 size={17} aria-hidden="true"/>Поделиться результатом</Tap>
    <Tap className="free-start-finale-secondary" onClick={start}><RotateCcw size={17} aria-hidden="true"/>Пройти ещё раз</Tap>
    <small>Это разминка, не аттестация: она подсказывает, с чего начать, и не подтверждает навык. Результат хранится только в этом браузере.{sparksEnabled()?' За повтор решённых заданий искр нет.':''}</small>
   </div>
  </article>
 }
 return <article className="free-start free-start-article" data-warmup="intro">
  <Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>Все бесплатные разборы</Tap>
  <div className="free-start-hero"><span className="free-start-kicker"><Zap size={15} aria-hidden="true"/>AI-разминка · 2 минуты</span>
   <h1 ref={heading} tabIndex={-1}>Проверь, как ты работаешь с ИИ</h1>
   <p>Пять коротких заданий: собрать запрос, пересчитать цифру, выбрать инструмент, составить бриф и защитить данные. В конце подскажем, с какого разбора начать.</p>
   <Tap onClick={start}>Начать разминку<ArrowRight size={18}/></Tap>
  </div>
  <ul className="warmup-rules"><li>Одна попытка на задание, после неё сразу разбор.</li><li>Без регистрации, таймера и оценок.</li><li>Результат{sparksEnabled()?' и искры остаются':' остаётся'} в этом браузере. Это не XP и не подтверждение навыка.</li></ul>
 </article>
}
