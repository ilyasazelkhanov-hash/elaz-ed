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
  for (const route of ['admin_list', 'admin_courses', 'admin_payments', 'admin_refund', 'admin_save', 'admin_delete', 'admin_course_save', 'admin_course_delete', 'admin_grant', 'admin_request', 'admin_analytics', 'admin_announce', 'admin_advent_theme', 'admin_advent_save', 'admin_advent_reward_save', 'admin_advent_reward_delete', 'admin_advent_pulse', 'admin_advent_winners', 'admin_advent_ticket_grant', 'admin_advent_points', 'admin_advent_point_save', 'admin_advent_point_delete']) {
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

// ---------- Адвент: билеты «догнать» и призы ----------

const DAY = 86_400_000
// Сегодня — пятый день кампании по поясу календаря (UTC+5).
const campaignStart = () => new Date(Date.now() + 300 * 60_000 - 4 * DAY).toISOString().slice(0, 10)
// Функция кэширует настройки на 15 секунд — сдвигаем часы, чтобы она перечитала их после правки.
const realNow = Date.now
let skew = 0
Date.now = () => realNow() + skew
function adventOn(extra = {}) {
  skew += 20_000
  state.tables.settings.push({ key: 'advent', value: { enabled: true, start: campaignStart(), days: 10, tz: 300, grace: 3, catchup: { methods: ['quiz', 'invite', 'story', 'stars'], stars: 50 }, ...extra } })
  state.tables.advent_doors = Array.from({ length: 10 }, (_, i) => ({ day: i + 1, kind: 'story', title: `Дверь ${i + 1}`, emoji: '🎁', xp: 30, quiz: [], body: 'текст', prize: '' }))
  state.tables.advent_opens = []
  state.tables.advent_tickets = []
  state.tables.advent_rewards = []
  state.tables.reward_codes = []
  state.tables.lesson_access = []
}
const tickets = (id) => state.tables.advent_tickets.filter((t) => t.user_id === id)

test('пропущенную дверь без билета не открыть, сегодняшнюю — можно', async () => {
  await everyoneBoots()
  adventOn()
  assert.deepEqual(await call('advent_open', { day: 2 }, BUYER), { status: 402, body: { error: 'need_ticket' } })
  assert.equal((await call('advent_open', { day: 5 }, BUYER)).status, 200)
  assert.equal(state.tables.advent_opens.length, 1)
})

test('урок с квизом без ошибок даёт билет, им открывается одна пропущенная дверь', async () => {
  await everyoneBoots()
  adventOn()
  const now = new Date().toISOString()
  state.tables.progress.push({ user_id: BUYER, lesson_id: 11, score: 3, total: 3, completed_at: now })
  // С ошибками и без квиза — не считается.
  state.tables.progress.push({ user_id: BUYER, lesson_id: 12, score: 2, total: 3, completed_at: now }, { user_id: BUYER, lesson_id: 13, score: 0, total: 0, completed_at: now })
  const state1 = await call('advent', {}, BUYER)
  assert.equal(state1.body.catchup.tickets, 1)
  assert.equal((await call('advent_open', { day: 2 }, BUYER)).status, 200)
  assert.equal(state.tables.advent_opens.find((o) => o.day === 2).late, true)
  assert.deepEqual(await call('advent_open', { day: 3 }, BUYER), { status: 402, body: { error: 'need_ticket' } })
  // Повторный запрос состояния не начисляет билет за тот же урок второй раз.
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
  assert.equal(tickets(BUYER).length, 1)
})

test('урок, пройденный до старта календаря, билет не даёт', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.progress.push({ user_id: BUYER, lesson_id: 11, score: 3, total: 3, completed_at: new Date(Date.now() - 30 * DAY).toISOString() })
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
})

test('приглашённый друг даёт билет, только когда прошёл проверку подписки', async () => {
  await everyoneBoots()
  adventOn()
  const now = new Date().toISOString()
  state.tables.users.push({ id: 50, first_name: 'Друг', referred_by: BUYER, ref_rewarded: false, created_at: now, subscribed: false, xp: 0 })
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
  state.tables.users.find((u) => u.id === 50).ref_rewarded = true
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 1)
})

test('переход по ссылке из сторис: билет автору, не себе и не дважды от одного человека', async () => {
  await everyoneBoots()
  adventOn()
  calls.length = 0
  await call('boot', { sp: `st${BUYER}` }, OTHER)
  await call('boot', { sp: `st${BUYER}` }, OTHER)
  await call('boot', { sp: `st${BUYER}` }, BUYER)
  assert.deepEqual(tickets(BUYER).map((t) => t.source), ['story'])
  assert.equal(sent('sendMessage').filter((c) => c.payload.chat_id === BUYER).length, 1)
})

test('способ, выключенный в настройках, билетов не даёт', async () => {
  await everyoneBoots()
  adventOn({ catchup: { methods: ['stars'], stars: 50 } })
  state.tables.progress.push({ user_id: BUYER, lesson_id: 11, score: 3, total: 3, completed_at: new Date().toISOString() })
  await call('boot', { sp: `st${BUYER}` }, OTHER)
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
})

