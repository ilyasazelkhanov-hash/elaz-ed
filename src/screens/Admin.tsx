import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Eye, Gift, GraduationCap, Heart, LibraryBig, Newspaper, Plus, Search, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../lib/api'
import { editorialReviewLabel, editorialReviewStatus } from '../lib/editorial'
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
  return <div className="flex items-center gap-3 px-5">{!inTelegram && <Tap onClick={pop} aria-label="Назад" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-card"><ChevronLeft size={21} /></Tap>}<h1 className="min-w-0 flex-1 font-display text-[20px] font-semibold">{title}</h1>{right}</div>
}

function AdminLink({title,hint,icon:Icon,onClick}:{title:string;hint:string;icon:typeof Newspaper;onClick:()=>void}){
 return <Tap onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-card p-3 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-violet/15 text-violet"><Icon size={22}/></span><span className="min-w-0 flex-1"><span className="block text-base font-semibold">{title}</span><span className="mt-1 block text-[13px] leading-relaxed text-mute">{hint}</span></span><ChevronRight size={18} className="shrink-0 text-faint"/></Tap>
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
 const [reviewOnly,setReviewOnly]=useState(false)
 const [publication,setPublication]=useState<'all'|'published'|'draft'>('all')
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
 const filteredLessons=lessons.filter(item=>publication==='all'||(publication==='published'?item.published:!item.published))
 const visibleLessons=scope==='blog'&&reviewOnly?filteredLessons.filter(item=>['missing','incomplete','due'].includes(editorialReviewStatus(item.editorial))):filteredLessons
 return <motion.div {...sheet}><div className="scroll h-full" style={{paddingTop:'calc(var(--top) + 16px)',paddingBottom:'calc(40px + var(--bottom))'}}>
  <Header title={info?.title??'Управление'}/>
  {!scope?<>
   <section aria-label="Быстрые действия" className="mt-5 grid grid-cols-2 gap-2 px-5">
    <Tap onClick={()=>push({type:'editor',lesson:null,kind:'lesson'})} className="min-h-12 rounded-2xl bg-violet px-3 py-3 text-sm font-semibold text-white"><Plus size={16} className="mr-1 inline"/>Публикация</Tap>
    <Tap onClick={()=>push({type:'editor',lesson:null,kind:'story'})} className="min-h-12 rounded-2xl border border-line bg-card px-3 py-3 text-sm font-semibold"><Plus size={16} className="mr-1 inline"/>Сторис</Tap>
   </section>
   <section aria-label="Разделы контента" className="mt-5 space-y-3 px-5">
    <AdminLink title="Блог" hint="Найти, изменить или снять публикацию" icon={Newspaper} onClick={()=>push({type:'admin-content',scope:'blog'})}/>
    <AdminLink title="Сторис" hint="Хайлайты и короткие истории" icon={Sparkles} onClick={()=>push({type:'admin-content',scope:'stories'})}/>
    <AdminLink title="Материалы курсов" hint="Программы → модули → уроки. Объяснения, практика, задания и проверка работ." icon={GraduationCap} onClick={()=>push({type:'learning',path:'/courses/admin'})}/>
   </section>
   <details className="mx-5 mt-5 rounded-2xl border border-line bg-card"><summary tabIndex={0} className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">Статистика приложения</summary><section aria-label="Статистика" className="grid grid-cols-2 gap-2 p-3">{[['Всего',stats?.users],['Подписаны',stats?.subscribed],['За сутки',stats?.active],['Пройдено',stats?.completions]].map(([label,value])=><div key={String(label)} className="rounded-[18px] border border-line bg-card p-3"><p className="font-display text-[17px] font-semibold">{value??'-'}</p><p className="mt-1 text-xs text-mute">{label}</p></div>)}</section></details>
   <section aria-label="Инструменты администратора" className="mt-5 space-y-2 px-5"><h2 className="mb-3 text-sm font-semibold text-mute">Управление приложением</h2><AdminLink title="Аналитика" hint="Активность, публикации и обучение" icon={ChartNoAxesColumn} onClick={()=>push({type:'analytics'})}/><AdminLink title="Адвент" hint="Двери по дням, коды и погашения" icon={Gift} onClick={()=>push({type:'advent-admin'})}/></section>
   <details className="mx-5 mt-5 rounded-2xl border border-line"><summary tabIndex={0} className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">Архивные курсы и доступы</summary><section aria-label="Архив" className="space-y-2 p-3"><AdminLink title="Архив курсов и заявки" hint="Старые программы, оплаты и выданные доступы" icon={LibraryBig} onClick={()=>push({type:'courses-admin'})}/><AdminLink title="Архивные уроки" hint="Редактирование материалов старых курсов" icon={LibraryBig} onClick={()=>push({type:'admin-content',scope:'legacy'})}/></section></details>
  </>:<section aria-label={`${info!.title}: управление`} className="mt-4 px-5">
   <p className="text-sm leading-relaxed text-mute">{info!.hint}</p>
   {scope!=='legacy'&&<Tap onClick={()=>push({type:'editor',lesson:null,kind:scope==='stories'?'story':'lesson'})} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-violet px-4 text-sm font-semibold text-white"><Plus size={18}/>{info!.create}</Tap>}
   <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4"><Search size={18} className="shrink-0 text-mute"/><input aria-label="Поиск по заголовку" maxLength={120} placeholder="Поиск по заголовку во всём разделе" value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"/></label>
   <div aria-label="Статус материалов" className="mt-3 flex flex-wrap gap-2">{([['all','Все'],['draft','Черновики'],['published','Опубликованные']] as const).map(([value,label])=><Tap key={value} aria-pressed={publication===value} onClick={()=>setPublication(value)} className={`min-h-11 rounded-xl border px-3 text-sm ${publication===value?'border-violet bg-violet/10 font-semibold':'border-line text-mute'}`}>{label}</Tap>)}</div>
   <p role="status" className="mb-3 mt-3 text-xs text-mute">Показано {visibleLessons.length} из {lessons.length} загруженных. Фильтры статуса и проверки действуют только на загруженные материалы.</p>
   {scope==='blog'&&<div className="mb-4 rounded-2xl border border-line bg-card p-3"><label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={reviewOnly} onChange={e=>setReviewOnly(e.target.checked)} className="h-5 w-5 accent-violet"/>Требуют проверки среди загруженных</label><p className="mt-1 text-xs leading-relaxed text-mute">Показывает просроченные и незаполненные сведения только среди уже загруженных материалов. Для продолжения списка нажми «Загрузить ещё».</p></div>}
   {oldServer&&<p role="status" className="mb-4 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed text-mute">Для просмотра всего архива требуется обновление сервера. Пока показаны доступные материалы этого раздела.</p>}
   <div className="space-y-2">{visibleLessons.map(item=><Tap key={item.id} aria-label={`Редактировать: ${item.title}`} onClick={()=>push({type:'editor',lesson:item,kind:item.kind})} className="flex w-full items-center gap-3 rounded-[20px] border border-line bg-card p-3 text-left"><EmojiTile emoji={item.emoji} gradient={item.gradient} size={50} radius={16}/><span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold leading-snug">{item.title}</span><span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mute"><span className={`rounded-full px-2 py-0.5 font-semibold ${item.published?'bg-mint/15 text-mint':'bg-amber/15 text-amber'}`}>{item.published?'Опубликован':'Черновик'}</span>{scope==='blog'&&item.pinned&&<span className="font-semibold text-violet">Продвигается</span>}<span className="flex items-center gap-1"><Eye size={12}/>{item.views}</span><span className="flex items-center gap-1"><Heart size={12}/>{item.likes}</span></span>{scope==='blog'&&<span className="mt-2 block text-xs leading-relaxed text-mute">{editorialReviewLabel(item.editorial)}{item.editorial?.review_due?` · ${item.editorial.review_due}`:''}</span>}</span><ChevronRight size={16} className="shrink-0 text-faint"/></Tap>)}</div>
   {loading&&<div role="status" className="py-6 text-center text-sm text-mute">Загружаем {scope==='stories'?'сторис':'материалы'}…</div>}
   {!loading&&!error&&!lessons.length&&<p className="py-8 text-center text-sm text-mute">{search?'По этому заголовку ничего не найдено.':'Здесь пока нет материалов.'}</p>}
   {!loading&&!error&&lessons.length>0&&!visibleLessons.length&&<div className="py-6 text-center text-sm text-mute"><p>Среди загруженных нет материалов по выбранным фильтрам.{next!==null?' Можно загрузить ещё.':''}</p><Tap onClick={()=>{setPublication('all');setReviewOnly(false)}} className="mt-2 min-h-11 px-3 font-semibold text-violet">Сбросить фильтры</Tap></div>}
   {!loading&&!error&&next!==null&&<Tap onClick={()=>setCursor(next)} className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-card text-sm font-semibold">Загрузить ещё</Tap>}
  </section>}
  {error&&<div className="mx-5 mt-4 rounded-2xl border border-line bg-card p-4 text-sm"><p role="alert">Не удалось загрузить раздел. {error}</p><Tap onClick={()=>setRevision(v=>v+1)} className="mt-3 min-h-11 w-full font-semibold text-violet">Повторить загрузку</Tap></div>}
 </div></motion.div>
}
