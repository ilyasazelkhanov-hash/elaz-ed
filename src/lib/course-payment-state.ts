/** A local UI hint, never proof of payment or authorization to open lesson content. */
export type CoursePaymentStatus = 'opening' | 'pending' | 'waiting' | 'unknown' | 'cancelled' | 'failed'
export type CoursePaymentState = { status: CoursePaymentStatus; updatedAt: number; checking?: boolean; error?: string }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
const statuses: CoursePaymentStatus[] = ['opening', 'pending', 'waiting', 'unknown', 'cancelled', 'failed']

export function isUnresolvedPayment(status?: CoursePaymentStatus): boolean {
  return status === 'opening' || status === 'pending' || status === 'waiting' || status === 'unknown'
}

export function paymentMessage(status: CoursePaymentStatus): { title: string; description: string } {
  switch (status) {
    case 'opening': return { title: 'Открываем счёт', description: 'Заверши оплату или закрой счёт в Telegram.' }
    case 'pending': return { title: 'Платёж обрабатывается', description: 'Telegram ещё не подтвердил оплату. Проверь доступ, не создавая новый счёт.' }
    case 'waiting': return { title: 'Оплата прошла, ожидаем доступ', description: 'Telegram сообщил об оплате. Сервер ещё не подтвердил доступ. Повторно платить не нужно.' }
    case 'unknown': return { title: 'Результат оплаты пока неизвестен', description: 'Проверим доступ после возвращения в приложение. Если звёзды списаны, не оплачивай повторно.' }
    case 'cancelled': return { title: 'Оплата отменена', description: 'Telegram сообщил об отмене. Если ты всё же оплатил курс, сначала проверь доступ.' }
    case 'failed': return { title: 'Не удалось завершить оплату', description: 'Если звёзды списаны, сначала проверь доступ. Не оплачивай повторно до выяснения результата.' }
  }
}

/** Per account, environment and course; survives navigation/reload without storing invoice URLs or auth. */
export function createCoursePaymentStore(storage: () => Storage | undefined) {
  const cache = new Map<string, CoursePaymentState | null>()
  const listeners = new Set<() => void>()
  const key = (scope: string, id: number) => {
    if (!/^(telegram|demo):[1-9]\d*$/.test(scope) || !Number.isSafeInteger(id) || id <= 0) return null
    return `og-course-payment:v1:${scope}:${id}`
  }
  const get = (scope: string, id: number): CoursePaymentState | null => {
    const k = key(scope, id)
    if (!k) return null
    if (cache.has(k)) return cache.get(k)!
    let state: CoursePaymentState | null = null
    try {
      const data = JSON.parse(storage()?.getItem(k) ?? 'null')
      if (data && statuses.includes(data.status) && Number.isFinite(data.updatedAt) && data.updatedAt > 0) {
        // The callback may have been lost when the app closed. Never assume cancellation or retry payment.
        state = { status: data.status === 'opening' ? 'unknown' : data.status, updatedAt: data.updatedAt }
      }
    } catch { /* Private mode, broken or untrusted local data is not payment evidence. */ }
    cache.set(k, state)
    return state
  }
  const set = (scope: string, id: number, state: CoursePaymentState | null) => {
    const k = key(scope, id)
    if (!k) return
    cache.set(k, state)
    try {
      if (state) storage()?.setItem(k, JSON.stringify({ status: state.status, updatedAt: state.updatedAt }))
      else storage()?.removeItem(k)
    } catch { /* In-memory recovery still works if browser storage is unavailable. */ }
    listeners.forEach(listener => listener())
  }
  return { get, set, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }
}
