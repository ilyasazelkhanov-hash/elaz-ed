import '@fontsource-variable/onest'
import '@fontsource-variable/unbounded'
import { Component, Suspense, lazy, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const AcademyPublic = lazy(() => import('./AcademyPublic'))
import './index.css'
const PlatformSpace = lazy(() => import('./PlatformSpace'))
const academyPublic = /^\/academy\/(verify|portfolio)\/[^/]+\/?$/.test(location.pathname)
const platform = new URLSearchParams(location.search).has('platform') || location.pathname.startsWith('/space')

// После выкладки файлы прошлой версии с сервера исчезают. Если кусок приложения не загрузился,
// один раз перезагружаемся за свежей версией; повторно в течение минуты — нет, чтобы не зациклиться.
window.addEventListener('vite:preloadError', (e) => {
  const KEY = 'elaz-ed-reloaded'
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 60_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return
  }
  e.preventDefault()
  location.reload()
})

/** Последний рубеж: вместо пустого экрана — понятное сообщение и перезапуск. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center px-8 text-center">
        <p className="font-display text-[22px] font-semibold">Что-то сломалось</p>
        <p className="mt-2 text-[15px] text-mute">Перезапусти приложение — прогресс сохранён.</p>
        <button onClick={() => location.reload()} className="mt-6 h-[52px] rounded-[20px] border border-line bg-card px-7 text-[14.5px] font-semibold">
          Перезапустить
        </button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <Boundary>
    {academyPublic ? <Suspense fallback={<div style={{padding:32}}>AI Academy…</div>}><AcademyPublic/></Suspense> : platform ? <Suspense fallback={<div style={{padding:32}}>Открываем пространство OG CRE8R²…</div>}><PlatformSpace /></Suspense> : <Suspense fallback={<div style={{padding:32}}>OG CRE8R²…</div>}><App /></Suspense>}
  </Boundary>,
)
