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

// In production (2026-11-07) Supabase never delivered a reply to a request whose body was left
// unread: oversized requests hung until the client gave up instead of receiving 413. So the rest
// of an oversized body is read and thrown away before answering. Past these caps the sender is
// abusive; reading stops so it cannot hold the function open.
export const DRAIN_LIMIT = 16 * 1024 * 1024
export const DRAIN_MS = 10_000
export type DrainOptions = { drainLimit?: number; drainMs?: number }

async function discardRest(reader: ReadableStreamDefaultReader<Uint8Array>, received: number, { drainLimit = DRAIN_LIMIT, drainMs = DRAIN_MS }: DrainOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<'expired'>(resolve => { timer = setTimeout(() => resolve('expired'), drainMs) })
  try {
    while (received <= drainLimit) {
      const next = await Promise.race([reader.read(), expired])
      if (next === 'expired') break
      if (next.done) return
      received += next.value.byteLength
    }
    void reader.cancel().catch(() => {})
  } catch {
    // A broken sender stream still gets 413.
  } finally {
    clearTimeout(timer)
  }
}

function release(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try { reader.releaseLock() } catch { /* A read may still be pending after cancel. */ }
}

export async function readJson(request: Request, limit = JSON_BODY_LIMIT, drain: DrainOptions = {}): Promise<Record<string, any>> {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new HttpError(400, 'invalid_json')
  }
  if (length !== null && Number(length) > limit) {
    const reader = request.body?.getReader()
    if (reader) {
      // Nothing is kept: the declared size alone decides 413.
      if (Number(length) <= (drain.drainLimit ?? DRAIN_LIMIT)) await discardRest(reader, 0, drain)
      else void reader.cancel().catch(() => {})
      release(reader)
    }
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
        parts.length = 0
        await discardRest(reader, size, drain)
        throw new HttpError(413, 'request_too_large')
      }
      parts.push(value)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'invalid_json')
  } finally {
    release(reader)
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
