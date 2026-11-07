import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate } from 'node:timers/promises'
import { transformWithOxc } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const stub = source => moduleUrl(source)
async function compile(path, imports = {}) {
  const file = new URL(path, import.meta.url)
  let { code } = await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: path.endsWith('.tsx') ? 'tsx' : 'ts' })
  code = code.replaceAll('import.meta.env', '({ VITE_API_URL: "https://api.example", DEV: false })')
  code = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`)
  return moduleUrl(code)
}

const errorsUrl = await compile('../src/lib/errors.ts')
const apiUrl = await compile('../src/lib/api.ts', {
  './errors': errorsUrl,
  './tg': stub('export const initData = "test-auth", inTelegram = true, platform = "test", startParam = ""'),
  './discovery': new URL('../src/lib/discovery.ts', import.meta.url).href,
})
const { api, ApiError, errorText } = await import(apiUrl)
const storeUrl = await compile('../src/store.ts', {
  './lib/api': apiUrl,
  './lib/game': stub('export const achievement = () => null'),
  './lib/journey': stub('export const projectProgress = me => me'),
  './lib/experience': stub('export const demoPlatformXp = () => 0'),
})
const { useStore } = await import(storeUrl)
const screenUrl = await compile('../src/screens/States.tsx', {
  '../lib/api': apiUrl,
  '../store': stub(`import { useStore as store } from ${JSON.stringify(storeUrl)}; export const useStore = selector => selector(store.getState())`),
  'motion/react': stub('export const motion = { div: "div" }'),
  '../lib/install': stub('export const INSTAGRAM = {}'),
  '../lib/tg': stub('export const haptic = {}, openLink = () => {}'),
  '../ui': stub('export const Tap = "button", Cta = "button", Emoji = () => null, Spinner = () => null'),
})
const { ErrorScreen } = await import(screenUrl)

const guardErrors = [
  ['rate_limited', 429, 'Слишком много действий. Подожди минуту и попробуй ещё раз'],
  ['rate_limit_unavailable', 503, 'Сервис временно недоступен. Попробуй немного позже'],
  ['membership_unavailable', 503, 'Проверка подписки в Telegram временно недоступна. Попробуй немного позже'],
  ['invalid_json', 400, 'Не получилось отправить запрос. Открой приложение заново'],
  ['request_too_large', 413, 'Слишком много данных в запросе. Сократи текст или уменьши размер изображения'],
]
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: status === 429 ? { 'Retry-After': '60' } : {} })
const session = () => ({
  phase: 'ok', errorCode: null, me: { id: 1, xp: 50 }, feed: [{ id: 2 }],
  courses: [{ id: 3, access: true }], stack: [{ type: 'lesson', id: 2 }], reward: { lessonId: 2 },
})

test('new guard failures explain the specific problem and a manual recovery', () => {
  for (const [code, status, text] of guardErrors) {
    assert.equal(errorText(new ApiError(code, status)), text)
    // Boot stores only the code, while operation toasts receive the Error instance.
    assert.equal(errorText(code), text)
    useStore.setState({ errorCode: code })
    const html = renderToStaticMarkup(ErrorScreen())
    assert.ok(html.includes(text), `${code} must be visible on ErrorScreen`)
    assert.ok(html.includes('Попробовать ещё раз'))
    assert.ok(!html.includes('Подписаться на канал'))
  }
})

test('existing failures retain their recovery and unknown errors never expose backend details', () => {
  for (const [code, text] of [
    ['network', 'Нет связи. Проверь интернет'],
    ['locked', 'Подписка на канал не найдена'],
    ['expired', 'Сессия устарела. Открой приложение заново'],
    ['bad_auth', 'Сессия устарела. Открой приложение заново'],
    ['platform_not_ready', 'Клуб обновляется. Попробуй открыть приложение немного позже'],
    ['course_locked', 'Урок откроется вместе с курсом'],
    ['quiz_answer_locked', 'Ответ уже сохранён. Открой урок заново, чтобы продолжить'],
    ['quiz_sequence', 'Сначала ответь на предыдущий вопрос'],
    ['pin_locked', 'Слишком много попыток. Подожди 15 минут'],
  ]) {
    assert.equal(errorText(code), text)
    assert.equal(errorText(new ApiError(code, 400)), text)
  }
  for (const error of [new ApiError('private database detail', 503), new Error('private provider response'), 'unexpected secret', null, {}, { code: 'locked' }]) {
    assert.equal(errorText(error), 'Что-то сломалось. Попробуй ещё раз')
  }
  useStore.setState({ errorCode: 'private database detail' })
  assert.ok(!renderToStaticMarkup(ErrorScreen()).includes('private database detail'))
  useStore.setState({ errorCode: 'no_token' })
  assert.ok(renderToStaticMarkup(ErrorScreen()).includes('Бот ещё настраивается'))
})

test('HTTP failures preserve error codes and do not automatically repeat reads, writes or payments', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const [code, status, text] of guardErrors) {
      for (const action of [() => api.blogPage(), () => api.complete(2, [], 'attempt'), () => api.courseInvoice(3)]) {
        let calls = 0
        globalThis.fetch = async () => { calls++; return reply({ error: code, detail: 'private provider response' }, status) }
        await assert.rejects(action(), error => error instanceof ApiError && error.code === code && error.status === status && errorText(error) === text)
        await setImmediate()
        assert.equal(calls, 1, `${code} must not automatically retry`)
      }
    }
  } finally { globalThis.fetch = originalFetch }
})

test('temporary failures do not revoke access or clear progress, and boot recovers only on explicit retry', async () => {
  const originalFetch = globalThis.fetch
  const originalDocument = globalThis.document
  globalThis.document = { documentElement: { dataset: {} } }
  try {
    for (const [code, status] of guardErrors) {
      const initial = session()
      useStore.setState(initial)
      useStore.getState().guard(new ApiError(code, status))
      for (const key of Object.keys(initial)) assert.equal(useStore.getState()[key], initial[key])
      let calls = 0
      globalThis.fetch = async () => { calls++; return reply({ error: code }, status) }
      assert.equal(await useStore.getState().boot(), 'error')
      assert.equal(useStore.getState().phase, 'error')
      assert.equal(useStore.getState().errorCode, code)
      for (const key of ['me', 'feed', 'courses', 'stack', 'reward']) assert.equal(useStore.getState()[key], initial[key])
      const screen = ErrorScreen()
      await setImmediate()
      assert.equal(calls, 1, 'rendering the error must not retry')
      const retry = screen.props.children.find(child => child?.type === 'button')
      assert.ok(retry, 'error screen must provide a retry button')
      globalThis.fetch = async () => {
        calls++
        return reply({ status: 'ok', ...initial, channel: {}, bot: {} })
      }
      retry.props.onClick()
      assert.equal(useStore.getState().phase, 'loading')
      await setImmediate()
      assert.equal(calls, 2)
      assert.equal(useStore.getState().phase, 'ok')
      assert.equal(useStore.getState().errorCode, null)
      assert.deepEqual(useStore.getState().me, initial.me)
      assert.deepEqual(useStore.getState().courses, initial.courses)
    }
    useStore.setState(session())
    useStore.getState().guard(new ApiError('locked', 403))
    assert.equal(useStore.getState().phase, 'locked')
    assert.deepEqual(useStore.getState().stack, [])
    assert.equal(useStore.getState().reward, null)
  } finally {
    globalThis.fetch = originalFetch
    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument
  }
})
