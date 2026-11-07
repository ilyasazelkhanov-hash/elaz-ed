// Offline only: synthetic users/content, in-memory Supabase, no network calls.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { registerHooks } from 'node:module'
import { reset, state } from './fake-supabase.mjs'
import { HttpError, readJson, rateLimit, JSON_BODY_LIMIT, SHARE_BODY_LIMIT, ACADEMY_BODY_LIMIT, ANON_ROUTE_LIMIT, API_USER_LIMIT } from '../../supabase/functions/api/request-guards.ts'

const TOKEN = 'fixture-token', BASE = 'https://fixture.invalid/functions/v1/api'
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()
function auth(id = 2) {
  const params = new URLSearchParams({ user: JSON.stringify({ id, first_name: 'Fixture' }), auth_date: String(Math.floor(Date.now() / 1000)) })
  params.set('hash', hmac(hmac('WebAppData', TOKEN), [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')).toString('hex'))
  return params.toString()
}
let telegramReply, telegramCalls = []
globalThis.Deno = { env: { get: key => ({ BOT_TOKEN: TOKEN, SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture' })[key] }, serve: handler => { globalThis.guardHandler = handler } }
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('npm:@supabase/supabase-js')) return { url: new URL('./fake-supabase.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/api\.telegram\.org\/botfixture-token\//)
  telegramCalls.push({ method: String(url).split('/').at(-1), options })
  if (telegramReply instanceof Error) throw telegramReply
  if (typeof telegramReply === 'function') return await telegramReply(options)
  return new Response(JSON.stringify(telegramReply))
}
await import('../../supabase/functions/api/index.ts')
const handler = globalThis.guardHandler
function seed() {
  reset({ settings: [{ key: 'channel', value: { id: -1001 } }, { key: 'admins', value: {} }],
    users: [2, 3].map(id => ({ id, subscribed: true, sub_checked_at: new Date().toISOString(), first_name: 'Fixture', xp: 0 })),
    lessons: [{ id: 11, title: 'Synthetic fixture', body: 'FIXTURE_ONLY', published: true, kind: 'lesson', course_id: null, quiz: [], xp: 0 }],
    events: [], advent_points: [{ id: 1, name: 'Fixture' }],
  })
  telegramCalls = []
  telegramReply = { ok: true, result: { status: 'member' } }
}
async function call(route, body = {}, headers = {}) {
  const response = await handler(new Request(`${BASE}/${route}`, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }))
  return { status: response.status, body: await response.json(), headers: response.headers }
}
function streamed(chunks, headers = {}, { cancelRejects = false } = {}) {
  let pulled = 0, cancelled = false
  const request = new Request(`${BASE}/redeem_points`, { method: 'POST', headers, duplex: 'half', body: new ReadableStream({
    pull(controller) { if (pulled < chunks.length) controller.enqueue(chunks[pulled++]); else controller.close() },
    cancel() { cancelled = true; if (cancelRejects) return Promise.reject(new Error('fixture cancellation failure')) },
  }, { highWaterMark: 0 }) })
  return { request, pulled: () => pulled, cancelled: () => cancelled }
}
const bytes = value => new TextEncoder().encode(value)
const rejectsCode = (promise, status, code) => assert.rejects(promise, e => e instanceof HttpError && e.status === status && e.code === code)

// These checks exercise the actual stream, not just a Content-Length hint.
test('JSON reader permits exact byte limit, split UTF-8, empty bodies and text/plain', async () => {
  const raw = bytes('{"text":"қазақша"}')
  const stream = streamed([raw.subarray(0, 11), raw.subarray(11)], { 'content-type': 'text/plain' })
  assert.deepEqual(await readJson(stream.request, raw.length), { text: 'қазақша' })
  assert.deepEqual(await readJson(new Request(BASE, { method: 'POST' })), {})
})
// Supabase only delivers a reply once the request body is fully read, so 413 drains first.
test('stream overflow reads the rest of the body before 413, despite missing or false Content-Length', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    const stream = streamed([bytes('{"a":"'), bytes('я'.repeat(30)), bytes('drained')], headers)
    await rejectsCode(readJson(stream.request, 32), 413, 'request_too_large')
    assert.equal(stream.pulled(), 3)
    assert.equal(stream.cancelled(), false)
  }
  const stream = streamed([bytes('x'.repeat(33))], {}, { cancelRejects: true })
  await rejectsCode(readJson(stream.request, 32), 413, 'request_too_large')
})
test('oversized Content-Length drains a bounded body, and cancels one above the drain cap', async () => {
  const bounded = streamed([bytes('x'.repeat(40))], { 'content-length': '40' })
  await rejectsCode(readJson(bounded.request, 32, { drainLimit: 64 }), 413, 'request_too_large')
  assert.equal(bounded.pulled(), 1)
  assert.equal(bounded.cancelled(), false)
  const huge = streamed([bytes('{}')], { 'content-length': '100' })
  await rejectsCode(readJson(huge.request, 32, { drainLimit: 64 }), 413, 'request_too_large')
  assert.equal(huge.pulled(), 0)
  assert.equal(huge.cancelled(), true)
})
test('draining gives up past the size cap or the time cap, still answering 413', async () => {
  const big = streamed([bytes('x'.repeat(40)), bytes('x'.repeat(40)), bytes('x'.repeat(40)), bytes('never')])
  await rejectsCode(readJson(big.request, 32, { drainLimit: 64 }), 413, 'request_too_large')
  assert.equal(big.cancelled(), true)
  assert.ok(big.pulled() < 4)
  let cancelled = false
  const slow = new Request(BASE, { method: 'POST', duplex: 'half', body: new ReadableStream({
    start(controller) { controller.enqueue(bytes('x'.repeat(40))) },
    pull() { return new Promise(() => {}) },
    cancel() { cancelled = true },
  }, { highWaterMark: 0 }) })
  const started = Date.now()
  await rejectsCode(readJson(slow, 32, { drainMs: 50 }), 413, 'request_too_large')
  assert.ok(Date.now() - started < 2000)
  assert.equal(cancelled, true)
})
test('invalid JSON, scalar/array/null and invalid UTF-8 return 400', async () => {
  for (const raw of ['{', 'null', '[]', 'true', '1', '"text"']) await rejectsCode(readJson(new Request(BASE, { method: 'POST', body: raw })), 400, 'invalid_json')
  await rejectsCode(readJson(streamed([new Uint8Array([0xff])]).request), 400, 'invalid_json')
  await rejectsCode(readJson(streamed([bytes('{}')], { 'content-length': '-1' }).request), 400, 'invalid_json')
})
test('ordinary API rejects oversized and malformed bodies before route side effects', async () => {
  seed()
  assert.equal((await call('redeem_points', { padding: 'x'.repeat(2 * 1024 * 1024) })).status, 413)
  assert.deepEqual((await call('redeem_points', '{')).body, { error: 'invalid_json' })
  for (const raw of ['null', '[]', '"text"']) assert.equal((await call('redeem_points', raw)).status, 400)
  assert.equal((await call('redeem_points', {})).status, 200)
})
test('share upload retains the existing 1,300,000-character image allowance', async () => {
  seed()
  const jpeg = Buffer.alloc(975000, 0); jpeg.set([255, 216, 255])
  const image = jpeg.toString('base64')
  assert.equal(image.length, 1300000)
  assert.equal((await call('share_upload', { auth: auth(), image })).status, 200)
  assert.equal(state.uploads[0].size, jpeg.length)
  assert.equal((await call('share_upload', { image: 'x'.repeat(SHARE_BODY_LIMIT) })).status, 413)
})
test('Academy keeps large UTF-8 import payloads but enforces a finite stream cap', async () => {
  seed()
  const response = await call('academy', { auth: auth(), action: 'admin_import', payload: { fixture: '界'.repeat(3_900_000) } })
  assert.equal(response.status, 200) // The downstream mock records, rather than executing, the import.
  assert.equal(state.academyCalls.length, 1)
  assert.equal((await call('academy', { padding: 'x'.repeat(ACADEMY_BODY_LIMIT) })).status, 413)
})
test('one verified user has 120 requests per minute across routes; spoofed IDs and forwarding headers do not change it', async () => {
  seed()
  const signed = auth()
  for (let i = 0; i < API_USER_LIMIT; i++) assert.equal((await call('track', { auth: signed, user_id: i + 100, events: [{ name: 'share' }] }, { 'x-forwarded-for': `spoof-${i}` })).status, 200)
  const response = await call('lesson', { auth: signed, id: 11 }, { 'x-forwarded-for': 'fresh-spoof' })
  assert.equal(response.status, 429)
  assert.deepEqual(response.body, { error: 'rate_limited' })
  assert.equal(response.headers.get('retry-after'), '60')
  assert.equal(response.headers.get('access-control-expose-headers'), 'Retry-After')
  assert.equal(state.tables.events.length, API_USER_LIMIT)
  assert.equal((await call('lesson', { auth: auth(3), id: 11 })).status, 200)
  const row = state.tables.az_rate_limits.find(row => row.key === 'api:user:2')
  row.window_at = Date.now() - 61000
  assert.equal((await call('lesson', { auth: signed, id: 11 })).status, 200)
})
test('invalid signatures cannot consume another user quota', async () => {
  seed()
  const forged = new URLSearchParams(auth()); forged.set('user', JSON.stringify({ id: 3 }))
  assert.equal((await call('boot', { auth: forged.toString() })).status, 401)
  assert.deepEqual(state.tables.az_rate_limits ?? [], [])
})
test('an anonymous flood on signed routes never touches a shared quota or locks out real users', async () => {
  seed()
  for (let i = 0; i < 50; i++) assert.equal((await call('lesson', { id: 11 }, { 'x-forwarded-for': `flood-${i}` })).status, 401)
  assert.deepEqual(state.tables.az_rate_limits ?? [], [])
  assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 200)
})
test('anonymous routes have their own per-route quota, rejected before body reading, isolated from signed users', async () => {
  seed()
  state.tables.az_rate_limits = [{ key: 'api:anon:redeem_points', window_at: Date.now(), count: ANON_ROUTE_LIMIT - 1 }]
  assert.equal((await call('redeem_points')).status, 200)
  const stream = streamed([bytes('{}')], { 'x-forwarded-for': 'new-address' })
  const response = await handler(stream.request)
  assert.equal(response.status, 429)
  assert.equal(stream.pulled(), 0)
  assert.equal((await call('boot', { auth: auth(3) })).status, 200)
  assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 200)
  assert.equal((await call('redeem', { point: 1, pin: '0000' })).status === 429, false)
})
test('rate limiter outage fails closed without application writes or raw backend details', async () => {
  seed()
  state.failNext = { table: 'az_rate_limits', op: 'rpc' }
  const response = await call('track', { auth: auth(), events: [{ name: 'share' }] })
  assert.equal(response.status, 503)
  assert.deepEqual(response.body, { error: 'rate_limit_unavailable' })
  assert.equal(state.tables.events.length, 0)
  for (const result of [{ data: null, error: null }, { data: null, error: new Error('private database detail') }]) await rejectsCode(rateLimit({ rpc: async () => result }, 'fixture', 1), 503, 'rate_limit_unavailable')
  await rejectsCode(rateLimit({ rpc: async () => { throw new Error('private network detail') } }, 'fixture', 1), 503, 'rate_limit_unavailable')
})
test('exhausted public quota does not block authenticated webhook delivery; webhook JSON is bounded', async () => {
  seed()
  state.tables.az_rate_limits = ['redeem', 'redeem_points'].map(route => ({ key: `api:anon:${route}`, window_at: Date.now(), count: ANON_ROUTE_LIMIT }))
  const secret = hmac('elaz-ed-webhook', TOKEN).toString('hex').slice(0, 48)
  assert.equal((await call('webhook', {}, { 'x-telegram-bot-api-secret-token': secret })).status, 200)
  assert.equal((await call('webhook', { padding: 'x'.repeat(JSON_BODY_LIMIT) }, { 'x-telegram-bot-api-secret-token': secret })).status, 413)
  assert.equal((await call('webhook', {}, { 'x-telegram-bot-api-secret-token': 'wrong' })).status, 401)
  assert.equal((await call('payment_refunds')).status, 401)
  assert.equal((await call('learning_reminders')).status, 401)
  assert.equal((await handler(new Request(`${BASE}/boot`, { method: 'OPTIONS' }))).status, 200)
})
test('health has an independent finite quota', async () => {
  seed()
  state.tables.az_rate_limits = [{ key: 'api:health', window_at: Date.now(), count: 120 }]
  assert.equal((await handler(new Request(`${BASE}/health`))).status, 429)
  assert.equal((await call('redeem_points')).status, 200)
})
test('expired, missing, invalid or future membership cache never grants access during Telegram errors', async () => {
  for (const checked of [new Date(Date.now() - 30 * 86400000).toISOString(), null, 'invalid', new Date(Date.now() + 86400000).toISOString()]) {
    seed()
    const user = state.tables.users[0]; user.sub_checked_at = checked
    telegramReply = { ok: false, description: 'temporary outage' }
    const response = await call('lesson', { auth: auth(), id: 11 })
    assert.equal(response.status, 503)
    assert.deepEqual(response.body, { error: 'membership_unavailable' })
    assert.equal(user.subscribed, true)
    assert.equal(user.sub_checked_at, checked)
    assert.equal(telegramCalls.length, 1)
    assert.ok(telegramCalls[0].options.signal instanceof AbortSignal)
  }
})
test('fresh membership cache remains usable; confirmations past the grace period report temporary unavailability', async () => {
  seed()
  telegramReply = { ok: false, description: 'temporary outage' }
  assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 200)
  assert.equal(telegramCalls.length, 0)
  for (const reply of [null, { ok: true }, { ok: true, result: { status: 'unknown' } }, new Error('fixture network failure')]) {
    seed(); telegramReply = reply
    state.tables.users[0].sub_checked_at = new Date(Date.now() - 25 * 3600000).toISOString()
    assert.equal((await call('boot', { auth: auth(), force: true })).status, 503)
  }
})
test('a Telegram outage keeps recently confirmed members in the app instead of taking it down', async () => {
  for (const reply of [{ ok: false, description: 'temporary outage' }, new Error('fixture network failure')]) {
    seed(); telegramReply = reply
    const user = state.tables.users[0], checked = new Date(Date.now() - 3600000).toISOString()
    user.sub_checked_at = checked
    assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 200)
    const booted = await call('boot', { auth: auth(), force: true })
    assert.equal(booted.status, 200)
    assert.notEqual(booted.body.status, 'locked')
    assert.equal(user.subscribed, true)
    assert.equal(user.sub_checked_at, checked)
  }
})
test('a Telegram outage keeps unsubscribed users on the gate, not on an error screen', async () => {
  seed()
  telegramReply = { ok: false, description: 'temporary outage' }
  const user = state.tables.users[0]
  user.subscribed = false; user.sub_checked_at = new Date(Date.now() - 3600000).toISOString()
  const booted = await call('boot', { auth: auth() })
  assert.equal(booted.status, 200)
  assert.equal(booted.body.status, 'locked')
  assert.deepEqual((await call('lesson', { auth: auth(), id: 11 })).body, { error: 'locked' })
  assert.equal(user.subscribed, false)
})
test('confirmed membership refreshes access; confirmed departure still revokes it', async () => {
  seed()
  state.tables.users[0].sub_checked_at = new Date(Date.now() - 30 * 86400000).toISOString()
  assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 200)
  assert.ok(Date.now() - Date.parse(state.tables.users[0].sub_checked_at) < 1000)
  state.tables.users[0].sub_checked_at = new Date(Date.now() - 3600000).toISOString()
  telegramReply = { ok: true, result: { status: 'left' } }
  assert.equal((await call('lesson', { auth: auth(), id: 11 })).status, 403)
  assert.equal(state.tables.users[0].subscribed, false)
})

