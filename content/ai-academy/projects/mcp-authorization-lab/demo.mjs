import { evaluatePolicy } from './policy.mjs'
import { evidence, policy, request } from './fixtures.mjs'
const cases = [
  ['allowed_read', evidence(), request()],
  ['other_issuer', evidence({ iss: 'https://other.example.test' }), request()],
  ['other_service', evidence({ aud: 'https://other.example.test/mcp' }), request()],
  ['scope_prefix_is_not_permission', evidence({ scope: 'notes:read:any' }), request()],
  ['expired', evidence({ exp: policy.now }), request()],
  ['unverified_with_session', evidence({}, 'failed'), request({ sessionId: 'fictional-session' })],
  ['untrusted_browser_origin', evidence(), request({ origin: 'https://other.example.test' })],
]
for (const [caseId, tokenEvidence, incoming] of cases) {
  console.log(JSON.stringify({ caseId, synthetic: true, ...evaluatePolicy(tokenEvidence, policy, incoming) }))
}
