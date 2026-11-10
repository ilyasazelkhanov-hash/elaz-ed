import { withRequestDeadline, responseJsonOr, RequestTimeoutError } from './request-deadline.ts'

type Preview = (action: string, payload: Record<string, unknown>) => unknown
type Dependencies = { fetch?: typeof fetch; preview?: Preview }

/** The live API remains authoritative for access, lessons and all writes. */
export async function requestAcademyApi<T>(action: string, payload: Record<string, unknown>, auth: string, apiUrl: string, dependencies: Dependencies = {}): Promise<T> {
  async function preview(): Promise<T | null> {
    if (!['catalog', 'course'].includes(action)) return null
    const read = dependencies.preview || (await import('./academy-programs')).academyProgramPreview
    return read(action, payload) as T | null
  }
  let received: Response | undefined
  let response: Response
  let parsed: any
  try {
    const result = await withRequestDeadline(async signal => {
      const response = await (dependencies.fetch || fetch)(`${apiUrl}/academy`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ auth, action, payload }),
        signal,
      })
      received = response
      return { response, parsed: await responseJsonOr(response, null) }
    })
    response = result.response
    parsed = result.parsed
  } catch (error) {
    // A stalled/failed authorization response must not become a public preview.
    if (received?.status !== 401 && received?.status !== 403) {
      const program = await preview()
      if (program) return program
    }
    throw new Error(error instanceof RequestTimeoutError ? 'timeout' : 'network')
  }
  const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { error: 'academy_not_ready' }
  if (!response.ok) {
    // Authentication and authorization errors must never be converted to successful reads.
    if (response.status !== 401 && response.status !== 403 && (response.status >= 500 || ['academy_not_ready', 'academy_not_found', 'not_found'].includes(body.error))) {
      const program = await preview()
      if (program) return program
    }
    throw new Error(body.error || 'academy_not_ready')
  }
  if ((action === 'course' && !body.course) || (action === 'catalog' && !Array.isArray(body.courses))) {
    const program = await preview()
    if (program) return program
    throw new Error('academy_not_ready')
  }
  if (action === 'catalog' && body.total === 0 && Array.isArray(body.directions) && !body.directions.length && Array.isArray(body.courses) && !body.courses.length) {
    const program = await preview()
    if (program) return program
  }
  return body as T
}
