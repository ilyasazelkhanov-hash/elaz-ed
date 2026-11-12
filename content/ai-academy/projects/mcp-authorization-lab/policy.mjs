// Original offline teaching model. NOT a JWT verifier or HTTP authentication middleware.
// verificationOutcome is synthetic evidence supplied by the exercise, never by a client.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 2048
const scopeToken = value => typeof value === 'string' && /^[\x21\x23-\x5B\x5D-\x7E]+$/.test(value)
const denseList = (value, predicate) => {
  if (!Array.isArray(value) || value.length === 0) return false
  for (let i = 0; i < value.length; i++) {
    if (!Object.hasOwn(value, i) || !predicate(value[i])) return false
  }
  return true
}
const strings = value => denseList(value, text)
const timestamp = value => Number.isSafeInteger(value) && value >= 0
const origin = value => {
  if (!text(value)) return false
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && url.origin === value }
  catch { return false }
}

/**
 * Exercise-only policy evaluation AFTER a trusted signature/introspection adapter.
 * This function cannot establish signature validity, token origin or caller identity.
 * Numeric dates are epoch seconds; no implicit clock, skew or URL normalization.
 */
export function evaluatePolicy(evidence, policy, request = {}) {
  const checks = []
  const deny = reason => ({ allowed: false, reason, checks: [...checks] })
  if (!record(policy) || !text(policy.issuer) || !text(policy.audience)
      || !denseList(policy.requiredScopes, scopeToken) || !timestamp(policy.now)
      || (policy.allowedOrigins !== undefined
        && (!strings(policy.allowedOrigins) || !policy.allowedOrigins.every(origin)))) return deny('invalid_policy')
  if (!record(request)) return deny('invalid_request')
  if (!record(evidence) || evidence.verificationOutcome !== 'verified') return deny('unverified_token')
  checks.push('trusted_verification_evidence')
  const claims = evidence.claims
  if (!record(claims) || !text(claims.iss)
      || !(text(claims.aud) || strings(claims.aud))
      || typeof claims.scope !== 'string' || claims.scope.length > 4096
      || !claims.scope.split(' ').every(scopeToken)
      || !timestamp(claims.exp)
      || (claims.nbf !== undefined && (!timestamp(claims.nbf) || claims.nbf >= claims.exp))) return deny('invalid_claims')
  if (claims.iss !== policy.issuer) return deny('wrong_issuer')
  checks.push('issuer')
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audiences.includes(policy.audience)) return deny('wrong_audience')
  checks.push('audience')
  if (claims.exp <= policy.now) return deny('expired_token')
  if (claims.nbf !== undefined && claims.nbf > policy.now) return deny('token_not_yet_valid')
  checks.push('lifetime')
  const granted = new Set(claims.scope.split(' '))
  if (!policy.requiredScopes.every(scope => granted.has(scope))) return deny('insufficient_scope')
  checks.push('scope')
  if (policy.allowedOrigins !== undefined) {
    if (!origin(request.origin) || !policy.allowedOrigins.includes(request.origin)) return deny('origin_denied')
    checks.push('origin')
  }
  // Session identifiers do not participate in any authorization decision.
  return { allowed: true, reason: 'policy_passed', checks }
}
