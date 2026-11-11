import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatMeetingDateTime, meetingTimeZoneLabel, meetingUtcOffset, toLocalInput } from '../src/platform-kit/src/platform/meeting-time.ts'
import { entityTag } from '../src/platform-kit/src/platform/entity-tag.ts'

const config = { locale: 'ru', timezone: 'Asia/Qyzylorda' }
const startsAt = '2026-11-22T13:30:00Z'
const event = { kind: 'event', tag: 'СТАРАЯ ДАТА', data: { startsAt } }

function inTimezone(timezone, run) {
  const original = process.env.TZ
  process.env.TZ = timezone
  try { run() } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
}

test('meeting dates identify the app zone and offset, independently of the device zone', () => {
  for (const device of ['UTC', 'Asia/Qyzylorda', 'America/Los_Angeles', 'Asia/Tokyo']) inTimezone(device, () => {
    assert.equal(meetingTimeZoneLabel(startsAt, config.timezone), 'Asia/Qyzylorda (UTC+05:00)')
    assert.match(formatMeetingDateTime(startsAt, config), /22.*ноября.*2026.*18:30.*Asia\/Qyzylorda \(UTC\+05:00\)/)
    for (const kind of ['event', 'slot']) assert.match(entityTag({ ...event, kind }, config), /18:30.*UTC\+05:00/)
    assert.match(entityTag(event, { ...config, timezone: 'UTC' }), /13:30.*UTC\+00:00$/)
    assert.match(formatMeetingDateTime(startsAt, { locale: 'en-US', timezone: 'UTC' }), /November 22, 2026.*1:30 PM.*UTC \(UTC\+00:00\)/)
  })
})

test('offsets describe the meeting date, including DST and non-whole-hour zones', () => {
  const cases = [
    ['2026-01-15T12:00:00Z', 'America/New_York', 'UTC-05:00'],
    ['2026-07-15T12:00:00Z', 'America/New_York', 'UTC-04:00'],
    ['2026-03-08T06:30:00Z', 'America/New_York', 'UTC-05:00'],
    ['2026-03-08T07:30:00Z', 'America/New_York', 'UTC-04:00'],
    ['2026-11-01T05:30:00Z', 'America/New_York', 'UTC-04:00'],
    ['2026-11-01T06:30:00Z', 'America/New_York', 'UTC-05:00'],
    [startsAt, 'Asia/Kathmandu', 'UTC+05:45'],
    [startsAt, 'America/St_Johns', 'UTC-03:30'],
    [startsAt, 'UTC', 'UTC+00:00'],
  ]
  for (const [date, timezone, offset] of cases) {
    assert.equal(meetingUtcOffset(date, timezone), offset)
    assert.match(entityTag({ ...event, data: { startsAt: date } }, { ...config, timezone }), new RegExp(offset.replace(/[+]/g, '\\+')))
  }
  assert.match(formatMeetingDateTime('2026-11-01T05:30:00Z', { ...config, timezone: 'America/New_York' }), /01:30.*UTC-04:00/)
  assert.match(formatMeetingDateTime('2026-11-01T06:30:00Z', { ...config, timezone: 'America/New_York' }), /01:30.*UTC-05:00/)
})

test('date rollovers keep the displayed day and offset together', () => {
  assert.match(formatMeetingDateTime('2026-11-22T22:30:00Z', config), /23.*ноября.*03:30.*UTC\+05:00/)
  assert.match(formatMeetingDateTime('2026-11-22T01:30:00Z', { ...config, timezone: 'America/Los_Angeles' }), /21.*ноября.*17:30.*UTC-08:00/)
})

test('empty and malformed schedules are safe and do not invent a date or offset', () => {
  for (const value of [undefined, null, '', 'not-a-date']) {
    assert.equal(formatMeetingDateTime(value, config), 'Дата уточняется')
    assert.equal(meetingTimeZoneLabel(value, config.timezone), config.timezone)
    assert.equal(meetingUtcOffset(value, config.timezone), '')
    assert.equal(toLocalInput(value), '')
    assert.equal(entityTag({ ...event, data: { startsAt: value } }, config), 'ВСТРЕЧА')
  }
  assert.equal(entityTag({ ...event, kind: 'article' }, config), 'СТАРАЯ ДАТА')
})

test('datetime-local keeps the existing device-local input and UTC storage semantics', () => {
  for (const [timezone, input] of [
    ['UTC', '2026-11-22T13:30'],
    ['Asia/Qyzylorda', '2026-11-22T18:30'],
    ['America/Los_Angeles', '2026-11-22T05:30'],
    ['Asia/Tokyo', '2026-11-22T22:30'],
  ]) inTimezone(timezone, () => {
    assert.equal(toLocalInput(startsAt), input)
    assert.equal(new Date(input).toISOString(), '2026-11-22T13:30:00.000Z')
  })
  inTimezone('America/New_York', () => {
    assert.equal(toLocalInput('2026-03-08T06:30:00Z'), '2026-03-08T01:30')
    assert.equal(toLocalInput('2026-03-08T07:30:00Z'), '2026-03-08T03:30')
    // Preserve the browser's existing handling of nonexistent and ambiguous local times.
    const gap = new Date('2026-03-08T02:30').toISOString()
    assert.equal(gap, '2026-03-08T07:30:00.000Z')
    assert.equal(toLocalInput(gap), '2026-03-08T03:30')
    assert.equal(new Date('2026-11-01T01:30').toISOString(), '2026-11-01T05:30:00.000Z')
  })
})

test('editor labels both zones and previews the same instant shown to participants', () => {
  const admin = readFileSync(new URL('../src/platform-kit/src/screens/Admin.tsx', import.meta.url), 'utf8')
  assert.match(admin, /Часовой пояс редактора \(устройство\)/)
  assert.match(admin, /Часовой пояс приложения: \{s.config.timezone\}/)
  assert.match(admin, /meetingTimeZoneLabel\(e.data.startsAt, Intl.DateTimeFormat\(\).resolvedOptions\(\).timeZone\)/)
  assert.match(admin, /aria-describedby="meeting-time-preview"/)
  assert.match(admin, /id="meeting-time-preview"[^>]+aria-live="polite"/)
  assert.match(admin, /Участники увидят: \{formatMeetingDateTime\(e.data.startsAt, s.config\)\}/)
  assert.match(admin, /new Date\(ev.target.value\).toISOString\(\)/)
  const detail = readFileSync(new URL('../src/platform-kit/src/screens/Detail.tsx', import.meta.url), 'utf8')
  assert.match(detail, /formatMeetingDateTime\(e.data.startsAt, s.config\)/)
  const home = readFileSync(new URL('../src/platform-kit/src/screens/Home.tsx', import.meta.url), 'utf8')
  assert.match(home, /entityTag\(events\[0\], s.config\)/)
})
