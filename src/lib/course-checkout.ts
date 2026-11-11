import type { Course } from './types'
import { isUnresolvedPayment, type CoursePaymentStatus } from './course-payment-state.ts'

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending'
export type CourseAccessResult = 'open' | 'busy' | 'unavailable' | 'declined' | 'opened' | 'waiting' | 'unknown' | InvoiceStatus | 'requested' | 'already_requested' | 'error'

/** Everything the flow touches outside itself, so it runs the same in the app and in tests. */
export type CourseAccessDeps = {
  demo: boolean
  canPay: boolean
  confirm: (text: string) => Promise<boolean>
  invoice: (courseId: number) => Promise<string | null | undefined>
  openInvoice: (link: string) => Promise<InvoiceStatus>
  request: (courseId: number) => Promise<unknown>
  refresh: () => Promise<unknown>
  hasAccess: (courseId: number) => boolean
  track: (name: 'checkout_start' | 'checkout_result', props: Record<string, string | number | boolean>) => void
  notify: (text: string, emoji?: string) => void
  celebrate: () => void
  guard: (error: unknown) => void
  errorText: (error: unknown) => string
  wait: (ms: number) => Promise<void>
  paymentStatus?: () => CoursePaymentStatus | undefined
  onPaymentStatus?: (status: CoursePaymentStatus | null) => void
}

type AccessCourse = Pick<Course, 'id' | 'price_stars' | 'access' | 'request'>
let pending = false

// The server grants access once Telegram confirms the payment, which takes a few seconds.
async function waitForAccess(id: number, deps: CourseAccessDeps) {
  for (let i = 0; i < 8; i++) {
    await deps.refresh()
    if (deps.hasAccess(id)) return true
    await deps.wait(1200)
  }
  return false
}

/**
 * Opens access to a paid OG course without leaving the current screen: a Stars invoice for a
 * priced course, an access request for a course without a price. Mirrors CourseScreen.buy,
 * which only admins can reach since the old course screen is hidden.
 */
export async function openCourseAccess(course: AccessCourse, deps: CourseAccessDeps): Promise<CourseAccessResult> {
  if (course.access) { deps.onPaymentStatus?.(null); return 'open' }
  if (pending) return 'busy'
  pending = true
  try {
    // A pending/uncertain payment must never create or reopen an invoice on another tap.
    if (isUnresolvedPayment(deps.paymentStatus?.())) return await refreshAccess(course.id, deps)
    if (!(Number.isFinite(course.price_stars) && course.price_stars > 0)) {
      if (course.request === 'pending') {
        deps.notify('Заявка уже отправлена. Ответ придёт в чат с ботом', '📨')
        return 'already_requested'
      }
      try {
        await deps.request(course.id)
        await deps.refresh()
        deps.notify('Заявка отправлена. Ответ придёт в чат с ботом', '📨')
        return 'requested'
      } catch (e) {
        deps.guard(e)
        deps.notify(deps.errorText(e))
        return 'error'
      }
    }
    return await buy(course, deps)
  } finally {
    pending = false
  }
}

/** Read-only recovery. It deliberately has no path to invoice creation or an access request. */
export async function checkCourseAccess(courseId: number, deps: CourseAccessDeps): Promise<CourseAccessResult> {
  if (pending) return 'busy'
  pending = true
  try { return await refreshAccess(courseId, deps) }
  finally { pending = false }
}

async function refreshAccess(id: number, deps: CourseAccessDeps): Promise<CourseAccessResult> {
  try {
    await deps.refresh()
    if (deps.hasAccess(id)) {
      deps.onPaymentStatus?.(null)
      deps.notify('Доступ к курсу открыт', '🔓')
      return 'opened'
    }
    deps.notify('Доступ пока не подтверждён. Если звёзды списаны, не оплачивай повторно')
    const status = deps.paymentStatus?.()
    return status === 'waiting' ? 'waiting' : status === 'pending' ? 'pending' : 'unknown'
  } catch (error) {
    deps.guard(error)
    deps.notify('Не удалось проверить доступ. ' + deps.errorText(error))
    return 'error'
  }
}

async function buy(course: AccessCourse, deps: CourseAccessDeps): Promise<CourseAccessResult> {
  const id = course.id
  let started = false, reported = false, invoiceOpened = false
  const report = (status: InvoiceStatus) => {
    reported = true
    deps.track('checkout_result', { course_id: id, source: 'course', status })
  }
  try {
    if (!deps.demo && !deps.canPay) {
      deps.notify('Оплата звёздами работает в приложении Telegram')
      return 'unavailable'
    }
    // The demo has no real invoice, so the course opens only after explicit consent.
    if (deps.demo && !(await deps.confirm(`Это демо. В Telegram здесь откроется счёт на ${course.price_stars} звёзд, и без оплаты курс не откроется. Открыть курс условно, чтобы посмотреть?`))) return 'declined'
    deps.track('checkout_start', { course_id: id, source: 'course' })
    started = true
    if (!deps.demo) deps.onPaymentStatus?.('opening')
    const link = await deps.invoice(id)
    if (!link) {
      if (!deps.demo) throw new Error('Не удалось открыть счёт. Попробуй ещё раз.')
      await deps.refresh()
      deps.celebrate()
      deps.notify('В демо оплата условная: звёзды не списаны')
      return 'opened'
    }
    invoiceOpened = true
    const status = await deps.openInvoice(link)
    report(status)
    if (status === 'paid') {
      deps.onPaymentStatus?.('waiting')
      let access = false
      // A failed refresh cannot turn Telegram's paid result into a failed payment.
      try { access = await waitForAccess(id, deps) }
      catch (error) { deps.guard(error) }
      if (access) {
        deps.onPaymentStatus?.(null)
        deps.celebrate()
        deps.notify('Курс открыт', '🔓')
        return 'opened'
      }
      deps.notify('Оплата прошла по данным Telegram. Проверяем доступ; повторно платить не нужно')
      return 'waiting'
    }
    deps.onPaymentStatus?.(status)
    if (status === 'failed') deps.notify('Telegram сообщил об ошибке оплаты. Если звёзды списаны, проверь доступ перед повторной оплатой')
    else if (status === 'pending') deps.notify('Платёж обрабатывается. Доступ появится после подтверждения оплаты')
    else deps.notify('Оплата отменена')
    return status
  } catch (e) {
    if (started && !deps.demo) deps.onPaymentStatus?.(invoiceOpened ? 'unknown' : 'failed')
    if (started && !reported && !invoiceOpened) report('failed')
    deps.guard(e)
    deps.notify(invoiceOpened ? 'Результат оплаты пока неизвестен. Проверь доступ; если звёзды списаны, не оплачивай повторно' : deps.errorText(e))
    return invoiceOpened ? 'unknown' : 'error'
  }
}
