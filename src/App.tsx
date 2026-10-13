import { House, Trophy, User } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { lazy, Suspense, useEffect } from 'react'
import { isDemo } from './lib/api'
import { bindBack, initTelegram, inTelegram, startParam } from './lib/tg'
import { applyTheme, watchTheme } from './lib/theme'
import { preloadMarkdown } from './Markdown'
import { Home } from './screens/Home'
import { LessonScreen } from './screens/Lesson'
import { Profile } from './screens/Profile'
import { RewardModal } from './screens/Reward'
import { ShareSheet } from './screens/ShareSheet'
import { ErrorScreen, Gate, Outside, Setup, Splash } from './screens/States'
import { Stories } from './screens/Stories'
import { Top } from './screens/Top'
import { useStore, type Overlay, type Tab } from './store'
import { Tap, Toasts } from './ui'

// Админку видит один человек — незачем грузить её всем.
const AdminScreen = lazy(() => import('./screens/Admin').then((m) => ({ default: m.AdminScreen })))
const EditorScreen = lazy(() => import('./screens/Admin').then((m) => ({ default: m.EditorScreen })))
const AnalyticsScreen = lazy(() => import('./screens/Analytics').then((m) => ({ default: m.AnalyticsScreen })))

export default function App() {
  const phase = useStore((s) => s.phase)

  useEffect(() => {
    initTelegram()
    applyTheme()
    watchTheme()
    const { boot, setPhase } = useStore.getState()
    if (!inTelegram && !isDemo) setPhase('outside')
    else void boot()
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <div id="app" className="relative mx-auto h-full max-w-[480px] overflow-hidden">
        <div className="aurora">
          <i />
          <i />
          <i />
        </div>
        <AnimatePresence mode="wait">
          {phase === 'loading' && <Splash key="splash" />}
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
          Elaz Ed
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

  useEffect(() => bindBack(stack.length > 0 ? pop : null), [stack.length, pop])

  // Прямая ссылка на урок: t.me/бот?start=l12
  useEffect(() => {
    const id = Number(/(?:^|_)l(\d+)/.exec(startParam)?.[1] ?? 0)
    if (id) useStore.getState().push({ type: 'lesson', id })
    preloadMarkdown()
  }, [])

  return (
    <motion.div className="relative z-10 h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} className="h-full" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          {tab === 'home' && <Home />}
          {tab === 'top' && <Top />}
          {tab === 'profile' && <Profile />}
        </motion.div>
      </AnimatePresence>

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
    case 'editor':
      return `editor-${o.lesson?.id ?? 'new'}-${i}`
    default:
      return `${o.type}-${i}`
  }
}

function OverlayView({ overlay }: { overlay: Overlay }) {
  switch (overlay.type) {
    case 'lesson':
      return <LessonScreen id={overlay.id} from={overlay.from} />
    case 'stories':
      return <Stories startId={overlay.id} />
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
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center" style={{ paddingBottom: 'calc(14px + var(--bottom))' }}>
      <nav className="pointer-events-auto flex gap-1 rounded-full border border-line bg-float/85 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <Tap key={id} feedback="select" onClick={() => setTab(id)} aria-label={label} className={`relative flex h-11 items-center gap-2 rounded-full px-4 ${active ? 'text-white' : 'text-mute'}`}>
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
