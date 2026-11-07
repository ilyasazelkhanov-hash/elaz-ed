import { AnimatePresence } from 'motion/react'
import { ArrowRight, ArrowUpRight, Bookmark, ChevronRight, Compass, Sparkles, WandSparkles } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useReadPosts } from '../lib/blog-read'
import { useFollowedTopics, useSavedPosts } from '../lib/blog-library'
import { updateSummary } from '../lib/discovery'
import { useBlogFeed } from '../lib/blog-feed'
import { knowledgeTopics } from '../lib/knowledge'
import { useStore } from '../store'
import { Avatar, Counter, Emoji, Odometer, Tap } from '../ui'
import { AdventBanner } from './advent/Banner'
import { MainCourses } from './home/AcademyCourses'
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
  const push = useStore(s => s.push)
  const scroller = useRef<HTMLDivElement>(null)
  const read = useReadPosts(me.id)
  const saved = useSavedPosts(me.id)
  const followed = useFollowedTopics(me.id)
  const latest = useBlogFeed(true, me.id, 'home-latest')
  const summary = updateSummary(latest.posts ?? feed, read)
  const stories = useMemo(() => feed.filter(c => c.kind === 'story' && c.published), [feed])

  return <div ref={scroller} data-tab-scroll className="scroll h-full" style={{ paddingBottom: 'calc(110px + var(--bottom))' }}>
    <header className="flex items-center justify-between gap-3 px-5 pb-5" style={{ paddingTop: 'calc(var(--top) + 18px)' }}>
      <div><p className="font-display text-[17px] font-bold tracking-tight">OG CRE8R<span className="text-violet">²</span></p><p className="mt-1 text-xs text-mute">Твоя берлога знаний об ИИ</p></div>
      <Tap feedback="soft" onClick={() => setTab('profile')} aria-label="Профиль" className="rounded-full border border-line p-1"><Avatar name={me.name} photo={me.photo} id={me.id} size={38}/></Tap>
    </header>

    <section className="reader-hero mx-5 p-5" aria-label="Об OG CRE8R">
      <p className="reader-eyebrow flex items-center gap-2 text-violet"><span className="h-1.5 w-1.5 rounded-full bg-violet" aria-hidden="true"/>Читай. Пробуй. Создавай.</p>
      <h1 className="reader-hero-title mt-4 font-semibold">Понятно об ИИ.<br/><span className="text-violet">Полезно тебе.</span></h1>
      <p className="mt-4 text-base leading-relaxed text-mute">Бесплатные разборы, инструменты и идеи, которые помогают освоиться с ИИ и применять его каждый день.</p>
      <Tap onClick={() => push({ type: 'learning', path: '/start' })} className="mt-5 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-violet px-4 py-3 text-left text-base font-semibold text-on-violet"><span>Я начинаю — с чего начать?</span><ArrowUpRight size={19} className="shrink-0"/></Tap>
      <p className="mt-3 text-center text-xs text-mute">Бесплатный маршрут для первого шага</p>
    </section>

    <section className="mx-5 mt-6" aria-label="Бонус дня и стрик">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-display text-base font-semibold">Рад видеть тебя снова</h2><p className="mt-1 text-sm text-mute">Маленький бонус за любопытство</p></div><Tap onClick={() => setTab('profile')} aria-label="Мой уровень и прогресс" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-3"><Emoji char="🔥" size={17}/><Counter value={me.streak} className="text-sm font-semibold"/><ChevronRight size={14} className="text-mute"/></Tap></div>
      <AnimatePresence mode="wait" initial={false}>{me.daily_claimed ? <StreakCard key="streak"/> : <DailyCard key="daily"/>}</AnimatePresence>
      <Tap onClick={() => setTab('profile')} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-sm text-mute"><span id="xp-pill" className="flex items-center gap-1"><Emoji char="⚡" size={16}/><Odometer value={me.xp}/> XP</span><span aria-hidden="true">·</span>Мой прогресс<ChevronRight size={15}/></Tap>
    </section>
    <AdventBanner/>

    <section className="mt-7 px-5" aria-label="Последние обновления">
      <div className="mb-4 flex items-end justify-between gap-2"><div><p className="reader-eyebrow mb-1.5 text-mute">Свежий взгляд</p><h2 className="reader-section-title">Новое в берлоге</h2></div><Tap className="flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-violet" onClick={() => openBlogLibrary()}>Все<ChevronRight size={17}/></Tap></div>
      {summary.posts.length > 0 && <p className="mb-4 text-sm leading-relaxed text-mute">{summary.unread ? `${summary.unread} ещё не прочитано` : 'Ты прочитал все загруженные публикации'}<span className="mx-2" aria-hidden="true">·</span>Новые — в начале</p>}
      <Feed lessons={summary.posts} scroller={scroller} compact/>
      {summary.posts.length > 0 && <Tap onClick={() => openBlogLibrary(summary.unread ? 'unread' : 'new')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-sm font-semibold">{summary.unread ? 'Продолжить читать' : 'Открыть все обновления'}<ArrowRight size={17}/></Tap>}
    </section>

    <section className="mt-7 px-5" aria-label="Темы публикаций">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="reader-section-title">Что тебе интересно?</h2><Tap aria-label="Все темы публикаций" onClick={() => openBlogLibrary()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line"><ArrowUpRight size={18}/></Tap></div>
      <div className="reader-topics">{homeTopics.map(topic => <Tap key={topic.id} onClick={() => openBlogLibrary('new', topic.id)} className="reader-topic"><topic.icon size={19} className="mb-3 text-violet"/><span>{topic.title}</span><small className="mt-1 block text-xs leading-relaxed text-mute">{topic.detail}</small></Tap>)}</div>
      {followed.length > 0 && <div className="no-bar mt-3 flex gap-2 overflow-x-auto" aria-label="Мои темы">{followed.map(id => {const topic = knowledgeTopics.find(item => item.id === id); return topic ? <Tap key={id} onClick={() => openBlogLibrary('new', id)} className="min-h-11 shrink-0 rounded-full border border-violet/25 bg-violet/10 px-3 text-sm text-violet">{topic.label}</Tap> : null})}</div>}
      <Tap onClick={() => openBlogLibrary('saved')} className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-[19px] border border-line bg-card p-4 text-left"><Bookmark size={21} className="shrink-0 text-violet"/><span className="min-w-0 flex-1"><b className="block text-base font-semibold">Отложить на потом</b><span className="mt-1 block text-sm text-mute">{saved.length ? `В сохранённых: ${saved.length}` : 'Сохраняй полезное и возвращайся к нему'}</span></span><ChevronRight size={18} className="shrink-0 text-mute"/></Tap>
    </section>

    {stories.length > 0 && <section className="mt-7" aria-label="Короткие истории"><h2 className="reader-section-title mb-4 px-5">Коротко и наглядно</h2><div className="no-bar flex gap-3.5 overflow-x-auto px-5">{stories.map((story, index) => <StoryBubble key={story.id} card={story} index={index}/>)}</div></section>}

    <div className="mt-7"><MainCourses/></div>


    <p className="mx-8 mt-7 text-center text-sm leading-relaxed text-mute">Есть пара минут? Этого достаточно,<br/>чтобы узнать что-то полезное.</p>
  </div>
}
