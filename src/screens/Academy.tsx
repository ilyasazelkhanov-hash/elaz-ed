import { ArrowLeft, BookOpen, GraduationCap, LibraryBig, Settings2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { LearningProvider } from '../lib/learning-scope'
import { learningPath, learningUrl } from '../lib/learning-entry'
import { useStore } from '../store'
import { backWithinApp } from '../lib/app-navigation'
import { Tap } from '../ui'
import '../academy.css'
import { useAcademyLocale, useAcademyTranslation, setAcademyLocale, type AcademyLocale } from '../lib/academy-i18n'
import { supportedAcademyLocales } from '../lib/academy-config'
import { Empty } from './academy/shared'
import { Competencies } from './academy/Competencies'
import { Admin } from './academy/Admin'
import { useAcademy } from './academy/shared'
import { Catalog, Course, Library } from './academy/Catalog'
import { Lesson, MyLearning } from './academy/Learning'

function decode(value: string) { try { return decodeURIComponent(value) } catch { return value } }
export function AcademyScreen({ path }: { path?: string }) {
  return <LearningProvider demo={true}><LearningScreen initialPath={path} demo={true}/></LearningProvider>
}
function LearningScreen({ initialPath, demo }: { initialPath?: string; demo: boolean }) {
  const normalize=(value='')=>learningPath(value,demo)
  const path = normalize(initialPath || '')
  const locale = useAcademyLocale(), t = useAcademyTranslation()
  const locales = supportedAcademyLocales()
  const permissions = useAcademy('permissions').data
  const pop = useStore((s) => s.pop), isAdmin = useStore((s) => !demo && s.me?.is_admin), reduced = useReducedMotion(), scroller = useRef<HTMLDivElement>(null)
  function go(next: string) { const value = next === '/courses' ? '' : next.replace(/\/$/,''); if (value === path) return; useStore.setState(s=>({stack:s.stack.map((o,i)=>i===s.stack.length-1&&o.type==='academy'?{...o,path:learningUrl(value,demo)}:o)})) }
  function back() { backWithinApp(() => { if (path) go(''); else pop() }) }
  useEffect(() => { const listener = () => back(); const event=demo?'og:academy-back':'og:courses-back'; window.addEventListener(event, listener); return () => window.removeEventListener(event, listener) })
  useEffect(() => { scroller.current?.scrollTo({ top: 0, behavior: 'instant' }); scroller.current?.focus({ preventScroll: true }) }, [path])
  const parts = path.split('/').filter(Boolean), area = parts[0], code = decode(parts[1] || '')
  const title = area === 'videos' ? 'Видео' : area === 'competencies' ? 'Компетенции' : area === 'admin' ? 'Студия' : area === 'library' ? 'Библиотека' : area === 'my-learning' || area === 'projects' ? 'Моё обучение' : area === 'lessons' || area === 'assessments' ? 'Занятие' : area === 'courses' ? 'Программа курса' : demo?'AI Academy · демо':'Курсы'
  return <motion.div className="academy absolute inset-0 z-30 flex flex-col bg-bg" initial={reduced ? { opacity: 0 } : { x: '100%' }} animate={reduced ? { opacity: 1 } : { x: 0 }} exit={reduced ? { opacity: 0 } : { x: '100%' }} transition={{ type: 'spring', stiffness: 330, damping: 36 }}>
    <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 pb-3" style={{ paddingTop: 'calc(var(--top) + 12px)' }}><Tap onClick={back} aria-label={t('Назад')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card"><ArrowLeft size={20}/></Tap><p className="flex-1 font-display text-[15px] font-semibold">{t(title)}</p>{locales.length > 1 && <select aria-label={t('Язык')} className="rounded-full border border-line bg-bg px-2 py-1.5 text-xs" value={locale} onChange={e=>setAcademyLocale(e.target.value as AcademyLocale)}>{locales.map(value=><option key={value} value={value}>{value.toUpperCase()}</option>)}</select>}<span className="rounded-full border border-line px-2.5 py-1.5 text-[10px] text-mute">{demo ? 'ДЕМО' : 'OG'}</span></header>
    <nav aria-label={demo?'Разделы демо Академии':'Разделы курсов'} className="flex shrink-0 items-center gap-1 border-b border-line bg-bg px-3 pt-2" style={{ paddingBottom: 8 }}>{[{ route: '', label: 'Каталог', icon: GraduationCap, active: !area || ['courses', 'directions', 'lessons', 'assessments', 'videos'].includes(area) }, { route: '/my-learning', label: 'Моё обучение', icon: BookOpen, active: ['my-learning', 'projects'].includes(area) }, { route: '/competencies', label: 'Навыки', icon: GraduationCap, active: area === 'competencies' }, { route: '/library', label: 'Источники', icon: LibraryBig, active: area === 'library' }, ...(isAdmin || permissions?.editor || permissions?.instructor || permissions?.admin ? [{ route: '/admin', label: 'Студия', icon: Settings2, active: area === 'admin' }] : [])].map((n) => <Tap key={n.route} className="academy-nav min-w-0" style={{padding: '10px 2px'}} aria-current={n.active ? 'page' : undefined} onClick={() => go(n.route)}><n.icon size={21}/><span className="max-w-full break-words text-center text-[9px] leading-tight">{t(n.label)}</span></Tap>)}</nav>
    <main ref={scroller} tabIndex={-1} className="scroll min-h-0 flex-1 space-y-5 px-5 py-5" style={{ paddingBottom: 28 }} key={path} aria-label={t(title)}>
      {demo&&<section role="note" className="academy-notice"><b>Демо Академии</b><p className="mt-2 text-sm">Здесь можно попробовать один вводный модуль. Демо-прогресс хранится на устройстве отдельно от основных курсов.</p><Tap className="academy-chip mt-3 text-violet" onClick={()=>{useStore.getState().navigateTab('courses')}}>Перейти к основным курсам →</Tap></section>}
      {area === 'videos' ? <Empty title="Демовидео убраны">В уроках остались объяснения, иллюстрации и практика.</Empty> : area === 'competencies' ? <Competencies/> : area === 'courses' && code ? <Course code={code} go={go}/> : (area === 'lessons' || area === 'assessments') && code ? <Lesson code={code} go={go}/> : area === 'library' ? <Library/> : area === 'my-learning' || area === 'projects' ? <MyLearning go={go} projectId={area === 'projects' ? code : undefined}/> : area === 'admin' ? demo?<Empty title="Студия недоступна в демо"/>:<Admin section={code} permissions={permissions}/> : <Catalog go={go} directionCode={area === 'directions' ? code || undefined : undefined}/>}
    </main>

  </motion.div>
}




