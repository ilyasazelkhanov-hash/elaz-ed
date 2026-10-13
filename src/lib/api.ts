import { mockApi } from './mock'
import { initData, inTelegram, platform, startParam } from './tg'
import type { Api } from './types'

const API_URL: string = import.meta.env.VITE_API_URL ?? ''

/** Вне Telegram приложение работает только как демо на локальных данных. */
export const isDemo = !inTelegram && (import.meta.env.DEV || new URLSearchParams(location.search).has('demo'))

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

async function call<T>(route: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    // text/plain — «простой» запрос: браузер не тратит круг на CORS-preflight.
    res = await fetch(`${API_URL}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ auth: initData, tz: -new Date().getTimezoneOffset(), ...payload }),
    })
  } catch {
    throw new ApiError('network', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data?.error ?? 'server', res.status)
  return data as T
}

const httpApi: Api = {
  boot: (force) => call('boot', { force: !!force, sp: startParam, platform, theme: document.documentElement.dataset.theme ?? '' }),
  lesson: (id) => call('lesson', { id }),
  complete: (id, answers) => call('complete', { id, answers }),
  daily: () => call('daily'),
  like: (id) => call('like', { id }),
  top: () => call('top'),
  track: async (events) => {
    await call('track', { events })
  },
  shareUpload: async (image, kind) => (await call<{ url: string }>('share_upload', { image, kind })).url,
  adminAnalytics: () => call('admin_analytics'),
  adminList: () => call('admin_list'),
  adminSave: (lesson) => call('admin_save', { lesson }),
  adminDelete: async (id) => {
    await call('admin_delete', { id })
  },
  adminAnnounce: async (id) => {
    await call('admin_announce', { id })
  },
}

export const api: Api = isDemo ? mockApi : httpApi

export function errorText(e: unknown) {
  const code = e instanceof ApiError ? e.code : typeof e === 'string' ? e : ''
  switch (code) {
    case 'network':
      return 'Нет связи. Проверь интернет'
    case 'locked':
      return 'Подписка на канал не найдена'
    case 'expired':
    case 'bad_auth':
      return 'Сессия устарела. Открой приложение заново'
    case 'title_required':
      return 'Нужен заголовок'
    case 'not_published':
      return 'Сначала опубликуй урок'
    case 'bad_image':
    case 'upload':
      return 'Картинка не загрузилась. Попробуй ещё раз'
    case 'telegram':
      return 'Telegram не принял сообщение. Проверь права бота в канале'
    default:
      return 'Что-то сломалось. Попробуй ещё раз'
  }
}
