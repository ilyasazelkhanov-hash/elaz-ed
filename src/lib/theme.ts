// Тема: «авто» берёт её из Telegram (а вне Telegram — из настроек устройства), либо человек выбирает сам.
import { inTelegram, paintChrome } from './tg'

export type ThemeMode = 'auto' | 'light' | 'dark'
type Scheme = 'light' | 'dark'

const KEY = 'elaz-ed-theme'
const BG: Record<Scheme, string> = { dark: '#0b0a12', light: '#efecf8' }
const media = window.matchMedia('(prefers-color-scheme: light)')

export function getMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

function autoScheme(): Scheme {
  const scheme = window.Telegram?.WebApp?.colorScheme
  // Вне Telegram SDK всегда отвечает «light», поэтому там верим только настройкам устройства.
  if (inTelegram && (scheme === 'light' || scheme === 'dark')) return scheme
  return media.matches ? 'light' : 'dark'
}

export function applyTheme(): Scheme {
  const mode = getMode()
  const scheme = mode === 'auto' ? autoScheme() : mode
  document.documentElement.dataset.theme = scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BG[scheme])
  paintChrome(BG[scheme])
  return scheme
}

export function setMode(mode: ThemeMode) {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, mode)
  } catch {
    /* приватный режим */
  }
  applyTheme()
}

/** Следим за сменой темы в Telegram и на устройстве — в режиме «авто» приложение перекрашивается само. */
export function watchTheme() {
  try {
    window.Telegram?.WebApp?.onEvent?.('themeChanged', applyTheme)
  } catch {
    /* старый клиент Telegram */
  }
  media.addEventListener('change', applyTheme)
}