test('билет за звёзды: цена из настроек, повтор уведомления и возврат', async () => {
  await everyoneBoots()
  adventOn()
  calls.length = 0
  assert.equal((await call('advent_ticket_invoice', {}, BUYER)).status, 200)
  const inv = sent('createInvoiceLink')[0].payload
  assert.deepEqual(inv.prices, [{ label: 'Билет', amount: 50 }])
  await hook({ pre_checkout_query: { id: 'q1', from: { id: BUYER }, currency: 'XTR', total_amount: 50, invoice_payload: inv.payload } })
  await hook({ pre_checkout_query: { id: 'q2', from: { id: BUYER }, currency: 'XTR', total_amount: 1, invoice_payload: inv.payload } })
  await hook({ pre_checkout_query: { id: 'q3', from: { id: OTHER }, currency: 'XTR', total_amount: 50, invoice_payload: inv.payload } })
  assert.deepEqual(sent('answerPreCheckoutQuery').map((c) => c.payload.ok), [true, false, false])
  const paid = { message: { chat: { id: BUYER, type: 'private' }, from: { id: BUYER }, successful_payment: { currency: 'XTR', total_amount: 50, invoice_payload: inv.payload, telegram_payment_charge_id: 'tk-1' } } }
  assert.equal(await hook(paid), 200)
  assert.equal(await hook(paid), 200)
  assert.deepEqual(tickets(BUYER).map((t) => t.source), ['stars'])
  assert.equal(state.tables.payments.length, 1)
  assert.equal(state.tables.payments[0].purpose, 'catchup')
  // Возврат: неиспользованный билет отзывается, повтор уведомления его не возвращает.
  const pay = (await call('admin_payments', {}, ADMIN)).body.payments[0]
  assert.equal(pay.course, 'Билет календаря')
  await call('admin_refund', { id: pay.id }, ADMIN)
  assert.ok(tickets(BUYER)[0].revoked_at)
  await hook(paid)
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
  assert.equal(state.tables.course_access.length, 0)
})

test('возврат звёзд за уже потраченный билет дверь не закрывает', async () => {
  await everyoneBoots()
  adventOn()
  const paid = { message: { chat: { id: BUYER, type: 'private' }, from: { id: BUYER }, successful_payment: { currency: 'XTR', total_amount: 50, invoice_payload: `catchup:${BUYER}:1`, telegram_payment_charge_id: 'tk-2' } } }
  await hook(paid)
  assert.equal((await call('advent_open', { day: 1 }, BUYER)).status, 200)
  await call('admin_refund', { id: state.tables.payments[0].id }, ADMIN)
  assert.equal(tickets(BUYER)[0].revoked_at ?? null, null)
  assert.ok(state.tables.advent_opens.some((o) => o.user_id === BUYER && o.day === 1))
})

test('призы: код, сообщение, урок и курс выдаются по порогу; содержимое скрыто до выдачи', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_rewards = [
    { id: 1, doors: 1, title: 'Промокод', description: '', emoji: '🎟', stock: null, position: 0, kind: 'promo', payload: {} },
    { id: 2, doors: 1, title: 'Секрет', description: '', emoji: '💬', stock: null, position: 0, kind: 'message', payload: { text: 'Тайное слово' } },
    { id: 3, doors: 1, title: 'Урок', description: '', emoji: '📚', stock: null, position: 0, kind: 'lesson', payload: { lesson_id: 10 } },
    { id: 4, doors: 2, title: 'Курс', description: '', emoji: '🎓', stock: null, position: 0, kind: 'course', payload: { course_id: 1 } },
  ]
  const before = (await call('advent', {}, BUYER)).body.rewards
  assert.ok(before.every((r) => !r.issued && r.content === null && r.code === null))
  assert.deepEqual(await call('lesson', { id: 10 }, BUYER), { status: 403, body: { error: 'course_locked' } })
  const res = await call('advent_open', { day: 5 }, BUYER)
  assert.deepEqual(res.body.new_codes.map((c) => c.kind).sort(), ['lesson', 'message', 'promo'])
  const after = (await call('advent', {}, BUYER)).body.rewards
  assert.match(after.find((r) => r.id === 1).code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  assert.deepEqual(after.find((r) => r.id === 2).content, { text: 'Тайное слово' })
  assert.equal(after.find((r) => r.id === 2).code, null)
  // Урок призом открыт, а весь курс — ещё нет.
  assert.equal((await call('lesson', { id: 10 }, BUYER)).status, 200)
  assert.equal(access(BUYER, 1).length, 0)
  assert.equal(after.find((r) => r.id === 4).issued, false)
})

test('приз «курс» открывает курс после нужного числа дверей', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_rewards = [{ id: 4, doors: 1, title: 'Курс', description: '', emoji: '🎓', stock: null, position: 0, kind: 'course', payload: { course_id: 1 } }]
  await call('advent_open', { day: 5 }, BUYER)
  assert.deepEqual(access(BUYER, 1).map((a) => a.source), ['advent'])
})

test('админ: приз с пустой ссылкой или чужим уроком не сохраняется, выданный — не удаляется', async () => {
  await everyoneBoots()
  adventOn()
  const bad = [
    { title: 'Видео', kind: 'video', doors: 2, payload: { url: 'javascript:alert(1)' } },
    { title: 'Ссылка', kind: 'link', doors: 2, payload: { url: '' } },
    { title: 'Урок', kind: 'lesson', doors: 2, payload: { lesson_id: 999 } },
    { title: 'Сообщение', kind: 'message', doors: 2, payload: { text: '   ' } },
  ]
  for (const reward of bad) assert.deepEqual(await call('admin_advent_reward_save', { reward }, ADMIN), { status: 400, body: { error: 'reward_payload' } }, reward.kind)
  const ok = await call('admin_advent_reward_save', { reward: { title: 'Видео', kind: 'video', doors: 1, stock: 5, payload: { url: 'https://youtu.be/abcdefghijk' } } }, ADMIN)
  assert.equal(ok.status, 200)
  assert.equal(ok.body.stock, 5)
  assert.deepEqual((await call('admin_advent_reward_save', { reward: { title: 'x', kind: 'promo' } }, BUYER)).status, 403)
  await call('advent_open', { day: 5 }, BUYER)
  assert.deepEqual(await call('admin_advent_reward_delete', { id: ok.body.id }, ADMIN), { status: 409, body: { error: 'reward_issued' } })
})

