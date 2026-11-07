import { ArrowLeft, ArrowRight, Check, CheckCheck, Clock3, Compass, Copy, FolderOpen, Image, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { beginnerGlossary, beginnerGuides } from '../../lib/beginner-content'
import { copyText } from '../../lib/tg'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import './free-start.css'

const icons = {message:MessageSquare,check:ShieldCheck,compass:Compass,image:Image,folder:FolderOpen}
export function FreeStart({path,go}:{path:string;go:(path:string)=>void}) {
 const user = useStore(state=>state.me?.id ?? 0), guideId = path.split('/').filter(Boolean)[1]
 const storageKey = 'og:free-start:' + user
 const [done,setDone] = useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(value)?value.filter(id=>beginnerGuides.some(guide=>guide.id===id)):[]}catch{return []}})
 const [copied,setCopied] = useState(false), guide = beginnerGuides.find(item=>item.id===guideId)
 const blog = () => {const store=useStore.getState();store.pop();store.setTab('blog')}
 const mark = (id:string) => setDone(current=>{const next=current.includes(id)?current.filter(value=>value!==id):[...current,id];try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}return next})
 if(guideId&&!guide)return <section className="free-start"><h1>Такого разбора нет</h1><p>Выбери тему в бесплатном старте.</p><Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>К началу</Tap></section>
 if(guide){const index=beginnerGuides.indexOf(guide),next=beginnerGuides[index+1];return <article className="free-start free-start-article" data-free-guide>
  <Tap className="free-start-link" onClick={()=>go('/start')}><ArrowLeft size={17}/>Все бесплатные разборы</Tap>
  <div className="free-start-eyebrow"><span>Бесплатно</span><span>{index+1} / {beginnerGuides.length}</span></div>
  <h1>{guide.title}</h1><p className="free-start-intro">{guide.intro}</p>
  <p className="free-start-time"><Clock3 size={15}/>{guide.minutes} минут · можно попробовать сразу</p>
  <div className="free-start-result"><Sparkles size={20}/><p>{guide.result}</p></div>
  <ol className="free-start-steps">{guide.steps.map((step,i)=><li key={step.title}><span aria-hidden="true">{i+1}</span><div><h2>{step.title}</h2><p>{step.text}</p></div></li>)}</ol>
  <section className="free-start-prompt"><div><h2>Попробуй этот запрос</h2><Tap aria-label="Скопировать учебный запрос" onClick={async()=>{if(await copyText(guide.prompt)){setCopied(true);setTimeout(()=>setCopied(false),1800)}}}>{copied?<Check size={18}/>:<Copy size={18}/>}<span>{copied?'Скопировано':'Копировать'}</span></Tap></div><pre>{guide.prompt}</pre></section>
  <section className="free-start-example"><h2>На примере</h2><p>{guide.example}</p></section>
  <section><h2>Как проверить себя</h2><ul className="free-start-checks">{guide.checks.map(check=><li key={check}><Check size={17}/><span>{check}</span></li>)}</ul></section>
  <section className="free-start-task"><h2>Твой маленький результат</h2><p>{guide.task}</p><Tap onClick={()=>mark(guide.id)} aria-pressed={done.includes(guide.id)} className={done.includes(guide.id)?'is-done':''}><CheckCheck size={18}/>{done.includes(guide.id)?'Попробовал · отменить отметку':'Я попробовал'}</Tap><small>Это твоя отметка в этом браузере, без оценки и начисления XP.</small></section>
  {next?<Tap className="free-start-next" onClick={()=>go('/start/'+next.id)}><span><small>Дальше</small>{next.title}</span><ArrowRight size={19}/></Tap>:<Tap className="free-start-next" onClick={blog}><span><small>Продолжай узнавать полезное</small>Открыть обновления</span><ArrowRight size={19}/></Tap>}
  <p className="free-start-note">Эти разборы бесплатны. Доступные функции выбранного ИИ-сервиса зависят от его условий и твоего аккаунта.</p>
 </article>}
 return <section className="free-start" aria-label="Бесплатный старт с ИИ">
  <div className="free-start-hero"><span className="free-start-kicker"><Sparkles size={15}/>Бесплатно · для новичков</span><h1>С ИИ можно<br/>разобраться.</h1><p>Пять коротких разборов, понятные примеры и запросы, которые можно попробовать на своей задаче.</p><Tap onClick={()=>go('/start/'+beginnerGuides[0].id)}>Сделать первый запрос<ArrowRight size={18}/></Tap></div>
  {done.length>0&&<p className="free-start-progress">{done.length} из {beginnerGuides.length} разборов попробовано</p>}
  <h2 className="free-start-section-title">Начни с того, что нужно сейчас</h2>
  <div className="free-start-grid">{beginnerGuides.map((item,index)=>{const Icon=icons[item.icon as keyof typeof icons];return <Tap key={item.id} className="free-start-card" onClick={()=>go('/start/'+item.id)}><span className="free-start-card-icon"><Icon size={22}/></span><span><small>{item.eyebrow} · {item.minutes} мин</small><b>{item.title}</b><span>{item.result}</span></span><span className="free-start-card-tail">{done.includes(item.id)?<Check size={18}/>:<span>{index+1}</span>}</span></Tap>})}</div>
  <section className="free-start-glossary"><h2>По-человечески об ИИ</h2><p>Несколько слов, которые встретятся в публикациях.</p>{beginnerGlossary.map(([term,definition])=><details key={term}><summary>{term}<span aria-hidden="true">+</span></summary><p>{definition}</p></details>)}</section>
  <section className="free-start-further"><h2>Основа есть. Что дальше?</h2><p>В обновлениях — новые инструменты и полезные разборы. Если нужен полный маршрут с проектом, посмотри программу платных курсов.</p><Tap onClick={blog}>Читать обновления<ArrowRight size={17}/></Tap><Tap onClick={()=>go('/og-practice')}>Посмотреть курсы<ArrowRight size={17}/></Tap></section>
 </section>
}