test('forced refresh cannot extend a grace period that ends during the Telegram request', async () => {
  seed()
  const realNow = Date.now, started = realNow()
  state.tables.users[0].sub_checked_at = new Date(started - (24 * 3600000 - 1000)).toISOString()
  const signed = auth()
  telegramReply = async () => {
    Date.now = () => started + 5000
    return new Response(JSON.stringify({ ok: false, description: 'fixture timeout' }))
  }
  try { assert.equal((await call('boot', { auth: signed, force: true })).status, 503) }
  finally { Date.now = realNow }
})
test('hanging Telegram mock aborts after five seconds and access past the grace period stays closed', { timeout: 8000 }, async () => {
  seed()
  state.tables.users[0].sub_checked_at = new Date(Date.now() - 25 * 3600000).toISOString()
  let aborted = false
  telegramReply = ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) }, { once: true })
  })
  // AbortSignal.timeout is unref'ed in Node; keep this isolated test process alive.
  const keepAlive = setTimeout(() => {}, 7000)
  try {
    const response = await call('lesson', { auth: auth(), id: 11 })
    assert.equal(aborted, true)
    assert.equal(response.status, 503)
    assert.deepEqual(response.body, { error: 'membership_unavailable' })
    assert.equal(state.tables.users[0].subscribed, true)
  } finally { clearTimeout(keepAlive) }
})
