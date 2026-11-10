export const REQUEST_TIMEOUT_MS = 15_000

export class RequestTimeoutError extends Error {
  constructor() {
    super('timeout')
    this.name = 'RequestTimeoutError'
  }
}

/** Bound the complete request, including consuming its body. Never retry here:
 * a timed-out mutation may already have committed on the server. */
export async function withRequestDeadline<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject first so abort-related body failures cannot hide the timeout.
      reject(new RequestTimeoutError())
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
  })
  try {
    // The race also bounds transports that fail to honor AbortSignal.
    return await Promise.race([request(controller.signal), deadline])
  } finally {
    clearTimeout(timer)
  }
}

/** Invalid JSON may use the existing fallback; interrupted bodies must fail. */
export async function responseJsonOr<T>(response: Response, fallback: T): Promise<any | T> {
  try {
    return await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) return fallback
    throw error
  }
}