test('админ: настройки календаря — дни, способы и цена билета, тема и старт сохраняются', async () => {
  await everyoneBoots()
  adventOn({ theme: 'halloween' })
  const r = await call('admin_advent_save', { settings: { days: 14, catchup: { methods: ['quiz', 'hack'], stars: 75 } } }, ADMIN)
  assert.equal(r.status, 200)
  const a = state.tables.settings.find((s) => s.key === 'advent').value
  assert.equal(a.days, 14)
  assert.deepEqual(a.catchup, { methods: ['quiz'], stars: 75 })
  assert.equal(a.theme, 'halloween')
  assert.equal(a.start, campaignStart())
  assert.deepEqual(await call('admin_advent_save', { settings: { start: '14.10.2026' } }, ADMIN), { status: 400, body: { error: 'bad_date' } })
})

// ---------- Адвент: режимы выдачи призов и двери ----------

const reward = (over) => ({ id: 1, doors: 1, title: 'Приз', description: '', emoji: '🎁', stock: null, position: 0, kind: 'promo', payload: {}, mode: 'threshold', day_from: null, day_to: null, drawn_at: null, ...over })
const winners = (id) => state.tables.reward_codes.filter((c) => c.reward_id === id).map((c) => c.user_id)

test('подарок дня: достаётся открывшим дверь своего окна, пока не кончится лимит', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_rewards = [reward({ mode: 'day', day_from: 5, day_to: 5, stock: 2 })]
  state.tables.users.push({ id: 60, first_name: 'Четвёртый', username: 'u60', subscribed: true, sub_checked_at: new Date(Date.now() + 9e9).toISOString(), xp: 0 })
  // Окно — только пятый день: шестой день тут ни при чём, а четвёртый открывают за билет.
  for (const id of [BUYER, OTHER, ADMIN]) await call('advent_open', { day: 5 }, id)
  assert.deepEqual(winners(1).sort(), [BUYER, OTHER].sort())
})

test('мгновенный выигрыш: в последний день окна разыгрывается всё, что осталось, но не больше лимита', async () => {
  await everyoneBoots()
  adventOn()
  // Окно закончилось сегодня (5-й день) — шанс 100%, пока есть призы.
  state.tables.advent_rewards = [reward({ mode: 'instant', day_from: 1, day_to: 5, stock: 2 })]
  for (const id of [BUYER, OTHER, ADMIN]) await call('advent_open', { day: 5 }, id)
  assert.equal(winners(1).length, 2)
})

test('мгновенный выигрыш в начале длинного окна выпадает не всем', async () => {
  await everyoneBoots()
  adventOn({ days: 30 })
  state.tables.advent_doors = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, kind: 'story', title: `Дверь ${i + 1}`, emoji: '🎁', xp: 30, quiz: [], body: '', prize: '' }))
  // Сотня открытий уже была: темп высокий, впереди ещё 25 дней — шанс маленький.
  for (let u = 0; u < 100; u++) state.tables.advent_opens.push({ user_id: 1000 + u, day: 1 + (u % 5), score: 0, total: 0, xp: 0, late: false })
  state.tables.advent_rewards = [reward({ mode: 'instant', day_from: 1, day_to: 30, stock: 3 })]
  for (const id of [BUYER, OTHER, ADMIN]) await call('advent_open', { day: 5 }, id)
  assert.ok(winners(1).length < 3)
})

test('розыгрыш: проходит после окна, ровно по лимиту, разным людям; до окна — нет', async () => {
  await everyoneBoots()
  adventOn()
  // Окно 1–3 закончилось, окно 1–7 — ещё нет.
  for (const [uid, days] of [[BUYER, [1, 2, 3]], [OTHER, [2]], [ADMIN, [1, 3]]]) for (const d of days) state.tables.advent_opens.push({ user_id: uid, day: d, score: 0, total: 0, xp: 0, late: false })
  state.tables.advent_rewards = [reward({ id: 1, mode: 'draw', day_from: 1, day_to: 3, stock: 2 }), reward({ id: 2, mode: 'draw', day_from: 1, day_to: 7, stock: 1 })]
  calls.length = 0
  const st = (await call('advent', {}, BUYER)).body
  assert.equal(winners(1).length, 2)
  assert.equal(new Set(winners(1)).size, 2)
  assert.equal(winners(2).length, 0)
  assert.ok(state.tables.advent_rewards[0].drawn_at)
  assert.equal(sent('sendMessage').length, 2)
  // Шансы в незакончившемся розыгрыше — число открытых дверей окна.
  assert.equal(st.rewards.find((r) => r.id === 2).entries, 3)
  // Повторный заход розыгрыш не повторяет.
  await call('advent', {}, OTHER)
  assert.equal(winners(1).length, 2)
})

test('розыгрыш вручную: только админ и только один раз', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_opens.push({ user_id: BUYER, day: 1, score: 0, total: 0, xp: 0, late: false })
  state.tables.advent_rewards = [reward({ mode: 'draw', day_from: 1, day_to: 9, stock: 5 })]
  assert.deepEqual(await call('admin_advent_draw', { id: 1 }, BUYER), { status: 403, body: { error: 'forbidden' } })
  assert.deepEqual(await call('admin_advent_draw', { id: 1 }, ADMIN), { status: 200, body: { winners: 1 } })
  assert.deepEqual(await call('admin_advent_draw', { id: 1 }, ADMIN), { status: 409, body: { error: 'already_drawn' } })
})

test('приз «за N дверей» по-прежнему выдаётся по порогу', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_rewards = [reward({ doors: 1 })]
  await call('advent_open', { day: 5 }, BUYER)
  assert.deepEqual(winners(1), [BUYER])
})

