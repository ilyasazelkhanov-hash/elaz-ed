import { House, Trophy, User } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect, useRef, type UIEvent } from 'react'
import { isDemo } from './lib/api'
import { coursesEntry } from './lib/learning-entry'
import { academyEntry } from './lib/academy-entry'
import { bindBack, initTelegram, inTelegram, startParam } from './lib/tg'
import { applyTheme, watchTheme } from './lib/theme'
import { preloadMarkdown } from './Markdown'
import { CourseScreen } from './screens/Course'
import { Home } from './screens/Home'
import { LessonScreen } from './screens/Lesson'
import { Profile } from './screens/Profile'
import { RewardModal } from './screens/Reward'
import { ShareSheet } from './screens/ShareSheet'
import { ErrorScreen, Gate, Outside, Setup, Splash } from './screens/States'
import { Stories } from './screens/Stories'
import { Top } from './screens/Top'
import { useStore, type Overlay, type Tab } from './store'
import { enableSparks, Tap, Toasts } from './ui'

// Админку видит один человек — незачем грузить её всем.
const AdminScreen = lazy(() => import('./screens/Admin').then((m) => ({ default: m.AdminScreen })))
const EditorScreen = lazy(() => import('./screens/AdminEditor').then((m) => ({ default: m.EditorScreen })))
const AnalyticsScreen = lazy(() => import('./screens/Analytics').then((m) => ({ default: m.AnalyticsScreen })))
const CoursesAdminScreen = lazy(() => import('./screens/AdminCourses').then((m) => ({ default: m.CoursesAdminScreen })))
const CourseEditorScreen = lazy(() => import('./screens/AdminCourses').then((m) => ({ default: m.CourseEditorScreen })))
const LabScreen = lazy(() => import('./screens/Lab').then((m) => ({ default: m.LabScreen })))
const JourneyScreen = lazy(() => import('./screens/Experience').then((m) => ({ default: m.JourneyScreen })))
const ClubScreen = lazy(() => import('./screens/Experience').then((m) => ({ default: m.ClubScreen })))
const ServicesScreen = lazy(() => import('./screens/Experience').then((m) => ({ default: m.ServicesScreen })))
const CoursesScreen = lazy(() => import('./screens/Academy').then((m) => ({ default: m.CoursesScreen })))
const AcademyScreen = lazy(() => import('./screens/Academy').then((m) => ({ default: m.AcademyScreen })))
// Адвент нужен только в сезон — грузим экраны календаря, игр и кассы по требованию.
const AdventScreen = lazy(() => import('./screens/advent/Advent').then((m) => ({ default: m.AdventScreen })))
const CertificationsScreen = lazy(() => import('./screens/Certifications').then((m) => ({ default: m.CertificationsScreen })))
const DoorScreen = lazy(() => import('./screens/advent/Door').then((m) => ({ default: m.DoorScreen })))
const AdventAdminScreen = lazy(() => import('./screens/advent/AdventAdmin').then((m) => ({ default: m.AdventAdminScreen })))
const RedeemScreen = lazy(() => import('./screens/Redeem').then((m) => ({ default: m.RedeemScreen })))

/** Страница кассира: …/?redeem открывается в обычном браузере, без входа через Telegram. */
const CASHIER = new URLSearchParams(location.search).has('redeem')

