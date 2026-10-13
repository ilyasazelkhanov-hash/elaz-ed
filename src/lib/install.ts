// Ярлык приложения: на телефоне в Telegram его ставит сам Telegram, в браузере — системное окно установки.
import { inTelegram, telegram, tgVersion } from './tg'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
}

let deferred: InstallPrompt | null = null

// Браузер присылает это событие, когда готов предложить установку. Сохраняем его до нажатия кнопки.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPrompt
})

/** Что произошло после нажатия: ярлык поставлен средствами платформы или нужна подсказка. */
export async function addShortcut(): Promise<'done' | 'hint-telegram' | 'hint-browser'> {
  const mobileTelegram = inTelegram && ['android', 'ios'].includes(telegram?.platform)
  if (mobileTelegram && tgVersion('8.0') && typeof telegram.addToHomeScreen === 'function') {
    telegram.addToHomeScreen()
    return 'done'
  }
  if (deferred) {
    await deferred.prompt()
    deferred = null
    return 'done'
  }
  return inTelegram ? 'hint-telegram' : 'hint-browser'
}

export const INSTAGRAM = { handle: '@elazart', url: 'https://www.instagram.com/elazart' }