test('админ: розыгрыш и мгновенный приз без лимита и с перевёрнутым окном не сохраняются', async () => {
  await everyoneBoots()
  adventOn()
  assert.deepEqual(await call('admin_advent_reward_save', { reward: { title: 'x', mode: 'draw', day_from: 1, day_to: 7 } }, ADMIN), { status: 400, body: { error: 'stock_required' } })
  assert.deepEqual(await call('admin_advent_reward_save', { reward: { title: 'x', mode: 'day', day_from: 7, day_to: 2 } }, ADMIN), { status: 400, body: { error: 'bad_window' } })
  const ok = await call('admin_advent_reward_save', { reward: { title: 'x', mode: 'instant', day_from: 1, day_to: 24, stock: 13 } }, ADMIN)
  assert.equal(ok.status, 200)
  assert.deepEqual([ok.body.mode, ok.body.day_from, ok.body.day_to, ok.body.stock], ['instant', 1, 24, 13])
})

test('админ: дверь сохраняется с проверкой, открытую дверь удалить нельзя', async () => {
  await everyoneBoots()
  adventOn()
  assert.deepEqual(await call('admin_advent_door_save', { door: { day: 11, kind: 'quiz', title: 'Квиз', quiz: [] } }, ADMIN), { status: 400, body: { error: 'quiz_required' } })
  assert.deepEqual(await call('admin_advent_door_save', { door: { day: 11, kind: 'scratch', title: 'Скретч' } }, ADMIN), { status: 400, body: { error: 'prize_required' } })
  const saved = await call('admin_advent_door_save', { door: { day: 11, kind: 'quiz', title: 'Квиз', xp: 9999, quiz: [{ q: 'Вопрос?', options: ['Да', 'Нет'], correct: 7 }] } }, ADMIN)
  assert.equal(saved.status, 200)
  assert.equal(saved.body.xp, 500)
  assert.equal(saved.body.quiz[0].correct, 1)
  assert.equal((await call('admin_advent_doors', {}, ADMIN)).body.doors.length, 11)
  assert.deepEqual(await call('admin_advent_door_save', { door: { day: 12, title: 'x' } }, BUYER), { status: 403, body: { error: 'forbidden' } })
  await call('advent_open', { day: 5 }, BUYER)
  assert.deepEqual(await call('admin_advent_door_delete', { day: 5 }, ADMIN), { status: 409, body: { error: 'door_opened' } })
  assert.deepEqual(await call('admin_advent_door_delete', { day: 11 }, ADMIN), { status: 200, body: { ok: true } })
})

// ---------- Адвент: ход календаря, журнал призов, точки погашения ----------

test('точка погашения: PIN хранится хешем, по новому PIN касса гасит код, повторно — нет', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_points = []
  assert.deepEqual(await call('admin_advent_point_save', { name: 'Касса', pin: '12' }, ADMIN), { status: 400, body: { error: 'bad_pin_format' } })
  const { body } = await call('admin_advent_point_save', { name: 'Касса 1', pin: '482913' }, ADMIN)
  const point = state.tables.advent_points[0]
  assert.equal(point.id, body.id)
  assert.ok(!JSON.stringify(point).includes('482913'))
  state.tables.advent_rewards = [reward({ doors: 1 })]
  await call('advent_open', { day: 5 }, BUYER)
  const code = state.tables.reward_codes[0].code
  const cashier = (pin) => handler(new Request(`${SUPABASE_URL}/functions/v1/api/redeem`, { method: 'POST', body: JSON.stringify({ point: point.id, pin, code }) })).then((r) => r.status)
  assert.equal(await cashier('000000'), 403)
  // Погашение делает SQL-функция redeem_code — здесь проверяем, что PIN принят.
  state.tables.reward_codes[0].status = 'issued'
  assert.notEqual(await cashier('482913'), 403)
})

test('точку с погашениями удалить нельзя, пустую — можно', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_points = [{ id: 1, name: 'A', pin_hash: 'x', fails: 0, locked_until: null }, { id: 2, name: 'B', pin_hash: 'x', fails: 0, locked_until: null }]
  state.tables.reward_codes = [{ code: 'AAAA-AAAA', user_id: BUYER, reward_id: 1, status: 'redeemed', point_id: 1 }]
  assert.deepEqual(await call('admin_advent_point_delete', { id: 1 }, ADMIN), { status: 409, body: { error: 'point_used' } })
  assert.deepEqual(await call('admin_advent_point_delete', { id: 2 }, ADMIN), { status: 200, body: { ok: true } })
  const list = (await call('admin_advent_points', {}, ADMIN)).body.points
  assert.deepEqual(list.map((p) => [p.name, p.redeemed]), [['A', 1]])
})

test('журнал «кто что получил»: человек, приз, код и точка погашения', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.advent_points = [{ id: 1, name: 'Касса 1' }]
  state.tables.advent_rewards = [reward({ id: 1, title: 'Промокод' }), reward({ id: 2, title: 'Курс', kind: 'course', payload: { course_id: 1 } })]
  state.tables.reward_codes = [
    { code: 'AAAA-AAAA', user_id: BUYER, reward_id: 1, status: 'redeemed', point_id: 1, issued_at: '2026-12-08T10:00:00Z', redeemed_at: '2026-12-09T10:00:00Z' },
    { code: 'BBBB-BBBB', user_id: OTHER, reward_id: 2, status: 'issued', point_id: null, issued_at: '2026-12-09T10:00:00Z' },
  ]
  const all = (await call('admin_advent_winners', {}, ADMIN)).body.winners
  assert.deepEqual(all.map((w) => [w.username, w.reward, w.status, w.point]).sort(), [['ivan_p', 'Промокод', 'redeemed', 'Касса 1'], ['ivanxp', 'Курс', 'issued', null]].sort())
  const one = (await call('admin_advent_winners', { reward_id: 2 }, ADMIN)).body.winners
  assert.deepEqual(one.map((w) => w.username), ['ivanxp'])
})

