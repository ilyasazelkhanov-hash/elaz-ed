import { ArrowRight, ArrowUpRight, Bookmark, Check, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Card } from '../../lib/types'
import { postDate } from '../../lib/content'
import { filterNewsPosts, newestPosts, postTeaser } from '../../lib/discovery'
import { useBlogFeed } from '../../lib/blog-feed'
import { useReadPosts } from '../../lib/blog-read'
import { toggleFollowedTopic, toggleSavedPost, useFollowedTopics, useSavedPosts } from '../../lib/blog-library'
import { knowledgeTopics } from '../../lib/knowledge'
import { useStore } from '../../store'
import { Tap } from '../../ui'
import { useBlogView, type BlogFilter } from './blog-view'
import { track } from '../../lib/track'
import './free-first.css'

export function PostCard({ card }: { card: Card }) {
  const push = useStore(s => s.push)
  const me = useStore(s => s.me)
  const read = useReadPosts(me?.id ?? 0)
  const saved = useSavedPosts(me?.id ?? 0)
  const isSaved = saved.includes(card.id)
  const date = postDate(card.published_at)
  const teaser = postTeaser(card)
  const open = () => push({ type: 'lesson', id: card.id })
  return <article className="reader-post">
    <Tap onClick={open} className="reader-post-open p-[18px]" aria-label={`Читать публикацию: ${card.title}`}>
      <div className="reader-post-meta"><span className="font-semibold text-violet">{card.category || 'ИИ и инструменты'}</span>{date && <time dateTime={card.published_at ?? undefined}>{date}</time>}{card.pinned && <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] text-violet">Выбор автора</span>}</div>
      <h3 className="reader-post-heading mt-3">{card.title}</h3>
      {teaser && <p className="mt-2 line-clamp-2 text-base leading-relaxed text-mute">{teaser}</p>}
      {card.cover_url && <img src={card.cover_url} alt="" loading="lazy" decoding="async" className="mt-4 aspect-[2/1] w-full rounded-2xl object-cover"/>}
    </Tap>
    <div className="reader-post-bottom"><span className="flex flex-wrap items-center gap-2 text-xs text-mute">{card.minutes > 0 && <span>{card.minutes} мин чтения</span>}{read.includes(card.id) && <span className="inline-flex items-center gap-1"><Check size={12}/>Прочитано</span>}</span><div className="flex shrink-0 items-center gap-1"><Tap onClick={open} className="flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-violet">Читать<ArrowUpRight size={16}/></Tap><Tap onClick={() => {if (me) { const value = toggleSavedPost(me.id, card.id, saved => track('blog_save',{saved,source:'blog'},card.id)); useStore.getState().toast(value ? 'Добавлено в сохранённые' : 'Удалено из сохранённых') }}} aria-label={isSaved ? 'Убрать из сохранённых' : 'Сохранить публикацию'} aria-pressed={isSaved} className="grid h-11 w-11 place-items-center rounded-full text-violet"><Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'}/></Tap></div></div>
  </article>
}

