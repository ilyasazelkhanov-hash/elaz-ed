import { withDeadline } from './telegram.ts'

type Database = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: any; error?: any }> }
type Telegram = (method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<{ ok: boolean; description?: string }>
export const REFUND_BATCH_TIMEOUT_MS = 60_000

// Jobs are durable before contacting Telegram. Leases fence concurrent workers;
// ALREADY_REFUNDED safely closes retries after a remote success and local failure.
// Four lanes and a batch deadline prevent one slow refund blocking every job.
export async function processRefundJobs(db: Database, telegram: Telegram, charge?: string, onCompleted?: (charge: string) => Promise<void>) {
 return await withDeadline(async signal => {
  const claimed = await db.rpc(charge ? 'claim_payment_refund' : 'claim_payment_refunds', charge ? { p_charge: charge } : { p_limit: 20 })
  if (claimed.error) throw new Error(claimed.error.message ?? 'refund_claim_failed')
  signal.throwIfAborted()
  const jobs = [...(claimed.data ?? [])]
  let completed = 0, failed = 0
  const lanes = Array.from({ length: Math.min(4, jobs.length) }, async () => {
   while (jobs.length) {
    signal.throwIfAborted()
    const job = jobs.shift()
    let ok = false, error: string | null = null
    try {
     const result = await telegram('refundStarPayment', { user_id: job.user_id, telegram_payment_charge_id: job.charge_id }, signal)
     ok = result.ok || /\b(?:PAYMENT_)?ALREADY_REFUNDED\b/i.test(result.description ?? '')
     if (!ok) error = result.description ?? 'telegram_refund_failed'
    } catch (e) { error = String(e) }
    signal.throwIfAborted()
    const finished = await db.rpc('finish_payment_refund', { p_charge: job.charge_id, p_lease: job.lease_token, p_ok: ok, p_error: error })
    if (finished.error) throw new Error(finished.error.message ?? 'refund_finish_failed')
    if (finished.data && ok) {
     completed++
     // Notification failure cannot undo a committed refund or retry a message.
     try { await onCompleted?.(job.charge_id) } catch (error) { console.error('refund notification', error) }
    } else failed++
   }
  })
  const results = await Promise.allSettled(lanes)
  const rejected = results.find(result => result.status === 'rejected')
  if (rejected?.status === 'rejected') throw rejected.reason
  return { completed, failed }
 }, REFUND_BATCH_TIMEOUT_MS)
}
