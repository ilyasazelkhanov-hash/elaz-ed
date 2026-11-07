export const RELEASE = Object.freeze({
  api: 'og-roadmap-v1',
  capabilities: ['blog_newest', 'practice_outline', 'discovery_events', 'editorial_metadata'],
  content_revision: 'ai-practice-paths-2026-11-01-v5',
})

export function checkRelease(health) {
  const release = health?.release
  return {
    healthy: health?.ok === true && health?.db === true,
    api: release?.api === RELEASE.api,
    capabilities: RELEASE.capabilities.every(capability => release?.capabilities?.includes(capability)),
    content_revision: release?.content_revision === RELEASE.content_revision,
  }
}

export function publicApiUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/^\/[a-zA-Z0-9/_-]+$/.test(url.pathname)) throw Error('Use an HTTPS API URL without credentials, query or fragment')
  return url.href.replace(/\/$/, '')
}
