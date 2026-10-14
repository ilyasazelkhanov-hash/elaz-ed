import { ApiError } from './errors'
import { initData, inTelegram, platform, startParam } from './tg'
import type { Api, Payment, RedeemPoint } from './types'

const API_URL: string = import.meta.env.VITE_API_URL ?? ''

/** Вне Telegram приложение работает только как демо на локальных данных. */
export const isDemo = !inTelegram && (import.meta.env.DEV || new URLSearchParams(location.search).has('demo'))

export { ApiError }

async function call<T>(route: string, payload: Record<string, unknown> = {}, keepalive = false): Promise<T> {
  let res: Response
  try {
    // text/plain — «простой» запрос: браузер не тратит круг на CORS-preflight.
    // keepalive — запрос долетает, даже если приложение свернули прямо во время отправки.
    res = await fetch(`${API_URL}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ auth: initData, tz: -new Date().getTimezoneOffset(), ...payload }),
      keepalive,
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
    await call('track', { events }, true)
  },
  shareUpload: async (image, kind) => (await call<{ url: string }>('share_upload', { image, kind })).url,
  shareMessage: async (kind, lessonId) => (await call<{ id: string }>('share_message', { kind, lesson_id: lessonId })).id,
  courseRequest: async (id) => {
    await call('course_request', { id })
  },
  courseInvoice: async (id) => (await call<{ link: string }>('course_invoice', { id })).link,
  adminAnalytics: () => call('admin_analytics'),
  adminCourses: () => call('admin_courses'),
  adminCourseSave: (course) => call('admin_course_save', { course }),
  adminCourseDelete: async (id) => {
    await call('admin_course_delete', { id })
  },
  adminRequest: async (userId, courseId, approve) => {
    await call('admin_request', { user_id: userId, course_id: courseId, approve })
  },
  adminGrant: async (courseId, username) => (await call<{ name: string }>('admin_grant', { course_id: courseId, username })).name,
  adminPayments: async () => (await call<{ payments: Payment[] }>('admin_payments')).payments,
  adminRefund: async (id) => {
    await call('admin_refund', { id })
  },
  adminList: () => call('admin_list'),
  adminSave: (lesson) => call('admin_save', { lesson }),
  adminDelete: async (id) => {
    await call('admin_delete', { id })
  },
  adminAnnounce: async (id) => {
    await call('admin_announce', { id })
  },
  advent: () => call('advent'),
  adventDoor: (day) => call('advent_door', { day }),
  adventOpen: (day, input) => call('advent_open', { day, ...input }),
  adminAdvent: () => call('admin_advent'),
  redeemPoints: async () => (await call<{ points: RedeemPoint[] }>('redeem_points')).points,
  redeemCheck: (point, pin, code) => call('redeem', { point, pin, code, check: true }),
  redeem: (point, pin, code) => call('redeem', { point, pin, code }),
}

/**
 * Демо-данные (уроки, адвент, логика мока — ~45 КБ) нужны только вне Telegram.
 * Раньше они лежали в основном бандле у каждого подписчика; теперь грузятся при первом вызове в демо.
 */
const demoApi = Object.fromEntries(
  (Object.keys(httpApi) as (keyof Api)[]).map((key) => [
    key,
    async (...args: unknown[]) => {
      const { mockApi } = await import('./mock')
      return (mockApi[key] as (...a: unknown[]) => unknown)(...args)
    },
  ]),
) as unknown as Api

export const api: Api = isDemo ? demoApi : httpApi

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
    case 'course_locked':
      return 'Урок откроется вместе с курсом'
    case 'user_not_found':
      return 'Не нашёл такого @username. Человек должен хотя бы раз открыть приложение'
    case 'not_for_sale':
      return 'Этот курс не продаётся за звёзды'
    case 'paid_only':
      return 'Этот курс открывается за звёзды'
    case 'already_open':
      return 'Курс уже открыт. Обнови приложение'
    case 'bad_image':
    case 'upload':
      return 'Картинка не загрузилась. Попробуй ещё раз'
    case 'telegram':
      return 'Telegram не принял сообщение. Проверь права бота в канале'
    case 'door_locked':
      return 'Эта дверь ещё закрыта'
    case 'advent_closed':
      return 'Календарь закончился'
    case 'advent_off':
      return 'Календарь сейчас выключен'
    case 'bad_pin':
      return 'Неверный PIN точки'
    case 'pin_locked':
      return 'Слишком много попыток. Подожди 15 минут'
    case 'code_not_found':
      return 'Такого кода нет. Проверь буквы и цифры'
    case 'code_used':
      return 'Код уже погашен'
    case 'point_not_found':
      return 'Точка не найдена'
    default:
      return 'Что-то сломалось. Попробуй ещё раз'
  }
}