export default function App() {
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    initTelegram()
    applyTheme()
    watchTheme()
    const { boot, setPhase } = useStore.getState()
    if (CASHIER) return
    if (!inTelegram && !isDemo) setPhase('outside')
    else void boot()
    return enableSparks()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div id="app" className="relative mx-auto h-full max-w-[480px] overflow-hidden">
        <div className="backdrop">
          <i />
          <i />
        </div>
        {CASHIER && (
          <Suspense fallback={null}>
            <RedeemScreen />
          </Suspense>
        )}
        <AnimatePresence mode="wait">
          {phase === 'loading' && !CASHIER && <Splash key="splash" />}
          {phase === 'ok' && <Shell key="shell" />}
          {phase === 'locked' && <Gate key="gate" />}
          {phase === 'setup' && <Setup key="setup" />}
          {phase === 'outside' && <Outside key="outside" />}
          {phase === 'error' && <ErrorScreen key="error" />}
        </AnimatePresence>
        <Toasts />
        {/* В полноэкранном режиме между системными кнопками Telegram остаётся полоса — ставим туда название. */}
        <div
          className="pointer-events-none fixed inset-x-0 z-[110] flex items-center justify-center overflow-hidden font-display text-[14px] font-bold text-ink/90"
          style={{ top: 'var(--tg-safe-area-inset-top, 0px)', height: 'var(--tg-content-safe-area-inset-top, 0px)' }}
        >
          OG CRE8R²
        </div>
      </div>
    </MotionConfig>
  )
}

function Shell() {
  const tab = useStore((s) => s.tab)
  const stack = useStore((s) => s.stack)
  const reward = useStore((s) => s.reward)
  const pop = useStore((s) => s.pop)

  useEffect(() => bindBack(stack.length > 0 ? () => {
    if (stack[stack.length - 1]?.type === 'learning') window.dispatchEvent(new Event('og:courses-back'))
    else if (stack[stack.length - 1]?.type === 'academy') window.dispatchEvent(new Event('og:academy-back'))
    else pop()
  } : null), [stack, pop])

  // Полоса под системными кнопками проявляется, только когда под неё что-то уехало.
  const scrim = useRef<HTMLDivElement>(null)
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (scrim.current && el.dataset.tabScroll !== undefined) scrim.current.dataset.on = String(el.scrollTop > 6)
  }
  useEffect(() => {
    if (scrim.current) scrim.current.dataset.on = 'false'
  }, [tab])

  // Прямая ссылка на урок: t.me/бот?start=l12
  useEffect(() => {
    const academyPath = academyEntry(location.hash, location.pathname, startParam)
    const coursesPath = coursesEntry(location.hash, location.pathname, startParam)
    if (coursesPath) useStore.getState().push({type:'learning',path:coursesPath})
    else if (academyPath) useStore.getState().push({ type: 'academy', path: academyPath })
    if (!coursesPath && !academyPath) {
      const id = Number(/(?:^|_)l(\d+)/.exec(startParam)?.[1] ?? 0)
      const course = Number(/(?:^|_)c(\d+)/.exec(startParam)?.[1] ?? 0)
      if (id) useStore.getState().push({ type: 'lesson', id })
      else if (course) useStore.getState().push({ type: 'course', id: course })
      else if (startParam === 'certifications') useStore.getState().push({ type: 'certifications' })
      // Кнопка из напоминания бота: t.me/бот?startapp=advent
      else if (/(?:^|_)advent(?:_|$)/.test(startParam) && useStore.getState().advent) useStore.getState().push({ type: 'advent' })
    }
    preloadMarkdown()
  }, [])

  return (
    <motion.div className="relative z-10 h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} onScrollCapture={onScroll} className="h-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          {tab === 'home' && <Home />}
          {tab === 'top' && <Top />}
          {tab === 'profile' && <Profile />}
        </motion.div>
      </AnimatePresence>

      <div ref={scrim} className="glass top-scrim pointer-events-none absolute inset-x-0 top-0 z-20" />
      <Nav />

      <AnimatePresence>
        {stack.map((o, i) => (
          <OverlayView key={overlayKey(o, i)} overlay={o} />
        ))}
      </AnimatePresence>

      <AnimatePresence>{reward && <RewardModal key="reward" reward={reward} />}</AnimatePresence>

      <ShareSheet />
    </motion.div>
  )
}

