import { useEffect, useId, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { artifactFeedback, artifactKey, artifactStatus, exportArtifact, PRACTICE_LIMIT, readArtifact, saveArtifact, emptyArtifact, removeArtifact, type PracticeArtifact as Artifact } from '../../lib/practice-artifact'
import { Tap } from '../../ui'
import './practice-artifact.css'

type Props = {scope?:string|number; course:string; lesson:string; title:string; task:string; criteria:readonly string[]}
export function PracticeArtifact(props: Props) {
 return <ArtifactSession key={`${props.scope ?? 'session'}:${props.course}:${props.lesson}`} {...props}/>
}
function ArtifactSession({scope,course,lesson,title,task,criteria}:Props) {
 const key=artifactKey(scope,course,lesson), rubric=JSON.stringify(criteria), id=useId()
 const [value,setValue]=useState(()=>readArtifact(key,criteria.length,rubric))
 const [message,setMessage]=useState(''),[feedback,setFeedback]=useState<string[]|null>(null)
 const [dirty,setDirty]=useState(false),[confirmClear,setConfirmClear]=useState(false)
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 const edit=(field:'result'|'evidence'|'revision',text:string)=>{
  setValue(current=>({...current,[field]:text,checks:criteria.map(()=>false)}));setDirty(true);setFeedback(null);setMessage('')
 }
 const review=()=>{setFeedback(artifactFeedback(value,criteria));setMessage('')}
 const download=()=>{
  try {const url=URL.createObjectURL(new Blob([exportArtifact(title,task,value,criteria)],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='og-practice.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Файл подготовлен. Проверь загрузки браузера.')}catch{setMessage('Не удалось создать файл. Скопируй свою работу из полей ниже.')}
 }
 const status=artifactStatus(value)
 return <section className="practice-artifact" aria-labelledby={`${id}-title`}>
  <header><h2 id={`${id}-title`}>Собери свой результат</h2><span>{status==='self_checked'?'Самопроверка выполнена':status==='draft'?'Черновик':'Практическая работа'}</span></header>
  <p>{task}</p>
  <p className="practice-artifact-privacy">Используй вымышленные или обезличенные данные. Не добавляй пароли и данные пациентов. Работа не отправляется ИИ или преподавателю. Сохранение - только в этом браузере по кнопке, без синхронизации.</p>
  {(['result','evidence','revision'] as const).map((field,index)=><label key={field} htmlFor={`${id}-${field}`}><b>{['Мой результат','Как я проверил','Что улучшил после проверки'][index]}</b><textarea id={`${id}-${field}`} rows={field==='result'?5:2} maxLength={PRACTICE_LIMIT} value={value[field]} onChange={e=>edit(field,e.target.value)} placeholder={['Вставь свою работу или опиши созданный файл.','Какие факты, источники или тесты ты проверил?','Что изменилось и почему? Если правки не нужны, объясни почему.'][index]}/></label>)}
  <fieldset><legend>Проверь работу по критериям</legend>{criteria.map((text,index)=><label key={index}><input type="checkbox" checked={!!value.checks[index]} onChange={e=>{const checked=e.target.checked;setValue(current=>({...current,checks:current.checks.map((v,i)=>i===index?checked:v)}));setDirty(true);setFeedback(null);setMessage('')}}/>{text}</label>)}</fieldset>
  <p className="practice-artifact-privacy">После изменения текста отметки сбрасываются: новую версию нужно проверить заново. Это самооценка, не подтверждённый навык. XP и сертификат за неё не выдаются.</p>
  <div className="practice-artifact-actions"><Tap onClick={review}>Что ещё проверить?</Tap><Tap disabled={!key || status==='empty'} onClick={()=>{const ok=saveArtifact(key,value,rubric);setMessage(ok?'Работа сохранена в этом браузере.':'Браузер не сохранил работу. Скачай файл, чтобы не потерять её.');if(ok)setDirty(false)}}><Save size={16}/>Сохранить</Tap><Tap disabled={status==='empty'} onClick={download}><Download size={16}/>Скачать .txt</Tap></div>
  <div className="practice-artifact-actions">{confirmClear?<><span>Удалить работу из этого браузера?</span><Tap onClick={()=>{if(removeArtifact(key)){setValue(emptyArtifact(criteria.length));setDirty(false);setFeedback(null);setConfirmClear(false);setMessage('Работа удалена из этого браузера. Скачанные файлы остаются у тебя.')}else setMessage('Не удалось удалить сохранённую работу. Проверь доступ к хранилищу браузера.')}}>Да, удалить</Tap><Tap onClick={()=>setConfirmClear(false)}>Отмена</Tap></>:<Tap disabled={status==='empty'&&!key} onClick={()=>setConfirmClear(true)}>Удалить эту работу</Tap>}</div>
  <p role="status" className="practice-artifact-status">{message || (dirty?'Есть несохранённые изменения. Перед выходом сохрани или скачай работу.':!key?'Без аккаунта работа доступна только на этом экране. Скачай её перед выходом.':'')}</p>
  {feedback!==null&&<div className="practice-artifact-feedback" role="status">{feedback.length?<><b>Следующий шаг</b><ul>{feedback.map((text,i)=><li key={i}>{text}</li>)}</ul></>:<p>Все пункты отмечены. Теперь повтори задачу с другим условием без подсказки. Только независимая проверка может подтвердить навык; приложение не оценивало правильность твоего текста.</p>}</div>}
 </section>
}
