import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const post = (id, extra = {}) => ({ id, kind: 'lesson', course_id: null, published: true, title: `Новость ${id}`, subtitle: '', category: 'ИИ', minutes: 2, published_at: '2026-11-06T10:00:00Z', ...extra })
const validBoot = feed => ({ status: 'ok', me: { id: 1 }, feed })
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status })

async function loadApi() {
 const file = new URL('../src/lib/api.ts', import.meta.url)
 const errorsFile = new URL('../src/lib/errors.ts', import.meta.url)
 const errors = (await transformWithOxc(await readFile(errorsFile, 'utf8'), errorsFile.pathname, { lang: 'ts' })).code
 let compiled = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: 'ts' })).code
 compiled = compiled.replace(/import[^;\n]*from ["']\.\/tg["'];?/g, 'const initData = "test-auth", inTelegram = true, platform = "test", startParam = "referral-must-not-repeat";')
  .replaceAll('import.meta.env', '({ VITE_API_URL: "https://api.example", DEV: false })')
 compiled = compiled.replaceAll('from "./errors"', `from "data:text/javascript;base64,${Buffer.from(errors).toString('base64')}"`)
 compiled = compiled.replaceAll('from "./discovery"', `from ${JSON.stringify(new URL('../src/lib/discovery.ts', import.meta.url).href)}`)
 return (await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)).api
}

test('blog_feed compatibility falls back only for an unsupported route and safely refreshes the bounded boot selection', async () => {
 const api = await loadApi(), originalFetch = globalThis.fetch, calls = []
 let fetchReply
 globalThis.fetch = async (url, options) => { calls.push({ url, payload: JSON.parse(options.body) }); return fetchReply(url) }
 try {
  const page = { posts: [post(1)], next: { id: 1, published_at: '2026-11-06T10:00:00Z' } }
  fetchReply = () => reply(page)
  assert.deepEqual(await api.blogPage(), page)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/blog_feed$/)

  calls.length = 0
  let current = 2
  fetchReply = url => url.endsWith('/blog_feed') ? reply({ error: 'not_found' }, 404) : reply(validBoot([
   post(current), post(1), post(3, { course_id: 7 }), post(4, { published: false }), post(5, { published_at: '2999-01-01' }),
   post(6, { kind: 'story' }), post(7, { news_eligible: false }), null, {}, post(8, { course_id: undefined }), post(9, { title: {} }),
  ]))
  assert.deepEqual(await api.blogPage(), { posts: [post(2), post(1)], next: null, legacy: true })
  assert.equal(calls.length, 2)
  assert.deepEqual(Object.keys(calls[1].payload).sort(), ['auth', 'tz'])
  assert.equal(calls[1].payload.auth, 'test-auth')
  current = 10
  assert.deepEqual((await api.blogPage()).posts.map(item => item.id), [10, 1])
  assert.equal(calls.length, 4)

  for (const [status, code] of [[401, 'bad_auth'], [403, 'locked'], [500, 'server'], [404, 'post_not_found']]) {
   calls.length = 0
   fetchReply = () => reply({ error: code }, status)
   await assert.rejects(api.blogPage(), error => error.status === status && error.code === code)
   assert.equal(calls.length, 1, `${status}/${code} must not call boot`)
  }
  calls.length = 0
  fetchReply = () => { throw new TypeError('offline') }
  await assert.rejects(api.blogPage(), error => error.code === 'network')
  assert.equal(calls.length, 1)

  for (const [boot, code] of [
   [{ status: 'locked', feed: [post(20)] }, 'locked'],
   [{ status: 'setup', feed: [post(20)] }, 'platform_not_ready'],
   [null, 'server'], [[], 'server'], [{ status: 'ok', feed: [post(20)] }, 'server'],
   [{ status: 'ok', me: { id: 1 }, feed: {} }, 'server'],
  ]) {
   fetchReply = url => url.endsWith('/blog_feed') ? reply({ error: 'not_found' }, 404) : reply(boot)
   await assert.rejects(api.blogPage(), error => error.code === code)
  }
 } finally { globalThis.fetch = originalFetch }
})
