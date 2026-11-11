export const TELEGRAM_TIMEOUT_MS = 8_000
export const CHECKOUT_TIMEOUT_MS = 8_000
// deno-lint-ignore no-explicit-any
type TelegramResponse = { ok: boolean; result?: any; description?: string; error_code?: number }

// Includes response-body reads and bounds even transports that ignore abort.
// Do not retry here: an interrupted send can have an unknown remote outcome.
export async function withDeadline<T>(work: (signal: AbortSignal) => PromiseLike<T>, timeoutMs: number, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort(parent?.reason ?? new Error('request_timeout'))
      reject(controller.signal.reason)
    }
    if (parent?.aborted) onAbort()
    else parent?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      controller.abort(new Error('request_timeout'))
      reject(controller.signal.reason)
    }, timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(() => {
      controller.signal.throwIfAborted()
      return work(controller.signal)
    }), deadline])
  } finally {
    clearTimeout(timer)
    if (onAbort) parent?.removeEventListener('abort', onAbort)
  }
}

export async function telegramRequest(token: string, method: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<TelegramResponse> {
  try {
    return await withDeadline(async requestSignal => {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: requestSignal,
      })
      const result = await response.json() as TelegramResponse
      if (!response.ok || result?.ok !== true) return { ok: false, description: result?.description ?? 'telegram_failed', error_code: result?.error_code ?? response.status }
      return result
    }, TELEGRAM_TIMEOUT_MS, signal)
  } catch {
    return { ok: false, description: 'network_or_timeout' }
  }
}
