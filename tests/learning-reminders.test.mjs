import test from 'node:test'
import assert from 'node:assert/strict'
import { learningLocalParts, localMidnightUtc } from '../supabase/functions/api/learning-reminders.ts'

test('weekly reminder time and week start use the user IANA timezone', () => {
  const parts = learningLocalParts('Asia/Almaty', new Date('2026-11-01T13:00:00Z'))
  assert.deepEqual(parts, { day: 0, hour: 18, week: '2026-10-26' })
})

test('local Monday boundary accounts for summer time', () => {
  assert.equal(localMidnightUtc('2026-03-23', 'Europe/Paris'), '2026-03-22T23:00:00.000Z')
})

test('local Monday boundary accounts for winter time after DST ends', () => {
  assert.equal(localMidnightUtc('2026-10-26', 'Europe/Paris'), '2026-10-25T23:00:00.000Z')
})
