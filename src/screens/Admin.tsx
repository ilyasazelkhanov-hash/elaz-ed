import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Eye, Gift, GraduationCap, Heart, LibraryBig, Newspaper, Plus, Search, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../lib/api'
import { inTelegram } from '../lib/tg'
import type { AdminContentScope, AdminStats, Lesson } from '../lib/types'
import { useStore } from '../store'
import { EmojiTile, Tap } from '../ui'

export const sheet = {
  className: 'absolute inset-0 z-30 bg-bg',
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
  transition: { type: 'spring' as const, stiffness: 340, damping: 36 },
}

export function Header({ title, right }: { title: string; right?: React.ReactNode }) {
  const pop = useStore((s) => s.pop)
  return <div className="flex items-center gap-3 px-5">{!inTelegram && <Tap onClick={pop} aria-label="Назад" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card"><ChevronLeft size={21} /></Tap>}<h1 className="flex-1 font-display text-[22px] font-semibold">{title}</h1>{right}</div>
}

function AdminLink({title,hint,icon:Icon,onClick}:{title:string;hint:string;icon:typeof Newspaper;onClick:()=>void}){
 return <Tap onClick={onClick} className="flex min-h-20 w-full items-center gap-3 rounded-[20px] border border-line bg-card p-4 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-violet/15 text-violet"><Icon size={22}/></span><span className="min-w-0 flex-1"><span className="block text-base font-semibold">{title}</span><span className="mt-1 block text-[13px] leading-relaxed text-mute">{hint}</span></span><ChevronRight size={18} className="shrink-0 text-faint"/></Tap>
}
const sections={
 blog:{title:'Блог',hint:'Новости и статьи: текст, обложка, категория, продвижение и публикация.',create:'Новая публикация'},
 stories:{title:'Сторис',hint:'Короткие истории: слайды, оформление, XP за просмотр и публикация.',create:'Новая сторис'},
 legacy:{title:'Архивные уроки',hint:'Уроки старых курсов. Их доступы и результаты сохранены; актуальные программы находятся в «Материалах курсов».',create:''},
} as const

/** Blog, stories and old course lessons have distinct lists and editor settings. */
export function AdminScreen({scope}:{scope?:AdminContentScope}) {
 const push=useStore(s=>s.push),stackSize=useStore(s=>s.stack.length)
 const {guard,toast}=useStore.getState()
 const [lessons,setLessons]=useState<Lesson[]>([]),[stats,setStats]=useState<AdminStats|null>(null)
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[cursor,setCursor]=useState<number|null>(null),[next,setNext]=useState<number|null>(null)
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[oldServer,setOldServer]=useState(false)
 const previousStack=useRef(stackSize)
 useEffect(()=>{const task=setTimeout(()=>{setSearch(query.trim());setCursor(null)},250);return()=>clearTimeout(task)},[query])
 // Reload the first page after returning from an editor, preserving this section.
 useEffect(()=>{if(stackSize<previousStack.current){setCursor(null);setRevision(v=>v+1)}previousStack.current=stackSize},[stackSize])
 useEffect(()=>{
  let alive=true;setLoading(true);setError('')
  if(cursor===null)setLessons([])
  api.adminList({scope:scope??'summary',cursor,query:search}).then(result=>{
   if(!alive)return
   const items=scope?result.lessons.filter(item=>scope==='stories'?item.kind==='story':item.kind==='lesson'&&(scope==='blog'?item.course_id==null:item.course_id!=null)).filter(item=>!search||item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())):[]
   setOldServer(!!scope&&result.next===undefined);setStats(result.stats);setLessons(previous=>cursor===null?items:[...new Map([...previous,...items].map(item=>[item.id,item])).values()]);setNext(result.next??null)
  }).catch(e=>{if(!alive)return;guard(e);setError(errorText(e));toast(errorText(e))}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}
 },[scope,cursor,search,revision,guard,toast])
 const info=scope?sections[scope]:null
 return <motion.div {...sheet}><div className="scroll h-full" style={{paddingTop:'calc(var(--top) + 16px)',paddingBottom:'calc(40px + var(--bottom))'}}>
  <Header title={info?.title??'Админка'}/>
  {!scope?<>
   <p className="mt-4 px-5 text-sm leading-relaxed text-mute">Выбери, что хочешь настроить. У каждого раздела свой список и редактор.</p>
   <section aria-label="Разделы контента" className="mt-5 space-y-3 px-5">
    <AdminLink title="Блог" hint={sections.blog.hint} icon={Newspaper} onClick={()=>push({type:'admin-content',scope:'blog'})}/>
    <AdminLink title="Сторис" hint={sections.stories.hint} icon={Sparkles} onClick={()=>push({type:'admin-content',scope:'stories'})}/>
    <AdminLink title="Материалы курсов" hint="Программы → модули → уроки. Объяснения, практика, задания и проверка работ." icon={GraduationCap} onClick={()=>push({type:'learning',path:'/courses/admin'})}/>
   </section>
   <section aria-label="Статистика" className="mt-5 grid grid-cols-2 gap-2 px-5">{[['Всего',stats?.users],['Подписаны',stats?.subscribed],['За сутки',stats?.active],['Пройдено',stats?.completions]].map(([label,value])=><div key={String(label)} className="rounded-[18px] border border-line bg-card p-3"><p className="font-display text-[17px] font-semibold">{value??'—'}</p><p className="mt-1 text-xs text-mute">{label}</p></div>)}</section>
   <section aria-label="Инструменты администратора" className="mt-5 space-y-2 px-5"><h2 className="mb-3 text-sm font-semibold text-mute">Управление приложением</h2><AdminLink title="Аналитика" hint="Активность, публикации и обучение" icon={ChartNoAxesColumn} onClick={()=>push({type:'analytics'})}/><AdminLink title="Адвент" hint="Двери по дням, коды и погашения" icon={Gift} onClick={()=>push({type:'advent-admin'})}/></section>
   <section aria-label="Архив" className="mt-5 space-y-2 px-5"><h2 className="mb-3 text-sm font-semibold text-mute">Старые курсы</h2><AdminLink title="Архив курсов и заявки" hint="Старые программы, оплаты и выданные доступы" icon={LibraryBig} onClick={()=>push({type:'courses-admin'})}/><AdminLink title="Архивные уроки" hint="Редактирование материалов старых курсов" icon={LibraryBig} onClick={()=>push({type:'admin-content',scope:'legacy'})}/></section>
  </>:<section aria-label={`${info!.title}: управление`} className="mt-4 px-5">
   <p className="text-sm leading-relaxed text-mute">{info!.hint}</p>
   {scope!=='legacy'&&<Tap onClick={()=>push({type:'editor',lesson:null,kind:scope==='stories'?'story':'lesson'})} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-violet px-4 text-sm font-semibold text-white"><Plus size={18}/>{info!.create}</Tap>}
   <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск по заголовку" maxLength={120} placeholder="Поиск по заголовку во всём разделе" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/></label>
   <p className="mb-3 mt-4 text-xs text-mute">Опубликованные материалы и черновики</p>
   {oldServer&&<p role="status" className="mb-4 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-mute">Для просмотра всего архива требуется обновление сервера. Пока показаны доступные материалы этого раздела.</p>}
   <div className="space-y-2">{lessons.map(item=><Tap key={item.id} aria-label={`Редактировать: ${item.title}`} onClick={()=>push({type:'editor',lesson:item,kind:item.kind})} className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-card p-3 text-left"><EmojiTile emoji={item.emoji} gradient={item.gradient} size={50} radius={16}/><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold leading-snug">{item.title}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute"><span className={`rounded-full px-2 py-0.5 font-semibold ${item.published?'bg-mint/15 text-mint':'bg-amber/15 text-amber'}`}>{item.published?'Опубликован':'Черновик'}</span>{scope==='blog'&&item.pinned&&<span className="font-semibold text-violet">Продвигается</span>}<span className="flex items-center gap-1"><Eye size={12}/>{item.views}</span><span className="flex items-center gap-1"><Heart size={12}/>{item.likes}</span></span></span><ChevronRight size={16} className="shrink-0 text-faint"/></Tap>)}</div>
   {loading&&<div role="status" className="py-6 text-center text-sm text-mute">Загружаем {scope==='stories'?'сторис':'материалы'}…</div>}
   {!loading&&!error&&!lessons.length&&<p className="py-8 text-center text-sm text-mute">{search?'По этому заголовку ничего не найдено.':'Здесь пока нет материалов.'}</p>}
   {!loading&&!error&&next!==null&&<Tap onClick={()=>setCursor(next)} className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">Загрузить ещё</Tap>}
  </section>}
  {error&&<div className="mx-5 mt-4 rounded-2xl border border-line bg-card p-4 text-sm"><p role="alert">Не удалось загрузить раздел. {error}</p><Tap onClick={()=>setRevision(v=>v+1)} className="mt-3 min-h-11 w-full font-semibold text-violet">Повторить загрузку</Tap></div>}
 </div></motion.div>
}
