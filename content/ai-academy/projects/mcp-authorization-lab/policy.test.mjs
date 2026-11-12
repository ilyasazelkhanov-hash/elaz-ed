import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePolicy } from './policy.mjs'
import { evidence, policy, request } from './fixtures.mjs'
const check = (claims = {}, config = policy, incoming = request(), outcome = 'verified') =>
  evaluatePolicy(evidence(claims, outcome), config, incoming)
const denied = (result, reason) => { assert.equal(result.allowed, false); assert.equal(result.reason, reason) }

test('matching verified synthetic evidence passes every configured check', () => {
  assert.deepEqual(check(), { allowed: true, reason: 'policy_passed', checks: ['trusted_verification_evidence', 'issuer', 'audience', 'lifetime', 'scope', 'origin'] })
})
test('audience array can contain exact intended resource', () => assert.equal(check({ aud: ['other', policy.audience] }).allowed, true))
test('foreign issuer rejected', () => denied(check({ iss: 'https://other.example.test' }), 'wrong_issuer'))
test('issuer matching is exact, not URL normalized', () => denied(check({ iss: policy.issuer + '/' }), 'wrong_issuer'))
test('correctly verified evidence intended for another audience rejected', () => denied(check({ aud: 'https://other.example.test/mcp' }), 'wrong_audience'))
test('audience prefix or trailing slash does not match', () => {
  for (const aud of [policy.audience + '/', policy.audience + '-admin']) denied(check({ aud }), 'wrong_audience')
})
test('malformed audiences fail closed', () => {
  for (const aud of [undefined, null, [], [policy.audience, null], 123, {}]) denied(check({ aud }), 'invalid_claims')
})
test('exact scope required, substring is insufficient', () => {
  for (const scope of ['notes:read:any', 'notes:reader', 'notes:write']) denied(check({ scope }), 'insufficient_scope')
})
test('space-delimited scopes and multiple requirements work', () => {
  assert.equal(check({ scope: 'notes:write notes:read' }, { ...policy, requiredScopes: ['notes:read', 'notes:write'] }).allowed, true)
  denied(check({}, { ...policy, requiredScopes: ['notes:read', 'notes:write'] }), 'insufficient_scope')
})
test('malformed scopes do not become an empty permission set', () => {
  for (const scope of [undefined, '', ['notes:read'], 'notes:read\tadmin', 'notes:read  admin', ' notes:read']) denied(check({ scope }), 'invalid_claims')
})
test('expiration boundary is exclusive', () => {
  denied(check({ exp: policy.now }), 'expired_token')
  denied(check({ exp: policy.now - 1 }), 'expired_token')
  assert.equal(check({ exp: policy.now + 1 }).allowed, true)
})
test('not-before boundary is inclusive', () => {
  assert.equal(check({ nbf: policy.now }).allowed, true)
  denied(check({ nbf: policy.now + 1 }), 'token_not_yet_valid')
})
test('optional not-before may be absent', () => assert.equal(check({ nbf: undefined }).allowed, true))
test('missing or invalid dates fail closed', () => {
  for (const exp of [undefined, null, '1800000300', NaN, Infinity, -1, 1.5]) denied(check({ exp }), 'invalid_claims')
  for (const nbf of [null, '1800000000', NaN, policy.now + 301]) denied(check({ nbf }), 'invalid_claims')
})
test('verification failure or absence cannot be repaired by correct claims', () => {
  for (const outcome of ['failed', 'unavailable', undefined, true]) denied(evaluatePolicy({ verificationOutcome: outcome, claims: evidence().claims }, policy, request()), 'unverified_token')
  denied(evaluatePolicy(null, policy, request()), 'unverified_token')
})
test('session ID is neither a credential nor an audience', () => {
  denied(check({}, policy, request({ sessionId: 'approved' }), 'failed'), 'unverified_token')
  denied(check({ aud: 'elsewhere' }, policy, request({ sessionId: 'approved' })), 'wrong_audience')
  assert.deepEqual(check({}, policy, request({ sessionId: 'anything' })), check())
})
test('configured origin denies wrong, missing and opaque origins', () => {
  for (const incoming of [{}, { origin: 'null' }, { origin: 'https://other.example.test' }, { origin: policy.allowedOrigins[0] + '/path' }]) denied(check({}, policy, incoming), 'origin_denied')
})
test('origin check may be disabled explicitly by trusted policy, not request', () => {
  const { allowedOrigins, ...withoutOrigin } = policy
  assert.equal(check({}, withoutOrigin, {}).allowed, true)
  denied(check({}, policy, { disableOrigin: true }), 'origin_denied')
})
test('malformed policy fails closed before consuming evidence', () => {
  for (const config of [null, [], {}, { ...policy, now: NaN }, { ...policy, requiredScopes: [] }, { ...policy, requiredScopes: [''] }, { ...policy, allowedOrigins: [] }, { ...policy, allowedOrigins: ['null'] }]) denied(evaluatePolicy(null, config), 'invalid_policy')
})
test('malformed claims and request fail closed', () => {
  for (const claims of [null, [], 'claims']) denied(evaluatePolicy({ verificationOutcome: 'verified', claims }, policy, request()), 'invalid_claims')
  denied(check({}, policy, null), 'invalid_request')
})
test('evaluation does not mutate evidence, policy or request', () => {
  const original = { token: evidence(), policy: structuredClone(policy), incoming: request() }
  const before = structuredClone(original)
  evaluatePolicy(original.token, original.policy, original.incoming)
  assert.deepEqual(original, before)
})
test('result trace does not leak claims, origins, credentials or raw tokens', () => {
  const result = check({ sub: 'fictional-private-person', token: 'not-a-real-secret' })
  assert.deepEqual(Object.keys(result), ['allowed', 'reason', 'checks'])
  assert.equal(JSON.stringify(result).includes('fictional-private-person'), false)
})

test('sparse required scopes cannot silently remove requirements', () => {
  denied(check({ scope: 'notes:write' }, { ...policy, requiredScopes: Array(1) }), 'invalid_policy')
  denied(check({}, { ...policy, requiredScopes: [, 'notes:read'] }), 'invalid_policy')
})
test('audience arrays with holes are malformed even beside a matching value', () => {
  denied(check({ aud: [, policy.audience] }), 'invalid_claims')
  denied(check({ aud: Array(1) }), 'invalid_claims')
})
test('origin arrays with holes are malformed even beside an allowed origin', () => {
  denied(check({}, { ...policy, allowedOrigins: [, policy.allowedOrigins[0]] }), 'invalid_policy')
})
