export const ADVENT_SEASON_ID = 'ai-winter-2026'
export const ADVENT_START = '2026-11-14'
export const ADVENT_END = '2027-01-05'
export const ADVENT_TIME_ZONE = 'Asia/Almaty'
export interface AdventMission {
  date: string; title: string; teaser: string; kind: string; minutes: number;
  body: string[]; prompt: string; advanced: string; deliverable: string; check: string; courseTag: string
}
export function adventToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ADVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function seasonDates() {
  const dates: string[] = []
  for (let at = Date.parse(`${ADVENT_START}T00:00:00Z`); at <= Date.parse(`${ADVENT_END}T00:00:00Z`); at += 86400000) dates.push(new Date(at).toISOString().slice(0,10))
  return dates
}
export function missionAvailable(date: string, today: string) { return seasonDates().includes(date) && date <= today }
export function seasonScope(user: string | number, demo: boolean) { return `og:${demo ? 'demo' : 'live'}:${encodeURIComponent(String(user))}:advent:${ADVENT_SEASON_ID}` }
export type AdventStorage = Pick<Storage, 'getItem' | 'setItem'>
export function readSeasonProgress(storage: AdventStorage | undefined, key: string): string[] {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || '[]')
    return Array.isArray(parsed) ? [...new Set(parsed.filter((v): v is string => typeof v === 'string' && seasonDates().includes(v)))] : []
  } catch { return [] }
}
export function saveSeasonProgress(storage: AdventStorage | undefined, key: string, done: string[]) {
  try { if (!storage) return false; storage.setItem(key, JSON.stringify([...new Set(done.filter(v => seasonDates().includes(v)))])); return true } catch { return false }
}
export function localSeasonStorage(): AdventStorage | undefined { try { return window.localStorage } catch { return undefined } }
