import { ArrowUpRight, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Card } from '../../lib/types'
import { isBlogPost, postDate, comparePosts } from '../../lib/content'
import {useBlogFeed} from '../../lib/blog-feed'
import { useReadPosts } from '../../lib/blog-read'
import { useStore } from '../../store'
import { Tap } from '../../ui'

export function PostCard({card}:{card:Card}){
 const push=useStore(s=>s.push)
 return <Tap onClick={()=>push({type:'lesson',id:card.id})} className="block w-full rounded-[24px] border border-line bg-card p-5 text-left" aria-label={`Читать публикацию: ${card.title}`}>
  <p className="flex items-center justify-between gap-3 text-xs text-mute"><span className="font-semibold text-violet">{card.pinned?'Продвигается · ':''}{card.category||'Блог'}</span><span>{postDate(card.published_at)}</span></p>
  <h3 className="mt-3 text-lg font-semibold leading-snug">{card.title}</h3>{card.subtitle&&<p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mute">{card.subtitle}</p>}
  {card.cover_url&&<img src={card.cover_url} alt="" loading="lazy" className="mt-4 aspect-[2/1] w-full rounded-2xl object-cover"/>}
  <p className="mt-4 flex items-center justify-between text-xs text-mute"><span>{card.minutes} мин чтения</span><span className="flex items-center gap-1 font-semibold text-violet">Читать<ArrowUpRight size={15}/></span></p>
 </Tap>
}
/** Standalone content is a blog; it never displays course completion or XP. */
export function Feed({lessons,scroller,compact=false}:{lessons:Card[];scroller?:RefObject<HTMLDivElement|null>;compact?:boolean}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState('Все'),[unread,setUnread]=useState(false)
 const me=useStore(s=>s.me),read=useReadPosts(me?.id??0)
 const remote=useBlogFeed(!compact,me?.id??0,lessons.map(p=>`${p.id}:${p.pinned}:${p.published_at}`).join('|')),sentinel=useRef<HTMLDivElement>(null)
 const posts=useMemo(()=>(compact?lessons:remote.posts??lessons).filter(isBlogPost).slice().sort(comparePosts),[lessons,remote.posts,compact])
 const categories=['Все',...new Set(posts.map(p=>p.category).filter(Boolean))]
 const found=posts.filter(p=>(category==='Все'||p.category===category)&&(!unread||!read.includes(p.id))&&`${p.title} ${p.subtitle} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()))
 useEffect(()=>{
  const node=sentinel.current
  if(compact||!node||!remote.more||remote.busy||remote.error||!('IntersectionObserver' in window))return
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void remote.load()},{root:scroller?.current??node.closest('[data-tab-scroll]'),rootMargin:'400px'})
  observer.observe(node);return()=>observer.disconnect()
 },[compact,remote.more,remote.busy,remote.error,remote.load,posts.length,found.length,scroller])
 return <section aria-label={compact?'Последние публикации':'Публикации блога'}>
  {!compact&&<><label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск в блоге" placeholder="Найти публикацию" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none" value={query} onChange={e=>{setQuery(e.target.value)}}/>{query&&<Tap aria-label="Очистить поиск" onClick={()=>setQuery('')} className="grid h-11 w-11 place-items-center"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1">{categories.map(c=><Tap key={c} aria-pressed={category===c} onClick={()=>{setCategory(c)}} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${category===c?'border-violet bg-violet/10 text-violet':'border-line bg-card text-mute'}`}>{c}</Tap>)}</div>
  <Tap onClick={()=>{setUnread(v=>!v)}} aria-pressed={unread} className={`mb-4 min-h-11 rounded-full border px-4 text-sm ${unread?'border-violet text-violet':'border-line text-mute'}`}>Непрочитанные</Tap></>}
  {found.length?<><div className="space-y-3">{found.slice(0,compact?3:undefined).map(card=><PostCard key={card.id} card={card}/>)}</div></>:<div className="rounded-2xl border border-dashed border-line p-6 text-center"><h2 className="font-semibold">{!compact&&remote.more?'Ищем публикации…':posts.length?'Публикаций не найдено':'Новые публикации скоро появятся'}</h2><p className="mt-2 text-sm text-mute">{posts.length?'Измени запрос или фильтры.':'Здесь будут новости и заметки об ИИ.'}</p>{posts.length>0&&<Tap className="mt-4 min-h-11 px-3 text-violet" onClick={()=>{setQuery('');setCategory('Все');setUnread(false)}}>Сбросить фильтры</Tap>}</div>}
  {!compact&&<div ref={sentinel} className="mt-4 pb-4" aria-live="polite">
   {remote.error?<div className="rounded-2xl border border-line bg-card p-4 text-sm"><p role="alert">Не удалось загрузить публикации. {remote.error}</p><Tap onClick={()=>void remote.load(true)} className="mt-3 min-h-12 w-full rounded-xl border border-line font-semibold">Попробовать ещё раз</Tap></div>:remote.more?<Tap disabled={remote.busy} onClick={()=>void remote.load(true)} className="min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">{remote.busy?'Загружаем публикации…':'Ещё публикации'}</Tap>:posts.length>0?<p className="py-4 text-center text-sm text-mute">Это все публикации — ты дошёл до самой первой.</p>:null}
  </div>}
 </section>
}
