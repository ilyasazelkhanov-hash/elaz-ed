import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Compass,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  Home as HomeIcon,
  Layers3,
  Menu,
  MessagesSquare,
  Moon,
  Settings2,
  ShoppingBag,
  Sparkles,
  Sun,
  User,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import brandJson from '../brand.config.json'
import configJson from '../app.config.json'
import type { AppConfig, BrandConfig, PresetId } from './platform/contracts.ts'
import { presets, validateConfig } from './platform/config.ts'
import { demoMode, telegram } from './platform/client.ts'
import { usePlatform } from './platform/store.ts'
import Home from './screens/Home.tsx'
import { Gifts, Passport, Projects, Recap } from './screens/Expansion.tsx'
import Industry, { IndustryPicker } from './screens/Industry.tsx'
import { AllModules, ModulePage, Notifications, Wallet } from './screens/Modules.tsx'
import { Button, Celebration, Empty, IconButton, Scene, Toast, type StyleVars } from './components/ui.tsx'
import { SharedArtTransition } from './components/SharedArtTransition.tsx'
import TouchEffects from './components/TouchEffects.tsx'
import { BrandContext } from './platform/brand-context.ts'
import './styles.css'
import './experience.css'
import './signature.css'

const Detail = lazy(() => import('./screens/Detail.tsx'))
const Cart = lazy(() => import('./screens/Detail.tsx').then((m) => ({ default: m.Cart })))
const Profile = lazy(() => import('./screens/Profile.tsx'))
const Admin = lazy(() => import('./screens/Admin.tsx'))
const Cashier = lazy(() => import('./screens/Admin.tsx').then((m) => ({ default: m.Cashier })))
const Game = lazy(() => import('./screens/Games.tsx').then((m) => ({ default: m.Game })))
const Quiz = lazy(() => import('./screens/Games.tsx').then((m) => ({ default: m.Quiz })))
const Story = lazy(() => import('./screens/Games.tsx').then((m) => ({ default: m.Story })))
const nav: Record<string, { label: string; icon: LucideIcon }> = {
  home: { label: 'Главная', icon: HomeIcon },
  campaigns: { label: 'Активности', icon: Gamepad2 },
  loyalty: { label: 'Привилегии', icon: Gift },
  community: { label: 'Свои люди', icon: MessagesSquare },
  profile: { label: 'Мой круг', icon: User },
  learning: { label: 'Академия', icon: GraduationCap },
  team: { label: 'Команда', icon: Users },
  commerce: { label: 'Коллекция', icon: ShoppingBag },
  events: { label: 'Встречи', icon: CalendarDays },
  content: { label: 'Журнал', icon: BookOpen },
  progress: { label: 'Прогресс', icon: Zap },
  retention: { label: 'Уведомления', icon: Bell },
  analytics: { label: 'Аналитика', icon: Settings2 },
}
export interface AppProps {
  brand?: BrandConfig
  config?: AppConfig
  apiBase?: string
  embedded?: boolean
}
export default function App({
  brand = brandJson as BrandConfig,
  config = configJson as AppConfig,
  apiBase,
  embedded = false,
}: AppProps) {
  const initialMode = new URLSearchParams(location.search).get('mode')
  const [mode, setMode] = useState<PresetId>(
    demoMode() && ['club', 'team', 'academy', 'services'].includes(initialMode ?? '')
      ? (initialMode as PresetId)
      : config.preset,
  )
  const [dark, setDark] = useState(
      () => (localStorage.getItem(`az-theme:${config.id}`) ?? brand.defaultTheme ?? 'light') === 'dark',
    ),
    [menu, setMenu] = useState(false)
  const effective = useMemo(
    () =>
      validateConfig(
        demoMode()
          ? {
              ...config,
              ...(mode === config.preset ? {} : presets[mode]),
              id: config.id,
              name: config.name,
              modules: config.modules,
              navigation: (mode === config.preset ? config.navigation : presets[mode].navigation).filter((id) =>
                ['home', 'profile', ...config.modules].includes(id),
              ),
            }
          : config,
        brand,
      ).config,
    [config, brand, mode],
  )
  const { snapshot: s, loading, error, boot, push, back, stack, cart } = usePlatform(),
    view = stack[stack.length - 1]
  const appRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const viewport = window.visualViewport
    let releaseKeyboard: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      const root = appRef.current
      if (!root) return
      const editing = document.activeElement?.matches('input,textarea,select') ?? false
      if (editing) {
        clearTimeout(releaseKeyboard)
        releaseKeyboard = undefined
        root.classList.add('az-keyboard')
      } else if (root.classList.contains('az-keyboard') && !releaseKeyboard) {
        // Let the form's pointer-up/click finish before the floating navigation returns.
        releaseKeyboard = setTimeout(() => {
          releaseKeyboard = undefined
          if (!document.activeElement?.matches('input,textarea,select')) root.classList.remove('az-keyboard')
        }, 250)
      }
      root.style.setProperty('--az-viewport-height', `${viewport?.height ?? innerHeight}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    const blur = () => setTimeout(update, 0)
    document.addEventListener('focusout', blur)
    return () => {
      clearTimeout(releaseKeyboard)
      viewport?.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', blur)
    }
  }, [])
  useEffect(() => {
    appRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [view.type, view.id, mode])
  useEffect(() => {
    const el = appRef.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const scroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => el.style.setProperty('--az-scroll', String(Math.min(el.scrollTop, 600))))
    }
    el.addEventListener('scroll', scroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', scroll)
    }
  }, [])
  useEffect(() => {
    void boot(effective, apiBase)
  }, [effective, apiBase])
  useEffect(() => {
    const t = telegram()
    try {
      t?.ready?.()
      t?.expand?.()
      if (t?.isVersionAtLeast?.('8.0')) t.requestFullscreen?.()
      if (t?.isVersionAtLeast?.('6.1')) {
        t.setHeaderColor?.(dark ? (brand.dark?.background ?? '#0B1020') : brand.colors.background)
        t.setBackgroundColor?.(dark ? (brand.dark?.background ?? '#0B1020') : brand.colors.background)
      }
    } catch {
      /* optional native affordance */
    }
    // Поля вокруг колонки на широком экране — того же цвета, что и фон приложения.
    if (!embedded)
      document.documentElement.style.setProperty(
        '--az-page',
        dark ? (brand.dark?.background ?? '#0B1020') : brand.colors.background,
      )
  }, [dark, brand, embedded])
  useEffect(() => {
    const b = telegram()?.BackButton
    if (!b || !telegram()?.isVersionAtLeast?.('6.1')) return
    if (stack.length > 1) b.show()
    else b.hide()
    b.onClick(back)
    return () => b.offClick(back)
  }, [stack.length, back])
  const toggleTheme = () =>
    setDark((v) => {
      localStorage.setItem(`az-theme:${config.id}`, v ? 'light' : 'dark')
      return !v
    })
  const primary = (dark && brand.dark?.primary) || brand.colors.primary
  const accent = (dark && brand.dark?.accent) || brand.colors.accent
  const onPrimary = (dark && brand.dark?.onPrimary) || brand.colors.onPrimary
  const onAccent = (dark && brand.dark?.onAccent) || brand.colors.onAccent
  const vars: StyleVars = {
    '--az-primary': primary,
    '--az-ink': dark ? (brand.dark?.ink ?? '#F5F3EE') : brand.colors.ink,
    '--az-bg': dark ? (brand.dark?.background ?? '#0B1020') : brand.colors.background,
    '--az-accent': accent,
    '--az-grad-from': brand.colors.gradientFrom ?? primary,
    '--az-grad-via': brand.colors.gradientVia ?? `color-mix(in srgb, ${primary} 55%, ${accent})`,
    '--az-grad-to': brand.colors.gradientTo ?? accent,
    '--az-hero-highlight': brand.colors.heroHighlight ?? brand.colors.accent,
    '--az-surface': dark ? (brand.dark?.surface ?? '#171D2E') : brand.colors.surface,
    '--az-muted': dark ? (brand.dark?.muted ?? '#A8B0C4') : brand.colors.muted,
    ...(brand.colors.peach ? { '--az-peach': brand.colors.peach } : {}),
    ...(brand.colors.lilac ? { '--az-lilac': brand.colors.lilac } : {}),
    ...(onPrimary ? { '--az-on-primary': onPrimary } : {}),
    ...(onAccent ? { '--az-on-accent': onAccent } : {}),
    ...(brand.shadow ? { '--az-shadow': brand.shadow } : {}),
    '--az-card-bg': brand.colors.card ?? '#10162A',
    '--az-radius': `${brand.radius}px`,
    '--az-font': `'${brand.fonts.body}',sans-serif`,
    '--az-display': `'${brand.fonts.display}',sans-serif`,
  }
  const go = (id: string) => {
    setMenu(false)
    push({ type: id })
  }
  const active =
    view.type === 'home'
      ? 'home'
      : view.type === 'entity'
        ? s?.entities.find((e) => e.id === view.id)?.module
        : view.type
  const login = () => {
    location.href = `${apiBase ?? import.meta.env.VITE_API_URL ?? '/api'}/v1/auth/login`
  }
  const enabled = (id: string) => (s?.config ?? effective).modules.includes(id as never)
  const navigation = (s?.config.navigation ?? effective.navigation).filter(
    (id) => ['home', 'profile'].includes(id) || enabled(id),
  )
  const routeModule =
    (
      {
        wallet: 'loyalty',
        gifts: 'loyalty',
        passport: 'progress',
        recap: 'progress',
        projects: 'commerce',
        'project-admin': 'commerce',
        cart: 'commerce',
        notifications: 'retention',
        progress: 'progress',
        game: 'campaigns',
        story: 'content',
      } as Record<string, string>
    )[view.type] ?? (nav[view.type] && !['home', 'profile'].includes(view.type) ? view.type : undefined)
  const disabled = routeModule && !enabled(routeModule)
  return (
    <BrandContext value={brand}>
      <MotionConfig reducedMotion={brand.motion === 'reduced' ? 'always' : 'user'}>
        <div
          ref={appRef}
          className={`az-app az-experience ${dark ? 'az-dark' : ''} ${embedded ? 'az-embedded' : ''} ${['admin', 'analytics', 'cashier'].includes(view.type) ? 'az-management' : ''}`}
          style={vars}
        >
          <div className="az-backdrop" aria-hidden="true">
            <i />
            <i />
          </div>
          <div className="az-top-line">
            <span>GOOD THINGS ARE COMING.</span>
            <span>YOUR NEXT CHAPTER ↗</span>
            <span>MADE FOR PEOPLE LIKE YOU.</span>
          </div>
          <div className="az-layout">
            <aside className={`az-sidebar ${menu ? 'is-open' : ''}`}>
              <div className="az-sidebar-brand">
                <img src={brand.wordmark} alt={brand.name} />
                <span>YOUR NEXT CHAPTER</span>
              </div>
              <button className="az-mobile-menu-close" aria-label="Закрыть меню" onClick={() => setMenu(false)}>
                <X size={24} />
              </button>
              <div className="az-sidebar-label">ВАШЕ ПРОСТРАНСТВО</div>
              <nav aria-label="Основная навигация">
                {navigation.map((id) => {
                  const item = nav[id] ?? nav.home
                  const Icon = item.icon
                  return (
                    <button
                      key={id}
                      className={active === id ? 'is-active' : ''}
                      onClick={() => (id === 'home' ? usePlatform.getState().home() : go(id))}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                      {active === id && <i />}
                    </button>
                  )
                })}
                <button className={view.type === 'all' ? 'is-active' : ''} onClick={() => go('all')}>
                  <Layers3 size={20} />
                  <span>Все возможности</span>
                  <ArrowUpRight size={16} />
                </button>
              </nav>
              <div className="az-sidebar-note">
                <span>✳</span>
                <h3>
                  Больше, чем
                  <br />
                  просто вместе.
                </h3>
                <p>
                  Место для ваших людей,
                  <br />
                  идей и маленьких радостей.
                </p>
              </div>
              <div className="az-sidebar-bottom">
                <button onClick={toggleTheme}>
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{dark ? 'Светлая тема' : 'Тёмная тема'}</span>
                </button>
                {s?.me.role !== 'member' && s && (
                  <button onClick={() => go('admin')}>
                    <Settings2 size={18} />
                    <span>Управление</span>
                  </button>
                )}
                <span>{brand.name} © 2026</span>
              </div>
            </aside>
            {menu && <div className="az-menu-scrim" onClick={() => setMenu(false)} />}
            <main className="az-main">
              <header className="az-header">
                {embedded && (
                  <IconButton
                    icon={ArrowLeft}
                    label="К основным урокам OG"
                    onClick={() => {
                      const url = new URL(location.href)
                      url.searchParams.delete('platform')
                      url.pathname = '/'
                      location.href = url.href
                    }}
                  />
                )}
                <button className="az-mobile-menu" aria-label="Открыть меню" onClick={() => setMenu(true)}>
                  <Menu size={22} />
                </button>
                <button className="az-header-brand" onClick={() => usePlatform.getState().home()}>
                  <img src={brand.monogram} alt="" />
                  <span>
                    {brand.name}
                    <small>
                      {mode === 'team'
                        ? 'TEAM'
                        : mode === 'academy'
                          ? 'ACADEMY'
                          : mode === 'services'
                            ? 'SPACE'
                            : 'CLUB'}
                    </small>
                  </span>
                </button>
                <div className="az-header-right">
                  {demoMode() && (
                    <label className="az-mode-switch">
                      <span>Пространство</span>
                      <select
                        aria-label="Демонстрационный сценарий"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as PresetId)}
                      >
                        <option value="club">Club</option>
                        <option value="team">Team</option>
                        <option value="academy">Academy</option>
                        <option value="services">Services</option>
                      </select>
                      <ChevronDown size={13} />
                    </label>
                  )}
                  {enabled('commerce') && (
                    <IconButton
                      icon={ShoppingBag}
                      label="Корзина"
                      badge={cart.reduce((n, c) => n + c.quantity, 0)}
                      onClick={() => go('cart')}
                    />
                  )}
                  {enabled('retention') && (
                    <IconButton
                      icon={Bell}
                      label="Уведомления"
                      badge={s?.notifications.filter((n) => !n.read && n.userId === s.me.id).length}
                      onClick={() => go('notifications')}
                    />
                  )}
                  <button className="az-header-avatar" aria-label="Открыть профиль" onClick={() => go('profile')}>
                    {s?.me.name[0] ?? 'A'}
                  </button>
                </div>
              </header>
              {demoMode() && (
                <div className="az-demo-ribbon">
                  <i />
                  <span>Демо</span>
                  <span>
                    {mode === 'team'
                      ? 'Для команды'
                      : mode === 'academy'
                        ? 'Для эксперта'
                        : mode === 'services'
                          ? 'Для бизнеса'
                          : 'Для клиентов'}
                    <ArrowUpRight size={12} />
                  </span>
                </div>
              )}
              {loading ? (
                <div className="az-splash">
                  <Scene />
                  <h2>
                    Готовим вашу новую главу<span>…</span>
                  </h2>
                  <p>Хорошее уже близко.</p>
                </div>
              ) : error ? (
                <div className="az-entry-error">
                  <img src={brand.monogram} alt="" />
                  <h1>
                    Ваше пространство
                    <br />
                    начинается здесь.
                  </h1>
                  <p>{error}</p>
                  {!telegram()?.initData && (
                    <Button onClick={login}>
                      Войти в управление через Telegram
                      <ArrowUpRight size={18} />
                    </Button>
                  )}
                  <Button tone="soft" onClick={() => void boot(effective, apiBase)}>
                    Попробовать снова
                  </Button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${mode}-${view.type}-${view.id ?? ''}`}
                    className="az-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.26 }}
                  >
                    <Suspense
                      fallback={
                        <div className="az-loading-small">
                          Хорошее уже близко<span>✳</span>
                        </div>
                      }
                    >
                      {disabled ? (
                        <Empty title="Раздел отключён" body="Эта возможность не включена в вашем пространстве." />
                      ) : view.type === 'home' ? (
                        <Home brand={brand} />
                      ) : view.type === 'gifts' ? (
                        <Gifts />
                      ) : view.type === 'passport' ? (
                        <Passport />
                      ) : view.type === 'projects' ? (
                        <Projects />
                      ) : view.type === 'project-admin' ? (
                        <Projects manage />
                      ) : view.type === 'recap' ? (
                        <Recap />
                      ) : view.type === 'industry' ? (
                        <Industry id={view.id ?? 'coffee'} />
                      ) : view.type === 'industries' ? (
                        <IndustryPicker />
                      ) : view.type === 'entity' ? (
                        <Detail id={view.id!} />
                      ) : view.type === 'profile' ? (
                        <Profile brand={brand} dark={dark} toggleTheme={toggleTheme} />
                      ) : view.type === 'all' ? (
                        <AllModules />
                      ) : view.type === 'wallet' ? (
                        <Wallet brand={brand} />
                      ) : view.type === 'notifications' ? (
                        <Notifications />
                      ) : view.type === 'cart' ? (
                        <Cart />
                      ) : view.type === 'admin' || view.type === 'analytics' ? (
                        <Admin />
                      ) : view.type === 'cashier' ? (
                        <Cashier />
                      ) : view.type === 'quiz' ? (
                        <Quiz id={view.id!} />
                      ) : view.type === 'game' ? (
                        <Game id={view.id!} />
                      ) : view.type === 'story' ? (
                        <Story id={view.id!} />
                      ) : (
                        <ModulePage id={view.type} />
                      )}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              )}
            </main>
          </div>
          {!loading && !error && view.type !== 'story' && (
            <nav className="az-bottom-nav" aria-label="Мобильная навигация">
              {navigation.map((id) => {
                const item = nav[id] ?? nav.home
                const Icon = item.icon
                return (
                  <button
                    key={id}
                    aria-label={item.label}
                    className={active === id ? 'is-active' : ''}
                    onClick={() => (id === 'home' ? usePlatform.getState().home() : go(id))}
                  >
                    {active === id && (
                      <motion.i
                        layoutId="az-nav-indicator"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon size={21} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          )}
          <SharedArtTransition />
          <TouchEffects />
          <Toast />
          <Celebration />
        </div>
      </MotionConfig>
    </BrandContext>
  )
}
