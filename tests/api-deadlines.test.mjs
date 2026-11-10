import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate } from 'node:timers/promises'
import { transformWithOxc } from 'vite'
import { requestAcademyApi } from '../src/lib/academy-transport.ts'
import { REQUEST_TIMEOUT_MS, withRequestDeadline } from '../src/lib/request-deadline.ts'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
async function compile(path, imports = {}) {
  const file = new URL(path, import.meta.url)
  let { code } = await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: 'ts' })
  code = code.replaceAll('import.meta.env', '({ VITE_API_URL: "https://api.example", DEV: false })')
  code = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? new URL(name, file).href)}`)
  return moduleUrl(code)
}
const apiUrl = await compile('../src/lib/api.ts', {
  './errors': await compile('../src/lib/errors.ts'),
  './tg': moduleUrl('export const initData = "test-auth", inTelegram = true, platform = "test", startParam = ""'),
  './discovery': new URL('../src/lib/discovery.ts', import.meta.url).href,
})
const { api, ApiError, errorText } = await import(apiUrl)
const { academyPublicRequest, academyRequest } = await import(await compile('../src/lib/academy.ts', {
  './api': apiUrl,
  './tg': moduleUrl('export const initData = "test-auth"'),
  '../store': moduleUrl('export const useStore = {}'),
  './academy-transport': new URL('../src/lib/academy-transport.ts', import.meta.url).href,
  './academy-types': new URL('../src/lib/academy-types.ts', import.meta.url).href,
}))
const never = () => new Promise(() => {})
const clients = {
  'main mutation': () => api.complete(1, [], 'attempt'),
  'main read': () => api.blogPage(),
  'main payment': () => api.courseInvoice(1),
  'Academy mutation': () => requestAcademyApi('enroll', {}, 'auth', 'https://api.example'),
  'Academy public': () => academyPublicRequest('certificate_public', { token: 'test' }),
}

for (const [name, action] of Object.entries(clients)) {
  for (const phase of ['headers', 'body']) test(`${name}: deadline includes delayed ${phase}, aborts and never retries`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    let signal, calls = 0, reading = false
    t.mock.method(globalThis, 'fetch', async (_, options) => {
      calls++; signal = options.signal
      if (phase === 'headers') return never()
      return { ok: true, status: 200, json: () => { reading = true; return never() } }
    })
    const pending = action()
    const rejection = assert.rejects(pending, error => name === 'Academy public'
      ? /не ответил вовремя/.test(error.message)
      : (error.code ?? error.message) === 'timeout')
    await setImmediate()
    if (phase === 'body') assert.equal(reading, true)
    t.mock.timers.tick(REQUEST_TIMEOUT_MS - 1)
    assert.equal(signal.aborted, false)
    t.mock.timers.tick(1)
    await rejection
    assert.equal(signal.aborted, true)
    await setImmediate()
    assert.equal(calls, 1)
  })
}

for (const failure of [new TypeError('offline'), new DOMException('aborted', 'AbortError')]) {
  for (const phase of ['headers', 'body']) test(`${failure.name} during ${phase} rejects rather than becoming a successful write`, async t => {
    for (const [name, action] of Object.entries(clients)) {
      let calls = 0
      const mock = t.mock.method(globalThis, 'fetch', async () => {
        calls++
        if (phase === 'headers') throw failure
        return { ok: true, status: 200, json: async () => { throw failure } }
      })
      await assert.rejects(action(), error => name === 'Academy public' ? error === failure : (error.code ?? error.message) === 'network')
      assert.equal(calls, 1)
      mock.mock.restore()
    }
  })
}

test('Academy body timeouts only permit public previews and never hide known auth denials', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const status of [200, 401, 403, 503]) {
    let previews = 0, calls = 0
    const result = requestAcademyApi('course', {}, 'auth', 'https://api.example', {
      fetch: async () => { calls++; return { status, ok: status === 200, json: never } },
      preview: () => { previews++; return { preview_only: true } },
    })
    const done = [401, 403].includes(status) ? assert.rejects(result, /timeout/) : result
    await setImmediate()
    t.mock.timers.tick(REQUEST_TIMEOUT_MS)
    const value = await done
    assert.equal(calls, 1)
    assert.equal(previews, [401, 403].includes(status) ? 0 : 1)
    if (previews) assert.equal(value.preview_only, true)
  }
})

test('successful and failed requests clear their deadline timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let successSignal, failureSignal
  assert.equal(await withRequestDeadline(async signal => { successSignal = signal; return 42 }), 42)
  await assert.rejects(withRequestDeadline(async signal => { failureSignal = signal; throw new Error('failure') }), /failure/)
  t.mock.timers.tick(REQUEST_TIMEOUT_MS * 2)
  assert.equal(successSignal.aborted, false)
  assert.equal(failureSignal.aborted, false)
})

test('timeout messages explain the uncertain result instead of encouraging a blind mutation retry', async t => {
  assert.match(errorText(new ApiError('timeout', 0)), /проверить результат/)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', never)
  const pending = assert.rejects(academyRequest('enroll'), /проверить результат/)
  t.mock.timers.tick(REQUEST_TIMEOUT_MS)
  await pending
})

for (const status of [401, 403]) {
  for (const body of ['stalled', 'network', 'abort', 'malformed', 'null', 'array']) {
    test(`main boot preserves ${status} when denied body is ${body}, without retries`, async t => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const originalDocument = globalThis.document
      globalThis.document = { documentElement: { dataset: {} } }
      t.after(() => {
        if (originalDocument === undefined) delete globalThis.document
        else globalThis.document = originalDocument
      })
      let calls = 0, signal
      t.mock.method(globalThis, 'fetch', async (_, options) => {
        calls++; signal = options.signal
        return { ok: false, status, json: async () => {
          if (body === 'stalled') return never()
          if (body === 'network') throw new TypeError('body interrupted')
          if (body === 'abort') throw new DOMException('aborted', 'AbortError')
          if (body === 'malformed') throw new SyntaxError('bad JSON')
          return body === 'array' ? [] : null
        } }
      })
      const pending = assert.rejects(api.boot(), error => error instanceof ApiError &&
        error.status === status && error.code === (status === 401 ? 'bad_auth' : 'forbidden'))
      await setImmediate()
      if (body === 'stalled') {
        t.mock.timers.tick(REQUEST_TIMEOUT_MS)
        assert.equal(signal.aborted, true)
      }
      await pending
      await setImmediate()
      assert.equal(calls, 1)
    })
  }
}

test('main writes reject malformed and nonobject successful bodies without retry; empty objects remain valid', async t => {
  for (const body of ['<html>gateway</html>', '', 'null', '[]', '"ok"', 'true', '42']) {
    let calls = 0
    const mock = t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(body) })
    await assert.rejects(api.complete(1, [], 'attempt'), error => error instanceof ApiError && error.code === 'server' && error.status === 502)
    assert.equal(calls, 1)
    mock.mock.restore()
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'))
  assert.deepEqual(await api.complete(1, [], 'attempt'), {})
})
