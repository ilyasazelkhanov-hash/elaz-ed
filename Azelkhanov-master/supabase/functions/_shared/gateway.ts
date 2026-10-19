import { ApiError, requireValue } from './errors.ts'
export interface Gateway { rpc<T = any>(name: string, args?: Record<string, unknown>): Promise<T>; storage(path: string, body: unknown): Promise<any> }
export function createGateway(url: string, key: string, fetcher: typeof fetch = fetch): Gateway {
  requireValue(/^https:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1):/.test(url), 'invalid_supabase_url', 500)
  requireValue(Boolean(key), 'missing_server_secret', 500)
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  // New sb_secret keys are API keys, not JWTs. Only legacy service JWTs belong in Authorization.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  async function request(path: string, body: unknown, attempt = 0): Promise<any> {
    const response = await fetcher(`${url.replace(/\/$/,'')}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
    const value = await response.json().catch(() => null)
    if (!response.ok) {
      // PostgreSQL guarantees these transactions rolled back. Do not retry ambiguous network failures.
      if (path.startsWith('/rest/v1/rpc/') && ['40P01','40001'].includes(value?.code) && attempt < 2) {
        await new Promise(resolve => setTimeout(resolve,25*(attempt+1)))
        return request(path,body,attempt+1)
      }
      const safe = typeof value?.message === 'string' && /^[a-z][a-z0-9_]{2,80}$/.test(value.message) ? value.message : 'database_error'
      const status = ['forbidden','owner_required','access_denied','point_forbidden','file_forbidden'].includes(safe) ? 403 : safe === 'authentication_required' ? 401 : safe === 'database_error' ? 500 : 400
      throw new ApiError(safe, status)
    }
    return value
  }
  return { rpc: (name, args = {}) => request(`/rest/v1/rpc/${name}`, args), storage: (path, body) => request(`/storage/v1${path}`, body) }
}