test('ручной билет: админ выдаёт по @username, человеку приходит сообщение', async () => {
  await everyoneBoots()
  adventOn()
  calls.length = 0
  assert.deepEqual(await call('admin_advent_ticket_grant', { username: '@ivan_p', count: 2 }, ADMIN), { status: 200, body: { name: `User${BUYER}`, count: 2 } })
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 2)
  assert.equal(sent('sendMessage').filter((c) => c.payload.chat_id === BUYER).length, 1)
  assert.deepEqual(await call('admin_advent_ticket_grant', { username: 'nobody' }, ADMIN), { status: 404, body: { error: 'user_not_found' } })
})

test('ход календаря: нажатия «догнать», билеты по источникам и темп случайных призов', async () => {
  await everyoneBoots()
  adventOn()
  await call('track', { events: [{ name: 'catchup', props: { step: 'open' } }, { name: 'catchup', props: { step: 'try', method: 'stars' } }, { name: 'catchup', props: { step: 'try', method: 'stars' } }] }, BUYER)
  await call('track', { events: [{ name: 'catchup', props: { step: 'open' } }] }, OTHER)
  state.tables.advent_tickets.push({ user_id: BUYER, source: 'quiz', ref: 'q1', used_at: '2026-12-08' }, { user_id: BUYER, source: 'stars', ref: 's1', revoked_at: '2026-12-09' })
  state.tables.advent_rewards = [reward({ id: 1, mode: 'instant', day_from: 1, day_to: 10, stock: 20 })]
  const p = (await call('admin_advent_pulse', {}, ADMIN)).body
  assert.equal(p.today, 5)
  assert.equal(p.catchup.sheet_users, 2)
  assert.deepEqual(p.catchup.tries, { stars: 2 })
  assert.deepEqual(p.catchup.sources.quiz, { earned: 1, used: 1, revoked: 0 })
  assert.deepEqual(p.catchup.sources.stars, { earned: 0, used: 0, revoked: 1 })
  // 5-й день из 10 — к сегодняшнему дню ожидается половина лимита.
  assert.equal(p.pacing[0].expected, 10)
})

// ---------- Настройка бота ----------

test('вебхук ставится на адрес своего проекта, а не на адрес из настроек', async () => {
  const res = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/setup`))
  assert.equal(res.status, 200)
  assert.equal(sent('setWebhook')[0].payload.url, `${SUPABASE_URL}/functions/v1/api/webhook`)
  assert.ok(!JSON.stringify(await res.json()).includes(TOKEN))
})

test('напоминание о двери: утренний пуш с подсказкой и вечернее напоминание', async () => {
  await everyoneBoots()
  adventOn()
  state.tables.settings.push({ key: 'cron_key', value: 'secret-cron' })
  calls.length = 0

  // Без ключа — 401
  const bad = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/advent_push`, { method: 'POST' }))
  assert.equal(bad.status, 401)

  // Утренний пуш
  const res = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/advent_push`, {
    method: 'POST',
    headers: { 'x-cron-key': 'secret-cron' },
    body: JSON.stringify({ type: 'morning' }),
  }))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.day, 5)

  // Сообщение содержит HTML и кнопку
  const msgs = sent('sendMessage')
  assert.ok(msgs.length > 0)
  assert.equal(msgs[0].payload.parse_mode, 'HTML')
  assert.match(msgs[0].payload.text, /Адвент-календарь: Дверь №5 открыта/)
  assert.ok(msgs[0].payload.reply_markup.inline_keyboard[0][0].web_app.url.includes('sp=advent'))

  // Повторный вызов в тот же день — already_completed
  calls.length = 0
  const again = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/advent_push`, {
    method: 'POST',
    headers: { 'x-cron-key': 'secret-cron' },
  }))
  assert.equal((await again.json()).reason, 'already_completed')
  assert.equal(sent('sendMessage').length, 0)

  // Вечерний пуш
  const eve = await handler(new Request(`${SUPABASE_URL}/functions/v1/api/advent_push`, {
    method: 'POST',
    headers: { 'x-cron-key': 'secret-cron' },
    body: JSON.stringify({ type: 'evening' }),
  }))
  assert.equal(eve.status, 200)
  const eveMsgs = sent('sendMessage')
  assert.ok(eveMsgs.length > 0)
  assert.match(eveMsgs[0].payload.text, /закроется через несколько часов/)
})

// ---------- Ordinary lesson quizzes: answer keys stay private until committed ----------
function quizLesson() {
  const questions = [
    { q: 'First?', options: ['No', 'Yes'], correct: 1, explain: 'First explanation' },
    { q: 'Second?', options: ['Yes', 'No'], correct: 0, explain: 'Second explanation' },
    { q: 'Third?', options: ['No', 'Yes'], correct: 1, explain: 'Third explanation' },
  ]
  state.tables.lessons.push({ id: 20, kind: 'lesson', title: 'Secure quiz', course_id: null, published: true, xp: 50, quiz: questions })
  return questions
}

test('ordinary public lesson never reveals answer keys or explanations, including completed practice', async () => {
  await everyoneBoots()
  quizLesson()
  for (const completed of [false, true]) {
    if (completed) state.tables.progress.push({ user_id: BUYER, lesson_id: 20, score: 1, total: 3 })
    const res = await call('lesson', { id: 20 }, BUYER)
    assert.equal(res.status, 200)
    for (const question of res.body.quiz) {
      assert.equal(Object.hasOwn(question, 'correct'), false)
      assert.equal(Object.hasOwn(question, 'explain'), false)
    }
  }
})

test('old direct forged perfect answers cannot create progress, XP or catchup tickets', async () => {
  await everyoneBoots()
  quizLesson()
  const xp = state.tables.users.find(u => u.id === BUYER).xp ?? 0
  const res = await call('complete', { id: 20, answers: [1, 0, 1] }, BUYER)
  assert.deepEqual(res, { status: 409, body: { error: 'quiz_required' } })
  assert.equal(state.tables.progress.length, 0)
  assert.equal(state.tables.users.find(u => u.id === BUYER).xp ?? 0, xp)
  adventOn()
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
})

