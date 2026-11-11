import {useEffect, useSyncExternalStore} from 'react'
import {ArrowRight, RefreshCw} from 'lucide-react'
import {api, ApiError, errorText, isDemo} from '../../lib/api'
import {checkCourseAccess, openCourseAccess, type CourseAccessDeps} from '../../lib/course-checkout'
import {createCoursePaymentStore, isUnresolvedPayment, paymentMessage} from '../../lib/course-payment-state'
import {practiceOffer} from '../../lib/og-course-access'
import {canPayStars, confirmDialog, haptic, openInvoice, telegram} from '../../lib/tg'
import {sfx} from '../../lib/sfx'
import {track} from '../../lib/track'
import type {Course} from '../../lib/types'
import {useStore} from '../../store'
import {celebrate, Tap} from '../../ui'

const payments = createCoursePaymentStore(() => window.localStorage)
const scopeFor = (id: number) => `${isDemo ? 'demo' : 'telegram'}:${id}`
const currentScope = () => scopeFor(useStore.getState().me?.id ?? 0)

function dependencies(scope: string, id: number): CourseAccessDeps {
 const active = () => currentScope() === scope && useStore.getState().phase === 'ok'
 return {
  demo: isDemo, canPay: canPayStars, confirm: confirmDialog,
  // Closing/reloading the app can lose Telegram's callback. Release the UI lock,
  // preserving an uncertain result instead of inventing cancellation or failure.
  openInvoice: link => new Promise((resolve, reject) => {
   let timedOut = false
   const timeout = setTimeout(() => { timedOut = true; reject(new Error('invoice_result_unknown')) }, 60_000)
   openInvoice(link).then(status => {
    // The user may spend longer than a minute in Telegram's invoice. Keep its
    // eventual result, but never overwrite a newer attempt or confirmed access.
    if (timedOut && payments.get(scope, id)?.status === 'unknown') {
     payments.set(scope, id, {status: status === 'paid' ? 'waiting' : status, updatedAt: Date.now()})
     if (active() && (status === 'paid' || status === 'pending')) void checkAccess(scope, id)
    }
    resolve(status)
   }, reject).finally(() => clearTimeout(timeout))
  }),
  invoice: courseId => {
   if (!active()) throw new ApiError('bad_auth', 401)
   return api.courseInvoice(courseId)
  },
  request: courseId => api.courseRequest(courseId),
  refresh: async () => {
   if (!active()) throw new ApiError('bad_auth', 401)
   const phase = await useStore.getState().boot()
   const state = useStore.getState()
   if (!active()) throw new ApiError('bad_auth', 401)
   if (phase !== 'ok' || state.refreshErrorCode) throw new ApiError(state.refreshErrorCode ?? state.errorCode ?? 'network', 0)
  },
  hasAccess: courseId => active() && !!useStore.getState().courses.find(course => course.id === courseId)?.access,
  paymentStatus: () => payments.get(scope, id)?.status,
  onPaymentStatus: status => {
   if (!isDemo) payments.set(scope, id, status ? {status, updatedAt: Date.now()} : null)
  },
  track: (name, props) => { if (active()) track(name, props) },
  notify: (text, emoji) => { if (active()) useStore.getState().toast(text, emoji) },
  guard: error => { if (active()) useStore.getState().guard(error) }, errorText,
  celebrate: () => { if (active()) {celebrate(); sfx.levelUp(); haptic.success()} },
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
 }
}

async function checkAccess(scope: string, id: number) {
 const previous = payments.get(scope, id)
 if (previous?.checking) return
 if (previous) payments.set(scope, id, {...previous, checking: true, error: undefined})
 const result = await checkCourseAccess(id, dependencies(scope, id))
 const latest = payments.get(scope, id)
 if (latest) payments.set(scope, id, {...latest, checking: false, error: result === 'error' ? 'Не удалось проверить доступ. Проверь соединение и попробуй ещё раз.' : undefined})
}

/** All purchase entry points share the same account-scoped state. */
export function CoursePaymentAction({course, compact = false}: {course: Course; compact?: boolean}) {
 const userId = useStore(state => state.me?.id ?? 0), scope = scopeFor(userId)
 const state = useSyncExternalStore(payments.subscribe, () => payments.get(scope, course.id))
 const unresolved = isUnresolvedPayment(state?.status), busy = state?.status === 'opening' || state?.checking
 const message = state && paymentMessage(state.status)
 const purchase = () => {
  if (currentScope() !== scope) return
  // Re-read current access rather than trusting a stale rendered card.
  const live = useStore.getState().courses.find(item => item.id === course.id)
  if (live) void openCourseAccess(live, dependencies(scope, course.id))
 }
 if (course.access) return null
 return <div className={compact ? 'px-4 pb-4' : 'mt-3'} data-course-payment={state?.status ?? 'idle'}>
  {message && <div role="status" aria-live="polite" className="rounded-2xl border border-violet/20 bg-violet/8 p-3"><p className="text-sm font-semibold">{message.title}</p><p className="mt-1 text-xs leading-relaxed text-mute">{message.description}</p>{unresolved && state?.status !== 'opening' && <p className="mt-2 text-xs leading-relaxed text-mute">Если доступ долго не появляется, открой чат с ботом и отправь /paysupport.</p>}</div>}
  {state?.error && <p role="alert" className="mt-2 text-xs leading-relaxed text-mute">{state.error}</p>}
  {state && <Tap disabled={!!busy} onClick={() => void checkAccess(scope, course.id)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet/35 px-3 text-sm font-semibold text-violet disabled:opacity-60"><RefreshCw size={16} className={state.checking ? 'animate-spin' : ''}/>{state.checking ? 'Проверяем доступ…' : 'Проверить доступ'}</Tap>}
  {!unresolved && <Tap onClick={purchase} disabled={!!busy} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet px-3 text-sm font-semibold text-on-violet disabled:opacity-60">{practiceOffer(course).action}<ArrowRight size={17}/></Tap>}
 </div>
}

/** Fresh server access wins. Returning/reloading only reads access; never starts another payment. */
export function useCoursePaymentRecovery() {
 const userId = useStore(state => state.me?.id ?? 0)
 useEffect(() => {
  if (!userId || isDemo) return
  const scope = scopeFor(userId)
  const reconcile = () => {
   if (currentScope() !== scope) return
   for (const course of useStore.getState().courses) {
    if (course.access && payments.get(scope, course.id)) payments.set(scope, course.id, null)
   }
  }
  let lastCheck = 0
  const recover = () => {
   if (document.visibilityState === 'hidden' || currentScope() !== scope || Date.now() - lastCheck < 5000) return
   reconcile()
   const course = useStore.getState().courses.find(item => isUnresolvedPayment(payments.get(scope, item.id)?.status))
   if (course) { lastCheck = Date.now(); void checkAccess(scope, course.id) }
  }
  const unsubscribe = useStore.subscribe(reconcile)
  recover()
  window.addEventListener('focus', recover)
  window.addEventListener('pageshow', recover)
  document.addEventListener('visibilitychange', recover)
  telegram?.onEvent?.('activated', recover)
  return () => {
   unsubscribe()
   window.removeEventListener('focus', recover)
   window.removeEventListener('pageshow', recover)
   document.removeEventListener('visibilitychange', recover)
   telegram?.offEvent?.('activated', recover)
  }
 }, [userId])
}
