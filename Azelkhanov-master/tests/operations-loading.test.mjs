import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLatestRequest } from '../src/platform/latest-request.ts'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('switching queue filters discards old rows and late successful results', async () => {
  const states = [], request = createLatestRequest(state => states.push(state))
  request.select('notification')
  await request.run('notification', async () => [{ id: 'notification-row' }])
  const old = deferred(), newer = deferred()
  const first = request.run('notification', () => old.promise)
  request.select('refund')
  const second = request.run('refund', () => newer.promise)
  assert.deepEqual(states.at(-1), { key: 'refund', loading: true, error: '' })
  newer.resolve([{ id: 'refund-row' }]); await second
  old.resolve([{ id: 'stale-row' }]); await first
  assert.deepEqual(states.at(-1).value, [{ id: 'refund-row' }])
  assert.equal(states.at(-1).key, 'refund')
})

test('failed filter load stops loading, exposes retry state, and recovers to a genuine empty result', async () => {
  const states = [], request = createLatestRequest(state => states.push(state))
  request.select('refund')
  await request.run('refund', async () => undefined) // act reports errors through undefined
  assert.equal(states.at(-1).loading, false)
  assert.match(states.at(-1).error, /Не удалось/)
  assert.equal(states.at(-1).value, undefined)
  await request.run('refund', async () => [])
  assert.deepEqual(states.at(-1), { key: 'refund', loading: false, value: [], error: '' })
})

test('an older failure cannot replace a newer success, even for the same filter', async () => {
  const states = [], request = createLatestRequest(state => states.push(state)), old = deferred()
  request.select('payments')
  const first = request.run('payments', () => old.promise)
  await request.run('payments', async () => [{ id: 'current' }])
  old.reject(Error('old failure')); await first
  assert.equal(states.at(-1).value[0].id, 'current')
  assert.equal(states.at(-1).error, '')
})

test('unmount cancels publication and stale post-mutation callbacks cannot reload a previous filter', async () => {
  const states = [], request = createLatestRequest(state => states.push(state)), old = deferred()
  request.select('notification')
  const first = request.run('notification', () => old.promise)
  request.invalidate()
  const count = states.length
  old.resolve([{ id: 'late' }]); await first
  assert.equal(states.length, count)
  request.select('refund')
  await request.run('refund', async () => [{ id: 'current' }])
  let called = false
  await request.run('notification', async () => { called = true; return [] })
  assert.equal(called, false)
  assert.equal(states.at(-1).value[0].id, 'current')
})

test('current thrown errors are visible and repeated refreshes publish only their latest result', async () => {
  const states = [], request = createLatestRequest(state => states.push(state)), first = deferred(), second = deferred()
  request.select('payments')
  await request.run('payments', async () => { throw Error('network offline') })
  assert.equal(states.at(-1).error, 'network offline')
  const a = request.run('payments', () => first.promise), b = request.run('payments', () => second.promise)
  first.resolve([{ id: 'old' }]); await a
  assert.equal(states.at(-1).loading, true)
  second.resolve([{ id: 'new' }]); await b
  assert.equal(states.at(-1).value[0].id, 'new')
})

test('Operations renders separate error/retry and keeps CSV bound to the visible filter', () => {
  const source = readFileSync(new URL('../src/screens/Operations.tsx', import.meta.url), 'utf8')
  assert.match(source, /const current = state.key === filterKey/)
  assert.match(source, /const rows = current \? state.value \?\? \[\] : \[\]/)
  assert.match(source, /error \? \([\s\S]*role="alert"[\s\S]*Повторить обновление/)
  assert.match(source, /disabled={!rows.length}/)
  assert.match(source, /request.invalidate\(\)/)
})