test('reward attempt resumes and locks each answer before any feedback; sequence and actor enforced', async () => {
  await everyoneBoots()
  quizLesson()
  const start = await call('quiz_start', { id: 20, practice: true }, BUYER)
  assert.equal(start.status, 200)
  assert.equal(start.body.practice, false)
  assert.equal(start.body.questions[0].correct, undefined)
  assert.equal(start.body.questions[0].explain, undefined)
  const attemptId = start.body.attemptId
  assert.equal((await call('quiz_start', { id: 20 }, BUYER)).body.attemptId, attemptId)
  assert.equal((await call('quiz_answer', { attemptId, index: 1, answer: 0 }, BUYER)).body.error, 'quiz_sequence')
  assert.equal((await call('quiz_answer', { attemptId, index: 0, answer: 1 }, OTHER)).status, 404)
  const first = await call('quiz_answer', { attemptId, index: 0, answer: 0 }, BUYER)
  assert.equal(first.status, 200)
  assert.equal(first.body.correct, false)
  assert.equal(first.body.correctIndex, 1)
  assert.equal(first.body.explain, 'First explanation')
  assert.equal((await call('quiz_answer', { attemptId, index: 0, answer: 1 }, BUYER)).body.error, 'quiz_answer_locked')
  assert.deepEqual((await call('quiz_answer', { attemptId, index: 0, answer: 0 }, BUYER)).body, first.body)
  const resumed = await call('quiz_start', { id: 20 }, BUYER)
  assert.deepEqual(resumed.body.answers, [0])
  assert.equal(resumed.body.feedback.length, 1)
  assert.equal(resumed.body.questions[1].correct, undefined)
  assert.equal((await call('complete', { id: 20, answers: [1, 0, 1], attemptId }, BUYER)).body.error, 'quiz_required')
})

test('completion derives score/combo from immutable snapshot and rewards only once', async () => {
  await everyoneBoots()
  quizLesson()
  const attemptId = (await call('quiz_start', { id: 20 }, BUYER)).body.attemptId
  for (const [index, answer] of [1, 0, 1].entries()) {
    const res = await call('quiz_answer', { attemptId, index, answer }, BUYER)
    assert.equal(res.status, 200)
    assert.equal(res.body.score, index + 1)
    assert.equal(res.body.gained, [10, 15, 20][index])
  }
  // Editor changes after start cannot rewrite already committed quiz grading.
  state.tables.lessons.find(l => l.id === 20).quiz[0].correct = 0
  const complete = await call('complete', { id: 20, answers: [1, 0, 1], attemptId }, BUYER)
  assert.equal(complete.status, 200)
  assert.equal(complete.body.score, 3)
  assert.equal(complete.body.bonus, 45)
  assert.equal(complete.body.gained, 95)
  assert.equal(state.tables.progress.find(p => p.lesson_id === 20).score, 3)
  const xp = state.tables.users.find(u => u.id === BUYER).xp
  assert.equal((await call('complete', { id: 20, answers: [1, 0, 1] }, BUYER)).body.already, true)
  assert.equal((await call('complete', { id: 20, answers: [0, 0, 1] }, BUYER)).body.error, 'quiz_answers_mismatch')
  assert.equal(state.tables.users.find(u => u.id === BUYER).xp, xp)
  adventOn()
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 1)
})

test('changed answer array and foreign or practice attempt cannot upgrade a first result', async () => {
  await everyoneBoots()
  quizLesson()
  const attemptId = (await call('quiz_start', { id: 20 }, BUYER)).body.attemptId
  for (const [index, answer] of [0, 0, 1].entries()) await call('quiz_answer', { attemptId, index, answer }, BUYER)
  assert.equal((await call('complete', { id: 20, answers: [1, 0, 1], attemptId }, BUYER)).body.error, 'quiz_answers_mismatch')
  const result = await call('complete', { id: 20, answers: [0, 0, 1] }, BUYER)
  assert.equal(result.body.score, 2)
  assert.equal(result.body.bonus, 25)
  const practice = await call('quiz_start', { id: 20 }, BUYER)
  assert.equal(practice.body.practice, true)
  assert.notEqual(practice.body.attemptId, attemptId)
  for (const [index, answer] of [1, 0, 1].entries()) await call('quiz_answer', { attemptId: practice.body.attemptId, index, answer }, BUYER)
  assert.equal((await call('complete', { id: 20, answers: [1, 0, 1], attemptId: practice.body.attemptId }, BUYER)).body.error, 'quiz_required')
  assert.equal(state.tables.progress.find(p => p.lesson_id === 20).score, 2)
  adventOn()
  assert.equal((await call('advent', {}, BUYER)).body.catchup.tickets, 0)
})

test('quiz requests reject malformed indexes/answers, locked lessons and DB errors without committing', async () => {
  await everyoneBoots()
  quizLesson()
  assert.equal((await call('quiz_start', { id: 10 }, BUYER)).status, 403)
  const attemptId = (await call('quiz_start', { id: 20 }, BUYER)).body.attemptId
  for (const payload of [{ index: -1, answer: 0 }, { index: 0, answer: 9 }, { index: '0', answer: 1 }, { index: 0, answer: '1' }, { index: 0, answer: null }]) {
    assert.equal((await call('quiz_answer', { attemptId, ...payload }, BUYER)).status, 400)
  }
  state.failNext = { table: 'lesson_quiz_attempts', op: 'answer' }
  assert.equal((await call('quiz_answer', { attemptId, index: 0, answer: 1 }, BUYER)).status, 500)
  assert.deepEqual((await call('quiz_start', { id: 20 }, BUYER)).body.answers, [])
})

