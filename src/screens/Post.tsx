import { ArrowLeft, Heart, Send } from 'lucide-react'
import { useEffect } from 'react'
import type { Card, Lesson } from '../lib/types'
import { markPostRead } from '../lib/blog-read'
import {relatedCourseGuides} from '../lib/knowledge'
import {KnowledgeLinks} from './courses/KnowledgeLinks'
import { postDate } from '../lib/content'
import { useStore } from '../store'
import { Video } from '../Video'
import { Markdown } from '../Markdown'
import { Cta, Tap } from '../ui'

/** Blog reading has no quiz, completion call or XP claim. */
export function PostScreen({post,preview,error,retry,like,share}:{post:Lesson|null;preview:Card|undefined;error:boolean;retry:()=>void;like:()=>void;share:()=>void}){
 const me=useStore(s=>s.me),pop=useStore(s=>s.pop),view=post??preview
 const id=post?.id??preview?.id
 useEffect(()=>{
  if(!id)return
  window.history.replaceState(null,'',`${location.pathname}${location.search}#/blog/${id}`)
  return()=>{if(location.hash===`#/blog/${id}`){const store=useStore.getState();store.setTab(store.tab)}}
 },[id])
 useEffect(()=>{if(post&&me)markPostRead(me.id,post.id)},[post?.id,me?.id])
 return <section className="absolute inset-0 z-30 flex flex-col bg-bg" aria-label="Публикация блога">
  <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 pb-3" style={{paddingTop:'calc(var(--top) + 12px)'}}>
   <Tap onClick={pop} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-full bg-card"><ArrowLeft size={21}/></Tap><span className="flex-1 font-display text-base font-semibold">Блог</span><Tap onClick={share} disabled={!view} aria-label="Поделиться публикацией" className="grid h-11 w-11 place-items-center rounded-full bg-card"><Send size={19}/></Tap>
  </header>
  <article className="scroll min-h-0 flex-1 px-5 pt-6" style={{paddingBottom:'calc(30px + var(--bottom))'}}>
   {view&&<><p className="text-xs font-semibold text-violet">{view.category||'Блог'}{postDate(view.published_at)&&` · ${postDate(view.published_at)}`} · {view.minutes} мин чтения</p><h1 className="mt-3 font-display text-[26px] font-semibold leading-tight">{view.title}</h1>{view.subtitle&&<p className="mt-3 text-base leading-relaxed text-mute">{view.subtitle}</p>}{view.cover_url&&<img src={view.cover_url} alt="" className="mt-5 max-h-80 w-full rounded-2xl object-cover"/>}</>}
   {!post&&!error&&<div role="status" aria-label="Загрузка публикации" className="mt-6 space-y-3">{[1,2,3].map(i=><div key={i} className="skeleton h-5 rounded-full"/>)}</div>}
   {error&&<div role="alert" className="mt-6 rounded-2xl border border-line bg-card p-5"><p>Публикация не загрузилась. Попробуй ещё раз.</p><Cta className="mt-4" onClick={retry}>Повторить загрузку</Cta></div>}
   {post&&<><>{post.video_url&&<div className="mt-5"><Video url={post.video_url}/></div>}<div className="mt-6"><Markdown text={post.subtitle&&post.body.startsWith(post.subtitle)?post.body.slice(post.subtitle.length).trimStart():post.body}/></div></><footer className="mt-8 flex items-center gap-3 border-t border-line py-5"><Tap onClick={like} aria-label="Нравится" aria-pressed={post.liked} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4"><Heart size={19} className={post.liked?'text-pink':'text-mute'} fill={post.liked?'currentColor':'none'}/><span>{post.likes||0}</span></Tap><Tap onClick={share} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4"><Send size={17}/>Поделиться</Tap></footer><KnowledgeLinks guides={relatedCourseGuides(post)}/></>}
  </article>
 </section>
}
