import '@fontsource-variable/onest'
import '@fontsource-variable/unbounded'
import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div style={{ fontFamily: 'sans-serif', padding: 40 }}>
        <h1>Давайте начнём заново</h1>
        <p>Перезагрузите приложение. Сохранённые действия останутся с вами.</p>
        <button onClick={() => location.reload()}>Перезагрузить</button>
      </div>
    ) : (
      this.props.children
    )
  }
}
createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>,
)