test('new module payments share the OG webhook and await the private master payment handler', async () => {
  const priorEnv=Deno.env.get, priorFetch=globalThis.fetch, recorded=[]
  Deno.env.get=k=>k==='APP_URL'?'https://og.example':priorEnv(k)
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/rest/v1/rpc/az_webhook')) {recorded.push(JSON.parse(init.body));return Response.json({preCheckoutId:'platform-pcq',accepted:true})}
    return priorFetch(url,init)
  }
  try {
    const secret=webhookSecret
    const update={update_id:990,pre_checkout_query:{id:'platform-pcq',from:{id:BUYER},invoice_payload:'12345678-1234-1234-1234-123456789abc',currency:'XTR',total_amount:40}}
    const res=await handler(new Request(`${SUPABASE_URL}/functions/v1/api/webhook`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify(update)}))
    assert.equal(res.status,200);assert.deepEqual(recorded,[{p_update:update}])
    assert.ok(sent('answerPreCheckoutQuery').some(c=>c.payload.pre_checkout_query_id==='platform-pcq'&&c.payload.ok===true))
    assert.equal(state.tables.payments.length,0)
  }finally{Deno.env.get=priorEnv;globalThis.fetch=priorFetch}
})

test('new module webhook database failure returns an error for Telegram retry', async () => {
  const priorEnv=Deno.env.get,priorFetch=globalThis.fetch
  Deno.env.get=k=>k==='APP_URL'?'https://og.example':priorEnv(k)
  globalThis.fetch=async(url,init)=>String(url).includes('/rest/v1/rpc/az_webhook')?Response.json({message:'temporary_failure',code:'XX000'},{status:500}):priorFetch(url,init)
  try{
    const secret=webhookSecret
    const res=await handler(new Request(`${SUPABASE_URL}/functions/v1/api/webhook`,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify({update_id:991,message:{from:{id:BUYER},successful_payment:{invoice_payload:'12345678-1234-1234-1234-123456789abc'}}})}))
    assert.ok(res.status>=400)
  }finally{Deno.env.get=priorEnv;globalThis.fetch=priorFetch}
})

// ---------- Запуск ----------

test('academy uses existing Telegram authentication and never trusts supplied actor', async () => {
  assert.equal((await call('academy', { action:'catalog', payload:{} })).status,401)
  assert.deepEqual(state.academyCalls,[])
  await everyoneBoots()
  const response=await call('academy',{action:'catalog',payload:{},actor_id:ADMIN,is_admin:true},BUYER)
  assert.equal(response.status,200)
  assert.equal(state.academyCalls[0].p_actor,BUYER)
  assert.equal(state.academyCalls[0].p_action,'catalog')
  assert.deepEqual(state.academyCalls[0].p_payload,{})
})

test('academy propagates SQL permission/conflict errors and rejects malformed actions', async () => {
  await everyoneBoots()
  state.academyReply={data:null,error:{message:'academy_forbidden'}}
  assert.equal((await call('academy',{action:'admin_save',payload:{entity:{}}},BUYER)).status,403)
  state.academyReply={data:null,error:{message:'academy_version_conflict'}}
  assert.equal((await call('academy',{action:'admin_save',payload:{entity:{}}},ADMIN)).status,409)
  const count=state.academyCalls.length
  assert.equal((await call('academy',{action:'constructor',payload:{}},ADMIN)).status,400)
  assert.equal((await call('academy',{action:'catalog',payload:[]},ADMIN)).status,400)
  assert.equal(state.academyCalls.length,count)
})

test('shared news contains a short article excerpt and a direct article link', async () => {
  await everyoneBoots()
  state.tables.lessons.push({id:20,title:'Новости ИИ',kind:'lesson',published:true,course_id:null,body:'Инструмент готовит презентацию по источникам. '+ 'Деталь. '.repeat(500),subtitle:'Описание',emoji:'🤖'})
  replies.savePreparedInlineMessage={ok:true,result:{id:'prepared-news'}}
  const response=await call('share_message',{kind:'lesson',lesson_id:20},BUYER)
  assert.equal(response.status,200)
  const result=sent('savePreparedInlineMessage')[0].payload.result
  assert(result.caption.includes('Инструмент готовит презентацию'))
  assert(result.caption.includes('https://t.me/test_bot?start=l20_r2'))
  assert(result.caption.length<=1024)
})

test('share cannot leak an excerpt from a locked course lesson', async () => {
  await everyoneBoots()
  assert.equal((await call('share_message',{kind:'lesson',lesson_id:10},BUYER)).status,403)
  assert.equal(sent('savePreparedInlineMessage').length,0)
})

test('manual announcement is short and includes the full article link in its text', async () => {
  await everyoneBoots()
  state.tables.lessons.push({id:20,title:'Новости ИИ',kind:'lesson',published:true,course_id:null,body:'Инструмент готовит презентацию по источникам. '+ 'Деталь. '.repeat(500),emoji:'🤖'})
  assert.equal((await call('admin_announce',{id:20},ADMIN)).status,200)
  const text=sent('sendMessage')[0].payload.text
  assert(text.includes('Инструмент готовит презентацию'))
  assert(text.includes('https://t.me/test_bot?start=l20'))
  assert(text.length<=1024)
})

test('fully readable zero-price course opens without a request; mixed access stays locked', async () => {
  await everyoneBoots()
  state.tables.lessons.push({id:21,title:'Free course lesson',kind:'lesson',published:true,course_id:2,free_preview:true,quiz:[]})
  let response=await call('boot',{},OTHER)
  assert.equal(response.body.courses.find(c=>c.id===2).access,true)
  state.tables.lessons.push({id:22,title:'Private course lesson',kind:'lesson',published:true,course_id:2,free_preview:false,quiz:[]})
  response=await call('boot',{},OTHER)
  assert.equal(response.body.courses.find(c=>c.id===2).access,false)
  assert.equal(response.body.courses.find(c=>c.id===1).access,false)
})

