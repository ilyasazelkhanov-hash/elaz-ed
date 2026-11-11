import test from 'node:test'
import assert from 'node:assert/strict'
import { fittingAppointments, companyJourney, expertGoals } from '../src/platform/industry-scenarios.ts'
import { DemoApi } from '../src/platform/demo.ts'

const now = Date.parse('2026-11-11T12:00:00Z')
const entity = (id, overrides = {}) => ({
  id,
  kind: 'slot',
  module: 'events',
  title: id,
  published: true,
  publishAt: null,
  data: { industry: 'fashion', appointmentType: 'fitting', startsAt: '2026-11-12T12:00:00Z' },
  ...overrides,
})

test('fitting list requires explicit fashion and fitting tags, publication and a future date', () => {
  const valid = entity('valid'),
    earlier = entity('earlier', { data: { ...valid.data, startsAt: '2026-11-12T10:00:00Z' } })
  const excluded = [
    entity('general', { data: { startsAt: valid.data.startsAt } }),
    entity('fashion-show', { data: { industry: 'fashion', startsAt: valid.data.startsAt } }),
    entity('other-industry', { data: { ...valid.data, industry: 'company' } }),
    entity('past', { data: { ...valid.data, startsAt: '2026-11-10T12:00:00Z' } }),
    entity('started', { data: { ...valid.data, startsAt: new Date(now).toISOString() } }),
    entity('missing-date', { data: { industry: 'fashion', appointmentType: 'fitting' } }),
    entity('invalid-date', { data: { ...valid.data, startsAt: 'tomorrow' } }),
    entity('hidden', { published: false }),
    entity('scheduled', { publishAt: '2026-11-12T00:00:00Z' }),
    entity('invalid-publish-date', { publishAt: 'invalid' }),
    entity('not-a-meeting', { kind: 'article' }),
  ]
  assert.deepEqual(
    fittingAppointments([...excluded, valid, earlier], now).map((e) => e.id),
    ['earlier', 'valid'],
  )
  assert.deepEqual(fittingAppointments(excluded, now), [])
  assert.equal(valid.id, 'valid') // no mutation of source records
})

const snapshot = (overrides = {}) => ({
  entities: ['one', 'two', 'three'].map((id) =>
    entity(id, { kind: 'article', module: 'content', data: { industry: 'company' } }),
  ),
  config: { modules: ['content', 'progress'] },
  progress: [],
  me: { id: 'me' },
  journey: null,
  ...overrides,
})

test('one company route resumes the next uncompleted step for the current member only', () => {
  const initial = snapshot()
  assert.equal(companyJourney(initial, now).next.id, 'one')
  assert.equal(companyJourney(initial, now).started, false)
  const started = snapshot({ journey: { entityId: 'one' } })
  assert.equal(companyJourney(started, now).started, true)
  assert.equal(companyJourney(started, now).completed, 0)
  const progress = [
    { entityId: 'one', userId: 'me' },
    { entityId: 'one', userId: 'me' },
    { entityId: 'two', userId: 'other' },
    { entityId: 'unrelated', userId: 'me' },
  ]
  const resumed = companyJourney(snapshot({ progress, journey: { entityId: 'goal:tools' } }), now)
  assert.equal(resumed.started, true)
  assert.equal(resumed.next.id, 'two')
  assert.equal(resumed.completed, 1)
  const done = companyJourney(
    snapshot({ progress: ['one', 'two', 'three'].map((entityId) => ({ entityId, userId: 'me' })) }),
    now,
  )
  assert.equal(done.completed, 3)
  assert.equal(done.next, undefined)
})

test('company route omits disabled, unpublished, scheduled and unrelated content and handles an empty catalog', () => {
  assert.deepEqual(companyJourney(snapshot({ config: { modules: [] } }), now).steps, [])
  assert.equal(companyJourney(snapshot({ entities: [], journey: { entityId: 'old' } }), now).started, false)
  const item = snapshot().entities[0]
  const entities = [
    { ...item, published: false },
    { ...item, publishAt: '2026-12-01T00:00:00Z' },
    { ...item, data: { industry: 'expert' } },
    { ...item, kind: 'course' },
    ...snapshot().entities,
  ]
  assert.deepEqual(
    companyJourney(snapshot({ entities }), now).steps.map((e) => e.id),
    ['one', 'two', 'three'],
  )
})

test('goal advice differs by explicit choice and DemoApi persists each without awarding progress', async () => {
  assert.equal(new Set(expertGoals.map((goal) => goal.nextStep)).size, expertGoals.length)
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const api = new DemoApi('club', storage)
  const before = await api.bootstrap()
  for (const goal of expertGoals) {
    await api.dispatch('journey.choose', { entityId: goal.id })
    const restored = await new DemoApi('club', storage).bootstrap()
    assert.equal(restored.journey.entityId, goal.id)
    assert.deepEqual(restored.progress, before.progress)
    assert.equal(restored.me.xp, before.me.xp)
  }
})
