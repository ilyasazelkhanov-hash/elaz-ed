import { ArrowUpRight, Search, X } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import type { Card } from '../../lib/types'
import { isBlogPost, postDate } from '../../lib/content'
import { useReadPosts } from '../../lib/blog-read'
import { useStore } from '../../store'
import { Tap } from '../../ui'

export function PostCard({card}:{card:Card}){
 const push=useStore(s=>s.push)
 return <Tap onClick={()=>push({type:'lesson',id:card.id})} className="block w-full rounded-[24px] border border-line bg-card p-5 text-left" aria-label={`Читать публикацию: ${card.title}`}>
  <p className="flex items-center justify-between gap-3 text-xs text-mute"><span className="font-semibold text-violet">{card.category||'Блог'}</span><span>{postDate(card.published_at)}</span></p>
  <h3 className="mt-3 text-lg font-semibold leading-snug">{card.title}</h3>{card.subtitle&&<p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mute">{card.subtitle}</p>}
  {card.cover_url&&<img src={card.cover_url} alt="" loading="lazy" className="mt-4 aspect-[2/1] w-full rounded-2xl object-cover"/>}
  <p className="mt-4 flex items-center justify-between text-xs text-mute"><span>{card.minutes} мин чтения</span><span className="flex items-center gap-1 font-semibold text-violet">Читать<ArrowUpRight size={15}/></span></p>
 </Tap>
}
/** Standalone content is a blog; it never displays course completion or XP. */
export function Feed({lessons,scroller:_,compact=false}:{lessons:Card[];scroller?:RefObject<HTMLDivElement|null>;compact?:boolean}){
 const [query,setQuery]=useState(''),[category,setCategory]=useState('Все'),[unread,setUnread]=useState(false),[limit,setLimit]=useState(12)
 const me=useStore(s=>s.me),read=useReadPosts(me?.id??0)
 const posts=useMemo(()=>lessons.filter(isBlogPost).slice().sort((a,b)=>(Date.parse(b.published_at??'')||0)-(Date.parse(a.published_at??'')||0)||b.id-a.id),[lessons])
 const categories=['Все',...new Set(posts.map(p=>p.category).filter(Boolean))]
 const found=posts.filter(p=>(category==='Все'||p.category===category)&&(!unread||!read.includes(p.id))&&`${p.title} ${p.subtitle} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase()))
 return <section aria-label={compact?'Последние публикации':'Публикации блога'}>
  {!compact&&<><label className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск в блоге" placeholder="Найти публикацию" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12)}}/>{query&&<Tap aria-label="Очистить поиск" onClick={()=>setQuery('')} className="grid h-11 w-11 place-items-center"><X size={17}/></Tap>}</label>
  <div className="no-bar my-4 flex gap-2 overflow-x-auto pb-1">{categories.map(c=><Tap key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setLimit(12)}} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${category===c?'border-violet bg-violet/10 text-violet':'border-line bg-card text-mute'}`}>{c}</Tap>)}</div>
  <Tap onClick={()=>{setUnread(v=>!v);setLimit(12)}} aria-pressed={unread} className={`mb-4 min-h-11 rounded-full border px-4 text-sm ${unread?'border-violet text-violet':'border-line text-mute'}`}>Непрочитанные</Tap></>}
  {found.length?<><div className="space-y-3">{found.slice(0,compact?3:limit).map(card=><PostCard key={card.id} card={card}/>)}</div>{!compact&&found.length>limit&&<Tap onClick={()=>setLimit(n=>n+12)} className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">Ещё публикации</Tap>}</>:<div className="rounded-2xl border border-dashed border-line p-6 text-center"><h2 className="font-semibold">{posts.length?'Публикаций не найдено':'Новые публикации скоро появятся'}</h2><p className="mt-2 text-sm text-mute">{posts.length?'Измени запрос или фильтры.':'Здесь будут новости и заметки об ИИ.'}</p>{posts.length>0&&<Tap className="mt-4 min-h-11 px-3 text-violet" onClick={()=>{setQuery('');setCategory('Все');setUnread(false)}}>Сбросить фильтры</Tap>}</div>}
 </section>
}
