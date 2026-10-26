import { ApiError } from './errors'
import { initData, inTelegram, platform, startParam } from './tg'
import type { AdminDoor, AdminPoint, AdventWinner, Api, Payment, RedeemPoint } from './types'

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
  certificationCatalog: () => call('certifications', { action:'catalog' }),
  certificationOpen: (id) => call('certifications', { action:'open',id }),
  certificationProgress: (id,status) => call('certifications', { action:'progress',id,status }),
  boot: (force) => call('boot', { force: !!force, sp: startParam, platform, theme: document.documentElement.dataset.theme ?? '' }),
  lesson: (id) => call('lesson', { id }),
  quizStart: (id) => call('quiz_start', { id }),
  quizAnswer: (attemptId, index, answer) => call('quiz_answer', { attemptId, index, answer }),
  complete: (id, answers, attemptId) => call('complete', { id, answers, attemptId }),
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
    return await call<{ queued?: boolean }>('admin_announce', { id })
  },
  advent: () => call('advent'),
  adventDoor: (day) => call('advent_door', { day }),
  adventOpen: (day, input) => call('advent_open', { day, ...input }),
  adminAdvent: () => call('admin_advent'),
  adminAdventTheme: async (theme) => {
    await call('admin_advent_theme', { theme })
  },
  adventTicketInvoice: async () => (await call<{ link: string }>('advent_ticket_invoice')).link,
  adminAdventSave: async (settings) => {
    await call('admin_advent_save', { settings })
  },
  adminAdventRewardSave: (reward) => call('admin_advent_reward_save', { reward }),
  adminAdventRewardDelete: async (id) => {
    await call('admin_advent_reward_delete', { id })
  },
  adminAdventDraw: async (id) => (await call<{ winners: number }>('admin_advent_draw', { id })).winners,
  adminAdventDoors: async () => (await call<{ doors: AdminDoor[] }>('admin_advent_doors')).doors,
  adminAdventDoorSave: (door) => call('admin_advent_door_save', { door }),
  adminAdventDoorDelete: async (day) => {
    await call('admin_advent_door_delete', { day })
  },
  adminAdventPulse: () => call('admin_advent_pulse'),
  adminAdventWinners: async (rewardId) => (await call<{ winners: AdventWinner[] }>('admin_advent_winners', { reward_id: rewardId ?? 0 })).winners,
  adminAdventTicketGrant: async (username, count) => (await call<{ name: string }>('admin_advent_ticket_grant', { username, count })).name,
  adminAdventPoints: async () => (await call<{ points: AdminPoint[] }>('admin_advent_points')).points,
  adminAdventPointSave: async (point) => {
    await call('admin_advent_point_save', point)
  },
  adminAdventPointDelete: async (id) => {
    await call('admin_advent_point_delete', { id })
  },
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
    case 'streak_required': return 'Нужен активный стрик от 10 дней. Подаренные курсы доступны отдельно'
    case 'complete_first': return 'Сначала отметь, что курс пройден'
    case 'platform_not_ready':
      return 'Клуб обновляется. Попробуй открыть приложение немного позже'
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
    case 'news_only':
      return 'В группу отправляются только новости. Уроки остаются в курсах'
    case 'course_locked':
      return 'Урок откроется вместе с курсом'
    case 'user_not_found':
      return 'Не нашёл такого @username. Человек должен хотя бы раз открыть приложение'
    case 'not_for_sale':
      return 'Этот курс не продаётся за звёзды'
    case 'bad_pin_format':
      return 'PIN — от 4 до 8 цифр'
    case 'point_used':
      return 'На этой точке уже гасили коды — удалить нельзя, можно сменить PIN'
    case 'stock_required':
      return 'У розыгрыша и случайного приза нужен лимит — сколько штук всего'
    case 'bad_window':
      return 'День «до» не может быть раньше дня «с»'
    case 'already_drawn':
      return 'Розыгрыш уже прошёл'
    case 'quiz_required':
      return 'Нужно пройти квиз: ответь на все вопросы'
    case 'quiz_answer_locked':
    case 'quiz_answers_mismatch':
      return 'Ответ уже сохранён. Открой урок заново, чтобы продолжить'
    case 'quiz_sequence':
      return 'Сначала ответь на предыдущий вопрос'
    case 'quiz_answer_invalid':
      return 'Не получилось отправить ответ. Открой урок заново'
    case 'quiz_not_found':
      return 'Попытка не найдена. Открой квиз заново'
    case 'prize_required':
      return 'Напиши, что под защитным слоем'
    case 'door_opened':
      return 'Эту дверь уже открывали — удалить нельзя, можно только поправить'
    case 'bad_day':
      return 'Номер дня — от 1 до 60'
    case 'need_ticket':
      return 'Нужен билет, чтобы догнать эту дверь'
    case 'reward_payload':
      return 'Проверь содержимое приза: текст, ссылку, урок или курс'
    case 'reward_issued':
      return 'Этот приз уже выдавали — удалить нельзя. Поставь лимит 0'
    case 'bad_date':
      return 'Дата старта — в формате ГГГГ-ММ-ДД'
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
