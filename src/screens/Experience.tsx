import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Compass, RefreshCw, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import {curatedGoalCourses} from '../lib/knowledge'
import { GOALS } from '../lib/journey'
import { experienceAction, experienceApi, experienceEnabled, openShowcase } from '../lib/experience'
import { isDemo } from '../lib/api'
import { confirmDialog, openInvoice } from '../lib/tg'
import { useStore } from '../store'
import { Cta, Emoji, Tap } from '../ui'
import type { Entity, Snapshot } from '../platform-kit/src/platform/contracts'

const GOAL_KEY = 'og:personal-goal:v1'
const panel = 'rounded-[24px] border border-line bg-card/90 p-5'
function Frame({ title, children }: { title: string; children: ReactNode }) {
  // Match the other navigation screens so later stack entries render above this one.
  return <motion.div className="absolute inset-0 z-30 flex flex-col bg-bg" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 36 }}>
    <header className="flex items-center gap-3 border-b border-line px-5 pb-4" style={{ paddingTop: 'calc(var(--top) + 16px)' }}><Tap aria-label="Назад" onClick={useStore.getState().pop} className="grid h-11 w-11 place-items-center rounded-full bg-card"><ArrowLeft size={21}/></Tap><h1 className="font-display text-[19px] font-semibold">{title}</h1></header>
    <div className="scroll flex-1 space-y-4 px-5 py-5" style={{ paddingBottom: 'calc(40px + var(--bottom))' }}>{children}</div>
  </motion.div>
}
function useExperience() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function refresh() {
    if (!experienceEnabled) return
    setLoading(true); setError('')
    try { setSnapshot(await (await experienceApi()).bootstrap()) } catch(e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить данные') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  return { snapshot, error, loading, refresh }
}
export function JourneyScreen() {
  const { push, me, toast } = useStore()
  const { snapshot } = useExperience()
  const [goal, setGoal] = useState(() => { try { return localStorage.getItem(GOAL_KEY) || GOALS[0].id } catch { return GOALS[0].id } })
  const [saving, setSaving] = useState(false)
  useEffect(() => { const id = (snapshot as Snapshot & { journey?: { entityId: string } } | null)?.journey?.entityId; if (GOALS.some((g) => g.id === id)) { setGoal(id!); try { localStorage.setItem(GOAL_KEY, id!) } catch {} } }, [snapshot])
  const courses = curatedGoalCourses(goal)
  async function choose(id: string) {
    if (saving) return
    setSaving(true)
    try {
      if (experienceEnabled) await experienceAction('journey.choose', { entityId: id })
      localStorage.setItem(GOAL_KEY, id); setGoal(id)
    } catch(e) { toast(e instanceof Error ? e.message : 'Не удалось сохранить цель') } finally { setSaving(false) }
  }
  return <Frame title="Мой маршрут"><Cta onClick={()=>push({type:'learning',path:'/courses'})}>Открыть курсы →</Cta><p className="text-[15px] leading-relaxed text-mute">Выбери цель: покажем подходящие курсы от основы к практике. Блог помогает находить идеи, а уроки — осваивать их по шагам.</p>
    <div className="grid gap-2">{GOALS.map((g) => <Tap disabled={saving} key={g.id} aria-pressed={goal === g.id} onClick={() => void choose(g.id)} className={`${panel} flex items-center gap-3 text-left ${goal === g.id ? 'ring-2 ring-violet' : ''}`}><Emoji char={g.emoji} size={30}/><span className="flex-1"><b className="block text-[14px]">{g.title}</b><span className="mt-1 block text-[12px] text-mute">{g.caption}</span></span>{goal === g.id && <Check size={20} className="text-violet"/>}</Tap>)}</div>
    <section className={panel}><h2 className="font-semibold">Твой следующий шаг</h2><p className="mt-2 text-sm leading-relaxed text-mute">Иди по программам в этом порядке. Материалы можно читать сразу; зачёт и результаты сохраняются отдельно в «Моём обучении».</p>{courses.map((course,i)=><Tap key={course.code} onClick={()=>push({type:'learning',path:`/courses/${course.code}`})} className="flex w-full items-start gap-3 border-b border-line py-4 text-left last:border-0"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet/10 text-sm font-semibold text-violet">{i+1}</span><span className="min-w-0 flex-1"><b className="text-sm">{course.plainTitle}</b><span className="mt-1 block text-xs leading-relaxed text-mute">{course.outcome}</span><span className="mt-2 block text-xs text-violet">Первый шаг: {course.tryNow}</span></span><ChevronRight size={17}/></Tap>)}</section>
    <section className={panel}><p className="font-semibold">Один профиль, весь прогресс</p><p className="mt-2 text-sm leading-relaxed text-mute">{me?.xp ?? 0} XP всего. Уроки: {me?.base_xp ?? me?.xp ?? 0} XP · активности клуба: {me?.platform_xp ?? 0} XP. История начислений сохраняется отдельно.</p></section>
  </Frame>
}
export function ClubScreen() {
  const { snapshot, loading, error, refresh } = useExperience()
  const [busy, setBusy] = useState(false)
  const [paymentNote, setPaymentNote] = useState('')
  const plans = snapshot?.entities.filter((e) => e.kind === 'course' && e.data.subscription === true) ?? []
  const memberships = (snapshot as Snapshot & { membership?: { entityId: string; expiresAt: string; status: string }[] } | null)?.membership ?? []
  async function buy(plan: Entity) {
    if (busy) return
    if (isDemo && !await confirmDialog('Демонстрация подписки: настоящего списания Stars не будет. Показать доступ на 30 дней?')) return
    setBusy(true); setPaymentNote('')
    try {
      const r = await experienceAction('stars.invoice', { entityId: plan.id })
      if (isDemo && String(r.result?.link).startsWith('demo:')) {
        await experienceAction('demo.purchase', {entityId:plan.id})
      } else if (r.result?.link && !isDemo) {
        const result = await openInvoice(String(r.result.link))
        if (result === 'cancelled') return
        setPaymentNote(result === 'failed' ? 'Не удалось завершить оплату. Можно попробовать снова.' : 'Проверяем подтверждение оплаты. Доступ появится после ответа Telegram.')
      }
      await refresh()
    } catch(e) { setPaymentNote(e instanceof Error ? e.message : 'Не удалось открыть оплату') } finally { setBusy(false) }
  }
  return <Frame title="Клуб OG"><section className={`${panel} relative overflow-hidden`}><div className="mb-5 inline-flex rounded-full bg-violet/15 px-3 py-1 text-[12px] text-violet">{isDemo ? 'Демо клуба' : 'Подписка на 30 дней'}</div><h2 className="font-display text-[29px] leading-tight">Быть в кругу<br/>своих.</h2><p className="mt-4 text-[15px] leading-relaxed text-mute">Практика, материалы и встречи с автором. Состав доступа указан в каждой программе ниже.</p><Star size={64} className="absolute right-4 top-7 text-violet/15"/></section>
    {loading && <p role="status">Загружаем условия…</p>}{error && <section role="alert" className={panel}><p>{error}</p><Tap className="mt-3 flex items-center gap-2 text-violet" onClick={() => void refresh()}><RefreshCw size={16}/>Повторить</Tap></section>}
    {!loading && !error && !plans.length && <section className={panel}><h2 className="font-semibold">Готовимся к открытию</h2><p className="mt-2 text-sm text-mute">Автор опубликует наполнение и стоимость перед стартом подписки.</p></section>}
    {plans.map((p) => { const membership = memberships.find((m) => m.entityId === p.id && m.status === 'active' && Date.parse(m.expiresAt) > Date.now()); return <section key={p.id} className={panel}><h2 className="font-display text-[19px]">{p.title}</h2><p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-mute">{p.body}</p><p className="my-5 text-[18px] font-semibold">{p.price} Stars <span className="text-sm font-normal text-mute">/ 30 дней</span></p>{membership ? <p role="status" className="rounded-xl bg-violet/15 p-3 text-sm">Доступ до {new Date(membership.expiresAt).toLocaleDateString('ru')}. Материалы — в клубном пространстве.</p> : <><p className="mb-4 text-xs leading-relaxed text-mute">Автопродление каждые 30 дней. Управление подпиской — в Telegram. Разовые покупки курсов сохраняются отдельно.</p><Cta busy={busy} onClick={() => void buy(p)}>{isDemo ? 'Посмотреть демо доступа' : 'Вступить в клуб'}</Cta></>}{membership && <Tap className="mt-4 text-violet" onClick={() => { const u = new URL(location.href); u.searchParams.set('platform',''); location.assign(u.href) }}>Открыть клуб →</Tap>}</section> })}
    {paymentNote && <section role="status" className={panel}><p>{paymentNote}</p><Tap onClick={() => void refresh()} className="mt-3 text-violet">Проверить доступ</Tap></section>}
  </Frame>
}
const showcases = [
  { id:'coffee', mode:'club', title:'Кофейня', emoji:'☕', text:'Предзаказ, клубная карта, подарок другу и сезонная коллекция.' },
  { id:'fashion', mode:'club', title:'Одежда', emoji:'👟', text:'Подбор образа, размеры, примерка и ранний доступ.' },
  { id:'construction', mode:'services', title:'Строительство и услуги', emoji:'🏗️', text:'Бриф, предварительный расчёт и кабинет проекта.' },
  { id:'company', mode:'team', title:'Компания', emoji:'🤝', text:'30 дней знакомства с командой, благодарности и события.' },
  { id:'expert', mode:'academy', title:'Эксперт', emoji:'🎓', text:'Диагностика, маршрут, практика, наставник и клуб.' },
]
export function ServicesScreen() {
  const { snapshot, error } = useExperience()
  const toast = useStore((s) => s.toast)
  const [industry,setIndustry] = useState('coffee'), [name,setName] = useState(''), [contact,setContact] = useState(''), [note,setNote] = useState(''), [busy,setBusy] = useState(false), [sent,setSent] = useState(false)
  const [requestId] = useState(() => crypto.randomUUID())
  const service = snapshot?.entities.find((e) => e.kind === 'service' && e.data.purpose === 'miniapp-brief')
  return <Frame title="Мини-аппка для вас"><p className="text-[15px] leading-relaxed text-mute">Пять примеров того, как может работать ваше приложение. Демонстрации используют отдельные данные.</p>{showcases.map((s) => <section key={s.id} className={panel}><div className="flex items-center gap-3"><Emoji char={s.emoji} size={34}/><h2 className="font-display text-[17px]">{s.title}</h2></div><p className="my-3 text-sm leading-relaxed text-mute">{s.text}</p><div className="flex flex-wrap gap-4"><Tap className="flex items-center gap-1 text-sm text-violet" onClick={() => openShowcase(s.mode,s.id)}>Попробовать <ArrowUpRight size={16}/></Tap><Tap className="text-sm" onClick={() => { setIndustry(s.id); document.getElementById('og-service-brief')?.scrollIntoView({behavior:'smooth'}) }}>Обсудить проект</Tap></div></section>)}
    <form id="og-service-brief" className={`${panel} space-y-3`} onSubmit={async(e) => {
      e.preventDefault(); if (busy || sent) return
      if (!service) return toast('Приём заявок появится после подключения сервера клуба')
      setBusy(true)
      try {
        const answers: Record<string,string> = { company:name, contact, industry, goal:note }
        await experienceAction('order.create',{requestId,items:[{entityId:service.id,quantity:1,variant:''}],note:`${name} · ${contact} · ${industry}\n${note}`,brief:{[service.id]:answers}})
        setSent(true)
      } catch(error) { toast(error instanceof Error ? error.message : 'Не удалось отправить заявку') } finally { setBusy(false) }
    }}><h2 className="font-display text-[18px]">Обсудим вашу задачу</h2>{sent ? <p role="status" className="text-sm text-mute">{isDemo ? 'Демо-заявка сохранена в истории. Настоящее сообщение автору не отправлялось.' : 'Заявка сохранена. Контакт для ответа указан в ней.'}</p> : <><label className="block text-sm">Сфера<select className="mt-1 w-full rounded-xl border border-line bg-card p-3" value={industry} onChange={(e)=>setIndustry(e.target.value)}>{showcases.map((s)=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label className="block text-sm">Имя или компания<input required maxLength={100} className="mt-1 w-full rounded-xl border border-line bg-card p-3" value={name} onChange={(e)=>setName(e.target.value)}/></label><label className="block text-sm">Контакт для ответа<input required maxLength={160} placeholder="@username или email" className="mt-1 w-full rounded-xl border border-line bg-card p-3" value={contact} onChange={(e)=>setContact(e.target.value)}/></label><label className="block text-sm">Какую задачу решаем?<textarea required maxLength={1600} rows={4} className="mt-1 w-full rounded-xl border border-line bg-card p-3" value={note} onChange={(e)=>setNote(e.target.value)}/></label>{error && <p className="text-sm text-mute">{error}</p>}<Cta type="submit" busy={busy} disabled={!service}>{isDemo ? 'Сохранить демо-заявку' : 'Отправить заявку'}</Cta></>}</form>
  </Frame>
}
export function JourneyCard() {
  const push = useStore((s) => s.push)
  return <Tap onClick={() => push({type:'journey'})} className="mx-5 mt-3 flex w-[calc(100%-40px)] items-center gap-3 rounded-[24px] border border-line bg-card/80 p-4 text-left"><span className="grid h-11 w-11 place-items-center rounded-[15px] bg-violet/15 text-violet"><Compass size={23}/></span><span className="flex-1"><b className="block text-[14px]">Мой следующий шаг</b><span className="mt-1 block text-[12px] text-mute">Короткий маршрут к твоей цели</span></span><ChevronRight size={18}/></Tap>
}
