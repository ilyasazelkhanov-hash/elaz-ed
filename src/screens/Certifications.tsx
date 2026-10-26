import { Award, BadgeCheck, Check, CheckCheck, ChevronLeft, ExternalLink, Flame, Gift, LockKeyhole, Search, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { api, errorText, isDemo } from '../lib/api'
import type { CertificationCard, CertificationCatalog, CertificationStatus } from '../lib/certifications'
import { haptic, openLink } from '../lib/tg'
import { useStore } from '../store'
import { Cta, Spinner, Tap } from '../ui'
import { plural } from '../lib/game'

const topics:Record<string,string>={fundamentals:'Основы ИИ',coding:'Кодинг и агенты',data:'Данные и ML',creative:'Креатив',business:'Работа и бизнес'}
type Filter='all'|'certificate'|'badge'|'mine'|'gift'
const filters:{id:Filter;label:string}[]=[{id:'all',label:'Все'},{id:'certificate',label:'Сертификаты'},{id:'badge',label:'Бейджи'},{id:'mine',label:'Мои'},{id:'gift',label:'Из адвента'}]

export function CertificationsScreen({focusId}:{focusId?:string}) {
 const {pop,toast,guard}=useStore.getState()
 const [data,setData]=useState<CertificationCatalog|null>(null)
 const [failed,setFailed]=useState(false)
 const [query,setQuery]=useState('')
 const [provider,setProvider]=useState('')
 const [filter,setFilter]=useState<Filter>(focusId?'gift':'all')
 const [limit,setLimit]=useState(12)
 const [busy,setBusy]=useState<string|null>(null)
 const load=async()=>{try{setData(await api.certificationCatalog());setFailed(false)}catch(e){setFailed(true);guard(e)}}
 useEffect(()=>{
  let alive=true
  const refresh=async()=>{try{const result=await api.certificationCatalog();if(alive){setData(result);setFailed(false)}}catch(e){if(alive){setFailed(true);guard(e)}}}
  void refresh()
  const visible=()=>{if(document.visibilityState==='visible')void refresh()}
  document.addEventListener('visibilitychange',visible)
  const timer=setInterval(visible,60000)
  return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible)}
 },[guard])
 useEffect(()=>setLimit(12),[query,provider,filter])
 const providers=useMemo(()=>[...new Set(data?.items.map(c=>c.provider)??[])].sort(),[data])
 const items=useMemo(()=>{
  const needle=query.toLocaleLowerCase().trim()
  const list=(data?.items??[]).filter(c=>(!provider||c.provider===provider)&&(!needle||`${c.title} ${c.provider} ${topics[c.topic]??''}`.toLocaleLowerCase().includes(needle))&&(filter==='all'||filter===c.credential||filter==='mine'&&c.touched||filter==='gift'&&c.gift))
  return focusId?[...list].sort((a,b)=>Number(b.id===focusId)-Number(a.id===focusId)):list
 },[data,provider,query,filter,focusId])
 const fail=async(e:unknown)=>{guard(e);toast(errorText(e));await load()}
 const mark=async(c:CertificationCard,status:CertificationStatus)=>{
  if(busy)return;setBusy(c.id)
  try{await api.certificationProgress(c.id,status);setData(d=>d?{...d,items:d.items.map(i=>i.id===c.id?{...i,status,touched:true}:i)}:d);haptic.success()}catch(e){await fail(e)}finally{setBusy(null)}
 }
 const open=async(c:CertificationCard)=>{
  if(busy)return;setBusy(c.id)
  try{
   const result=await api.certificationOpen(c.id)
   if(c.status==='saved'){
    await api.certificationProgress(c.id,'in_progress')
    setData(d=>d?{...d,items:d.items.map(i=>i.id===c.id?{...i,status:'in_progress',touched:true}:i)}:d)
   }
   openLink(result.url)
  }catch(e){await fail(e)}finally{setBusy(null)}
 }
 const completed=data?.items.filter(c=>c.status==='completed'||c.status==='received').length??0
 const received=data?.items.filter(c=>c.status==='received').length??0
 const studying=data?.items.filter(c=>c.status==='in_progress').length??0
 const streak=data?.streak??useStore.getState().me?.streak??0
 return <motion.div className="absolute inset-0 z-30 bg-bg" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:300,damping:34}}>
  <div className="scroll h-full px-5 pb-12" style={{paddingTop:'calc(var(--top) + 12px)',paddingBottom:'calc(var(--bottom) + 32px)'}}>
   <div className="mb-4 flex items-center gap-3"><Tap onClick={pop} aria-label="Назад" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card"><ChevronLeft size={22}/></Tap><p className="text-[13px] font-semibold text-mute">Коллекция достижений</p></div>
   <section className="relative overflow-hidden rounded-[30px] p-6 text-white" style={{background:'var(--aurora)'}}>
    <div aria-hidden className="absolute -right-7 -top-6 h-44 w-44 rounded-full border-[20px] border-white/10"/>
    <div className="relative flex items-start justify-between gap-3"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest">Твой следующий уровень</span><Award size={48} strokeWidth={1.5} className="shrink-0"/></div>
    <h1 className="relative mt-5 font-display text-[28px] font-semibold leading-[1.15]">Паспорт ИИ-<br/>сертификаций</h1>
    <p className="relative mt-3 max-w-[270px] text-[14px] leading-relaxed text-white/85">Учись у провайдеров. Собирай документы. Сохраняй свой прогресс здесь.</p>
    <div className="relative mt-5 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-black/15 px-3 py-1.5">{data?.total??'…'} {plural(data?.total??0,['маршрут','маршрута','маршрутов'])}</span><span className="rounded-full bg-black/15 px-3 py-1.5">{providers.length||'…'} {plural(providers.length,['провайдер','провайдера','провайдеров'])}</span></div>
   </section>
   <section className={`mt-4 rounded-[24px] border p-4 ${data?.unlocked?'border-mint/25 bg-mint/8':'border-violet/25 bg-violet/8'}`}>
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-veil/8">{data?.unlocked?<BadgeCheck className="text-mint" size={25}/>:<LockKeyhole className="text-violet" size={23}/>}</span><div className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold">{data?.unlocked?'Серия держится — каталог открыт':'Доступ за привычку учиться'}</h2><p className="mt-0.5 text-[12px] leading-relaxed text-mute">{data?.unlocked?'Сохраняй активный стрик от 10 дней.':`До открытия — ещё ${Math.max(0,10-streak)} ${plural(Math.max(0,10-streak),['день','дня','дней'])} серии.`}</p></div><span className="flex shrink-0 items-center gap-1 text-[13px] font-bold"><Flame size={15} className="text-rose"/>{streak}/10</span></div>
    <div className="mt-4 flex gap-1.5" aria-label={`Стрик ${streak} из 10`} role="img">{Array.from({length:10},(_,i)=><span key={i} className={`h-2 flex-1 rounded-full ${i<streak?'bg-violet':'bg-veil/10'}`}/>)}</div>
    <p className="mt-3 text-[12px] leading-relaxed text-mute">Если серия оборвётся, ссылки снова закроются до 10 дней. Отметки останутся. Подарки адвента открывают только выпавший маршрут без стрика.</p>
    {!data?.unlocked&&<Tap onClick={()=>useStore.setState({stack:[],tab:'home'})} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-violet/15 text-[13px] font-semibold text-violet"><Flame size={16}/> К ежедневному бонусу</Tap>}
   </section>
   <div className="mt-4 grid grid-cols-3 gap-2">{[{n:studying,label:'Прохожу',icon:Sparkles},{n:completed,label:'Пройдено',icon:CheckCheck},{n:received,label:'Получено',icon:Award}].map(({n,label,icon:Icon})=><div key={label} className="rounded-[18px] border border-line bg-card p-3"><Icon size={17} className="text-violet"/><p className="mt-2 font-display text-[23px] font-semibold">{n}</p><p className="text-[11px] text-mute">{label}</p></div>)}</div>
   <h2 className="mb-3 mt-7 font-display text-[19px] font-semibold">Выбери свой маршрут</h2>
   <label className="flex h-12 items-center gap-2 rounded-[16px] border border-line bg-card px-4"><Search size={19} className="shrink-0 text-faint"/><input aria-label="Поиск сертификаций" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Курс, провайдер или тема" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"/></label>
   <label className="mt-3 block text-[12px] font-semibold text-mute">Провайдер<select aria-label="Провайдер" value={provider} onChange={e=>setProvider(e.target.value)} className="mt-1.5 h-11 w-full rounded-[14px] border border-line bg-card px-3 text-[14px] text-ink"><option value="">Все провайдеры</option>{providers.map(p=><option key={p}>{p}</option>)}</select></label>
   <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">{filters.map(f=><Tap key={f.id} aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)} className={`h-11 shrink-0 rounded-full px-4 text-[12px] font-semibold ${filter===f.id?'bg-inverse text-on-inverse':'border border-line bg-card text-mute'}`}>{f.label}</Tap>)}</div>
   <p className="my-3 text-[12px] text-mute" aria-live="polite">{data?`Найдено: ${items.length}`:'Загружаем каталог…'} · Отметки заполняешь ты</p>
   {failed&&<div className="rounded-[20px] border border-rose/20 bg-card p-5"><p className="text-[14px]">Каталог не загрузился</p><Cta tone="quiet" className="mt-3 w-full" onClick={()=>void load()}>Повторить</Cta></div>}
   {!data&&!failed&&<div className="grid h-32 place-items-center"><Spinner size={30}/></div>}
   <div className="space-y-3">{items.slice(0,limit).map(c=><article key={c.id} className={`min-w-0 overflow-hidden rounded-[24px] border bg-card p-4 ${c.id===focusId?'border-violet/50':'border-line'}`}>
    <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-violet/10 text-violet">{c.credential==='certificate'?<Award size={24}/>:<BadgeCheck size={24}/>}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-violet">{c.provider}</p><h3 className="mt-1 break-words text-[16px] font-semibold leading-snug">{c.title}</h3></div>{c.status==='received'&&<CheckCheck size={19} className="shrink-0 text-mint"/>}</div>
    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold"><span className="rounded-full bg-veil/8 px-2.5 py-1">{c.credential==='certificate'?'Сертификат':'Бейдж'}</span><span className="rounded-full bg-veil/8 px-2.5 py-1 text-mute">{topics[c.topic]??'ИИ'}</span>{c.gift&&<span className="flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 text-mint"><Gift size={11}/>Подарок</span>}{c.status==='in_progress'&&<span className="rounded-full bg-violet/10 px-2.5 py-1 text-violet">Прохожу</span>}</div>
    <details className="mt-3 text-[12px] leading-relaxed text-mute"><summary className="cursor-pointer py-1 font-semibold">Условия документа</summary><p className="mt-2">{c.credential_note}</p><p className="mt-2">Обучение: {c.free_course===true?'в каталоге указано бесплатным':c.free_course===false?'платное или по условиям':'нужно уточнить'}. Документ: {c.free_credential===true?'в каталоге указан бесплатным':c.free_credential===false?'платный или по условиям':'нужно уточнить'}.</p><p className="mt-2">{c.availability==='reachable'?'Страница отвечала при проверке.':'Платформа ограничила автоматическую проверку; проверь страницу вручную.'} Выдачу документа подтверждает провайдер.</p></details>
    <Tap disabled={!c.available||!!busy} onClick={()=>void open(c)} className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-[13px] font-semibold disabled:opacity-55 ${c.available?'bg-inverse text-on-inverse':'bg-veil/8 text-mute'}`}>{busy===c.id?<Spinner size={16}/>:c.available?<ExternalLink size={16}/>:<LockKeyhole size={16}/>} {c.available?'Открыть обучение':'Доступ при стрике 10+'}</Tap>
    <div className="mt-3 grid grid-cols-2 gap-2"><Tap aria-pressed={c.status==='completed'||c.status==='received'} disabled={!c.available||!!busy} onClick={()=>void mark(c,['completed','received'].includes(c.status)?'in_progress':'completed')} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border px-2 text-[11px] font-semibold disabled:opacity-45 ${['completed','received'].includes(c.status)?'border-mint/30 bg-mint/10 text-mint':'border-line text-mute'}`}><Check size={14}/>Курс пройден</Tap><Tap aria-pressed={c.status==='received'} disabled={!c.available||!!busy||!['completed','received'].includes(c.status)} onClick={()=>void mark(c,c.status==='received'?'completed':'received')} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] border px-2 text-[11px] font-semibold disabled:opacity-45 ${c.status==='received'?'border-mint/30 bg-mint/10 text-mint':'border-line text-mute'}`}><Award size={14}/>{c.credential==='badge'?'Бейдж получен':'Сертификат получен'}</Tap></div>
   </article>)}</div>
   {data&&items.length===0&&<div className="rounded-[24px] border border-line bg-card p-7 text-center"><Search size={30} className="mx-auto text-faint"/><p className="mt-3 text-[14px] text-mute">{isDemo?'Каталог доступен в рабочей миниаппке.':filter==='gift'?'Здесь появятся маршруты, выигранные в адвенте.':'Нет подходящих маршрутов. Попробуй другой запрос.'}</p></div>}
   {items.length>limit&&<Cta tone="quiet" className="mt-4 w-full" onClick={()=>setLimit(n=>n+12)}>Показать ещё 12</Cta>}
   <p className="mt-6 text-[11px] leading-relaxed text-faint">Источник списка: aicertified.free · срез 26.10.2026. В каталоге есть сертификаты об окончании и учебные бейджи; они не равны профессиональной сертификации. Стоимость, требования и выдачу проверяй у провайдера. Личные отметки не являются проверкой документа.</p>
  </div>
 </motion.div>
}
