import { useStore } from '../store'

/**
 * Ссылка в приложение через бота: открывает урок (если указан) и засчитывает приглашение тому, кто поделился.
 * Пока бот не настроен, ссылки нет.
 */
export function appLink(lessonId?: number) {
  const { meta, me } = useStore.getState()
  if (!meta.bot.username) return null
  const parts = [lessonId ? `l${lessonId}` : '', me ? `r${me.id}` : ''].filter(Boolean).join('_')
  return `https://t.me/${meta.bot.username}?${meta.bot.main_app ? 'startapp' : 'start'}=${parts}`
}
