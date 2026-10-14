// Проверка серверной функции без сети: поддельные база и Telegram, настоящая подпись initData.
// Запуск: npm run test:api
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { reset, state } from './fake-supabase.mjs'

const TOKEN = 'test-token'
const SUPABASE_URL = 'https://test-project.supabase.co'
const CHANNEL = -1001
const ADMIN = 1
const BUYER = 2
const OTHER = 3

// --- Окружение Deno и подмена библиотек ---
globalThis.Deno = {
  env: { get: (k) => ({ BOT_TOKEN: TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'test' })[k] },
  serve: (handler) => {
    globalThis.__handler = handler
  },
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('npm:@supabase/supabase-js')) return { url: new URL('./fake-supabase.mjs', import.meta.url).href, shortCircuit: true }
    return next(specifier, context)
  },
})

// --- Поддельный Telegram: записываем вызовы, отвечаем заготовками ---
const calls = []
let replies = {}
globalThis.fetch = async (url, init) => {
  const method = String(url).split('/').pop()
  const payload = JSON.parse(init?.body ?? '{}')
  calls.push({ method, payload })
  const reply = replies[method]
  const result = typeof reply === 'function' ? reply(payload) : reply
  return new Response(JSON.stringify(result ?? { ok: true, result: defaults(method) }))
}
function defaults(method) {
  if (method === 'getChatMember') return { status: 'member' }
  if (method === 'createInvoiceLink') return 'https://t.me/$invoice-test'
  if (method === 'getMe') return { id: 100000001, username: 'test_bot', has_main_web_app: false }
  return true
}
const sent = (method) => calls.filter((c) => c.method === method)

// API_FILE позволяет прогнать те же проверки на другой версии функции.
await import(process.env.API_FILE ? pathToFileURL(resolve(process.env.API_FILE)).href : '../../supabase/functions/api/index.ts')
const handler = globalThis.__handler

// --- Помощники ---
const hmac = (key, msg) => createHmac('sha256', key).update(msg).digest()
function initData(user, { age = 0, tamper = false } = {}) {
  const params = new URLSearchParams({ user: JSON.stringify(user), auth_date: String(Math.floor(Date.now() / 1000) - age) })
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n')
  const hash = hmac(hmac('WebAppData', TOKEN), check).toString('hex')
  if (tamper) params.set('user', JSON.stringify({ ...user, id: user.id + 1 }))
  params.set('hash', hash)
  return params.toString()
}
const person = (id, username) => ({ id, first_name: `User${id}`, username })
const AUTH = { [ADMIN]: initData(person(ADMIN, 'boss')), [BUYER]: initData(person(BUYER, 'ivan_p')), [OTHER]: initData(person(OTHER, 'ivanxp')) }

