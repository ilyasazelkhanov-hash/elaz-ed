import { ChevronRight,Flame,Zap } from 'lucide-react'
import { useStore } from '../store'
import { Avatar,Tap } from '../ui'
import { MainCourses } from './home/AcademyCourses'
import { Feed } from './home/Feed'
import { StoryBubble } from './home/parts'

/** Main tasks first: courses and reading. Rewards and service tools live in profile. */
export function Home(){
 const me=useStore(s=>s.me)!,feed=useStore(s=>s.feed),setTab=useStore(s=>s.setTab)
 const stories=feed.filter(c=>c.kind==='story')
 return <div data-tab-scroll className="scroll h-full" style={{paddingBottom:'calc(110px + var(--bottom))'}}>
  <header className="mb-5 flex items-center gap-3 px-5" style={{paddingTop:'calc(var(--top) + 18px)'}}>
   <Tap aria-label="Профиль" onClick={()=>setTab('profile')}><Avatar name={me.name} photo={me.photo} id={me.id} size={44}/></Tap>
   <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-violet">OG CRE8R</p><h1 className="truncate text-base font-semibold">Привет, {me.name}</h1></div>
   <Tap onClick={()=>setTab('profile')} aria-label="Мои достижения" className="flex min-h-11 items-center gap-3 rounded-full border border-line bg-card px-3 text-xs font-semibold"><span className="flex items-center gap-1"><Flame size={15} className="text-peach"/>{me.streak}</span><span className="flex items-center gap-1"><Zap size={15} className="text-violet"/>{me.xp}</span></Tap>
  </header>
  <p className="mb-3 px-5 text-sm text-mute">Учись новому или читай свежие заметки об ИИ.</p>
  <MainCourses/>
  <section className="mt-2 px-5" aria-label="Блог"><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Блог</h2><Tap onClick={()=>setTab('blog')} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-violet">Все публикации<ChevronRight size={16}/></Tap></div><Feed lessons={feed} compact/></section>
  {stories.length>0&&<section className="mt-6" aria-label="Из канала"><h2 className="mb-4 px-5 font-display text-base font-semibold">Из канала</h2><div className="no-bar flex gap-3 overflow-x-auto px-5">{stories.map((story,i)=><StoryBubble key={story.id} card={story} index={i}/>)}</div></section>}
 </div>
}
