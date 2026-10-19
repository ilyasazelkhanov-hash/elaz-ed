import type { AppConfig, Data, PlatformApi, Snapshot } from './contracts.ts'
import type { DemoApi } from './demo.ts'
interface TelegramWindow {
  Telegram?: {
    WebApp?: {
      initData?: string
      DeviceOrientation?: {
        beta?: number
        gamma?: number
        start: (options: { refresh_rate: number; need_absolute: boolean }) => void
        stop: () => void
      }
      onEvent?: (name: string, handler: () => void) => void
      offEvent?: (name: string, handler: () => void) => void
      ready?: () => void
      expand?: () => void
      requestFullscreen?: () => void
      isVersionAtLeast?: (version: string) => boolean
      HapticFeedback?: { impactOccurred: (style: string) => void; notificationOccurred: (type: string) => void }
      BackButton?: {
        show: () => void
        hide: () => void
        onClick: (handler: () => void) => void
        offClick: (handler: () => void) => void
      }
      openInvoice?: (link: string, callback: (status: string) => void) => void
      openTelegramLink?: (link: string) => void
      setHeaderColor?: (color: string) => void
      setBackgroundColor?: (color: string) => void
    }
  }
}
export const telegram = () => (window as unknown as TelegramWindow).Telegram?.WebApp
const errors: Record<string, string> = {
  access_denied: 'Ваш доступ ожидает подтверждения организатором.',
  invalid_brief: 'Заполните обязательные поля заявки и проверьте выбранные варианты.',
  idempotency_conflict: 'Заказ с этим номером уже создан. Проверьте историю заказов.',
  authentication_required: 'Откройте приложение в Telegram или войдите как менеджер.',
  expired_auth: 'Сессия Telegram истекла. Закройте приложение и откройте снова.',
  session_expired: 'Сессия истекла. Войдите заново.',
  forbidden: 'Для этого действия недостаточно прав.',
  module_disabled: 'Этот раздел отключён организатором.',
  entity_unavailable: 'Материал пока недоступен.',
  channel_membership_required: 'Подпишитесь на канал организатора и откройте приложение снова.',
  not_provisioned: 'Пространство ещё настраивается.',
  employee_approval_required: 'Организатор должен подтвердить ваш доступ.',
  approval_required: 'Ваш доступ ожидает подтверждения.',
  insufficient_points: 'Пока не хватает баллов.',
  out_of_stock: 'Все экземпляры уже разобрали.',
  day_locked: 'Этот день откроется позже.',
  campaign_closed: 'Кампания завершена или ещё не началась.',
  already_completed: 'Результат уже сохранён.',
  coupon_invalid: 'Купон недействителен, истёк или уже погашен.',
  point_forbidden: 'На этой точке операция недоступна.',
  rate_limited: 'Слишком много действий. Попробуйте через минуту.',
  homework_required: 'Сначала отправьте практику и дождитесь проверки.',
  attempt_expired: 'Попытка истекла. Откройте квиз снова — ответы сохранены.',
  round_too_fast: 'Дождитесь окончания игры.',
  csrf_failed: 'Обновите страницу и войдите заново.',
  internal_error: 'Не удалось выполнить действие. Попробуйте позже.',
}
export const demoMode = () =>
  import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true' || new URLSearchParams(location.search).has('demo')
export function haptic(kind: 'tap' | 'success' = 'tap') {
  try {
    if (kind === 'success') telegram()?.HapticFeedback?.notificationOccurred('success')
    else telegram()?.HapticFeedback?.impactOccurred('light')
  } catch {
    /* unsupported client */
  }
}
export async function createApi(config: AppConfig, base?: string): Promise<PlatformApi> {
  if (demoMode()) {
    const { DemoApi } = await import('./demo.ts')
    return new DemoApi(config.preset, localStorage, config) as DemoApi
  }
  const endpoint = (base ?? import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
  let csrfToken = ''
  if (!telegram()?.initData) {
    const session = await fetch(`${endpoint}/v1/auth/session`, {
      credentials: 'include',
      signal: AbortSignal.timeout(10000),
    }).catch(() => null)
    if (session?.ok) csrfToken = String((await session.json()).csrf ?? '')
  }
  const dispatch = async (action: string, payload: Data = {}) => {
    const csrf =
      csrfToken ||
      document.cookie
        .split('; ')
        .find((v) => v.startsWith('__Host-az-csrf='))
        ?.split('=')
        .slice(1)
        .join('=')
    const res = await fetch(`${endpoint}/v1/dispatch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
      body: JSON.stringify({ auth: telegram()?.initData ?? '', action, payload }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {
      throw new Error('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.')
    })
    const body = await res.json().catch(() => ({ error: 'Сервер вернул непонятный ответ' }))
    if (!res.ok)
      throw new Error(
        errors[String(body.error)] ?? 'Не удалось выполнить действие. Обновите страницу или попробуйте позже.',
      )
    return body
  }
  return { bootstrap: async () => (await dispatch('bootstrap')).snapshot as Snapshot, dispatch }
}
