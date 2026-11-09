import { learningUrl } from '../../lib/learning-entry'
import { useLearningDemo } from '../../lib/learning-scope'
import { useStore } from '../../store'
import { learningDraftKey, readLearningDraft, writeLearningDraft, clearLearningDraft, questionSignature, restoreLearningAnswers } from '../../lib/learning-drafts'
import { useEffect, useRef, useState } from 'react'
import { academyAnswerPresent, type AcademyAnswer } from '../../lib/academy-quiz'
import { useAcademyTranslation } from '../../lib/academy-i18n'
import { Cta, Tap } from '../../ui'
import { panel, Status, text, useAction } from './shared'

type Props={code:string;lessonCode:string;refresh:()=>void;initialResult?:any}
export function Quiz(props:Props){
 const actor=useStore(s=>s.me?.id),demo=useLearningDemo()
 const draftKey=learningDraftKey(demo?'academy-demo':'academy-live',actor,props.code)
 return <QuizSession key={draftKey??props.code} {...props} draftKey={draftKey}/>
}
function QuizSession({code,lessonCode,refresh,initialResult,draftKey}:Props&{draftKey:string|null}){
 const demo=useLearningDemo(),t=useAcademyTranslation(),action=useAction()
 const [attempt,setAttempt]=useState<any>(null),[answers,setAnswers]=useState<Record<string,AcademyAnswer>>({}),[result,setResult]=useState<any>(initialResult??null)
 const [restored,setRestored]=useState(false),[draftStatus,setDraftStatus]=useState(''),restoreStarted=useRef(false),active=useRef(true)
 const questions:any[]=attempt?.questions||[]
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 useEffect(()=>{
  if(restoreStarted.current||initialResult)return
  restoreStarted.current=true
  const saved=readLearningDraft(draftKey)
  if(!saved?.attemptId)return
  void action.run('quiz_start',{code},t('Попытка восстановлена')).then(a=>{
   if(!a||!active.current)return
   setAttempt(a);setResult(null)
   const restoredAnswers=restoreLearningAnswers(saved,a.attempt_id||a.id,a.questions)
   if(restoredAnswers){setAnswers(restoredAnswers);setRestored(true);setDraftStatus('Черновик восстановлен')}
   else {clearLearningDraft(draftKey);setDraftStatus('Открыта новая попытка. Старый черновик не применён.')}
  })
 },[draftKey,code])
 function saveAnswers(next:Record<string,AcademyAnswer>,currentAttempt=attempt){
  setAnswers(next)
  if(currentAttempt)setDraftStatus(writeLearningDraft(draftKey,{attemptId:currentAttempt.attempt_id||currentAttempt.id,signature:questionSignature(currentAttempt.questions),answers:next})?'Черновик сохранён в этом сеансе':'Не удалось сохранить черновик')
 }
 async function start(){const a=await action.run('quiz_start',{code},t('Попытка открыта'));if(a){setAttempt(a);saveAnswers({},a);setRestored(false);setResult(null)}}
 async function submit(){
  const r=await action.run('quiz_submit',{attempt_id:attempt.attempt_id||attempt.id,answers:questions.map((q,i)=>answers[q.id??i])},t('Ответы проверены'))
  if(r){clearLearningDraft(draftKey);setDraftStatus('');setResult(r);setAttempt(null);if(r.passed&&lessonCode){await finish()}}
 }
 async function finish(){const completed=await action.run('complete',{code:lessonCode},t('Квиз пройден, занятие завершено'));if(completed)refresh()}
 function toggle(key:string,index:number){const values=Array.isArray(answers[key])?answers[key] as number[]:[];saveAnswers({...answers,[key]:values.includes(index)?values.filter(v=>v!==index):[...values,index]})}
 return <section className={`${panel} academy-lesson-quiz`}><p className="academy-kicker">{t('Проверка понимания')}</p><h2 className="mt-3 font-display text-[20px]">{t('Квиз')}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{t('Ответь самостоятельно. После отправки увидишь результат. Если ошибёшься, вернись к примеру и попробуй ещё раз в пределах доступных попыток.')}</p>
  {draftStatus&&<p role="status" className="mt-3 text-xs text-mute">{restored&&`${t('Черновик восстановлен')}. `}{t(draftStatus)}</p>}
  {!attempt&&!result&&<Cta className="mt-5" busy={action.busy} onClick={()=>void start()}>{t('Начать попытку')}</Cta>}
  {attempt&&<div className="mt-5 space-y-5">{questions.map((q,i)=>{const key=String(q.id??i),type=q.type||'mcq',prompt=text(q.prompt||q.text);return <fieldset key={key}><legend className="text-sm font-semibold">{i+1}. {prompt}</legend>
   {type==='text'||type==='code'?<><textarea aria-label={prompt} value={typeof answers[key]==='string'?answers[key] as string:''} onChange={e=>saveAnswers({...answers,[key]:e.target.value})} className={`academy-field mt-3 ${type==='code'?'min-h-36 font-mono':'min-h-20'}`} maxLength={20000}/>{type==='code'&&<p className="mt-2 text-xs text-mute">{t('Сравнение с эталоном без исполнения кода. Для полноценного проекта используется проверка преподавателем.')}</p>}</>:(q.choices||q.options||[]).map((o:any,j:number)=><label key={j} className="mt-3 flex items-start gap-3 rounded-xl border border-line p-3 text-sm leading-relaxed"><input className="mt-1 accent-violet" type={type==='multi'?'checkbox':'radio'} name={`quiz-${key}`} checked={type==='multi'?Array.isArray(answers[key])&&(answers[key] as number[]).includes(j):answers[key]===j} onChange={()=>type==='multi'?toggle(key,j):saveAnswers({...answers,[key]:j})}/>{typeof o==='string'?o:text(o.text||o.label)}</label>)}
   {type==='multi'&&<p className="mt-2 text-xs text-mute">{t('Выберите все подходящие варианты.')}</p>}</fieldset>})}<Cta busy={action.busy} disabled={!questions.length||questions.some((q,i)=>!academyAnswerPresent(answers[q.id??i]))} onClick={()=>void submit()}>{t('Проверить ответы')}</Cta></div>}
  {result&&<div className="academy-notice"><Status state={result.passed?'passed':'failed'}/><p className="mt-3 text-sm">{t('Результат')}: {result.score}/100</p><p className="mt-3 text-sm text-mute">{t('Подробный разбор по вопросам пока недоступен. По одному баллу нельзя определить, в какой теме была ошибка.')}</p>{lessonCode&&<a className="mt-3 inline-flex min-h-11 items-center text-sm text-violet" onClick={event=>event.currentTarget.closest('main')?.scrollTo({top:0,behavior:'smooth'})} href={`#${learningUrl(`/lessons/${encodeURIComponent(lessonCode)}`,demo)}`}>{t('Вернуться к материалу занятия')}</a>}{result.passed&&lessonCode?<Cta className="mt-4" busy={action.busy} onClick={()=>void finish()}>{t('Завершить занятие')}</Cta>:<Tap className="mt-4 text-sm text-violet" disabled={action.busy} onClick={()=>void start()}>{t('Запросить новую попытку')}</Tap>}</div>}{action.feedback}
 </section>
}

