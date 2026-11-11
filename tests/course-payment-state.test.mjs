import test from 'node:test'
import assert from 'node:assert/strict'
import {createCoursePaymentStore, isUnresolvedPayment, paymentMessage} from '../src/lib/course-payment-state.ts'

function storage() {
 const data = new Map()
 return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)}
}

test('unresolved payment survives reload and is scoped to account, course and demo mode', () => {
 const disk = storage(), store = createCoursePaymentStore(() => disk)
 store.set('telegram:10', 5, {status:'waiting', updatedAt:1, checking:true, error:'offline'})
 const reloaded = createCoursePaymentStore(() => disk)
 assert.deepEqual(reloaded.get('telegram:10', 5), {status:'waiting', updatedAt:1})
 assert.equal(reloaded.get('telegram:11', 5), null)
 assert.equal(reloaded.get('demo:10', 5), null)
 assert.equal(reloaded.get('telegram:10', 6), null)
 assert.equal(isUnresolvedPayment(reloaded.get('telegram:10', 5).status), true)
 assert.equal(disk.data.values().next().value.includes('checking'), false)
 reloaded.set('telegram:10', 5, null)
 assert.equal(createCoursePaymentStore(() => disk).get('telegram:10', 5), null)
})

test('interruption during an open invoice becomes unknown, never cancelled/failed', () => {
 const disk = storage(), store = createCoursePaymentStore(() => disk)
 store.set('telegram:10', 5, {status:'opening', updatedAt:1})
 assert.equal(createCoursePaymentStore(() => disk).get('telegram:10', 5).status, 'unknown')
})

test('malformed storage, paid/open tampering and missing identity cannot grant access', () => {
 for (const value of ['{', '{"status":"paid","updatedAt":1}', '{"status":"open","updatedAt":1}', '{"status":"waiting","updatedAt":"invalid"}']) {
  const disk=storage(); disk.data.set('og-course-payment:v1:telegram:10:5', value)
  assert.equal(createCoursePaymentStore(() => disk).get('telegram:10', 5), null)
 }
 const disk=storage(), store=createCoursePaymentStore(() => disk)
 store.set('telegram:0', 5, {status:'waiting', updatedAt:1})
 store.set('telegram:10', -1, {status:'waiting', updatedAt:1})
 assert.equal(disk.data.size, 0)
 assert.match(paymentMessage('waiting').description, /Сервер ещё не подтвердил доступ/)
 assert.doesNotMatch(paymentMessage('failed').description, /не списаны/)
})

test('storage denial preserves in-memory recovery and stable subscribed snapshots', () => {
 const store=createCoursePaymentStore(() => {throw Error('blocked')})
 let calls=0
 const stop=store.subscribe(() => calls++)
 assert.equal(store.get('telegram:10', 5), null)
 store.set('telegram:10', 5, {status:'pending', updatedAt:1})
 assert.equal(store.get('telegram:10', 5), store.get('telegram:10', 5))
 assert.equal(calls, 1)
 stop(); store.set('telegram:10', 5, null)
 assert.equal(calls, 1)
})
