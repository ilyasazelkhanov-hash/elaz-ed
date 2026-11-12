import { activeStories } from '../lib/highlights'
import { AnimatePresence } from 'motion/react'
import { ArrowRight, ArrowUpRight, Bookmark, ChevronRight, Compass, Sparkles, WandSparkles } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useFollowedTopics, useSavedPosts } from '../lib/blog-library'
import { knowledgeTopics } from '../lib/knowledge'
import { useStore } from '../store'
import { Avatar, Odometer, Tap } from '../ui'
import { AdventBanner } from './advent/Banner'
import { MainCourses } from './home/AcademyCourses'
import { Companion } from './home/Companion'
import { openBlogLibrary } from './home/blog-view'
import { DailyCard, StreakCard } from './home/Daily'
import { Feed } from './home/Feed'
import { StoryBubble } from './home/parts'
import './home/free-first.css'

const homeTopics = [
  { id: 'tools', title: 'ИИ без сложностей', detail: 'Инструменты и основы', icon: Sparkles },
  { id: 'creative', title: 'Контент и визуалы', detail: 'Идеи для творчества', icon: WandSparkles },
  { id: 'vibecoding', title: 'Код и приложения', detail: 'Создавать с ИИ', icon: Compass },
  { id: 'automation', title: 'Автоматизация', detail: 'Меньше рутины', icon: ArrowRight },
]

export function Home() {
  const me = useStore(s => s.me)!
  const feed = useStore(s => s.feed)
  const setTab = useStore(s => s.setTab)
  const scroller = useRef<HTMLDivElement>(null)
  const saved = useSavedPosts(me.id)
  const followed = useFollowedTopics(me.id)
  const stories = useMemo(() => activeStories(feed), [feed])

  return <div ref={scroller} data-tab-scroll className="scroll h-full" style={{ paddingBottom: 'calc(110px + var(--bottom))' }}>
    <header className="flex items-center justify-between gap-3 px-5 pb-5" style={{ paddingTop: 'calc(var(--top) + 18px)' }}>
      <div className="min-w-0"><h1 className="font-display text-[17px] font-bold tracking-tight">OG CRE8R<span className="text-violet">²</span></h1><p className="mt-1 text-xs text-mute">Твоя берлога знаний об ИИ</p></div>
      <Tap feedback="soft" onClick={() => setTab('profile')} aria-label={`Профиль, ${me.xp} XP`} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-2 pr-1">
        <span id="xp-pill" className="text-right text-xs font-semibold tabular"><Odometer value={me.xp}/><span className="ml-1 text-faint">XP</span></span>
        <Avatar name={me.name} photo={me.photo} id={me.id} size={38}/>
      </Tap>
    </header>

    <Companion key={me.id} userId={me.id}/>

    <section id="daily-check-in" tabIndex={-1} className="mx-5 mt-4 scroll-mt-4" aria-label="Бонус дня и стрик">
      <AnimatePresence mode="wait" initial={false}>{me.daily_claimed ? <StreakCard key="streak"/> : <DailyCard key="daily"/>}</AnimatePresence>
    </section>
    <AdventBanner/>

    <section className="mt-7 px-5" aria-label="Последние новости">
      <div className="mb-4 flex items-end justify-between gap-2"><h2 className="reader-section-title">Новости</h2><Tap aria-label="Открыть все новости с выбранными фильтрами" className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-violet" onClick={() => setTab('blog')}>Все<ChevronRight size={17}/></Tap></div>
      <Feed lessons={feed} scroller={scroller} compact/>
    </section>

    <details className="group mx-5 mt-4 border-b border-line pb-3" aria-label="Темы публикаций">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">Выбрать тему<ChevronRight size={16} className="text-mute transition-transform group-open:rotate-90" aria-hidden="true"/></summary>
      <div className="pb-3 pt-2"><Tap aria-label="Все темы публикаций" onClick={() => openBlogLibrary()} className="flex min-h-11 items-center gap-1 text-sm text-violet">Все темы<ArrowUpRight size={16}/></Tap></div>
      <div className="reader-topics">{homeTopics.map(topic => <Tap key={topic.id} onClick={() => openBlogLibrary('new', topic.id)} className="reader-topic"><topic.icon size={19} className="mb-3 text-violet"/><span>{topic.title}</span><small className="mt-1 block text-xs leading-relaxed text-mute">{topic.detail}</small></Tap>)}</div>
      {followed.length > 0 && <div className="no-bar mt-3 flex gap-2 overflow-x-auto" aria-label="Мои темы">{followed.map(id => {const topic = knowledgeTopics.find(item => item.id === id); return topic ? <Tap key={id} onClick={() => openBlogLibrary('new', id)} className="min-h-11 shrink-0 rounded-full border border-violet/25 bg-violet/10 px-3 text-sm text-violet">{topic.label}</Tap> : null})}</div>}
    </details>


    {stories.length > 0 && <section className="mt-7" aria-label="Короткие истории"><h2 className="reader-section-title mb-4 px-5">Коротко и наглядно</h2><div className="no-bar flex gap-3.5 overflow-x-auto px-5">{stories.map((story, index) => <StoryBubble key={story.id} card={story} index={index}/>)}</div></section>}

    <div className="mt-7"><MainCourses/></div>
    {saved.length > 0 && <Tap onClick={() => openBlogLibrary('saved')} className="mx-5 mt-4 flex min-h-11 items-center gap-2 text-sm text-mute"><Bookmark size={17}/>Сохранённые · {saved.length}<ChevronRight size={15}/></Tap>}

  </div>
}
