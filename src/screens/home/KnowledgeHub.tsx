import {ArrowUpRight,BookOpen,Compass,Sparkles,Zap} from 'lucide-react'
import {useState} from 'react'
import {knowledgeTopics,courseGuide,topicForPost} from '../../lib/knowledge'
import {comparePosts,isBlogPost,postDate} from '../../lib/content'
import type {Card} from '../../lib/types'
import {useStore} from '../../store'
import {Tap} from '../../ui'
import './knowledge.css'

/** Editorial picks are labelled as picks, never fabricated live trend statistics. */
export function KnowledgeHub({posts}:{posts:Card[]}){
 const [audience,setAudience]=useState<'beginner'|'practitioner'>('beginner'),[topic,setTopic]=useState('tools')
 const push=useStore(s=>s.push),setTab=useStore(s=>s.setTab)
 const current=knowledgeTopics.find(t=>t.id===topic)??knowledgeTopics[0]
 const code=audience==='beginner'?current.courseCodes[0]:current.courseCodes[Math.min(1,current.courseCodes.length-1)],guide=courseGuide(code)
 const picks=posts.filter(isBlogPost).filter(p=>topicForPost(p)===topic).sort(comparePosts).slice(0,2)
 return <section aria-label="База знаний" className="knowledge-hub mx-5 my-5 overflow-hidden rounded-[28px] border border-line">
  <div className="relative overflow-hidden p-5"><span className="knowledge-orb" aria-hidden="true"/><div className="relative">
   <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet"><Sparkles size={16}/>OG · Берлога знаний</p>
   <h2 className="font-display text-[26px] font-semibold leading-tight">Разобраться. Попробовать.<br/>Сделать своё.</h2>
   <p className="mt-3 max-w-lg text-sm leading-relaxed text-mute">Приёмы, разборы и курсы по ИИ. Зайди за идеей на сегодня — останься, чтобы освоить навык.</p>
   <div className="mt-5 flex flex-wrap gap-2" aria-label="Как изучать базу">{([['beginner','Я начинаю'],['practitioner','Уже практикую']] as const).map(([id,label])=><Tap key={id} aria-pressed={audience===id} onClick={()=>setAudience(id)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${audience===id?'border-violet bg-violet text-white':'border-line bg-card text-ink'}`}>{label}</Tap>)}</div>
  </div></div>
  <div className="relative border-t border-line bg-card/70 p-5">
   <div className="no-bar flex gap-2 overflow-x-auto pb-3" aria-label="Темы базы знаний">{knowledgeTopics.map(t=><Tap key={t.id} aria-pressed={topic===t.id} onClick={()=>setTopic(t.id)} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold ${topic===t.id?'border-violet bg-violet/10 text-violet':'border-line text-mute'}`}>{t.label}</Tap>)}</div>
   <p className="my-3 text-sm leading-relaxed text-mute">{audience==='beginner'?current.beginner:current.practitioner}</p>
   {guide&&<Tap onClick={()=>push({type:'learning',path:`/courses/${guide.code}`})} className="knowledge-path flex min-h-16 w-full items-start gap-3 rounded-2xl p-4 text-left"><BookOpen size={21} className="mt-0.5 shrink-0 text-violet"/><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-violet">{audience==='beginner'?'По шагам, с основ':'Следующий уровень'}</span><b className="mt-1 block text-sm">{guide.plainTitle}</b><span className="mt-2 block text-xs leading-relaxed text-mute">{guide.outcome}</span></span><ArrowUpRight size={18} className="shrink-0"/></Tap>}
   {picks.length>0&&<div className="mt-4"><h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-mute"><Zap size={15}/>Почитать по теме</h3>{picks.map(p=><Tap key={p.id} onClick={()=>push({type:'lesson',id:p.id})} className="flex min-h-14 w-full items-center gap-3 border-b border-line py-3 text-left last:border-0"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.title}</span><span className="mt-1 block text-xs text-mute">{p.pinned?'Выбор редактора · ':''}{postDate(p.published_at)} · {p.minutes} мин</span></span><ArrowUpRight size={16}/></Tap>)}</div>}
   <Tap onClick={()=>setTab('blog')} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-4 text-sm font-semibold text-violet"><Compass size={17}/>Все разборы и свежие публикации</Tap>
  </div>
 </section>
}
