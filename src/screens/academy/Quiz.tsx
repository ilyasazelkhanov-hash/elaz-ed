import { useState } from 'react'
import { academyAnswerPresent, type AcademyAnswer } from '../../lib/academy-quiz'
import { useAcademyTranslation } from '../../lib/academy-i18n'
import { Cta, Tap } from '../../ui'
import { panel, Status, text, useAction } from './shared'

export function Quiz({code,lessonCode,refresh,initialResult}:{code:string;lessonCode:string;refresh:()=>void;initialResult?:any}){
 const t=useAcademyTranslation(),action=useAction()
 const [attempt,setAttempt]=useState<any>(null),[answers,setAnswers]=useState<Record<string,AcademyAnswer>>({}),[result,setResult]=useState<any>(initialResult??null)
 const questions:any[]=attempt?.questions||[]
 async function start(){const a=await action.run('quiz_start',{code},t('Попытка открыта'));if(a){setAttempt(a);setAnswers({});setResult(null)}}
 async function submit(){
  const r=await action.run('quiz_submit',{attempt_id:attempt.attempt_id||attempt.id,answers:questions.map((q,i)=>answers[q.id??i])},t('Ответы проверены'))
  if(r){setResult(r);setAttempt(null);if(r.passed&&lessonCode){await finish()}}
 }
 async function finish(){const completed=await action.run('complete',{code:lessonCode},t('Квиз пройден, занятие завершено'));if(completed)refresh()}
 function toggle(key:string,index:number){setAnswers(a=>{const values=Array.isArray(a[key])?a[key] as number[]:[];return{...a,[key]:values.includes(index)?values.filter(v=>v!==index):[...values,index]}})}
 return <section className={`${panel} academy-lesson-quiz`}><p className="academy-kicker">{t('Проверка понимания')}</p><h2 className="mt-3 font-display text-[20px]">{t('Квиз')}</h2><p className="mt-3 text-sm leading-relaxed text-mute">{t('Ответь самостоятельно. После отправки увидишь результат. Если ошибёшься, вернись к примеру и попробуй ещё раз в пределах доступных попыток.')}</p>
  {!attempt&&!result&&<Cta className="mt-5" busy={action.busy} onClick={()=>void start()}>{t('Начать попытку')}</Cta>}
  {attempt&&<div className="mt-5 space-y-5">{questions.map((q,i)=>{const key=String(q.id??i),type=q.type||'mcq',prompt=text(q.prompt||q.text);return <fieldset key={key}><legend className="text-sm font-semibold">{i+1}. {prompt}</legend>
   {type==='text'||type==='code'?<><textarea aria-label={prompt} value={typeof answers[key]==='string'?answers[key] as string:''} onChange={e=>setAnswers(a=>({...a,[key]:e.target.value}))} className={`academy-field mt-3 ${type==='code'?'min-h-36 font-mono':'min-h-20'}`} maxLength={20000}/>{type==='code'&&<p className="mt-2 text-xs text-mute">{t('Сравнение с эталоном без исполнения кода. Для полноценного проекта используется проверка преподавателем.')}</p>}</>:(q.choices||q.options||[]).map((o:any,j:number)=><label key={j} className="mt-3 flex items-start gap-3 rounded-xl border border-line p-3 text-sm leading-relaxed"><input className="mt-1 accent-violet" type={type==='multi'?'checkbox':'radio'} name={`quiz-${key}`} checked={type==='multi'?Array.isArray(answers[key])&&(answers[key] as number[]).includes(j):answers[key]===j} onChange={()=>type==='multi'?toggle(key,j):setAnswers(a=>({...a,[key]:j}))}/>{typeof o==='string'?o:text(o.text||o.label)}</label>)}
   {type==='multi'&&<p className="mt-2 text-xs text-mute">{t('Выберите все подходящие варианты.')}</p>}</fieldset>})}<Cta busy={action.busy} disabled={!questions.length||questions.some((q,i)=>!academyAnswerPresent(answers[q.id??i]))} onClick={()=>void submit()}>{t('Проверить ответы')}</Cta></div>}
  {result&&<div className="academy-notice"><Status state={result.passed?'passed':'failed'}/><p className="mt-3 text-sm">{t('Результат')}: {result.score}/100</p>{result.passed&&lessonCode?<Cta className="mt-4" busy={action.busy} onClick={()=>void finish()}>{t('Завершить занятие')}</Cta>:<Tap className="mt-4 text-sm text-violet" disabled={action.busy} onClick={()=>void start()}>{t('Запросить новую попытку')}</Tap>}</div>}{action.feedback}
 </section>
}
