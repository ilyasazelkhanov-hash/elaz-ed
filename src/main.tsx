import '@fontsource-variable/onest'
import '@fontsource-variable/unbounded'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

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
    <App />
  </Boundary>,
)
