import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { academyEntry } from '../src/lib/academy-entry.ts'
import { academyProgramPreview } from '../src/lib/academy-programs.ts'
import { requestAcademyApi } from '../src/lib/academy-transport.ts'
import { publicAcademyCatalog } from '../scripts/academy-public.mjs'
import { managementQuery, academyReleasePlan } from '../scripts/academy-release.mjs'

const response = (body, status = 200) => async () => new Response(JSON.stringify(body), { status })
const api = (action, payload = {}, fetch = response({})) => requestAcademyApi(action, payload, 'test-init-data', 'https://api.example', { fetch, preview: academyProgramPreview })

test('main-app programs contain all 28 courses and 448 lesson outlines with no grading keys or bodies', async () => {
  const authored = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.learning.json', import.meta.url)))
  const publicCatalog = publicAcademyCatalog(authored)
  const encoded = JSON.stringify(publicCatalog)
  assert.equal(publicCatalog.entities.filter(n => n.kind === 'course').length, 28)
  assert.equal(publicCatalog.entities.filter(n => n.kind === 'lesson').length, 448)
  assert.ok(publicCatalog.entities.every(n => n.state === 'outline'))
  assert.doesNotMatch(encoded, /content_blocks|"questions"|"answer"|"correct"|"rubric_code"/)
  const injected = publicAcademyCatalog({ entities: [{ code: 'X', kind: 'lesson', title: 'Example', position: 0, data: { outcome: 'Goal', assessment: { answer: 'PRIVATE' }, content_blocks: ['PRIVATE'], minutes: 10 }, state: 'published' }] })
  assert.doesNotMatch(JSON.stringify(injected), /PRIVATE/)
})

test('program directory is generated from the same public schema as the deployed course previews', async () => {
  const base = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.normalized.json', import.meta.url)))
  const publicCatalog = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.public.json', import.meta.url)))
  const directory = JSON.parse(await readFile(new URL('../content/ai-academy/course-directory.json', import.meta.url)))
  assert.deepEqual(publicCatalog, publicAcademyCatalog(base))
  assert.deepEqual(directory, publicCatalog.entities.filter(n => n.kind === 'course'))
})

test('program previews support course navigation, direction filtering, search and pagination without enrollment', () => {
  const all = academyProgramPreview('catalog', { limit: 100 })
  assert.equal(all.total, 28); assert.equal(all.directions.length, 9)
  assert.equal(academyProgramPreview('catalog', { direction: 'DT', limit: 100 }).total, 3)
  assert.equal(academyProgramPreview('catalog', { q: 'DT-201' }).courses[0].code, 'DT-201')
  assert.deepEqual(academyProgramPreview('catalog', { offset: 12, limit: 12 }).courses, all.courses.slice(12, 24))
  for (const course of all.courses) {
    const preview = academyProgramPreview('course', { code: course.code })
    assert.equal(preview.modules.length, 4); assert.equal(preview.lessons.length, 16)
    assert.equal(preview.enrollment, null); assert.equal(preview.progress, null)
  }
  for (const action of ['lesson','enroll','complete','quiz_start','admin_save','my']) assert.equal(academyProgramPreview(action, { code: 'CORE-000' }), null)
})

test('unavailable or empty curriculum shows clearly marked programs, while live data stays authoritative', async () => {
  const offline = await api('course', { code: 'DT-201' }, async () => { throw new TypeError('offline') })
  assert.equal(offline.preview_only, true)
  assert.equal((await api('catalog', {}, response({ error: 'academy_not_ready' }, 500))).total, 28)
  assert.equal((await api('catalog', {}, response({ directions: [], courses: [], total: 0 }))).preview_only, true)
  const live = { course: { code: 'DT-201', state: 'published' }, enrollment: { state: 'active' } }
  assert.deepEqual(await api('course', { code: 'DT-201' }, response(live)), live)
  const filtered = { directions: [{ code: 'DT' }], courses: [], total: 0 }
  assert.deepEqual(await api('catalog', { q: 'absent' }, response(filtered)), filtered)
})

test('program fallback cannot bypass Telegram auth, protected lessons or writes', async () => {
  for (const status of [401, 403]) await assert.rejects(api('course', { code: 'CORE-000' }, response({ error: 'forbidden' }, status)), /forbidden/)
  for (const action of ['lesson','enroll','complete','quiz_start','admin_save','my']) await assert.rejects(api(action, { code: 'CORE-000' }, response({ error: 'academy_not_ready' }, 500)), /academy_not_ready/)
  await assert.rejects(api('course', { code: 'UNKNOWN' }, response({ error: 'academy_not_found' }, 404)), /academy_not_found/)
  await assert.rejects(api('enroll', {}, async () => { throw new TypeError('offline') }), /network/)
})

test('real API requests keep Telegram auth and preserve the text/plain transport', async () => {
  await api('course', { code: 'CORE-000' }, async (url, request) => {
    assert.equal(url, 'https://api.example/academy')
    assert.equal(request.headers['Content-Type'], 'text/plain;charset=UTF-8')
    assert.deepEqual(JSON.parse(request.body), { auth: 'test-init-data', action: 'course', payload: { code: 'CORE-000' } })
    return new Response(JSON.stringify({ course: { code: 'CORE-000' } }))
  })
})

test('Telegram opens Academy catalog or specific courses, alongside existing URL routes', () => {
  assert.equal(academyEntry('', '/', 'academy'), '/academy')
  assert.equal(academyEntry('', '/', 'academy_ENG-201'), '/academy/courses/ENG-201')
  assert.equal(academyEntry('#/academy/courses/DT-101', '/', 'academy'), '/academy/courses/DT-101')
  assert.equal(academyEntry('', '/academy/courses/VC-101', ''), '/academy/courses/VC-101')
  for (const value of ['academy_admin','academy_X-101','academy_CORE-301','l12','c2']) assert.equal(academyEntry('', '/', value), null)
  assert.equal(academyEntry('#/academyevil', '/academy-evil', ''), null)
})

test('malformed server responses fall back only to public programs', async () => {
  assert.equal((await api('course', { code: 'CORE-000' }, response(null))).preview_only, true)
  assert.equal((await api('catalog', {}, async () => new Response('<html>Gateway</html>'))).preview_only, true)
  await assert.rejects(api('course', { code: 'CORE-000' }, response(null, 403)), /academy_not_ready/)
})

test('release transport constrains the project host and does not echo provider errors or credentials', async () => {
  await assert.rejects(managementQuery('invalid/path', 'TEST_SECRET', '', async () => { throw Error('must not fetch') }), /Invalid Supabase project/)
  await assert.rejects(managementQuery('dcdepwdxvadhludnubis', '', 'select 1'), /secure environment settings/)
  await assert.rejects(managementQuery('dcdepwdxvadhludnubis', 'TEST_SECRET', 'select 1', async (url, request) => {
    assert.equal(url, 'https://api.supabase.com/v1/projects/dcdepwdxvadhludnubis/database/query')
    assert.equal(request.headers.Authorization, 'Bearer TEST_SECRET')
    assert.equal(JSON.parse(request.body).query, 'select 1')
    return new Response('TEST_SECRET private provider response', { status: 403 })
  }), error => error.message.includes('HTTP 403') && !error.message.includes('TEST_SECRET'))
  assert.throws(() => academyReleasePlan({}, [], '1;drop table users'), /administrator Telegram ID/)
})