/** Latest means chronological: editorial choices are labelled, with no artificial XP gate. */
export function Feed({ lessons, scroller, compact = false }: { lessons: Card[]; scroller?: RefObject<HTMLDivElement | null>; compact?: boolean }) {
  const { query, category, filter, topic, set } = useBlogView()
  const [revision, setRevision] = useState(0)
  const [homeWindow, setHomeWindow] = useState({ key: '', count: 3 })
  const me = useStore(s => s.me)
  const read = useReadPosts(me?.id ?? 0)
  const saved = useSavedPosts(me?.id ?? 0)
  const followed = useFollowedTopics(me?.id ?? 0)
  const remote = useBlogFeed(true, me?.id ?? 0, `${revision}:${lessons.map(p => `${p.id}:${p.pinned}:${p.published_at}`).join('|')}`)
  const sentinel = useRef<HTMLDivElement>(null)
  const posts = useMemo(() => newestPosts(remote.posts ?? lessons), [lessons, remote.posts])
  const categories = ['Все', ...new Set([...posts.map(p => p.category).filter(Boolean), ...(category === 'Все' ? [] : [category])])]
  const currentTopic = knowledgeTopics.find(item => item.id === topic)
  const found = filterNewsPosts(posts, { query, category, topic, filter }, read, saved)
  const selectionKey = JSON.stringify([query, category, topic, filter])
  const visibleLimit = homeWindow.key === selectionKey ? homeWindow.count : 3
  const visible = compact ? found.slice(0, visibleLimit) : found
  // Home grows only on request; the archive retains its existing infinite scroll.
  const showMore = () => {
    setHomeWindow({ key: selectionKey, count: visibleLimit + 3 })
    if (found.length <= visibleLimit) void remote.load(true)
  }
  const clear = () => set({ query: '', category: 'Все', topic: 'all', filter: 'new' })
  const hasSelection = !!query.trim() || category !== 'Все' || topic !== 'all'
  const activeFilters = hasSelection || filter !== 'new'
  useEffect(() => {
    const node = sentinel.current
    if (compact || !node || !remote.more || remote.busy || remote.error || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) void remote.load() }, { root: scroller?.current ?? node.closest('[data-tab-scroll]'), rootMargin: '400px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [compact, remote.more, remote.busy, remote.error, remote.load, posts.length, found.length, scroller])

  const emptyTitle = filter === 'saved' ? 'Сохрани то, что пригодится' : filter === 'unread' ? 'Всё прочитано' : 'Пока без публикаций'
  const emptyDetail = filter === 'saved' ? 'Нажми на закладку у публикации — она появится здесь.' : filter === 'unread' ? 'Новые материалы появятся здесь после публикации.' : 'Здесь появятся бесплатные разборы и идеи об ИИ.'
  const emptyHeading = remote.legacy ? 'В загруженной подборке пока пусто' : remote.more ? compact ? 'В загруженной подборке пока пусто' : 'Ищем публикации…' : hasSelection ? 'По запросу пока пусто' : emptyTitle
  const emptyDescription = remote.legacy ? 'Попробуй другие фильтры или обнови подборку, чтобы проверить новые публикации.' : remote.more ? compact ? 'Подходящее может быть в архиве. Загрузи следующую страницу или открой все подходящие публикации.' : 'Подгружаем архив, чтобы найти подходящее.' : hasSelection ? 'Попробуй другую тему или сократи поисковый запрос.' : emptyDetail
  const archiveLabel = remote.legacy ? 'Открыть подборку с фильтрами' : 'Все подходящие публикации'
  return <section aria-label={compact ? 'Последние публикации' : 'Публикации блога'}>
    <>
      <div className="reader-filter-tabs mb-4" aria-label="Режим публикаций">{([['new', 'Новые'], ['unread', 'Непрочитанные'], ['saved', 'Сохранённые']] as [BlogFilter, string][]).map(([id, label]) => <Tap key={id} aria-pressed={filter === id} onClick={() => set({ filter: id })}>{label}</Tap>)}</div>
      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label={compact ? 'Поиск в новостях' : 'Поиск в блоге'} placeholder="О чём хочешь узнать?" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none" value={query} onChange={e => set({ query: e.target.value })}/>{query && <Tap aria-label="Очистить поиск" onClick={() => set({ query: '' })} className="grid h-11 w-11 place-items-center"><X size={17}/></Tap>}</label>
      <div className="mt-3 flex items-center gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Тема публикаций</span><select aria-label="Тема публикаций" value={topic} onChange={e => set({ topic: e.target.value, category: 'Все' })} className="min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-base text-ink"><option value="all">Все темы</option>{knowledgeTopics.map(item => <option key={item.id} value={item.id}>{item.label}{followed.includes(item.id) ? ' · моя тема' : ''}</option>)}</select></label><Tap disabled={remote.busy} aria-label="Обновить публикации" onClick={() => setRevision(value => value + 1)} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-card text-violet disabled:opacity-40"><RefreshCw size={19} className={remote.busy ? 'animate-spin' : ''}/></Tap></div>
      {!compact && currentTopic && <div className="mt-3 rounded-2xl border border-line bg-card p-4"><p className="text-sm leading-relaxed text-mute">{currentTopic.beginner}</p><Tap aria-pressed={followed.includes(currentTopic.id)} onClick={() => { if (me) toggleFollowedTopic(me.id, currentTopic.id) }} className="mt-2 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-violet">{followed.includes(currentTopic.id) ? <Check size={16}/> : <Plus size={16}/>}{followed.includes(currentTopic.id) ? 'В моих темах' : 'Добавить в мои темы'}</Tap></div>}
      {(categories.length > 2 || category !== 'Все') && <div className="no-bar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Категории публикаций">{categories.map(item => <Tap key={item} aria-pressed={category === item} onClick={() => set({ category: item })} className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${category === item ? 'border-violet/40 bg-violet/10 text-violet' : 'border-line bg-card text-mute'}`}>{item === 'Все' ? 'Все рубрики' : item}</Tap>)}</div>}
      <div className="my-4 flex min-h-6 items-center justify-between gap-3"><p className="text-xs text-mute" role="status">{remote.busy ? 'Загружаем публикации…' : compact ? `Показано ${visible.length} из ${found.length} в загруженной подборке` : `${found.length} в загруженной подборке`}</p>{activeFilters && <Tap aria-label="Сбросить фильтры публикаций" onClick={clear} className="flex min-h-11 items-center gap-1 text-xs font-semibold text-violet">Сбросить<X size={13}/></Tap>}</div>
      {remote.legacy && <p className="mb-4 text-xs leading-relaxed text-mute">Показана загруженная подборка. Обнови её, чтобы проверить новые публикации.</p>}
    </>
    {found.length > 0 ? <div className="space-y-3">{visible.map(card => <PostCard key={card.id} card={card}/>)}</div> : <div className="reader-empty"><Bookmark size={25} className="mx-auto mb-3 text-violet"/><h2 className="text-lg font-semibold">{emptyHeading}</h2><p className="mt-2 text-base leading-relaxed text-mute">{emptyDescription}</p>{activeFilters && <Tap className="mt-4 inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-violet" onClick={clear}>Все новости<ArrowRight size={16}/></Tap>}</div>}
    <div ref={sentinel} className="mt-4 pb-4" aria-live="polite">
      {remote.error ? <div className="rounded-2xl border border-line bg-card p-4 text-base"><p role="alert">Не удалось загрузить публикации. Попробуй ещё раз.</p><Tap onClick={() => void remote.load(true)} className="mt-3 min-h-12 w-full rounded-xl border border-line text-sm font-semibold">Повторить загрузку</Tap></div> : compact && found.length > visible.length ? <Tap onClick={showMore} className="min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">Показать ещё</Tap> : remote.more ? <Tap disabled={remote.busy} aria-label="Загрузить следующую страницу публикаций" onClick={() => compact ? showMore() : void remote.load(true)} className="min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">{remote.busy ? 'Загружаем публикации…' : compact && !found.length ? 'Искать дальше в архиве' : 'Ещё публикации'}</Tap> : posts.length > 0 && found.length > 0 && !remote.legacy ? <p className="py-4 text-center text-sm text-mute">Все доступные публикации загружены.</p> : null}
      {compact && <Tap aria-label={archiveLabel} onClick={() => useStore.getState().setTab('blog')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-sm font-semibold">{archiveLabel}<ArrowRight size={17}/></Tap>}
    </div>
  </section>
}
