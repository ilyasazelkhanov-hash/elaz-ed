// Тонкая обёртка над Telegram WebApp SDK. Вне Telegram все вызовы молча ничего не делают.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Telegram?: { WebApp?: any }
  }
}

const wa: any = window.Telegram?.WebApp

export const initData: string = wa?.initData ?? ''
export const inTelegram = initData.length > 0
/** ios, android, tdesktop, weba… — для аналитики и выбора способа поделиться. */
export const platform: string = inTelegram ? String(wa?.platform ?? '') : 'web'
export const tgUser: { id?: number; first_name?: string; photo_url?: string } = wa?.initDataUnsafe?.user ?? {}

/** Параметр запуска: из прямой ссылки (startapp) или из кнопки бота (?sp=). */
export const startParam: string = wa?.initDataUnsafe?.start_param ?? new URLSearchParams(location.search).get('sp') ?? ''

const supports = (v: string) => !!wa?.isVersionAtLeast?.(v)
const safe = (fn: () => void) => {
  try {
    fn()
  } catch {
    /* старый клиент Telegram */
  }
}

export function initTelegram() {
  if (!wa) return
  safe(() => wa.ready())
  safe(() => wa.expand())
  if (supports('7.7')) safe(() => wa.disableVerticalSwipes())
  if (supports('8.0') && ['android', 'ios'].includes(wa.platform)) {
    safe(() => wa.requestFullscreen())
    safe(() => wa.lockOrientation())
  }
}

/** Красит шапку, фон и нижнюю панель Telegram в цвет темы приложения. */
export function paintChrome(color: string) {
  if (!wa || !inTelegram) return
  if (supports('6.1')) {
    safe(() => wa.setHeaderColor(color))
    safe(() => wa.setBackgroundColor(color))
  }
  if (supports('7.10')) safe(() => wa.setBottomBarColor(color))
}

const hf = inTelegram && supports('6.1') ? wa.HapticFeedback : null

export const haptic = {
  tap: () => safe(() => hf?.impactOccurred('light')),
  soft: () => safe(() => hf?.impactOccurred('soft')),
  heavy: () => safe(() => hf?.impactOccurred('medium')),
  select: () => safe(() => hf?.selectionChanged()),
  success: () => safe(() => hf?.notificationOccurred('success')),
  error: () => safe(() => hf?.notificationOccurred('error')),
}

export function openLink(url: string) {
  if (url.startsWith('/')) url = new URL(url, location.origin).href
  if (inTelegram && /^https:\/\/t\.me\//.test(url)) return safe(() => wa.openTelegramLink(url))
  if (wa?.openLink && inTelegram) return safe(() => wa.openLink(url))
  window.open(url, '_blank', 'noopener')
}

export function shareLink(url: string, text: string) {
  openLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
}

/** Показывает нативную кнопку «Назад» и возвращает функцию отписки. */
export function bindBack(handler: (() => void) | null) {
  const bb = wa?.BackButton
  if (!bb || !inTelegram) return () => {}
  if (!handler) {
    safe(() => bb.hide())
    return () => {}
  }
  safe(() => bb.onClick(handler))
  safe(() => bb.show())
  return () => safe(() => bb.offClick(handler))
}

/** Публикация в сторис Telegram и сохранение файла работают только с картинкой по ссылке. */
export const canShareStory = inTelegram && supports('7.8') && typeof wa?.shareToStory === 'function'
export const canDownload = inTelegram && supports('8.0') && typeof wa?.downloadFile === 'function'

export function shareToStory(url: string, text: string, link: string | null) {
  safe(() => wa.shareToStory(url, { text, ...(link ? { widget_link: { url: link, name: 'OG CRE8R²' } } : {}) }))
}

export function downloadFile(url: string, fileName: string) {
  safe(() => wa.downloadFile({ url, file_name: fileName }))
}

export const canShareMessage = inTelegram && supports('8.0') && typeof wa?.shareMessage === 'function'
export const canPayStars = inTelegram && supports('6.1') && typeof wa?.openInvoice === 'function'

/** Запрос разрешения на отправку сообщений и пуш-уведомлений от бота (Telegram WebApp 6.9+). */
export function requestWriteAccess(): Promise<boolean> {
  if (wa?.requestWriteAccess && inTelegram && supports('6.9')) {
    return new Promise((resolve) => {
      try {
        wa.requestWriteAccess((allowed: boolean) => resolve(!!allowed))
      } catch {
        resolve(false)
      }
    })
  }
  return Promise.resolve(false)
}

/** Отправка заранее подготовленного сообщения: Telegram сам покажет выбор чата. */
export function shareMessage(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      wa.shareMessage(id, (sent: boolean) => resolve(!!sent))
    } catch {
      resolve(false)
    }
  })
}

/** Открывает счёт в звёздах Telegram поверх приложения. */
export function openInvoice(link: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return new Promise((resolve) => {
    try {
      wa.openInvoice(link, (status: 'paid' | 'cancelled' | 'failed' | 'pending') => resolve(status))
    } catch {
      resolve('failed')
    }
  })
}

/** Сырой объект Telegram — для экрана «Лаборатория», где возможности показываются как есть. */
export const telegram: any = inTelegram ? wa : null
export const tgVersion = (v: string) => inTelegram && supports(v)

export function confirmDialog(message: string): Promise<boolean> {
  if (wa?.showConfirm && inTelegram && supports('6.2')) {
    return new Promise((resolve) => {
      try {
        wa.showConfirm(message, (ok: boolean) => resolve(ok))
      } catch {
        resolve(window.confirm(message))
      }
    })
  }
  return Promise.resolve(window.confirm(message))
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}
