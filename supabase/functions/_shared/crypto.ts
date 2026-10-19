import { requireValue } from './errors.ts'

export const utf8 = (value: string) => new TextEncoder().encode(value)
export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
export const unbase64url = (value: string) => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)))
export const digest = async (value: string) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(value))))
export async function hmac(key: Uint8Array, value: string) {
  const imported = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, utf8(value)))
}
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}
export interface TelegramIdentity { id: string; name: string; username: string; startParam?: string }
export function telegramId(value: unknown): string {
  requireValue(typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value)), 'invalid_telegram_id', 401)
  const id = String(value)
  requireValue(/^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n, 'invalid_telegram_id', 401)
  return id
}
export async function verifyInitData(raw: string, botToken: string, now = Date.now(), maxAge = 3600): Promise<TelegramIdentity> {
  requireValue(raw.length > 0 && raw.length <= 16384, 'authentication_required', 401)
  const params = new URLSearchParams(raw)
  requireValue([...new Set(params.keys())].length === [...params.keys()].length, 'invalid_auth', 401)
  const hash = params.get('hash') || ''
  requireValue(/^[a-f0-9]{64}$/i.test(hash), 'invalid_auth', 401)
  params.delete('hash')
  const dataCheck = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = await hmac(utf8('WebAppData'), botToken)
  const actual = [...await hmac(secret, dataCheck)].map(b => b.toString(16).padStart(2, '0')).join('')
  requireValue(equal(hash.toLowerCase(), actual), 'invalid_auth', 401)
  const timestamp = Number(params.get('auth_date'))
  requireValue(Number.isInteger(timestamp) && timestamp > 0 && timestamp <= now / 1000 + 30 && timestamp >= now / 1000 - maxAge, 'expired_auth', 401)
  let user: Record<string, unknown>
  try { user = JSON.parse(params.get('user') || '') } catch { requireValue(false, 'invalid_auth', 401) }
  requireValue(user && typeof user === 'object', 'invalid_auth', 401)
  const id = telegramId(user.id)
  return { id, name: [user.first_name, user.last_name].filter(v => typeof v === 'string').join(' ').slice(0, 200) || 'Member', username: typeof user.username === 'string' ? user.username.slice(0, 64) : '', startParam: params.get('start_param') || undefined }
}
export interface OidcOptions { clientId: string; nonce: string; now?: number }
export async function verifyOidcToken(token: string, jwks: { keys: JsonWebKey[] }, options: OidcOptions): Promise<TelegramIdentity> {
  const parts = token.split('.')
  requireValue(parts.length === 3 && token.length < 20000, 'invalid_oidc_token', 401)
  let header: Record<string, unknown>, claims: Record<string, unknown>
  try { header = JSON.parse(new TextDecoder().decode(unbase64url(parts[0]))); claims = JSON.parse(new TextDecoder().decode(unbase64url(parts[1]))) } catch { requireValue(false, 'invalid_oidc_token', 401) }
  requireValue(header.alg === 'RS256' && typeof header.kid === 'string', 'unsupported_oidc_algorithm', 401)
  const candidates = jwks.keys.filter(key => (key as JsonWebKey & { kid?: string }).kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'))
  requireValue(candidates.length === 1, 'invalid_oidc_key', 401)
  const key = await crypto.subtle.importKey('jwk', candidates[0], { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  requireValue(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unbase64url(parts[2]), utf8(`${parts[0]}.${parts[1]}`)), 'invalid_oidc_signature', 401)
  const now = (options.now ?? Date.now()) / 1000
  const aud = claims.aud
  requireValue(claims.iss === 'https://oauth.telegram.org' && (aud === options.clientId || Array.isArray(aud) && aud.includes(options.clientId)), 'invalid_oidc_claims', 401)
  requireValue(!Array.isArray(aud) || aud.length === 1 || claims.azp === options.clientId, 'invalid_oidc_audience', 401)
  requireValue(typeof claims.exp === 'number' && claims.exp > now && typeof claims.iat === 'number' && claims.iat <= now + 30 && claims.iat >= now - 600 && (claims.nbf === undefined || typeof claims.nbf === 'number' && claims.nbf <= now + 30), 'expired_oidc_token', 401)
  requireValue(typeof claims.nonce === 'string' && equal(claims.nonce, options.nonce), 'invalid_oidc_nonce', 401)
  // `sub` is an OIDC subject, NOT the Telegram user ID. Only the signed profile.id maps a member.
  return { id: telegramId(claims.id), name: typeof claims.name === 'string' ? claims.name.slice(0, 200) : 'Member', username: typeof claims.preferred_username === 'string' ? claims.preferred_username.slice(0, 64) : '' }
}
