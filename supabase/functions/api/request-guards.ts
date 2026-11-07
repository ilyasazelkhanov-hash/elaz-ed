// Transport limits are measured in UTF-8 bytes, before JSON parsing or authentication.
export const JSON_BODY_LIMIT = 512 * 1024
export const SHARE_BODY_LIMIT = 1536 * 1024
// Academy's existing admin import contract allows 4,000,000 UTF-16 code units.
// Keep room for their UTF-8 representation and the auth/action envelope.
export const ACADEMY_BODY_LIMIT = 12 * 1024 * 1024
export const PUBLIC_BODY_LIMIT = 2000
// Budget for each route that works without a Telegram login. It is per route, so
// flooding one of them never blocks signed-in users anywhere else.
export const ANON_ROUTE_LIMIT = 600
export const API_USER_LIMIT = 120
export const HEALTH_LIMIT = 120
export const RATE_WINDOW_SECONDS = 60

export class HttpError extends Error {
  constructor(public status: number, public code: string, public retryAfter?: number) {
    super(code)
  }
}

export async function readJson(request: Request, limit = JSON_BODY_LIMIT): Promise<Record<string, any>> {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new HttpError(400, 'invalid_json')
  }
  if (length !== null && Number(length) > limit) {
    void request.body?.cancel().catch(() => {})
    throw new HttpError(413, 'request_too_large')
  }
  const reader = request.body?.getReader()
  if (!reader) return {}
  const parts: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        // Do not wait for a sender-controlled cancellation before returning 413.
        void reader.cancel().catch(() => {})
        throw new HttpError(413, 'request_too_large')
      }
      parts.push(value)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'invalid_json')
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength }
  let body: unknown
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes) || '{}') }
  catch { throw new HttpError(400, 'invalid_json') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'invalid_json')
  return body as Record<string, any>
}

type RateDb = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
export async function rateLimit(db: RateDb, key: string, count: number) {
  try {
    const { data, error } = await db.rpc('az_rate_limit', { p_key: key, p_limit: count, p_seconds: RATE_WINDOW_SECONDS })
    if (error || (data !== true && data !== false)) throw new HttpError(503, 'rate_limit_unavailable')
    if (!data) throw new HttpError(429, 'rate_limited', RATE_WINDOW_SECONDS)
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'rate_limit_unavailable')
  }
}
