type Database = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data?: any; error?: any }> }
type Telegram = (method: string, body: Record<string, unknown>) => Promise<{ ok: boolean; description?: string }>

// Jobs are durable before contacting Telegram. A crashed worker's lease expires;
// Telegram's ALREADY_REFUNDED response safely closes a retried successful refund.
export async function processRefundJobs(db: Database, telegram: Telegram) {
 const claimed = await db.rpc('claim_payment_refunds', { p_limit: 20 })
 if (claimed.error) throw new Error(claimed.error.message ?? 'refund_claim_failed')
 let completed = 0, failed = 0
 for (const job of claimed.data ?? []) {
  let ok = false, error: string | null = null
  try {
   const result = await telegram('refundStarPayment', { user_id: job.user_id, telegram_payment_charge_id: job.charge_id })
   ok = result.ok || /\b(?:PAYMENT_)?ALREADY_REFUNDED\b/i.test(result.description ?? '')
   if (!ok) error = result.description ?? 'telegram_refund_failed'
  } catch (e) { error = String(e) }
  const finished = await db.rpc('finish_payment_refund', { p_charge: job.charge_id, p_lease: job.lease_token, p_ok: ok, p_error: error })
  if (finished.error) throw new Error(finished.error.message ?? 'refund_finish_failed')
  if (finished.data && ok) completed++; else failed++
 }
 return { completed, failed }
}
