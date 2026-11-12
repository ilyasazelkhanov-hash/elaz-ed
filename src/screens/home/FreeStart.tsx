import {saveLastFreeGuide} from '../../lib/learning-next'
import { ArrowLeft, ArrowRight, Check, CheckCheck, Clock3, Compass, Copy, FolderOpen, Image, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { beginnerGlossary, beginnerGuides } from '../../lib/beginner-content'
import { guideEvent, parseGuideStartParam, type DiscoverySource } from '../../lib/discovery-events'
import { track } from '../../lib/track'
import { copyText, startParam } from '../../lib/tg'
import { useStore } from '../../store'
import { isDemo } from '../../lib/api'
import { Tap } from '../../ui'
import './free-start.css'
import { PracticeArtifact } from './PracticeArtifact'
import { GuideJourney } from './GuideJourney'

const icons = {message:MessageSquare,check:ShieldCheck,compass:Compass,image:Image,folder:FolderOpen}
// CourseWindow remounts its content for each path. Carry only the next route's bounded source.
let pendingNavigation: {id:string;source:DiscoverySource} | null = null
function readAttempts(key:string): string[] {
 try {const value:unknown=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&beginnerGuides.some(guide=>guide.id===id)))]:[]}catch{return []}
}
type FreeStartProps = {path:string;go:(path:string)=>void}
export function FreeStart(props:FreeStartProps) {
 const user = useStore(state=>state.me?.id ?? 0)
 return <FreeStartSession key={`${isDemo ? 'demo' : 'live'}:${user}`} {...props} user={user}/>
}
function FreeStartSession({path,go,user}:FreeStartProps & {user:number}) {
 const guideId = path.split('/').filter(Boolean)[1]
 const storageKey = `og:free-start:v2:${isDemo ? 'demo' : 'live'}:${user}`
 const [done,setDone] = useState<string[]>(()=>readAttempts(storageKey))
 const [copied,setCopied] = useState<string | null>(null), guide = beginnerGuides.find(item=>item.id===guideId)
 const [feedback,setFeedback] = useState<Record<string,boolean>>({})
 const opened = useRef<string | null>(null), copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
 const doneRef = useRef(done), feedbackRef = useRef(feedback)
 const entry = parseGuideStartParam(startParam)
 const [initialSource] = useState<DiscoverySource>(()=>pendingNavigation && pendingNavigation.id===guideId?pendingNavigation.source:entry && entry.guideId===guideId?'telegram_guide':'free_start')
 const navigation = useRef<{id:string;source:DiscoverySource} | null>(null)
 const source = navigation.current && navigation.current.id === guideId ? navigation.current.source : initialSource
 const emit = (action:'open'|'copy'|'try'|'feedback',id:string,useful?:boolean) => {const event=guideEvent(action,id,source,useful);if(event)track(event.name,event.props)}
 useEffect(()=>{const loaded=readAttempts(storageKey);doneRef.current=loaded;setDone(loaded);feedbackRef.current={};setFeedback({})},[storageKey])
 useEffect(()=>{
  if (!guide) {opened.current=null;return}
  const key=user+':'+guide.id
  if (opened.current === key) return
  opened.current=key
  saveLastFreeGuide(user, isDemo, guide.id)
  if (pendingNavigation?.id===guide.id) pendingNavigation=null
  const event=guideEvent('open',guide.id,source);if(event)track(event.name,event.props)
 },[guide,source,user])
 useEffect(()=>()=>{if(copyTimer.current!==undefined)clearTimeout(copyTimer.current)},[])
 const openGuide = (id:string,source:DiscoverySource) => {pendingNavigation={id,source};navigation.current=pendingNavigation;go('/start/'+id)}
 const blog = () => useStore.getState().navigateTab('blog')
 const mark = (id:string) => {const current=doneRef.current,selected=!current.includes(id),next=selected?[...current,id]:current.filter(value=>value!==id);doneRef.current=next;setDone(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}if(selected)emit('try',id)}
 const respond = (id:string,useful:boolean) => {if(feedbackRef.current[id]===useful)return;const next={...feedbackRef.current,[id]:useful};feedbackRef.current=next;setFeedback(next);emit('feedback',id,useful)}
 if(guideId&&!guide)return <section className="free-start"><h1>Такого разбора нет</h1><p>Выбери тему в бесплатном старте.</p><Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>К началу</Tap></section>
 if(guide){const index=beginnerGuides.indexOf(guide),next=beginnerGuides[index+1];return <article className="free-start free-start-article" data-free-guide>
  <Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>Все бесплатные разборы</Tap>
  <div className="free-start-eyebrow"><span>Бесплатно</span><span>{index+1} / {beginnerGuides.length}</span></div>
  <h1>{guide.title}</h1><p className="free-start-intro">{guide.intro}</p>
  <p className="free-start-time"><Clock3 size={15}/>{guide.minutes} минут · можно попробовать сразу</p>
  <div className="free-start-result"><Sparkles size={20}/><p>{guide.result}</p></div>
  <p className="free-start-note" role="note">{guide.editorial.access_note}</p>
  <GuideJourney initialPractice={path.split('/').filter(Boolean)[2] === 'work'} scope={`${isDemo ? 'demo' : 'live'}:${user}`} guide={guide}>
  <section className="free-start-prompt"><div><h2>Попробуй этот запрос</h2><Tap aria-label="Скопировать учебный запрос" onClick={async()=>{if(await copyText(guide.prompt)){emit('copy',guide.id);setCopied(guide.id);if(copyTimer.current!==undefined)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(null),1800)}else useStore.getState().toast('Не удалось скопировать. Выдели запрос и скопируй его вручную.')}}>{copied===guide.id?<Check size={18}/>:<Copy size={18}/>}<span>{copied===guide.id?'Скопировано':'Копировать'}</span></Tap></div><pre>{guide.prompt}</pre></section>
  <section className="free-start-task" aria-label="Где выполнить задание"><h2>Теперь попробуй сам</h2><p>Скопируй запрос выше и вставь его в привычный ИИ-сервис. Замени поля в квадратных скобках своей задачей; используй вымышленные или обезличенные данные.</p><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="free-start-link">Открыть ChatGPT в новой вкладке<ArrowRight size={17}/></a><p>Затем вернись сюда и проверь ответ по трём критериям ниже. Если нужная функция недоступна, сделай черновик или эскиз вручную: покупать подписку для этого разбора не требуется.</p></section>
  {guide.workedExample ? <section className="free-start-example free-start-worked" aria-label="Разбор учебного примера">
   <h2>Найди слабое место</h2><p>{guide.workedExample.question}</p>
   <div className="free-start-example-version"><strong>Слабый вариант</strong><p>{guide.workedExample.weak}</p></div>
   <details key={guide.id + '-solution'}><summary tabIndex={0}>Посмотреть разбор и улучшенный вариант</summary>
    <p>{guide.workedExample.issue}</p>
    <div className="free-start-example-version"><strong>Улучшенный вариант</strong><p>{guide.workedExample.improved}</p></div>
    <p>{guide.workedExample.explanation}</p>
   </details>
   <details key={guide.id + '-hints'}><summary tabIndex={0}>Если застрял на своей задаче</summary><ul>{guide.workedExample.hints.map(hint=><li key={hint}>{hint}</li>)}</ul></details>
   <p className="free-start-note">Это учебный разбор, не оценка твоей работы. Примени принцип к своей задаче ниже.</p>
  </section> : <section className="free-start-example"><h2>На примере</h2><p>{guide.example}</p></section>}
  <PracticeArtifact scope={user ? `${isDemo ? 'demo' : 'live'}:${user}` : undefined} course="free-start" lesson={guide.id} title={guide.title} task={guide.task} criteria={guide.checks}/>
  <section className="free-start-task"><h2>Отметка попытки</h2><Tap onClick={()=>mark(guide.id)} aria-pressed={done.includes(guide.id)} className={done.includes(guide.id)?'is-done':''}><CheckCheck size={18}/>{done.includes(guide.id)?'Попробовал · отменить отметку':'Я попробовал'}</Tap><small>Самоотчёт о попытке: отметка хранится в этом браузере отдельно для твоего аккаунта и {isDemo ? 'демо' : 'основного режима'}. Это не проверка результата, без оценки и XP.</small></section>
  <section className="free-start-task" aria-label="Обратная связь о разборе"><h2>Удалось применить?</h2><p>Ответь, если уже попробовал. Отметка попытки и полезность учитываются отдельно.</p><div className="flex flex-wrap gap-3">{([true,false] as const).map(useful=><Tap key={String(useful)} onClick={()=>respond(guide.id,useful)} aria-pressed={feedback[guide.id]===useful} className={feedback[guide.id]===useful?'is-done':''}>{useful?'Да, пригодилось':'Пока нет'}</Tap>)}</div>{feedback[guide.id]!==undefined&&<small role="status">Спасибо за обратную связь.</small>}</section>
  {next?<Tap className="free-start-next" onClick={()=>openGuide(next.id,'guide_next')}><span><small>Следующий бесплатный шаг</small>{next.title}</span><ArrowRight size={19}/></Tap>:<Tap className="free-start-next" onClick={blog}><span><small>Следующий бесплатный шаг</small>Открыть новости</span><ArrowRight size={19}/></Tap>}
  </GuideJourney>
  <p className="free-start-note">Эти разборы бесплатны. Доступные функции выбранного ИИ-сервиса зависят от его условий и твоего аккаунта.</p>
 </article>}
 return <section className="free-start" aria-label="Бесплатный старт с ИИ">
  <div className="free-start-hero"><span className="free-start-kicker"><Sparkles size={15}/>Бесплатно · для новичков</span><h1>С ИИ можно<br/>разобраться.</h1><p>Пять коротких разборов, понятные примеры и запросы, которые можно попробовать на своей задаче.</p><Tap onClick={()=>openGuide(beginnerGuides[0].id,'free_start')}>Сделать первый запрос<ArrowRight size={18}/></Tap></div>
  {done.length>0&&<p className="free-start-progress">{done.length} из {beginnerGuides.length} разборов попробовано</p>}
  <h2 className="free-start-section-title">Начни с того, что нужно сейчас</h2>
  <div className="free-start-grid">{beginnerGuides.map((item,index)=>{const Icon=icons[item.icon as keyof typeof icons];return <Tap key={item.id} className="free-start-card" onClick={()=>openGuide(item.id,'free_start')}><span className="free-start-card-icon"><Icon size={22}/></span><span><small>{item.eyebrow} · {item.minutes} мин</small><b>{item.title}</b><span>{item.result}</span></span><span className="free-start-card-tail">{done.includes(item.id)?<Check size={18}/>:<span>{index+1}</span>}</span></Tap>})}</div>
  <section className="free-start-glossary"><h2>По-человечески об ИИ</h2><p>Несколько слов, которые встретятся в публикациях.</p>{beginnerGlossary.map(([term,definition])=><details key={term}><summary>{term}<span aria-hidden="true">+</span></summary><p>{definition}</p></details>)}</section>
  <section className="free-start-further"><h2>Основа есть. Что дальше?</h2><p>В новостях - новые инструменты и полезные разборы. Если нужен полный маршрут с проектом, посмотри программу платных курсов.</p><Tap onClick={blog}>Читать новости<ArrowRight size={17}/></Tap><Tap onClick={()=>go('/og-practice')}>Посмотреть курсы<ArrowRight size={17}/></Tap></section>
 </section>
}
