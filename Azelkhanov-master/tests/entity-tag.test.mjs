import test from 'node:test'
import assert from 'node:assert/strict'
import { entityTag } from '../src/platform/entity-tag.ts'

const config = { locale: 'ru', timezone: 'Asia/Qyzylorda' }
const event = { kind: 'event', tag: '18 ДЕК · 18:30', data: { startsAt: '2026-11-22T13:30:00Z' } }
test('event and slot badges use the actual schedule and configured timezone', () => {
  const expected = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: config.timezone }).format(new Date(event.data.startsAt))
  for (const kind of ['event', 'slot']) assert.equal(entityTag({ ...event, kind }, config), `${expected} · UTC+05:00`)
  assert.match(entityTag(event, config), /22.*нояб.*18:30/)
  assert.match(entityTag(event, { ...config, timezone: 'UTC' }), /13:30/)
  assert.doesNotMatch(entityTag(event, config), /ДЕК/i)
})
test('non-event editorial badges are preserved and an invalid schedule never repeats a stale date', () => {
  assert.equal(entityTag({ ...event, kind: 'article', tag: 'НОВОЕ' }, config), 'НОВОЕ')
  assert.equal(entityTag({ ...event, data: { startsAt: 'invalid' } }, config), 'ВСТРЕЧА')
  assert.equal(entityTag({ ...event, data: {} }, config), 'ВСТРЕЧА')
})
