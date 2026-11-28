/**
 * Manual course access by Telegram @username.
 * The server has one operation for it: admin_grant(course_id, username). It finds the person among
 * people who have opened the app, opens the course and sends them a bot message. Nothing here
 * invents a result: every pair is reported exactly as the server answered.
 */

export const GRANT_USER_LIMIT = 30

export type GrantStatus = 'granted' | 'user_not_found' | 'course_not_found' | 'stopped' | 'skipped' | 'error'
export type GrantPair = { username: string; courseId: number }
export type GrantResult = GrantPair & { status: GrantStatus; name?: string; message?: string }

// Telegram usernames: Latin letters, digits and underscores, starting with a letter. Regular ones are
// 5 to 32 characters; 4 is allowed because collectible short usernames exist.
const USERNAME = /^[a-z][a-z0-9_]{3,31}$/i

/** Accepts "@name", "name", "t.me/name" and full links, separated by spaces, commas or new lines. */
export function parseUsernames(input: string): { valid: string[]; invalid: string[]; overflow: number } {
  const valid: string[] = [], invalid: string[] = [], seen = new Set<string>()
  let overflow = 0
  for (const raw of String(input ?? '').split(/[\s,;]+/)) {
    const token = raw.trim()
    if (!token) continue
    const name = token.replace(/^(?:https?:\/\/)?(?:t|telegram)\.me\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '')
    if (!USERNAME.test(name)) {
      if (!invalid.includes(token)) invalid.push(token.slice(0, 40))
      continue
    }
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (valid.length >= GRANT_USER_LIMIT) overflow++
    else valid.push(name)
  }
  return { valid, invalid, overflow }
}

/** People first: when one person is not found, their other courses are skipped instead of asked again. */
export function grantPairs(usernames: string[], courseIds: number[]): GrantPair[] {
  const courses = [...new Set(courseIds.filter(id => Number.isSafeInteger(id) && id > 0))]
  return usernames.flatMap(username => courses.map(courseId => ({ username, courseId })))
}

type GrantError = { code?: unknown; status?: unknown }
const codeOf = (error: unknown) => (error && typeof error === 'object' && typeof (error as GrantError).code === 'string' ? String((error as GrantError).code) : '')

/**
 * Runs grants one by one. An access or session error stops the whole batch: repeating it for the
 * remaining pairs cannot succeed. A lost answer is reported as an error, never as a success.
 */
export async function runGrants(
  pairs: GrantPair[],
  grant: (courseId: number, username: string) => Promise<string>,
  options: { onResult?: (result: GrantResult, done: number, total: number) => void; errorText?: (error: unknown) => string } = {},
): Promise<GrantResult[]> {
  const results: GrantResult[] = [], missing = new Set<string>()
  let stopped = ''
  for (const pair of pairs) {
    let result: GrantResult
    if (stopped) result = { ...pair, status: 'stopped', message: stopped }
    else if (missing.has(pair.username.toLowerCase())) result = { ...pair, status: 'skipped' }
    else {
      try {
        result = { ...pair, status: 'granted', name: await grant(pair.courseId, pair.username) }
      } catch (error) {
        const code = codeOf(error), message = options.errorText?.(error) ?? ''
        if (code === 'user_not_found') {
          missing.add(pair.username.toLowerCase())
          result = { ...pair, status: 'user_not_found' }
        } else if (code === 'not_found') result = { ...pair, status: 'course_not_found' }
        else {
          result = { ...pair, status: 'error', message }
          if (['forbidden', 'bad_auth', 'no_user', 'locked'].includes(code)) stopped = message || 'Нет прав администратора или сессия устарела'
        }
      }
    }
    results.push(result)
    options.onResult?.(result, results.length, pairs.length)
  }
  return results
}

export function grantSummary(results: GrantResult[]) {
  const count = (status: GrantStatus) => results.filter(result => result.status === status).length
  const missing = [...new Set(results.filter(result => result.status === 'user_not_found').map(result => result.username))]
  return { granted: count('granted'), failed: count('error') + count('course_not_found') + count('stopped'), missing, total: results.length }
}

/** Pairs worth sending again: everything that did not end with a confirmed grant. */
export function retryPairs(results: GrantResult[]): GrantPair[] {
  return results.filter(result => result.status !== 'granted').map(({ username, courseId }) => ({ username, courseId }))
}
