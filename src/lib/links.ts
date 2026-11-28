import { useStore } from '../store'
import { isDemo } from './api'

/**
 * Ссылка в приложение через бота: открывает урок (если указан) и засчитывает приглашение тому, кто поделился.
 * Пока бот не настроен, ссылки нет.
 */
/** Ссылка для сторис адвента: переход по ней даёт автору билет «догнать», а новичок засчитывается как приглашённый. */
export function storyLink() {
  const { meta, me } = useStore.getState()
  if (!meta.bot.username || !me) return null
  return `https://t.me/${meta.bot.username}?${meta.bot.main_app ? 'startapp' : 'start'}=st${me.id}_r${me.id}`
}

export function appLink(lessonId?: number) {
  const { meta, me } = useStore.getState()
  if (!meta.bot.username) return null
  const parts = [lessonId ? `l${lessonId}` : '', me ? `r${me.id}` : ''].filter(Boolean).join('_')
  return `https://t.me/${meta.bot.username}?${meta.bot.main_app ? 'startapp' : 'start'}=${parts}`
}

/**
 * Вызов другу: ссылка сразу на бесплатный разбор или разминку. Приглашение засчитывает сервер по `_r<id>`.
 * В демо аккаунта нет, поэтому реферал не добавляется.
 */
export function freeStartLink(target: string) {
  const { meta, me } = useStore.getState()
  if (!meta.bot.username || !/^[a-z-]{1,40}$/.test(target)) return null
  return `https://t.me/${meta.bot.username}?${meta.bot.main_app ? 'startapp' : 'start'}=g_${target}${me && !isDemo ? `_r${me.id}` : ''}`
}
