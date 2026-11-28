import { useEffect, useId, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { artifactFeedback, artifactKey, artifactStatus, exportArtifact, PRACTICE_LIMIT, readArtifact, saveArtifact, emptyArtifact, removeArtifact, artifactRecovery, artifactRecoveryKey, readArtifactSession, type PracticeArtifact as Artifact } from '../../lib/practice-artifact'
import { practiceReaderRevision } from '../../lib/practice-reader'
import { Tap } from '../../ui'
import './practice-artifact.css'

/** `onPersist` reports that the saved copy in this browser changed. It never carries the learner's text. */
type Props = {scope?:string|number; course:string; lesson:string; title:string; task:string; taskRevision?:string; criteria:readonly string[]; onPersist?:()=>void}
export function PracticeArtifact(props: Props) {
 return <ArtifactSession key={JSON.stringify([props.scope ?? null,props.course,props.lesson,props.taskRevision,props.task,props.criteria])} {...props}/>
}
function ArtifactSession({scope,course,lesson,title,task,criteria,onPersist,taskRevision:sourceRevision}:Props) {
 const taskRevision=practiceReaderRevision(JSON.stringify([sourceRevision ?? '',task]))
 const key=artifactKey(scope,course,lesson), recoveryKey=artifactRecoveryKey(scope,course,lesson), rubric=JSON.stringify(criteria), id=useId()
 const [initial]=useState(()=>readArtifactSession(recoveryKey,key,criteria.length,rubric,taskRevision))
 const [value,setValue]=useState(initial.value)
 const [message,setMessage]=useState(''),[feedback,setFeedback]=useState<string[]|null>(null)
 const [dirty,setDirty]=useState(initial.dirty),[confirmClear,setConfirmClear]=useState(false)
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 const update=(next:Artifact)=>{artifactRecovery.put(recoveryKey,rubric,{value:next,dirty:true});setValue(next);setDirty(true);setFeedback(null);setMessage('')}
 const edit=(field:'result'|'evidence'|'revision',text:string)=>{
  update({...value,[field]:text,checks:criteria.map(()=>false)})
 }
 const review=()=>{setFeedback(artifactFeedback(value,criteria));setMessage('')}
 const download=()=>{
  try {const url=URL.createObjectURL(new Blob([exportArtifact(title,task,value,criteria)],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='og-practice.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Файл подготовлен. Проверь загрузки браузера.')}catch{setMessage('Не удалось создать файл. Скопируй свою работу из полей ниже.')}
 }
 const status=artifactStatus(value)
 return <section className="practice-artifact" aria-labelledby={`${id}-title`}>
  <header><h2 id={`${id}-title`}>Собери свой результат</h2><span>{status==='self_checked'?'Самопроверка выполнена':status==='draft'?'Черновик':'Практическая работа'}</span></header>
  <p>{task}</p>
  {value.stale&&<div role="status"><p>Задание обновилось. Твой текст сохранён, отметки самопроверки сняты.</p><Tap onClick={()=>update({...value,taskRevision,stale:false,checks:criteria.map(()=>false)})}>Я сверил работу с новым заданием, проверить заново</Tap></div>}
  <p className="practice-artifact-privacy">Бери вымышленные или обезличенные данные, без паролей и сведений о пациентах. Работа не отправляется ИИ или преподавателю: она остаётся в этом браузере и сохраняется по кнопке, без синхронизации.</p>
  {(['result','evidence','revision'] as const).map((field,index)=><label key={field} htmlFor={`${id}-${field}`}><b>{['Мой результат','Как я проверил','Что улучшил после проверки'][index]}</b><textarea id={`${id}-${field}`} rows={field==='result'?5:2} maxLength={PRACTICE_LIMIT} value={value[field]} onChange={e=>edit(field,e.target.value)} placeholder={['Вставь свою работу или опиши созданный файл.','Какие факты, источники или тесты ты проверил?','Что изменилось и почему? Если правки не нужны, объясни почему.'][index]}/></label>)}
  <fieldset disabled={value.stale}><legend>Проверь работу по критериям</legend>{criteria.map((text,index)=><label key={index}><input type="checkbox" checked={!!value.checks[index]} onChange={e=>{const checked=e.target.checked;update({...value,checks:value.checks.map((v,i)=>i===index?checked:v)})}}/>{text}</label>)}</fieldset>
  <p className="practice-artifact-privacy">Изменил текст - отметки сбросятся: новую версию проверь заново. Это самопроверка, не подтверждённый навык: XP и сертификат за неё не выдаются.</p>
  <div className="practice-artifact-actions"><Tap onClick={review}>Что ещё проверить?</Tap><Tap disabled={!key || status==='empty'} onClick={()=>{const ok=saveArtifact(key,value,rubric);setMessage(ok?'Работа сохранена в этом браузере.':'Браузер не сохранил работу. Скачай файл, чтобы не потерять её.');if(ok){artifactRecovery.remove(recoveryKey);setDirty(false);onPersist?.()}}}><Save size={16}/>Сохранить</Tap><Tap disabled={status==='empty'} onClick={download}><Download size={16}/>Скачать .txt</Tap></div>
  <div className="practice-artifact-actions">{confirmClear?<><span>Удалить работу из этого браузера?</span><Tap onClick={()=>{if(removeArtifact(key)){artifactRecovery.remove(recoveryKey);setValue({...emptyArtifact(criteria.length),taskRevision,stale:false});setDirty(false);setFeedback(null);setConfirmClear(false);setMessage('Работа удалена из этого браузера. Скачанные файлы остаются у тебя.');onPersist?.()}else setMessage('Не удалось удалить сохранённую работу. Проверь доступ к хранилищу браузера.')}}>Да, удалить</Tap><Tap onClick={()=>setConfirmClear(false)}>Отмена</Tap></>:<Tap disabled={status==='empty'&&!key} onClick={()=>setConfirmClear(true)}>Удалить эту работу</Tap>}</div>
  <p role="status" className="practice-artifact-status">{message || (dirty?'Есть несохранённые изменения. Сохрани или скачай работу до закрытия страницы.':!key?'Без аккаунта работа живёт только до закрытия страницы. Скачай её, чтобы не потерять.':'')}</p>
  {feedback!==null&&<div className="practice-artifact-feedback" role="status">{feedback.length?<><b>Следующий шаг</b><ul>{feedback.map((text,i)=><li key={i}>{text}</li>)}</ul></>:<p>Все пункты отмечены. Попробуй ещё раз с другим условием и без подсказки. Приложение не проверяло твой текст: оценить его может только человек.</p>}</div>}
 </section>
}