test('split courses are paid independently: one purchase opens only that course', async () => {
  await everyoneBoots()
  state.tables.courses.push(...[31,32,33].map(id=>({id,title:'Bundle '+id,published:true,price_stars:500,invite_unlock:0})))
  state.tables.courses.forEach(c=>c.price_stars=500)
  state.tables.settings.push({key:'content_revision:ai-practice-paths-2026-10-26-v4',value:{payment_scheme:'individual',courses:{foundations:1,text:2,media:31,coding:32,automation:33}}})
  for(const id of [2,31,32,33])state.tables.lessons.push({id:100+id,title:'Private bundle lesson',kind:'lesson',published:true,course_id:id,free_preview:false,quiz:[]})
  await hook(paidUpdate(BUYER,2,'bundle-payment',500))
  let response=await call('boot',{},BUYER)
  assert.equal(response.body.courses.filter(c=>c.access).length,1)
  assert.equal(state.tables.course_access.filter(a=>a.user_id===BUYER).length,1)
  assert.equal((await call('lesson',{id:10},BUYER)).status,403)
  assert.equal((await call('lesson',{id:102},BUYER)).status,200)
  await call('admin_refund',{id:state.tables.payments.find(p=>p.charge_id==='bundle-payment').id},ADMIN)
  response=await call('boot',{},BUYER)
  assert.equal(response.body.courses.filter(c=>c.access).length,0)
  assert.equal((await call('lesson',{id:10},BUYER)).status,403)
})

test('manual announcement never sends a course lesson, including free previews', async () => {
  await everyoneBoots()
  const lesson=state.tables.lessons.find(l=>l.id===10)
  lesson.body='Секретное содержимое платного урока.'
  lesson.subtitle='Публичный анонс урока.'
  for(const preview of [false,true]){
    lesson.free_preview=preview
    assert.equal((await call('admin_announce',{id:10},ADMIN)).status,400)
  }
  assert.equal(sent('sendMessage').length,0)
})

test('premium reward text is retained when editing a long pack', async () => {
  await everyoneBoots()
  const text='Готовое задание с критериями. '.repeat(140)
  const response=await call('admin_advent_reward_save',{reward:{title:'Premium pack',kind:'message',mode:'threshold',doors:3,payload:{text}}},ADMIN)
  assert.equal(response.status,200)
  assert.equal(state.tables.advent_rewards.at(-1).payload.text,text.trim())
})

function certificationSeed(streak=9,age=0){
  const user=state.tables.users.find(u=>u.id===BUYER)
  user.streak=streak;user.freezes=0;user.tz=0
  user.last_claim=new Date(Date.now()-age*86400000).toISOString().slice(0,10)
  state.tables.ai_certifications=[{id:'test-ai',title:'AI Foundations',provider:'Provider',credential:'certificate',topic:'fundamentals',url:'https://provider.example/ai',published:true,free_course:true,free_credential:true,position:0}]
  state.tables.certification_progress=[]
}
test('certification catalog previews are available but never leak enrollment links below streak10',async()=>{
 await everyoneBoots();certificationSeed()
 const r=await call('certifications',{action:'catalog'},BUYER)
 assert.equal(r.status,200);assert.equal(r.body.unlocked,false);assert.equal(r.body.items.length,1)
 assert(!JSON.stringify(r.body).includes('https://'))
 assert.equal((await call('certifications',{action:'open',id:'test-ai'},BUYER)).status,403)
})
test('certification access rechecks live streak and relocks immediately after it expires',async()=>{
 await everyoneBoots();certificationSeed(10)
 assert.equal((await call('certifications',{action:'open',id:'test-ai'},BUYER)).body.url,'https://provider.example/ai')
 state.tables.users.find(u=>u.id===BUYER).last_claim='2026-01-01'
 assert.equal((await call('certifications',{action:'open',id:'test-ai'},BUYER)).status,403)
 assert.equal((await call('certifications',{action:'progress',id:'test-ai',status:'completed'},BUYER)).status,403)
})
test('certification completion and receipt are separate self-reported, actor-bound marks',async()=>{
 await everyoneBoots();certificationSeed(10)
 assert.equal((await call('certifications',{action:'progress',id:'test-ai',status:'received'},BUYER)).status,409)
 assert.equal((await call('certifications',{action:'progress',id:'test-ai',status:'completed',user_id:ADMIN},BUYER)).status,200)
 assert.equal((await call('certifications',{action:'progress',id:'test-ai',status:'received'},BUYER)).status,200)
 assert.equal(state.tables.certification_progress[0].user_id,BUYER)
 assert.equal(state.tables.certification_progress[0].status,'received')
 state.tables.users.find(u=>u.id===BUYER).last_claim='2026-01-01'
 const r=await call('certifications',{action:'catalog'},BUYER)
 assert.equal(r.body.items[0].status,'received');assert.equal(r.body.unlocked,false)
})

test('an advent prize opens only its exact certification independently of the streak',async()=>{
 await everyoneBoots();certificationSeed(0)
 state.tables.advent_rewards=[{id:99,kind:'certification',payload:{certification_id:'test-ai'}}]
 state.tables.reward_codes=[{user_id:BUYER,reward_id:99}]
 const catalog=await call('certifications',{action:'catalog'},BUYER)
 assert.equal(catalog.body.unlocked,false);assert.equal(catalog.body.items[0].available,true)
 assert.equal((await call('certifications',{action:'open',id:'test-ai'},BUYER)).status,200)
 assert.equal((await call('certifications',{action:'open',id:'other-ai'},BUYER)).status,403)
 state.tables.reward_codes=[{user_id:ADMIN,reward_id:99}]
 assert.equal((await call('certifications',{action:'open',id:'test-ai'},BUYER)).status,403)
})

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
