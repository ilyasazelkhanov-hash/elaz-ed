import PlatformApp from './platform-kit/src/App.tsx'
import config from './platform-kit/app.config.json'
import brand from './platform-kit/brand.config.json'
import type { AppConfig, BrandConfig } from './platform-kit/src/platform/contracts.ts'
import { useEffect } from 'react'
import { usePlatform } from './platform-kit/src/platform/store.ts'
import { api, isDemo } from './lib/api'
import { creatorConfig } from './lib/og-config'
import { modules as moduleDefinitions } from './platform-kit/src/platform/config.ts'

const params = new URLSearchParams(location.search)
const industry = params.get('industry') ?? ''
const showcase = params.has('demo') && ['coffee','fashion','construction','company','expert'].includes(industry)
const effectiveConfig: AppConfig = showcase
  ? { ...config as AppConfig, id: `og-showcase-${industry}`, modules:moduleDefinitions.map((m)=>m.id) }
  : creatorConfig(config as AppConfig)

function useDemoProfile() {
  useEffect(() => {
    if (!isDemo || showcase) return
    let disposed = false
    let unsubscribe: (() => void) | undefined
    // Only the explicitly local adapter is projected here. Production totals come from private SQL RPCs.
    void Promise.all([api.boot(),api.top()]).then(([boot,ranking]) => {
      if (disposed || boot.status !== 'ok') return
      const baseXp = boot.me.base_xp ?? boot.me.xp
      const project = () => {
        const s = usePlatform.getState().snapshot
        if (!s) return
        const platformXp = s.me.platformXp ?? s.me.xp
        if (s.me.baseXp === baseXp && s.me.platformXp === platformXp && s.me.name === boot.me.name) return
        const xp = baseXp + platformXp
        const leaderboard = ranking.top.map((p) => ({id:p.id === boot.me.id ? s.me.id : String(p.id),name:p.id === boot.me.id ? boot.me.name : p.name,xp:p.id === boot.me.id ? xp : p.xp})).sort((a,b)=>b.xp-a.xp || a.id.localeCompare(b.id))
        usePlatform.setState({snapshot:{...s,me:{...s.me,name:boot.me.name,xp,baseXp,platformXp},leaderboard}})
      }
      unsubscribe = usePlatform.subscribe((state,previous) => { if (state.snapshot !== previous.snapshot) project() })
      project()
    }).catch(() => {})
    return () => { disposed = true; unsubscribe?.() }
  }, [])
}

/** A self-contained versioned copy; no imports from the standalone master directory. */
export default function PlatformSpace() {
  useDemoProfile()
  const apiBase = import.meta.env.VITE_PLATFORM_API_URL || '/platform-api'
  return <PlatformApp config={effectiveConfig} brand={brand as BrandConfig} apiBase={apiBase} embedded />
}
