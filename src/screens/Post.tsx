import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Heart, Lightbulb, Send } from 'lucide-react'
import { useEffect } from 'react'
import type { Card, Lesson } from '../lib/types'
import { markPostRead } from '../lib/blog-read'
import { toggleSavedPost, useSavedPosts } from '../lib/blog-library'
import { practiceCourseForTopic, topicForPost } from '../lib/knowledge'
import { practicePath } from '../lib/og-practice'
import { postDate } from '../lib/content'
import { track } from '../lib/track'
import { useStore } from '../store'
import { Video } from '../Video'
import { Markdown } from '../Markdown'
import { EditorialMetadata } from '../EditorialMetadata'
import { Cta, Tap } from '../ui'
import './home/free-first.css'

/** Blog reading has no quiz, completion call or XP claim. */
export function PostScreen({ post, preview, error, retry, like, share }: { post: Lesson | null; preview: Card | undefined; error: boolean; retry: () => void; like: () => void; share: () => void }) {
  const me = useStore(s => s.me)
  const pop = useStore(s => s.pop)
  const push = useStore(s => s.push)
  const view = post ?? preview
  const id = post?.id ?? preview?.id
  const saved = useSavedPosts(me?.id ?? 0)
  const isSaved = !!id && saved.includes(id)
  const course = view ? practiceCourseForTopic(topicForPost(view)) : null
  const date = postDate(view?.published_at)
  const save = () => {
    if (!me || !id) return
    const selected = toggleSavedPost(me.id, id, (selected) => track('blog_save',{source:'post',saved:selected},id))
    useStore.getState().toast(selected ? 'Добавлено в сохранённые' : 'Удалено из сохранённых')
  }
  useEffect(() => {
    if (!id) return
    window.history.replaceState(null, '', `${location.pathname}${location.search}#/blog/${id}`)
    return () => { if (location.hash === `#/blog/${id}`) { const store = useStore.getState(); store.setTab(store.tab) } }
  }, [id])
  useEffect(() => { if (post && me) markPostRead(me.id, post.id) }, [post?.id, me?.id])

  return <section className="absolute inset-0 z-30 flex flex-col bg-bg" aria-label="Публикация блога">
    <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 pb-3" style={{ paddingTop: 'calc(var(--top) + 12px)' }}>
      <Tap onClick={pop} aria-label="Назад" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><ArrowLeft size={21}/></Tap>
      <span className="min-w-0 flex-1 font-display text-sm font-semibold">OG · Разборы</span>
      <Tap onClick={save} disabled={!view} aria-label={isSaved ? 'Убрать из сохранённых' : 'Сохранить публикацию'} aria-pressed={isSaved} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-violet"><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'}/></Tap>
      <Tap onClick={share} disabled={!view} aria-label="Поделиться публикацией" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card"><Send size={19}/></Tap>
    </header>
    <article className="scroll selectable min-h-0 flex-1 px-5 pt-6" style={{ paddingBottom: 'calc(30px + var(--bottom))' }}>
      {view && <>
        <div className="reader-post-meta"><span className="font-semibold text-violet">{view.category || 'ИИ и инструменты'}</span>{date && <time dateTime={view.published_at ?? undefined}>{date}</time>}{view.minutes > 0 && <span>{view.minutes} мин чтения</span>}</div>
        <h1 className="mt-4 font-display text-[25px] font-semibold leading-[1.3] tracking-tight" style={{ overflowWrap: 'anywhere' }}>{view.title}</h1>
        {view.subtitle && <p className="mt-4 text-lg leading-relaxed text-mute">{view.subtitle}</p>}
        <EditorialMetadata metadata={view.editorial}/>
        {view.cover_url && <img src={view.cover_url} alt="" className="mt-5 max-h-80 w-full rounded-2xl object-cover"/>}
      </>}
      {!post && !error && <div role="status" aria-label="Загрузка публикации" className="mt-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-5 rounded-full"/>)}</div>}
      {error && <div role="alert" className="mt-6 rounded-2xl border border-line bg-card p-5"><p>Публикация не загрузилась. Попробуй ещё раз.</p><Cta className="mt-4" onClick={retry}>Повторить загрузку</Cta></div>}
      {post && <>
        {post.video_url && <div className="mt-5"><Video url={post.video_url}/></div>}
        <div className="mt-6"><Markdown text={post.subtitle && post.body.startsWith(post.subtitle) ? post.body.slice(post.subtitle.length).trimStart() : post.body}/></div>
        <EditorialMetadata metadata={post.editorial} section="sources"/>
        <footer className="mt-8 flex flex-wrap items-center gap-2 border-t border-line py-5">
          <Tap onClick={like} aria-label="Нравится" aria-pressed={post.liked} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4"><Heart size={19} className={post.liked ? 'text-pink' : 'text-mute'} fill={post.liked ? 'currentColor' : 'none'}/><span>{post.likes || 0}</span></Tap>
          <Tap onClick={save} aria-pressed={isSaved} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm"><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'}/>{isSaved ? 'Сохранено' : 'Сохранить'}</Tap>
          <Tap onClick={share} aria-label="Поделиться" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card"><Send size={17}/></Tap>
        </footer>
        <Tap onClick={pop} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 text-base font-semibold">Вернуться к публикациям<ArrowRight size={18}/></Tap>
        {course && <section aria-label="Практика в платном курсе" className="reader-course mt-6 rounded-2xl border border-line p-5">
          <p className="reader-eyebrow flex items-center gap-2 text-violet"><Lightbulb size={16}/>Дальше — по желанию</p>
          <h2 className="mt-3 text-lg font-semibold">Хочешь сделать свой проект?</h2>
          <p className="mt-2 text-base leading-relaxed text-mute">В платном курсе OG эта тема разобрана по шагам, с заданиями и проверкой результата.</p>
          <Tap onClick={() => push({ type: 'learning', path: practicePath(course.key) })} className="mt-3 flex min-h-16 w-full items-start gap-3 rounded-xl border border-line bg-card p-4 text-left"><span className="min-w-0 flex-1"><b className="block text-base">{course.title}</b><span className="mt-2 block text-sm leading-relaxed text-mute">{course.project}</span><span className="mt-3 block text-sm font-semibold text-violet">Программа и первый урок</span></span><ArrowUpRight size={19} className="mt-1 shrink-0 text-violet"/></Tap>
        </section>}
      </>}
    </article>
  </section>
}
