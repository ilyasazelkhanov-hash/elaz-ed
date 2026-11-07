import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { openCourseAccess } from '../src/lib/course-checkout.ts'

// Offline: every Telegram, API and UI effect is a recorded fake.
function fakes(overrides = {}) {
  const log = { notes: [], events: [], invoices: [], requests: [], opened: [], celebrated: 0, refreshed: 0 }
  let access = false
  const deps = {
    demo: false, canPay: true,
    confirm: async () => true,
    invoice: async id => { log.invoices.push(id); return 'https://t.me/$fixture-invoice' },
    openInvoice: async link => { log.opened.push(link); access = true; return 'paid' },
    request: async id => { log.requests.push(id) },
    refresh: async () => { log.refreshed++ },
    hasAccess: () => access,
    track: (name, props) => log.events.push({ name, ...props }),
    notify: text => log.notes.push(text),
    celebrate: () => { log.celebrated++ },
    guard: () => {},
    errorText: e => e.message,
    wait: async () => {},
    ...overrides,
  }
  return { deps, log }
}
const paid = { id: 7, price_stars: 250, access: false, request: null }

test('a student buying a priced course gets a Stars invoice, not the hidden legacy course screen', async () => {
  const { deps, log } = fakes()
  assert.equal(await openCourseAccess(paid, deps), 'opened')
  assert.deepEqual(log.invoices, [7])
  assert.deepEqual(log.opened, ['https://t.me/$fixture-invoice'])
  assert.deepEqual(log.events.map(e => e.name + (e.status ? ':' + e.status : '')), ['checkout_start', 'checkout_result:paid'])
  assert.equal(log.celebrated, 1)
  assert.deepEqual(log.notes, ['Курс открыт'])
})

test('OGPractice purchase buttons no longer push the admin-only course overlay', async () => {
  const source = await readFile(new URL('../src/screens/home/OGPractice.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /push\(\{\s*type:\s*'course'/)
  assert.match(source, /openCourseAccess\(course,/)
})

test('cancelled, failed and pending invoices report their status and never claim access', async () => {
  for (const status of ['cancelled', 'failed', 'pending']) {
    const { deps, log } = fakes({ openInvoice: async () => status })
    assert.equal(await openCourseAccess(paid, deps), status)
    assert.equal(log.celebrated, 0)
    assert.equal(log.events.at(-1).status, status)
    assert.equal(log.notes.length, 1)
  }
})

test('paid but not yet granted access tells the student to wait instead of failing', async () => {
  const { deps, log } = fakes({ hasAccess: () => false })
  assert.equal(await openCourseAccess(paid, deps), 'waiting')
  assert.equal(log.refreshed, 8)
  assert.match(log.notes[0], /Оплата прошла/)
})

test('outside Telegram there is no invoice, only a hint', async () => {
  const { deps, log } = fakes({ canPay: false })
  assert.equal(await openCourseAccess(paid, deps), 'unavailable')
  assert.deepEqual(log.invoices, [])
  assert.deepEqual(log.events, [])
})

test('invoice creation errors are reported as a failed checkout with a readable message', async () => {
  const { deps, log } = fakes({ invoice: async () => { throw new Error('Не удалось создать счёт') } })
  assert.equal(await openCourseAccess(paid, deps), 'error')
  assert.deepEqual(log.events.map(e => e.status ?? e.name), ['checkout_start', 'failed'])
  assert.deepEqual(log.notes, ['Не удалось создать счёт'])
})

test('demo asks for consent and opens the course without a real invoice', async () => {
  const declined = fakes({ demo: true, canPay: false, confirm: async () => false })
  assert.equal(await openCourseAccess(paid, declined.deps), 'declined')
  assert.deepEqual(declined.log.invoices, [])
  const accepted = fakes({ demo: true, canPay: false, invoice: async () => null })
  assert.equal(await openCourseAccess(paid, accepted.deps), 'opened')
  assert.equal(accepted.log.refreshed, 1)
})

test('a course without a price sends an access request once', async () => {
  const { deps, log } = fakes()
  assert.equal(await openCourseAccess({ id: 9, price_stars: 0, access: false, request: null }, deps), 'requested')
  assert.deepEqual(log.requests, [9])
  assert.deepEqual(log.invoices, [])
  const again = fakes()
  assert.equal(await openCourseAccess({ id: 9, price_stars: 0, access: false, request: 'pending' }, again.deps), 'already_requested')
  assert.deepEqual(again.log.requests, [])
})

test('an open course and a second tap during checkout do nothing', async () => {
  const { deps, log } = fakes()
  assert.equal(await openCourseAccess({ ...paid, access: true }, deps), 'open')
  let release
  const slow = fakes({ invoice: () => new Promise(resolve => { release = () => resolve(null) }), demo: true })
  const first = openCourseAccess(paid, slow.deps)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(await openCourseAccess(paid, slow.deps), 'busy')
  release()
  await first
  assert.deepEqual(log.invoices, [])
})
