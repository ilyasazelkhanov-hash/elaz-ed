import type { AppConfig, Entity } from './contracts.ts'
import { meetingUtcOffset } from './meeting-time.ts'

/** Event dates come from the schedule, never from a stale editorial badge. */
export function entityTag(entity: Entity, config: Pick<AppConfig, 'locale' | 'timezone'>): string {
  if (entity.kind !== 'event' && entity.kind !== 'slot') return entity.tag
  const startsAt = new Date(String(entity.data.startsAt ?? ''))
  if (!Number.isFinite(startsAt.getTime())) return 'ВСТРЕЧА'
  const time = new Intl.DateTimeFormat(config.locale, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: config.timezone,
  }).format(startsAt)
  return `${time} · ${meetingUtcOffset(entity.data.startsAt, config.timezone)}`
}
