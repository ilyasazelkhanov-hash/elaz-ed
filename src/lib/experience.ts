import type { PlatformApi, Snapshot, Data } from '../platform-kit/src/platform/contracts.ts'
import { isDemo } from './api'
import { creatorConfig } from './og-config'

export const experienceEnabled = isDemo || import.meta.env.VITE_PLATFORM_ENABLED === 'true'
let client: Promise<PlatformApi> | undefined
export async function experienceApi() {
  if (!experienceEnabled) throw new Error('Клуб готовится к открытию. Следите за новостями автора.')
  client ??= Promise.all([
    import('../platform-kit/src/platform/client.ts'),
    import('../platform-kit/app.config.json'),
  ]).then(([{ createApi }, { default: config }]) => createApi(creatorConfig(config as Snapshot['config']), import.meta.env.VITE_PLATFORM_API_URL || '/platform-api')).catch((error) => { client = undefined; throw error })
  return client
}
export async function experienceAction(action: string, payload: Data = {}) {
  return (await experienceApi()).dispatch(action, payload)
}
export function demoPlatformXp() {
  if (!isDemo) return 0
  try { return Number(JSON.parse(localStorage.getItem('az-master:v1:og-cre8r:club') || '{}').me?.xp) || 0 } catch { return 0 }
}
export function openShowcase(mode: string, industry: string) {
  const url = new URL(location.href)
  url.searchParams.set('platform', '')
  url.searchParams.set('demo', '')
  url.searchParams.set('mode', mode)
  url.searchParams.set('industry', industry)
  location.assign(url.href)
}
