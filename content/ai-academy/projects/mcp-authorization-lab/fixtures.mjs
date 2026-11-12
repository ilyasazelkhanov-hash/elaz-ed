// Deliberately fictional values. No serialized JWT, key or network request exists here.
export const policy = Object.freeze({
  issuer: 'https://identity.example.test',
  audience: 'https://mcp.example.test/mcp',
  requiredScopes: Object.freeze(['notes:read']),
  now: 1_800_000_000,
  allowedOrigins: Object.freeze(['https://classroom.example.test']),
})
export function evidence(claimChanges = {}, verificationOutcome = 'verified') {
  return { verificationOutcome, claims: {
    iss: policy.issuer, aud: policy.audience, scope: 'notes:read',
    exp: policy.now + 300, nbf: policy.now - 10, ...claimChanges,
  } }
}
export function request(changes = {}) {
  return { origin: policy.allowedOrigins[0], ...changes }
}
