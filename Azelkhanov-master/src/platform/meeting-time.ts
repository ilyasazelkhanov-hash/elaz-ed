import type { AppConfig } from './contracts.ts'

type MeetingConfig = Pick<AppConfig, 'locale' | 'timezone'>

function meetingDate(value: unknown): Date | null {
  const date = new Date(String(value ?? ''))
  return Number.isFinite(date.getTime()) ? date : null
}

/** Calculate the offset at the meeting, not today: the configured zone may observe DST. */
export function meetingUtcOffset(value: unknown, timezone: string): string {
  const date = meetingDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')!.value.replace('GMT', 'UTC').replace(/^UTC$/, 'UTC+00:00')
}

export function meetingTimeZoneLabel(value: unknown, timezone: string): string {
  const offset = meetingUtcOffset(value, timezone)
  return offset ? `${timezone} (${offset})` : timezone
}

/** The application zone is authoritative for participant-facing meeting times. */
export function formatMeetingDateTime(value: unknown, config: MeetingConfig): string {
  const date = meetingDate(value)
  if (!date) return 'Дата уточняется'
  const time = new Intl.DateTimeFormat(config.locale, {
    dateStyle: 'long', timeStyle: 'short', timeZone: config.timezone,
  }).format(date)
  return `${time} · ${meetingTimeZoneLabel(value, config.timezone)}`
}

/** datetime-local has no zone; keep the editor's existing device-local conversion. */
export function toLocalInput(value: unknown): string {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
