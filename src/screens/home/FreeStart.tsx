import {readLastFreeGuide,saveLastFreeGuide} from '../../lib/learning-next'
import { ArrowLeft, ArrowRight, Check, Clock3, Compass, Copy, FolderOpen, Image, MessageSquare, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { beginnerGlossary, beginnerGuides } from '../../lib/beginner-content'
import { guideEvent, parseGuideStartParam, WARMUP_ID, type DiscoverySource } from '../../lib/discovery-events'
import { guideInteractions, guideJourneyKey, guideJourneyProgress } from '../../lib/guide-interactions'
import { freeStartLink } from '../../lib/links'
import { artifactKey, artifactStatus, readArtifact } from '../../lib/practice-artifact'
import { guideCard } from '../../lib/shareCard'
import { sparksEnabled, sparksWord } from '../../lib/practice-sparks'
import { useSparks } from '../../lib/use-practice-sparks'
import { readWarmup } from '../../lib/warmup'
import { track } from '../../lib/track'
import { copyText, startParam } from '../../lib/tg'
import { useStore } from '../../store'
import { isDemo } from '../../lib/api'
import { Tap } from '../../ui'
import './free-start.css'
import { PracticeArtifact } from './PracticeArtifact'
import { GuideJourney } from './GuideJourney'
import { GuideFinale } from './GuideFinale'
import { Warmup } from './Warmup'
import { guideDoneEffect } from './practice-effects'

const icons = {message:MessageSquare,check:ShieldCheck,compass:Compass,image:Image,folder:FolderOpen}
type Guide = typeof beginnerGuides[number]
// CourseWindow remounts its content for each path. Carry only the next route's bounded source.
let pendingNavigation: {id:string;source:DiscoverySource} | null = null
function readAttempts(key:string): string[] {
 try {const value:unknown=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&beginnerGuides.some(guide=>guide.id===id)))]:[]}catch{return []}
}
/** Solved training tasks of the saved attempt. A place in practice, never a grade. */
const trainingOf = (scope:string,guide:Guide) => {const questions=guideInteractions[guide.id]??[];return guideJourneyProgress(guideJourneyKey(scope,guide.id,[guide.steps,questions]),questions)}
type FreeStartProps = {path:string;go:(path:string)=>void}
export function FreeStart(props:FreeStartProps) {
 const user = useStore(state=>state.me?.id ?? 0)
 return <FreeStartSession key={`${isDemo ? 'demo' : 'live'}:${user}`} {...props} user={user}/>
}
function FreeStartSession({path,go,user}:FreeStartProps & {user:number}) {
 const guideId = path.split('/').filter(Boolean)[1]
 const scope = `${isDemo ? 'demo' : 'live'}:${user}`
 const storageKey = `og:free-start:v2:${scope}`
 const [done,setDone] = useState<string[]>(()=>readAttempts(storageKey))
 const [copied,setCopied] = useState<string | null>(null), guide = beginnerGuides.find(item=>item.id===guideId)
 const [feedback,setFeedback] = useState<Record<string,boolean>>({})
 // Training steps and saved work live in their own components: re-read them when they report a change.
 const [,refresh] = useState(0)
 const sparks = useSparks(scope)
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
 const mark = (id:string) => {const current=doneRef.current,selected=!current.includes(id),next=selected?[...current,id]:current.filter(value=>value!==id);doneRef.current=next;setDone(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}if(selected){emit('try',id);guideDoneEffect()}}
 const respond = (id:string,useful:boolean) => {if(feedbackRef.current[id]===useful)return;const next={...feedbackRef.current,[id]:useful};feedbackRef.current=next;setFeedback(next);emit('feedback',id,useful)}
 if(guideId===WARMUP_ID)return <Warmup scope={scope} go={go} openGuide={id=>openGuide(id,'free_start')}/>
 if(guideId&&!guide)return <section className="free-start"><h1>Такого разбора нет</h1><p>Выбери тему в бесплатном старте.</p><Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>К началу</Tap></section>
 if(guide){
  const index=beginnerGuides.indexOf(guide),next=beginnerGuides[index+1],tried=done.includes(guide.id)
  const artifactScope=user ? scope : undefined
  const work=artifactStatus(readArtifact(artifactKey(artifactScope,'free-start',guide.id),guide.checks.length,JSON.stringify(guide.checks)))
  const trained=trainingOf(scope,guide)
  return <article className="free-start free-start-article" data-free-guide>
  <Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>Все бесплатные разборы</Tap>
  <div className="free-start-eyebrow"><span>Бесплатно</span><span>{index+1} / {beginnerGuides.length}</span></div>
  <h1>{guide.title}</h1><p className="free-start-intro">{guide.intro}</p>
  <p className="free-start-time"><Clock3 size={15}/>{guide.minutes} минут · можно попробовать сразу</p>
  <div className="free-start-result"><Sparkles size={20}/><p>{guide.result}</p></div>
  <p className="free-start-note" role="note">{guide.editorial.access_note}</p>
  <GuideJourney initialPractice={path.split('/').filter(Boolean)[2] === 'work'} scope={scope} guide={guide} onProgress={()=>refresh(value=>value+1)}>
  <section className="free-start-prompt"><div><h2>Попробуй этот запрос</h2><Tap aria-label="Скопировать учебный запрос" onClick={async()=>{if(await copyText(guide.prompt)){emit('copy',guide.id);setCopied(guide.id);if(copyTimer.current!==undefined)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(null),1800)}else useStore.getState().toast('Не удалось скопировать. Выдели запрос и скопируй его вручную.')}}>{copied===guide.id?<Check size={18}/>:<Copy size={18}/>}<span>{copied===guide.id?'Скопировано':'Копировать'}</span></Tap></div><pre>{guide.prompt}</pre></section>
  <section className="free-start-task" aria-label="Где выполнить задание"><h2>Теперь попробуй сам</h2><p>Скопируй запрос и вставь его в свой ИИ-чат. Поля в квадратных скобках замени своей задачей. Данные бери вымышленные или обезличенные.</p><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="free-start-link">Открыть ChatGPT в новой вкладке<ArrowRight size={17}/></a><p>Потом вернись и проверь ответ по критериям ниже. Нет доступа к ИИ? Сделай черновик вручную: подписка для этого разбора не нужна.</p></section>
  {guide.workedExample ? <section className="free-start-example free-start-worked" aria-label="Разбор учебного примера">
   <h2>Найди слабое место</h2><p>{guide.workedExample.question}</p>
   <div className="free-start-example-version"><strong>Слабый вариант</strong><p>{guide.workedExample.weak}</p></div>
   <details key={guide.id + '-solution'}><summary tabIndex={0}>Посмотреть разбор и улучшенный вариант</summary>
    <p>{guide.workedExample.issue}</p>
    <div className="free-start-example-version"><strong>Улучшенный вариант</strong><p>{guide.workedExample.improved}</p></div>
    <p>{guide.workedExample.explanation}</p>
   </details>
   <details key={guide.id + '-hints'}><summary tabIndex={0}>Если застрял на своей задаче</summary><ul>{guide.workedExample.hints.map(hint=><li key={hint}>{hint}</li>)}</ul></details>
   <p className="free-start-note">Это пример, а не оценка твоей работы. Тот же приём примени к своей задаче ниже.</p>
  </section> : <section className="free-start-example"><h2>На примере</h2><p>{guide.example}</p></section>}
  <PracticeArtifact scope={artifactScope} course="free-start" lesson={guide.id} title={guide.title} task={guide.task} criteria={guide.checks} onPersist={()=>refresh(value=>value+1)}/>
  <GuideFinale done={tried} trained={trained} work={work} demo={isDemo} next={next} telegramLink={freeStartLink(next?.id ?? guide.id)}
   onMark={()=>mark(guide.id)} onNext={()=>next&&openGuide(next.id,'guide_next')}
   onShare={()=>useStore.setState({share:guideCard(guide,trained,freeStartLink(guide.id))})}/>
  <section className="free-start-task" aria-label="Обратная связь о разборе"><h2>Удалось применить?</h2><p>Один ответ помогает нам улучшать разборы.</p><div className="flex flex-wrap gap-3">{([true,false] as const).map(useful=><Tap key={String(useful)} onClick={()=>respond(guide.id,useful)} aria-pressed={feedback[guide.id]===useful} className={feedback[guide.id]===useful?'is-done':''}>{useful?'Да, пригодилось':'Пока нет'}</Tap>)}</div>{feedback[guide.id]!==undefined&&<small role="status">Спасибо за обратную связь.</small>}</section>
  {!tried&&next&&<Tap className="free-start-next" onClick={()=>openGuide(next.id,'guide_next')}><span><small>Следующий бесплатный шаг</small>{next.title}</span><ArrowRight size={19}/></Tap>}
  {!next&&<Tap className="free-start-next" onClick={blog}><span><small>Следующий бесплатный шаг</small>Открыть новости</span><ArrowRight size={19}/></Tap>}
  </GuideJourney>
  <p className="free-start-note">Разборы бесплатные. Что умеет твой ИИ-сервис, зависит от его тарифа.</p>
 </article>}
 // Start screen: one route of five steps. Every step stays open; the highlight is a suggestion, not a lock.
 const lastFree=readLastFreeGuide(user,isDemo)
 const route=beginnerGuides.map(item=>({item,tried:done.includes(item.id),trained:trainingOf(scope,item)}))
 const current=(lastFree&&!done.includes(lastFree)?route.find(step=>step.item.id===lastFree):undefined)??route.find(step=>!step.tried)
 const begun=done.length>0||route.some(step=>step.trained.correct>0),warmup=readWarmup(scope)
 return <section className="free-start" aria-label="Бесплатный старт с ИИ">
  <div className="free-start-hero"><span className="free-start-kicker"><Sparkles size={15}/>Бесплатно · для новичков</span><h1>С ИИ можно<br/>разобраться.</h1><p>Пять коротких разборов: тренируешься на заданиях и сразу пробуешь на своей задаче.</p>
   {current?<Tap onClick={()=>openGuide(current.item.id,'free_start')}>{begun?`Продолжить: ${current.item.title}`:'Сделать первый запрос'}<ArrowRight size={18}/></Tap>:<Tap onClick={()=>go('/og-practice')}>Все пять попробованы. Посмотреть курсы<ArrowRight size={18}/></Tap>}
  </div>
  <div className="free-start-status">
   <p className="free-start-progress" role="status">{done.length} из {beginnerGuides.length} разборов попробовано</p>
   {sparksEnabled()&&<details className="free-start-sparks"><summary tabIndex={0}><Sparkles size={15} aria-hidden="true"/><span>{sparks.total} {sparksWord(sparks.total)}</span></summary><p>Искры - очки за задания тренировок и разминки{sparks.best>=2?`. Лучшая серия верных ответов подряд: ${sparks.best}`:''}. Они живут только в этом браузере. Это не XP и не уровень: за искры ничего не открывается и не продаётся.</p></details>}
  </div>
  <Tap className="free-start-warmup" onClick={()=>go('/start/'+WARMUP_ID)}><span className="free-start-card-icon"><Zap size={22}/></span><span><small>AI-разминка · 2 минуты</small><b>{warmup?`Твой результат: ${warmup.score} из ${warmup.total}`:'Проверь, как ты работаешь с ИИ'}</b><span>{warmup?'Посмотреть разбор по темам или пройти ещё раз.':'Пять заданий и подсказка, с какого разбора начать.'}</span></span><ArrowRight size={18} aria-hidden="true"/></Tap>
  <h2 className="free-start-section-title">Твой маршрут: пять шагов</h2>
  <p className="free-start-route-note">Порядок подсказывает, с чего начать. Открыть можно любой шаг.</p>
  <div className="free-start-grid">{route.map(({item,tried,trained},index)=>{
   const Icon=icons[item.icon as keyof typeof icons],now=current?.item.id===item.id
   const status=tried?'Попробовано':trained.correct===trained.total&&trained.total>0?'Тренировка пройдена · осталась своя работа':trained.correct>0?`Тренировка: ${trained.correct} из ${trained.total}`:now&&(begun||index>0)?'Следующий шаг':''
   return <Tap key={item.id} className="free-start-card" data-state={tried?'tried':now?'current':trained.correct>0?'started':'idle'} onClick={()=>openGuide(item.id,'free_start')}><span className="free-start-card-icon"><Icon size={22}/></span><span><small>{item.eyebrow} · {item.minutes} мин</small><b>{item.title}</b><span>{item.result}</span>{status&&<span className="free-start-card-status">{status}</span>}</span><span className="free-start-card-tail">{tried?<Check size={18}/>:<span>{index+1}</span>}</span></Tap>
  })}</div>
  <section className="free-start-task" aria-labelledby="vibe-atlas-title">
   <h2 id="vibe-atlas-title">VIBE ATLAS: справочник по вайбкодингу</h2>
   <p>Бесплатная методичка: 302 инструмента, навыка и MCP, 12 практических сценариев, готовые стеки и глоссарий. Для тех, кто хочет создавать приложения с ИИ.</p>
   <details>
    <summary>Попробовать первую задачу</summary>
    <p>Представь один экран для людей, которым нужно решить одну задачу. Опиши пользователя, действие и результат. Затем выпиши, что человек увидит сразу, что нажмёт и что произойдёт после нажатия.</p>
    <p><strong>Пример.</strong> Владелец питомца отмечает приём лекарства, чтобы видеть время последней дозы. На экране есть название, кнопка «Отметить приём» и запись с временем после нажатия.</p>
    <PracticeArtifact scope={user ? scope : undefined} course="free-start" lesson="vibe-atlas-first-screen"
     title="План первого экрана" task="Запиши идею одним предложением, затем перечисли содержимое экрана, одно основное действие и видимый результат."
     criteria={['Назван человек и его задача','На первом экране есть одно основное действие','Описано, что изменится после нажатия']}/>
   </details>
   <a className="free-start-link" href="/materials/vibe-atlas-2026-11-22.md" download="VIBE_ATLAS_2026.md">Скачать полную методичку (.md)<ArrowRight size={17} aria-hidden="true"/></a>
   <a className="free-start-link" href="https://vibe-atlas-six.vercel.app/" target="_blank" rel="noopener noreferrer">Открыть каталог Vibe Atlas в новой вкладке<ArrowRight size={17} aria-hidden="true"/></a>
   <p className="free-start-note">Редакция от 22 ноября 2026. Файл открывается в Markdown-редакторе, например Obsidian или VS Code. Команды и совместимость инструментов нужно сверять с их документацией; включение в каталог не означает проверку или установку.</p>
  </section>
  <section className="free-start-glossary"><h2>По-человечески об ИИ</h2><p>Несколько слов, которые встретятся в публикациях.</p>{beginnerGlossary.map(([term,definition])=><details key={term}><summary>{term}<span aria-hidden="true">+</span></summary><p>{definition}</p></details>)}</section>
  <section className="free-start-further"><h2>Основа есть. Что дальше?</h2><p>В новостях - новые инструменты и полезные разборы. Если нужен полный маршрут с проектом, посмотри программу платных курсов.</p><Tap onClick={blog}>Читать новости<ArrowRight size={17}/></Tap><Tap onClick={()=>go('/og-practice')}>Посмотреть курсы<ArrowRight size={17}/></Tap></section>
 </section>
}