function overlayKey(o: Overlay, i: number) {
  switch (o.type) {
    case 'lesson':
      return `lesson-${o.id}-${i}`
    case 'stories':
      return `stories-${o.id}-${i}`
    case 'course':
      return `course-${o.id}-${i}`
    case 'editor':
      return `editor-${o.lesson?.id ?? 'new'}-${i}`
    case 'course-editor':
      return `course-editor-${o.course?.id ?? 'new'}-${i}`
    case 'door':
      return `door-${o.day}-${i}`
    default:
      return `${o.type}-${i}`
  }
}

function OverlayView({ overlay }: { overlay: Overlay }) {
  const isAdmin=useStore(s=>s.me?.is_admin)
  switch (overlay.type) {
    case 'learning': return <Suspense fallback={null}><CoursesScreen path={overlay.path}/></Suspense>
    case 'academy': return <Suspense fallback={null}><AcademyScreen path={overlay.path}/></Suspense>
    case 'journey': return <Suspense fallback={null}><JourneyScreen/></Suspense>
    case 'club': return <Suspense fallback={null}><ClubScreen/></Suspense>
    case 'services': return <Suspense fallback={null}><ServicesScreen/></Suspense>
    case 'certifications': return <Suspense fallback={null}><CertificationsScreen focusId={overlay.focusId}/></Suspense>
    case 'lesson':
      return <LessonScreen id={overlay.id} from={overlay.from} />
    case 'stories':
      return <Stories startId={overlay.id} />
    case 'course':
      return isAdmin ? <CourseScreen id={overlay.id} from={overlay.from} /> : <div className="absolute inset-0 z-30 flex flex-col justify-center bg-bg p-6"><h1 className="font-display text-xl">Старый курс скрыт</h1><p className="mt-3 text-sm text-mute">Актуальные материалы находятся в разделе «Курсы». Твои предыдущие результаты сохранены.</p><button className="mt-5 text-violet" onClick={()=>{useStore.getState().pop();useStore.getState().push({type:'learning',path:'/courses'})}}>Открыть курсы →</button></div>
    case 'lab':
      return (
        <Suspense fallback={null}>
          <LabScreen />
        </Suspense>
      )
    case 'courses-admin':
      return (
        <Suspense fallback={null}>
          <CoursesAdminScreen />
        </Suspense>
      )
    case 'course-editor':
      return (
        <Suspense fallback={null}>
          <CourseEditorScreen course={overlay.course} />
        </Suspense>
      )
    case 'admin':
      return (
        <Suspense fallback={null}>
          <AdminScreen />
        </Suspense>
      )
    case 'analytics':
      return (
        <Suspense fallback={null}>
          <AnalyticsScreen />
        </Suspense>
      )
    case 'editor':
      return (
        <Suspense fallback={null}>
          <EditorScreen lesson={overlay.lesson} kind={overlay.kind} />
        </Suspense>
      )
    case 'advent':
      return (
        <Suspense fallback={null}>
          <AdventScreen />
        </Suspense>
      )
    case 'door':
      return (
        <Suspense fallback={null}>
          <DoorScreen day={overlay.day} />
        </Suspense>
      )
    case 'advent-admin':
      return (
        <Suspense fallback={null}>
          <AdventAdminScreen />
        </Suspense>
      )
  }
}

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Главная', icon: House },
  { id: 'top', label: 'Рейтинг', icon: Trophy },
  { id: 'profile', label: 'Профиль', icon: User },
]

function Nav() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  // Повторное нажатие на открытую вкладку возвращает к началу экрана.
  const toTop = () => document.querySelector('[data-tab-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' })
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: 'calc(14px + var(--bottom))' }}>
      <nav className="pointer-events-auto flex gap-1 rounded-full border border-line bg-float/85 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <Tap key={id} feedback="select" onClick={() => (active ? toTop() : setTab(id))} aria-label={label} className={`relative flex h-11 items-center gap-2 rounded-full px-4 ${active ? 'text-white' : 'text-mute'}`}>
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--aurora)' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon size={19} strokeWidth={2.2} className="relative" />
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="relative overflow-hidden whitespace-nowrap text-[13px] font-semibold">
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Tap>
          )
        })}
      </nav>
    </div>
  )
}
