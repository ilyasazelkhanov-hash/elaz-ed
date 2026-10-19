import test from 'node:test'
import assert from 'node:assert/strict'
import { DemoApi } from '../src/platform/demo.ts'
const storage = () => {
  const entries = new Map()
  return {
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => entries.set(k, v),
    removeItem: (k) => entries.delete(k),
  }
}
test('daily can only credit a member once per calendar day', async () => {
  const api = new DemoApi('club', storage())
  const before = await api.bootstrap()
  await api.dispatch('daily.claim')
  const after = (await api.dispatch('daily.claim')).snapshot
  assert.equal(after.me.points, before.me.points + 25)
  assert.equal(after.me.xp, before.me.xp + 30)
})
test('reward exchange persists and a coupon cannot be redeemed twice', async () => {
  const db = storage(),
    api = new DemoApi('club', db)
  const before = await api.bootstrap()
  const { snapshot } = await api.dispatch('reward.claim', { entityId: 'reward-coffee' })
  assert.equal(snapshot.me.points, before.me.points - 150)
  const coupon = snapshot.coupons[0]
  assert.ok(coupon.code)
  const reloaded = await new DemoApi('club', db).bootstrap()
  assert.equal(reloaded.coupons[0].id, coupon.id)
  await api.dispatch('coupon.redeem', { code: coupon.code, pointId: 'main' })
  await assert.rejects(api.dispatch('coupon.redeem', { code: coupon.code, pointId: 'main' }), /погашен/)
})
test('quiz answers are hidden until an immutable answer is submitted', async () => {
  const api = new DemoApi('academy', storage())
  assert.equal(JSON.stringify((await api.bootstrap()).entities).includes('correct'), false)
  const start = await api.dispatch('quiz.start', { entityId: 'lesson-1' })
  assert.equal(JSON.stringify(start.result.questions).includes('correct'), false)
  const reply = await api.dispatch('quiz.answer', { attemptId: start.result.attemptId, index: 0, answer: 0 })
  assert.equal(reply.result.correct, true)
  const replay = await api.dispatch('quiz.answer', { attemptId: start.result.attemptId, index: 0, answer: 1 })
  assert.equal(replay.result.answer, 0)
  assert.equal(replay.result.correct, true)
})
test('order price comes from catalog and invalid quantities are rejected', async () => {
  const api = new DemoApi('club', storage())
  const reply = await api.dispatch('order.create', {
    items: [{ entityId: 'product-cup', quantity: 2, variant: 'Кобальт', price: 1 }],
    note: '',
  })
  assert.equal(reply.snapshot.orders[0].total, 15800)
  await assert.rejects(
    api.dispatch('order.create', { items: [{ entityId: 'product-cup', quantity: -1, variant: 'Кобальт' }] }),
    /количество/,
  )
})
test('roles and module flags also guard demo domain operations', async () => {
  const api = new DemoApi('club', storage())
  await api.dispatch('demo.role', { role: 'member' })
  await assert.rejects(
    api.dispatch('admin.points.adjust', { userId: 'demo-me', delta: 10, reason: 'test', ref: 'x' }),
    /доступ/,
  )
})
test('booking is idempotent and cancellation persists', async () => {
  const api = new DemoApi('club', storage())
  await api.dispatch('event.book', { entityId: 'event-talk' })
  const again = await api.dispatch('event.book', { entityId: 'event-talk' })
  assert.equal(again.snapshot.bookings.length, 1)
  const cancelled = await api.dispatch('event.cancel', { entityId: 'event-talk' })
  assert.equal(cancelled.snapshot.bookings[0].status, 'cancelled')
})