async function call(route, body = {}, as) {
  const res = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/${route}`, { method: 'POST', body: JSON.stringify({ ...(as ? { auth: AUTH[as] } : {}), ...body }) }))
  return { status: res.status, body: await res.json() }
}
const webhookSecret = hmac('elaz-ed-webhook', TOKEN).toString('hex').slice(0, 48)
async function hook(update, secret = webhookSecret) {
  const res = await handler(
    new Request(`${SUPABASE_URL}/functions/v1/api/webhook`, { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) }),
  )
  return res.status
}
const paidUpdate = (userId, courseId, charge, stars = 500) => ({
  message: { chat: { id: userId, type: 'private' }, from: { id: userId }, successful_payment: { currency: 'XTR', total_amount: stars, invoice_payload: `course:${courseId}:${userId}`, telegram_payment_charge_id: charge } },
})
const access = (userId, courseId) => state.tables.course_access.filter((a) => a.user_id === userId && a.course_id === courseId)

function seed() {
  reset({
    settings: [
      { key: 'channel', value: { id: CHANNEL, title: 'Канал' } },
      { key: 'admins', value: { boss: null } },
      { key: 'bot', value: { username: 'test_bot' } },
      { key: 'app_url', value: 'https://app.example' },
      // Устаревший адрес из старого проекта: вебхук на него ставиться не должен.
      { key: 'api_url', value: 'https://old-project.supabase.co/functions/v1/api' },
    ],
    users: [],
    courses: [
      { id: 1, title: 'Платный курс', subtitle: 'Двадцать уроков', price_stars: 500, invite_unlock: 0, published: true, position: 0 },
      { id: 2, title: 'Курс по заявке', subtitle: '', price_stars: 0, invite_unlock: 0, published: true, position: 1 },
    ],
    lessons: [
      { id: 10, kind: 'lesson', title: 'Закрытый урок', course_id: 1, free_preview: false, published: true, xp: 50, quiz: [] },
      { id: 11, kind: 'lesson', title: 'Пробный урок', course_id: 1, free_preview: true, published: true, xp: 50, quiz: [] },
    ],
    course_access: [],
    access_requests: [],
    payments: [],
    events: [],
    progress: [],
    likes: [],
  })
  calls.length = 0
  replies = {}
}
// Все трое открыли приложение: появились в базе, админ привязался по @username.
async function everyoneBoots() {
  for (const id of [ADMIN, BUYER, OTHER]) assert.equal((await call('boot', {}, id)).body.status, 'ok')
  calls.length = 0
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

// ---------- Вход и роутер ----------

test('без подписи Telegram запрос не проходит', async () => {
  assert.deepEqual(await call('boot'), { status: 401, body: { error: 'no_auth' } })
})

test('подделанные данные пользователя отклоняются', async () => {
  const res = await call('boot', { auth: initData(person(BUYER, 'ivan_p'), { tamper: true }) })
  assert.deepEqual(res, { status: 401, body: { error: 'bad_auth' } })
})

test('подпись старше двух суток не принимается', async () => {
  const res = await call('boot', { auth: initData(person(BUYER, 'ivan_p'), { age: 49 * 3600 }) })
  assert.deepEqual(res, { status: 401, body: { error: 'expired' } })
})

test('встроенные методы объекта не считаются адресами API', async () => {
  for (const route of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.deepEqual(await call(route, { probe: 1 }), { status: 404, body: { error: 'not_found' } }, route)
  }
})

test('админские адреса закрыты для обычного подписчика', async () => {
  await everyoneBoots()
  for (const route of ['admin_list', 'admin_courses', 'admin_payments', 'admin_refund', 'admin_save', 'admin_delete', 'admin_course_save', 'admin_course_delete', 'admin_grant', 'admin_request', 'admin_analytics', 'admin_announce', 'admin_advent_theme']) {
    assert.deepEqual(await call(route, { id: 1 }, BUYER), { status: 403, body: { error: 'forbidden' } }, route)
  }
  assert.equal(state.tables.courses.length, 2)
})

test('человек без подписки на канал получает отказ', async () => {
  await everyoneBoots()
  state.tables.users.find((u) => u.id === BUYER).subscribed = false
  replies.getChatMember = { ok: true, result: { status: 'left' } }
  assert.deepEqual(await call('lesson', { id: 11 }, BUYER), { status: 403, body: { error: 'locked' } })
})

// ---------- Закрытые уроки ----------

test('урок платного курса закрыт без доступа, пробный — открыт', async () => {
  await everyoneBoots()
  assert.deepEqual(await call('lesson', { id: 10 }, BUYER), { status: 403, body: { error: 'course_locked' } })
  assert.deepEqual(await call('complete', { id: 10, answers: [] }, BUYER), { status: 403, body: { error: 'course_locked' } })
  assert.equal((await call('lesson', { id: 11 }, BUYER)).status, 200)
})

// ---------- Счёт и проверка перед оплатой ----------

test('счёт выставляется по цене из базы, а не из запроса', async () => {
  await everyoneBoots()
  const res = await call('course_invoice', { id: 1, price_stars: 1, amount: 1 }, BUYER)
  assert.equal(res.status, 200)
  const [invoice] = sent('createInvoiceLink')
  assert.equal(invoice.payload.currency, 'XTR')
  assert.deepEqual(invoice.payload.prices, [{ label: 'Доступ к курсу', amount: 500 }])
  assert.equal(invoice.payload.payload, `course:1:${BUYER}`)
})

test('курс без цены не продаётся', async () => {
  await everyoneBoots()
  assert.deepEqual(await call('course_invoice', { id: 2 }, BUYER), { status: 400, body: { error: 'not_for_sale' } })
})

test('за уже открытый курс счёт не выставляется', async () => {
  await everyoneBoots()
  state.tables.course_access.push({ user_id: BUYER, course_id: 1, source: 'admin' })
  assert.deepEqual(await call('course_invoice', { id: 1 }, BUYER), { status: 400, body: { error: 'already_open' } })
})

test('вебхук без секрета Telegram отклоняется', async () => {
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1'), 'wrong'), 401)
  assert.equal(state.tables.course_access.length, 0)
})

test('проверка перед оплатой: верный счёт проходит', async () => {
  await everyoneBoots()
  await hook({ pre_checkout_query: { id: 'q1', from: { id: BUYER }, currency: 'XTR', total_amount: 500, invoice_payload: `course:1:${BUYER}` } })
  assert.equal(sent('answerPreCheckoutQuery')[0].payload.ok, true)
})

test('проверка перед оплатой: чужая сумма, чужой счёт и чужая валюта не проходят', async () => {
  await everyoneBoots()
  const bad = [
    { total_amount: 1, invoice_payload: `course:1:${BUYER}`, currency: 'XTR' },
    { total_amount: 500, invoice_payload: `course:1:${OTHER}`, currency: 'XTR' },
    { total_amount: 500, invoice_payload: `course:1:${BUYER}`, currency: 'USD' },
    { total_amount: 0, invoice_payload: `course:2:${BUYER}`, currency: 'XTR' },
    { total_amount: 500, invoice_payload: 'course:1:2;drop', currency: 'XTR' },
  ]
  for (const [i, q] of bad.entries()) await hook({ pre_checkout_query: { id: `q${i}`, from: { id: BUYER }, ...q } })
  assert.deepEqual(sent('answerPreCheckoutQuery').map((c) => c.payload.ok), [false, false, false, false, false])
})

test('проверка перед оплатой: второй раз за открытый курс не берём', async () => {
  await everyoneBoots()
  state.tables.course_access.push({ user_id: BUYER, course_id: 1, source: 'stars' })
  await hook({ pre_checkout_query: { id: 'q1', from: { id: BUYER }, currency: 'XTR', total_amount: 500, invoice_payload: `course:1:${BUYER}` } })
  const [answer] = sent('answerPreCheckoutQuery')
  assert.equal(answer.payload.ok, false)
  assert.match(answer.payload.error_message, /уже открыт/)
})

// ---------- Оплата ----------

test('оплата открывает курс, пишется в журнал и приходит сообщение', async () => {
  await everyoneBoots()
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 200)
  assert.deepEqual(access(BUYER, 1).map((a) => a.source), ['stars'])
  assert.deepEqual(state.tables.payments.map((p) => [p.user_id, p.course_id, p.stars, p.charge_id]), [[BUYER, 1, 500, 'ch-1']])
  assert.equal(sent('sendMessage').length, 1)
  assert.equal((await call('lesson', { id: 10 }, BUYER)).status, 200)
})

test('повторное уведомление об оплате ничего не дублирует', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 200)
  assert.equal(state.tables.payments.length, 1)
  assert.equal(access(BUYER, 1).length, 1)
  assert.equal(sent('sendMessage').length, 1)
})

test('оплата с чужим счётом доступ не выдаёт', async () => {
  await everyoneBoots()
  const update = paidUpdate(BUYER, 1, 'ch-1')
  update.message.from.id = OTHER
  await hook(update)
  assert.equal(state.tables.course_access.length, 0)
  assert.equal(state.tables.payments.length, 0)
})

test('сбой записи оплаты откатывает транзакцию, повторная доставка выдаёт доступ', async () => {
  await everyoneBoots()
  state.failNext = { table: 'payments', op: 'insert' }
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 500)
  assert.equal(access(BUYER, 1).length, 0)
  assert.equal(state.tables.payments.length, 0)
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 200)
  assert.equal(state.tables.payments.length, 1)
  assert.equal(sent('sendMessage').length, 1)
})

test('сбой базы при выдаче доступа: Telegram пришлёт уведомление ещё раз', async () => {
  await everyoneBoots()
  state.failNext = { table: 'course_access', op: 'upsert' }
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 500)
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 200)
  assert.equal(access(BUYER, 1).length, 1)
  assert.equal(state.tables.payments.length, 1)
})

// ---------- Возврат ----------

test('возврат из админки: Telegram возвращает звёзды, доступ закрывается', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  calls.length = 0
  const list = await call('admin_payments', {}, ADMIN)
  assert.deepEqual(list.body.payments.map((p) => [p.username, p.course, p.stars, p.refunded]), [['ivan_p', 'Платный курс', 500, false]])
  assert.deepEqual(await call('admin_refund', { id: list.body.payments[0].id }, ADMIN), { status: 200, body: { ok: true } })
  assert.deepEqual(sent('refundStarPayment')[0].payload, { user_id: BUYER, telegram_payment_charge_id: 'ch-1' })
  assert.equal(access(BUYER, 1).length, 0)
  assert.ok(state.tables.payments[0].refunded_at)
  assert.deepEqual(await call('lesson', { id: 10 }, BUYER), { status: 403, body: { error: 'course_locked' } })
  // Повторный возврат звёзды второй раз не трогает.
  await call('admin_refund', { id: list.body.payments[0].id }, ADMIN)
  assert.equal(sent('refundStarPayment').length, 1)
})

test('если Telegram отказал в возврате, доступ остаётся', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  replies.refundStarPayment = { ok: false, description: 'Bad Request: CHARGE_NOT_FOUND' }
  assert.deepEqual(await call('admin_refund', { id: state.tables.payments[0].id }, ADMIN), { status: 502, body: { error: 'telegram' } })
  assert.equal(access(BUYER, 1).length, 1)
  assert.equal(state.tables.payments[0].refunded_at, null)
})

test('возврат, пришедший от Telegram, закрывает доступ', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  await hook({ message: { chat: { id: BUYER, type: 'private' }, from: { id: BUYER }, refunded_payment: { currency: 'XTR', total_amount: 500, invoice_payload: `course:1:${BUYER}`, telegram_payment_charge_id: 'ch-1' } } })
  assert.equal(access(BUYER, 1).length, 0)
  assert.ok(state.tables.payments[0].refunded_at)
})

test('возврат не отнимает доступ, выданный автором вручную', async () => {
  await everyoneBoots()
  state.tables.course_access.push({ user_id: BUYER, course_id: 1, source: 'admin' })
  state.tables.payments.push({ id: 1, user_id: BUYER, course_id: 1, stars: 500, charge_id: 'ch-1', refunded_at: null })
  await call('admin_refund', { id: 1 }, ADMIN)
  assert.deepEqual(access(BUYER, 1).map((a) => a.source), ['admin'])
})

test('повторное уведомление об оплате после возврата не открывает курс снова', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  await call('admin_refund', { id: state.tables.payments[0].id }, ADMIN)
  assert.equal(await hook(paidUpdate(BUYER, 1, 'ch-1')), 200)
  assert.equal(access(BUYER, 1).length, 0)
  assert.equal(state.tables.payments.length, 1)
})

test('сбой закрытия доступа после возврата исправляется повторной попыткой', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  const id = state.tables.payments[0].id
  replies.refundStarPayment = () => sent('refundStarPayment').length > 1 ? { ok: false, description: 'Bad Request: ALREADY_REFUNDED' } : { ok: true }
  state.failNext = { table: 'course_access', op: 'delete' }
  assert.equal((await call('admin_refund', { id }, ADMIN)).status, 500)
  assert.equal(access(BUYER, 1).length, 1)
  assert.equal((await call('admin_refund', { id }, ADMIN)).status, 200)
  assert.equal(access(BUYER, 1).length, 0)
  assert.equal(sent('refundStarPayment').length, 2)
})

test('сбой записи возврата вызывает повторную доставку вебхука', async () => {
  await everyoneBoots()
  await hook(paidUpdate(BUYER, 1, 'ch-1'))
  const update = { message: { refunded_payment: { telegram_payment_charge_id: 'ch-1' } } }
  state.failNext = { table: 'payments', op: 'update' }
  assert.equal(await hook(update), 500)
  assert.equal(await hook(update), 200)
  assert.equal(access(BUYER, 1).length, 0)
  assert.ok(state.tables.payments[0].refunded_at)
})

// ---------- Заявки и ручной доступ ----------

test('на платный курс бесплатная заявка не принимается', async () => {
  await everyoneBoots()
  assert.deepEqual(await call('course_request', { id: 1 }, BUYER), { status: 400, body: { error: 'paid_only' } })
  assert.equal(state.tables.access_requests.length, 0)
  assert.equal(sent('sendMessage').length, 0)
})

test('повторная заявка не заваливает админа сообщениями', async () => {
  await everyoneBoots()
  await call('course_request', { id: 2 }, BUYER)
  await call('course_request', { id: 2 }, BUYER)
  await call('course_request', { id: 2 }, BUYER)
  assert.equal(sent('sendMessage').length, 1)
  // После отказа попросить ещё раз можно.
  await call('admin_request', { course_id: 2, user_id: BUYER, approve: false }, ADMIN)
  await call('course_request', { id: 2 }, BUYER)
  assert.equal(sent('sendMessage').length, 2)
})

test('кнопку «Открыть доступ» в чате может нажать только админ', async () => {
  await everyoneBoots()
  await hook({ callback_query: { id: 'c1', from: { id: OTHER }, data: `req:a:1:${OTHER}` } })
  assert.equal(state.tables.course_access.length, 0)
  await hook({ callback_query: { id: 'c2', from: { id: ADMIN }, data: `req:a:1:${OTHER}` } })
  assert.equal(access(OTHER, 1).length, 1)
})

test('доступ по @username с подчёркиванием выдаётся именно этому человеку', async () => {
  await everyoneBoots()
  assert.deepEqual(await call('admin_grant', { course_id: 1, username: '@ivan_p' }, ADMIN), { status: 200, body: { name: `User${BUYER}` } })
  assert.equal(access(BUYER, 1).length, 1)
  assert.equal(access(OTHER, 1).length, 0)
  assert.deepEqual(await call('admin_grant', { course_id: 1, username: '%' }, ADMIN), { status: 404, body: { error: 'user_not_found' } })
})

// ---------- Адвент ----------

test('оформление календаря меняет только админ и только на известную тему', async () => {
  await everyoneBoots()
  state.tables.settings.push({ key: 'advent', value: { enabled: false, start: '2026-12-08', days: 24 } })
  assert.deepEqual(await call('admin_advent_theme', { theme: 'halloween' }, BUYER), { status: 403, body: { error: 'forbidden' } })
  assert.deepEqual(await call('admin_advent_theme', { theme: '<script>' }, ADMIN), { status: 400, body: { error: 'bad_theme' } })
  assert.deepEqual(await call('admin_advent_theme', { theme: 'newyear' }, ADMIN), { status: 200, body: { ok: true } })
  const advent = state.tables.settings.find((s) => s.key === 'advent').value
  assert.equal(advent.theme, 'newyear')
  // Остальные настройки адвента не потерялись.
  assert.equal(advent.start, '2026-12-08')
  assert.equal(advent.enabled, false)
})

// ---------- Настройка бота ----------

test('вебхук ставится на адрес своего проекта, а не на адрес из настроек', async () => {
  const res = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/setup`))
  assert.equal(res.status, 200)
  assert.equal(sent('setWebhook')[0].payload.url, `${SUPABASE_URL}/functions/v1/api/webhook`)
  assert.ok(!JSON.stringify(await res.json()).includes(TOKEN))
})

// ---------- Запуск ----------

let failed = 0
for (const { name, fn } of tests) {
  seed()
  try {
    await fn()
    console.log(`  ok  ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL  ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`)
  }
}
console.log(`\n${tests.length - failed} из ${tests.length} проверок прошли`)
process.exit(failed ? 1 : 0)
