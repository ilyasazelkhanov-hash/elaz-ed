import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
import { createLearningSettings, learningSettings, learningSettingsChanged } from '../src/lib/profile-learning.ts'

const initial = { enabled: false, goal: 3, day: 0, hour: 18, timezone: 'Asia/Almaty', completed: 2, nextLesson: { id: 7, title: 'Урок' } }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const setup = (overrides = {}) => createLearningSettings({ load: async () => ({ ...initial }), save: async input => ({ ...initial, ...input }), requestPermission: async () => true, ...overrides })

test('settings drafts include only writable fields and cancel restores confirmed values', async () => {
  const settings = setup()
  await settings.load()
  assert.deepEqual(Object.keys(settings.getSnapshot().draft).sort(), ['day', 'enabled', 'goal', 'hour', 'timezone'])
  settings.edit({ goal: 7, timezone: 'Europe/London' })
  assert.equal(settings.getSnapshot().saved.goal, 3)
  assert.ok(learningSettingsChanged(settings.getSnapshot().saved, settings.getSnapshot().draft))
  settings.reset()
  assert.deepEqual(settings.getSnapshot().draft, learningSettings(initial))
  assert.equal(learningSettingsChanged(settings.getSnapshot().saved, settings.getSnapshot().draft), false)
})

test('load rejection ends loading and explicit retry succeeds without clearing confirmed state', async () => {
  let fails = true, calls = 0
  const settings = setup({ load: async () => { calls++; if (fails) throw Error('offline'); return initial } })
  await settings.load()
  assert.equal(settings.getSnapshot().busy, null)
  assert.equal(settings.getSnapshot().error, 'load')
  assert.equal(settings.getSnapshot().saved, null)
  assert.equal(calls, 1)
  fails = false
  await settings.load()
  assert.equal(settings.getSnapshot().error, null)
  assert.equal(settings.getSnapshot().saved, initial)
  fails = true
  await settings.load()
  assert.equal(settings.getSnapshot().saved, initial)
})

test('denied Telegram permission does not send a write or pretend settings were saved', async () => {
  let writes = 0, permissions = 0
  const settings = setup({ requestPermission: async () => { permissions++; return false }, save: async () => { writes++; return initial } })
  await settings.load()
  settings.edit({ enabled: true, goal: 5 })
  await settings.save()
  assert.equal(writes, 0)
  assert.equal(permissions, 1)
  assert.equal(settings.getSnapshot().saved.enabled, false)
  assert.equal(settings.getSnapshot().draft.enabled, true)
  assert.match(settings.getSnapshot().notice, /Изменения не сохранены/)
  assert.equal(settings.getSnapshot().busy, null)
})

test('successful save uses the server result and preserves the chosen timezone', async () => {
  let input, permissions = 0
  const settings = setup({ requestPermission: async () => { permissions++; return true }, save: async value => { input = value; return { ...initial, ...value, completed: 4 } } })
  await settings.load()
  settings.edit({ enabled: true, goal: 5 })
  await settings.save()
  assert.equal(input.timezone, 'Asia/Almaty')
  assert.equal(permissions, 1)
  assert.equal(settings.getSnapshot().saved.completed, 4)
  assert.equal(settings.getSnapshot().saved.goal, 5)
  assert.equal(learningSettingsChanged(settings.getSnapshot().saved, settings.getSnapshot().draft), false)
  assert.equal(settings.getSnapshot().notice, 'Настройки сохранены.')
  await settings.save()
  assert.equal(permissions, 1, 'unchanged settings must not create another permission request')
})

test('disable and schedule-only changes do not ask for write permission again', async () => {
  let permissions = 0, writes = 0
  const settings = setup({ load: async () => ({ ...initial, enabled: true }), requestPermission: async () => { permissions++; return true }, save: async input => { writes++; return { ...initial, ...input } } })
  await settings.load()
  settings.edit({ hour: 9 })
  await settings.save()
  settings.edit({ enabled: false })
  await settings.save()
  assert.equal(permissions, 0)
  assert.equal(writes, 2)
  assert.equal(settings.getSnapshot().saved.enabled, false)
})

test('failed saves keep the draft and distinguish uncertain server state; reload reconciles it', async () => {
  let server = initial, writes = 0
  const settings = setup({ load: async () => server, save: async input => { writes++; server = { ...initial, ...input }; throw Error('response lost after commit') } })
  await settings.load()
  settings.edit({ goal: 6 })
  await settings.save()
  assert.equal(settings.getSnapshot().saved.goal, 3)
  assert.equal(settings.getSnapshot().draft.goal, 6)
  assert.equal(settings.getSnapshot().error, 'save')
  assert.equal(settings.getSnapshot().notice, '')
  assert.equal(settings.getSnapshot().busy, null)
  await settings.load()
  assert.equal(settings.getSnapshot().saved.goal, 6)
  assert.equal(settings.getSnapshot().error, null)
  assert.equal(writes, 1, 'checking must not repeat the write')
})

test('rapid repeated saves, edits, resets and loads cannot race the pending write', async () => {
  const permission = deferred(), write = deferred()
  let writes = 0, permissions = 0, loads = 0
  const settings = setup({ load: async () => { loads++; return initial }, requestPermission: () => { permissions++; return permission.promise }, save: () => { writes++; return write.promise } })
  await settings.load()
  settings.edit({ enabled: true, goal: 5 })
  const saving = settings.save()
  await settings.save(); await settings.load(); settings.edit({ goal: 7 }); settings.reset()
  assert.equal(permissions, 1)
  assert.equal(loads, 1)
  assert.equal(settings.getSnapshot().draft.goal, 5)
  permission.resolve(true)
  await new Promise(resolve => setImmediate(resolve))
  await settings.save()
  assert.equal(writes, 1)
  write.resolve({ ...initial, enabled: true, goal: 5 })
  await saving
  assert.equal(settings.getSnapshot().saved.goal, 5)
})

test('unmount while permission is pending prevents a later permission result from writing', async () => {
  const permission = deferred()
  let writes = 0
  const settings = setup({ requestPermission: () => permission.promise, save: async () => { writes++; return initial } })
  await settings.load()
  settings.edit({ enabled: true })
  const saving = settings.save()
  settings.cancel()
  permission.resolve(true)
  await saving
  assert.equal(writes, 0)
})

test('stale load and save responses cannot overwrite a remounted session', async () => {
  const old = deferred()
  let calls = 0
  const settings = setup({ load: () => ++calls === 1 ? old.promise : Promise.resolve({ ...initial, goal: 7 }) })
  const previous = settings.load()
  settings.cancel()
  await settings.load()
  old.resolve(initial)
  await previous
  assert.equal(settings.getSnapshot().saved.goal, 7)
  const write = deferred()
  const savingSettings = setup({ save: () => write.promise })
  await savingSettings.load(); savingSettings.edit({ goal: 5 })
  const saving = savingSettings.save(); savingSettings.cancel(); await savingSettings.load()
  write.resolve({ ...initial, goal: 5 }); await saving
  assert.equal(savingSettings.getSnapshot().saved.goal, 3)
})

test('stalled requests stop loading/saving without automatically retrying', async () => {
  const never = () => new Promise(() => {})
  const loading = setup({ load: never, timeoutMs: 10 })
  await loading.load()
  assert.equal(loading.getSnapshot().error, 'load')
  assert.equal(loading.getSnapshot().busy, null)
  const saving = setup({ save: never, timeoutMs: 10 })
  await saving.load(); saving.edit({ goal: 5 }); await saving.save()
  assert.equal(saving.getSnapshot().error, 'save')
  assert.equal(saving.getSnapshot().busy, null)
})

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const stateModule = dataUrl(`export const createLearningSettings = deps => { globalThis.__profileControllerDeps = deps; return globalThis.__profileSettings }; export { learningSettingsChanged } from ${JSON.stringify(new URL('../src/lib/profile-learning.ts', import.meta.url).href)}`)
async function component(demo = false) {
  const path = new URL('../src/screens/profile/LearningGoalCard.tsx', import.meta.url)
  let { code } = await transformWithOxc(await readFile(path, 'utf8'), path.pathname, { lang: 'tsx' })
  const imports = {
    '../../lib/api': dataUrl(`export const isDemo = ${demo}; export const api = {}`),
    '../../lib/tg': dataUrl('export const inTelegram = true; export const requestWriteAccess = () => Promise.resolve(true)'),
    '../../lib/profile-learning': stateModule,
    '../../ui': dataUrl('export const Tap = "button"'),
    '../../store': dataUrl('export const useStore = { getState: () => ({ guard: error => globalThis.__profileGuard?.(error) }) }'),
  }
  code = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`)
  return (await import(dataUrl(code))).LearningGoalCard
}
const Card = await component(), DemoCard = await component(true)
const render = state => {
  globalThis.__profileSettings = { getSnapshot: () => state, subscribe: () => () => {}, edit() {}, reset() {}, save() {}, load() {}, cancel() {} }
  return renderToStaticMarkup(createElement(Card, { onOpenLesson() {} }))
}

test('loading and load error markup expose distinct status and retry, not an endless spinner', () => {
  let html = render({ saved: null, draft: null, busy: 'loading', error: null, notice: '' })
  assert.match(html, /role="status"/); assert.match(html, /Загрузка настроек/)
  html = render({ saved: null, draft: null, busy: null, error: 'load', notice: '' })
  assert.match(html, /role="alert"/); assert.match(html, /Повторить загрузку/)
  assert.doesNotMatch(html, /Загрузка настроек/)
})

test('loaded form has labelled controls, all valid goals, honest scope and explicit timezone', () => {
  const html = render({ saved: initial, draft: learningSettings(initial), busy: null, error: null, notice: '' })
  assert.equal((html.match(/<label/g) || []).length, 4)
  assert.match(html, /type="checkbox"/)
  for (const n of [1, 2, 3, 4, 5, 6, 7]) assert.ok(html.includes(`value="${n}"`))
  assert.match(html, /Asia\/Almaty/)
  assert.match(html, /Учитываются завершённые уроки OG-курсов и ленты/)
  assert.match(html, /Продолжить: Урок/)
  assert.match(html, /<button type="submit" disabled/)
})

test('demo settings are fully read-only and never promise a successful save', () => {
  render({ saved: initial, draft: learningSettings(initial), busy: null, error: null, notice: '' })
  const html = renderToStaticMarkup(createElement(DemoCard, { onOpenLesson() {} }))
  assert.match(html, /<fieldset disabled/)
  assert.match(html, /Это просмотр настроек/)
  assert.match(html, /Пример недельной цели/)
  assert.doesNotMatch(html, /из 3 уроков на этой неделе|Обновить прогресс/)
  assert.doesNotMatch(html, /type="submit"/)
  delete globalThis.__profileSettings
})

async function profileComponent() {
  const path = new URL('../src/screens/Profile.tsx', import.meta.url)
  let { code } = await transformWithOxc(await readFile(path, 'utf8'), path.pathname, { lang: 'tsx' })
  code = code.replaceAll('import.meta.env', '({ VITE_PLATFORM_ENABLED: "false" })')
  const imports = {
    '../lib/api': dataUrl('export const isDemo = false'),
    '../lib/links': dataUrl('export const appLink = () => null'),
    '../lib/shareCard': dataUrl('export const achievementCard = () => null, levelCard = () => null'),
    '../lib/track': dataUrl('export const track = () => {}'),
    '../lib/game': new URL('../src/lib/game.ts', import.meta.url).href,
    '../lib/sfx': dataUrl('export const sfx = { enabled: true, setEnabled() {} }'),
    '../lib/install': dataUrl('export const addShortcut = async () => "hint-browser", INSTAGRAM = {handle: "@example", url: "https://example.com"}'),
    '../lib/tg': dataUrl('export const haptic = {tap() {}}, inTelegram = true, openLink = () => {}, confirmDialog = async () => false, shareLink = () => {}'),
    '../lib/theme': dataUrl('export const getMode = () => "auto", setMode = () => {}'),
    '../lib/tilt': dataUrl(`import { useMotionValue } from ${JSON.stringify(import.meta.resolve('motion/react'))}; export function useTilt(active) { globalThis.__profileTilt = active; return {x: useMotionValue(0), y: useMotionValue(0), onPointerMove() {}, onPointerLeave() {}} }`),
    '../store': dataUrl('export const useStore = selector => selector(globalThis.__profileFixture); useStore.getState = () => globalThis.__profileFixture; useStore.setState = () => {}'),
    '../ui': dataUrl(`import { createElement } from ${JSON.stringify(import.meta.resolve('react'))}; export const Avatar = () => null, Pattern = () => null, Counter = ({value, ...props}) => createElement("span", props, value), Emoji = ({char}) => createElement("span", null, char); export const Tap = ({feedback, initial, animate, transition, children, ...props}) => createElement("button", props, children)`),
    '../FocusLayer': dataUrl('export const FocusLayer = "section"'),
    '../lib/blog-read': dataUrl('export const useReadPosts = () => []'),
    '../lib/blog-library': dataUrl('export const useFollowedTopics = () => [], useSavedPosts = () => []'),
    '../lib/discovery': dataUrl('export const updateSummary = () => ({unread: globalThis.__profileUnread ?? 2})'),
    '../lib/knowledge': dataUrl('export const knowledgeTopics = []'),
    './home/blog-view': dataUrl('export const openBlogLibrary = () => {}'),
    './profile/LearningGoalCard': dataUrl(`import { createElement } from ${JSON.stringify(import.meta.resolve('react'))}; export const LearningGoalCard = () => createElement("section", null, "PROFILE_LEARNING_CARD")`),
    '../lib/visibility': dataUrl('export const usePrefersReducedMotion = () => true'),
  }
  code = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`)
  return (await import(dataUrl(code))).Profile
}
const Profile = await profileComponent()

test('profile settings precede optional sections; toggles expose state and levels are collapsed', () => {
  globalThis.__profileFixture = { me: { id: 1, name: 'Очень Длинное Имя Пользователя Без Обрезания', xp: 250, streak: 2, invited: 0, rank: 1, achievements: [], is_admin: false }, feed: [], meta: { channel: {}, bot: {} }, push() {}, toast() {} }
  const html = renderToStaticMarkup(createElement(Profile))
  assert.ok(html.indexOf('Настройки') < html.indexOf('Ещё в OG CRE8R'))
  assert.ok(html.indexOf('PROFILE_LEARNING_CARD') < html.indexOf('Уровни и достижения'))
  assert.match(html, /<details class="group mt-6">/)
  assert.match(html, /role="group" aria-label="Тема оформления"/)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 2)
  assert.match(html, /Поделиться карточкой/)
  assert.doesNotMatch(html, /Поделиться в сторис|>Админка</)
  assert.match(html, /Очень Длинное Имя Пользователя Без Обрезания/)
  assert.equal(globalThis.__profileTilt, false)
  globalThis.__profileFixture.me.is_admin = true
  assert.match(renderToStaticMarkup(createElement(Profile)), />Админка</)
  delete globalThis.__profileFixture; delete globalThis.__profileTilt
})


test('empty loaded news selection does not claim the entire archive has been read', () => {
  globalThis.__profileFixture = { me: { id: 1, name: 'User', xp: 0, streak: 0, invited: 0, rank: 1, achievements: [], is_admin: false }, feed: [], meta: { channel: {}, bot: {} }, push() {}, toast() {} }
  globalThis.__profileUnread = 0
  const html = renderToStaticMarkup(createElement(Profile))
  assert.match(html, /Ещё почитать/)
  assert.match(html, /Посмотреть новости/)
  assert.doesNotMatch(html, /Всё прочитано/)
  delete globalThis.__profileFixture; delete globalThis.__profileUnread; delete globalThis.__profileTilt
})

test('weekly goal counts current OG and standalone completions from progress, separately from Academy', async () => {
  const source = await readFile(new URL('../supabase/functions/api/index.ts', import.meta.url), 'utf8')
  const fn = source.match(/async function learningGoal\(body: Row\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(fn, 'actual learningGoal route must be inspected')
  const { code } = await transformWithOxc(fn, 'profile-goal-contract.ts', { lang: 'ts' })
  const run = new Function('db', 'member', 'learningLocalParts', 'localMidnightUtc', 'buildFeed', 'canRead', `${code}; return learningGoal;`)
  const since = '2026-11-02T00:00:00.000Z'
  const tables = {
    progress: [
      { user_id: 42, lesson_id: 101, completed_at: '2026-11-03T12:00:00.000Z', fixture: 'OG course' },
      { user_id: 42, lesson_id: 102, completed_at: '2026-11-04T12:00:00.000Z', fixture: 'standalone lesson' },
      { user_id: 42, lesson_id: 103, completed_at: '2026-10-20T12:00:00.000Z', fixture: 'old lesson' },
      { user_id: 99, lesson_id: 101, completed_at: '2026-11-03T12:00:00.000Z', fixture: 'another user' },
    ],
    aa_progress: [{ user_id: 42, lesson_code: 'VC-101-L01', completed_at: '2026-11-03T12:00:00.000Z' }],
  }
  const selectedTables = []
  const db = { from(name) {
    selectedTables.push(name)
    let rows = tables[name]
    return { select() { return this }, eq(key, value) { rows = rows.filter(row => row[key] === value); return this }, gte(key, value) { rows = rows.filter(row => row[key] >= value); return this }, then(resolve) { return Promise.resolve({ count: rows.length, error: null }).then(resolve) } }
  } }
  const goal = run(db, async () => ({ id: 42, learning_timezone: 'UTC' }), () => ({ week: '2026-11-02' }), () => since, async () => [], async () => true)
  const value = await goal({ action: 'get' })
  assert.equal(value.completed, 2)
  assert.deepEqual(selectedTables, ['progress'])
  const og = await readFile(new URL('../src/screens/home/OGPractice.tsx', import.meta.url), 'utf8')
  assert.match(og, /api\.complete\(loaded\.id,/)
  const completionSql = await readFile(new URL('../supabase/migrations/20261016201213_ordinary_quiz_attempts.sql', import.meta.url), 'utf8')
  assert.match(completionSql, /insert into public\.progress\(user_id, lesson_id/)
  const academySql = await readFile(new URL('../supabase/migrations/20261028091000_academy_version_policy.sql', import.meta.url), 'utf8')
  assert.match(academySql, /insert into aa_progress/)
})


test('manual refresh is blocked with an unsaved draft and refreshes confirmed progress after cancel', async () => {
  let server = initial, loads = 0
  const settings = setup({ load: async () => { loads++; return server } })
  await settings.load()
  settings.edit({ goal: 7 })
  server = { ...initial, goal: 5, completed: 4 }
  await settings.load(true)
  assert.equal(loads, 1)
  assert.equal(settings.getSnapshot().saved.goal, 3)
  assert.equal(settings.getSnapshot().draft.goal, 7)
  settings.reset()
  await settings.load(true)
  assert.equal(loads, 2)
  assert.equal(settings.getSnapshot().saved.completed, 4)
  assert.equal(settings.getSnapshot().saved.goal, 5)
  assert.equal(settings.getSnapshot().draft.goal, 5)
  assert.equal(settings.getSnapshot().notice, 'Данные обновлены.')
})

test('refresh UI explains stale progress and protects an unsaved settings draft', () => {
  const html = render({ saved: initial, draft: { ...learningSettings(initial), goal: 7 }, busy: null, error: null, notice: '' })
  assert.match(html, /По последней загрузке/)
  assert.match(html, /<button disabled=""[^>]*>Обновить прогресс<\/button>/)
  assert.match(html, /сначала сохрани или отмени изменения настроек/)
  delete globalThis.__profileSettings
})

test('demo reset confirmation describes its full scope and cancel has no side effects', async () => {
  const source = await readFile(new URL('../src/screens/Profile.tsx', import.meta.url), 'utf8')
  const body = source.match(/onClick=\{async \(\) => \{\n(\s+if \(!await confirmDialog\([\s\S]*?)\n\s+\}\}/)?.[1]
  assert.ok(body, 'must inspect the real reset button handler')
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const run = new AsyncFunction('confirmDialog', 'loadDemo', 'location', body.replace("import('../lib/mock')", 'loadDemo()'))
  let message, imports = 0, resets = 0, reloads = 0
  const loadDemo = async () => { imports++; return { resetDemo() { resets++ } } }
  const location = { reload() { reloads++ } }
  await run(async value => { message = value; return false }, loadDemo, location)
  assert.deepEqual([imports, resets, reloads], [0, 0, 0])
  for (const part of ['уроки и курсы', 'созданные в демо материалы', 'прогресс', 'награды', 'лайки', 'доступы', 'условные покупки и заявки', 'попытки проверок', 'открытые окна и коды адвента', 'Закладки, темы и отдельные демо-разделы сохранятся', 'Настоящий аккаунт не изменится']) assert.ok(message.includes(part), part)
  await run(async () => true, loadDemo, location)
  assert.deepEqual([imports, resets, reloads], [1, 1, 1])
})

test('failed refresh retains confirmed settings and later edits are not lost or silently reloaded', async () => {
  let fail = false, loads = 0
  const settings = setup({ load: async () => { loads++; if (fail) throw Error('offline'); return initial } })
  await settings.load()
  const before = settings.getSnapshot()
  fail = true
  await settings.load(true)
  assert.equal(settings.getSnapshot().error, 'load')
  assert.equal(settings.getSnapshot().busy, null)
  assert.equal(settings.getSnapshot().saved, before.saved)
  assert.deepEqual(settings.getSnapshot().draft, before.draft)
  settings.edit({ goal: 7 })
  await settings.load(true)
  assert.equal(loads, 2)
  assert.equal(settings.getSnapshot().draft.goal, 7)
  assert.equal(settings.getSnapshot().saved.goal, 3)
})

test('failed save cannot be reset, edited or resent before a successful full reconciliation', async () => {
  let reads = 0, writes = 0, readFails = false
  const settings = setup({ load: async () => { reads++; if (readFails) throw Error('offline'); return initial }, save: async () => { writes++; throw Error('unknown write outcome') } })
  await settings.load(); settings.edit({ goal: 5 }); await settings.save()
  assert.equal(settings.getSnapshot().needsReconcile, true)
  settings.reset(); settings.edit({ goal: 7 }); await settings.save(); await settings.load(true)
  assert.equal(settings.getSnapshot().error, 'save')
  assert.equal(settings.getSnapshot().draft.goal, 5)
  assert.equal(writes, 1)
  assert.equal(reads, 1)
  readFails = true
  await settings.load()
  settings.reset()
  assert.equal(settings.getSnapshot().needsReconcile, true)
  assert.equal(settings.getSnapshot().draft.goal, 5)
  readFails = false
  await settings.load()
  assert.equal(settings.getSnapshot().needsReconcile, false)
  assert.equal(settings.getSnapshot().saveUncertain, true, 'a transport error plus a read cannot prove that a late server write is impossible')
})

test('write timeout blocks reads and reset until the original promise settles, then accepts its late success', async () => {
  const write = deferred()
  let reads = 0, writes = 0, errors = 0
  const settings = setup({ timeoutMs: 10, load: async () => { reads++; return initial }, save: () => { writes++; return write.promise }, onError: () => { errors++ } })
  await settings.load(); settings.edit({ goal: 5 }); await settings.save()
  assert.equal(settings.getSnapshot().busy, null)
  assert.equal(settings.getSnapshot().writePending, true)
  assert.equal(settings.getSnapshot().needsReconcile, true)
  settings.reset(); await settings.load(); await settings.save()
  assert.equal(reads, 1)
  assert.equal(writes, 1)
  assert.equal(errors, 0, 'UI deadline is not a real API error')
  assert.equal(settings.getSnapshot().draft.goal, 5)
  write.resolve({ ...initial, goal: 5 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settings.getSnapshot().saved.goal, 5)
  assert.equal(settings.getSnapshot().error, null)
  assert.equal(settings.getSnapshot().writePending, false)
  assert.equal(settings.getSnapshot().saveUncertain, false)
  assert.equal(settings.getSnapshot().notice, 'Настройки сохранены.')
})

test('late write rejection reports the actual API error once and requires reconciliation', async () => {
  const write = deferred(), errors = [], locked = Object.assign(new Error('locked'), { code: 'locked', status: 403 })
  const settings = setup({ timeoutMs: 10, save: () => write.promise, onError: error => errors.push(error) })
  await settings.load(); settings.edit({ goal: 5 }); await settings.save()
  write.reject(locked)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(errors, [locked])
  assert.equal(settings.getSnapshot().writePending, false)
  assert.equal(settings.getSnapshot().needsReconcile, true)
  settings.reset()
  assert.equal(settings.getSnapshot().draft.goal, 5)
})

test('real load errors reach onError while permission and load timeouts do not imitate API errors', async () => {
  const errors = [], locked = Object.assign(new Error('locked'), { code: 'locked', status: 403 })
  const failed = setup({ load: async () => { throw locked }, onError: error => errors.push(error) })
  await failed.load()
  assert.deepEqual(errors, [locked])
  let writes = 0
  const permission = setup({ timeoutMs: 10, requestPermission: () => new Promise(() => {}), save: async () => { writes++; return initial }, onError: error => errors.push(error) })
  await permission.load(); permission.edit({ enabled: true }); await permission.save()
  assert.equal(permission.getSnapshot().error, 'permission')
  assert.equal(permission.getSnapshot().writePending, false)
  assert.equal(permission.getSnapshot().needsReconcile, false)
  permission.reset()
  assert.equal(permission.getSnapshot().draft.enabled, false)
  assert.equal(writes, 0)
  const readTimeout = setup({ timeoutMs: 10, load: () => new Promise(() => {}), onError: error => errors.push(error) })
  await readTimeout.load()
  assert.deepEqual(errors, [locked])
})

test('unmount invalidates late write responses and errors without touching a later session', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const write = deferred(), errors = []
    const settings = setup({ timeoutMs: 10, save: () => write.promise, onError: error => errors.push(error) })
    await settings.load(); settings.edit({ goal: 5 }); await settings.save()
    settings.cancel(); await settings.load()
    if (outcome === 'resolve') write.resolve({ ...initial, goal: 5 })
    else write.reject(Error('stale locked'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(settings.getSnapshot().saved.goal, 3)
    assert.equal(settings.getSnapshot().saveUncertain, true)
    assert.deepEqual(errors, [])
  }
})

test('UI keeps pending writes and reconciliation visibly blocked, with honest status after a read', () => {
  let html = render({ saved: initial, draft: { ...learningSettings(initial), goal: 5 }, busy: null, error: 'save', notice: '', writePending: true, needsReconcile: true, saveUncertain: true })
  assert.match(html, /Запрос ещё выполняется/)
  assert.match(html, /<button disabled=""[^>]*>Ожидаем ответ сервера<\/button>/)
  assert.match(html, /<button disabled=""[^>]*>Отменить<\/button>/)
  assert.match(html, /<fieldset disabled/)
  html = render({ saved: initial, draft: { ...learningSettings(initial), goal: 5 }, busy: null, error: 'save', notice: '', writePending: false, needsReconcile: true, saveUncertain: true })
  assert.match(html, /<button class="[^"]*">Проверить сохранение<\/button>/)
  assert.match(html, /<button disabled=""[^>]*>Отменить<\/button>/)
  html = render({ saved: initial, draft: learningSettings(initial), busy: null, error: null, notice: '', writePending: false, needsReconcile: false, saveUncertain: true })
  assert.match(html, /Предыдущая запись могла дойти до сервера позже/)
  assert.doesNotMatch(html, /Настройки сохранены/)
  delete globalThis.__profileSettings
})

test('LearningGoalCard forwards controller API errors to the existing store guard', () => {
  const errors = [], locked = Object.assign(new Error('locked'), { code: 'locked', status: 403 })
  globalThis.__profileGuard = error => errors.push(error)
  render({ saved: initial, draft: learningSettings(initial), busy: null, error: null, notice: '' })
  globalThis.__profileControllerDeps.onError(locked)
  assert.deepEqual(errors, [locked])
  delete globalThis.__profileSettings; delete globalThis.__profileGuard; delete globalThis.__profileControllerDeps
})

test('profile channel uses the owner-approved name and opens the unchanged configured invite', async () => {
  const invite = 'https://t.me/+test-private-channel'
  globalThis.__profileFixture = { me: { id: 1, name: 'User', xp: 0, streak: 0, invited: 0, rank: 1, achievements: [], is_admin: false }, feed: [], meta: { channel: { title: 'Эл вещает', invite }, bot: {} }, push() {}, toast() {} }
  const html = renderToStaticMarkup(createElement(Profile))
  assert.match(html, /Канал OG CRE8R/)
  assert.doesNotMatch(html, /Эл вещает|Канал «/)
  const source = await readFile(new URL('../src/screens/Profile.tsx', import.meta.url), 'utf8')
  const callback = source.match(/label="Канал OG CRE8R" onClick=\{([^}]+)\}/)?.[1]
  assert.ok(callback, 'inspect the actual configured channel click handler')
  const { code } = await transformWithOxc(`const run = ${callback}`, 'channel-handler.ts', { lang: 'ts' })
  const calls = []
  const run = new Function('openLink', 'meta', `${code}; return run;`)(url => calls.push(url), globalThis.__profileFixture.meta)
  run()
  assert.deepEqual(calls, [invite])
  globalThis.__profileFixture.meta.channel.invite = null
  assert.doesNotMatch(renderToStaticMarkup(createElement(Profile)), /Канал OG CRE8R/)
  delete globalThis.__profileFixture; delete globalThis.__profileTilt
})

test('a later successful save cannot erase a prior transport-uncertainty warning', async () => {
  let failWrite = true
  const settings = setup({ save: async input => { if (failWrite) throw Error('lost transport after possible server write'); return { ...initial, ...input } } })
  await settings.load(); settings.edit({ goal: 5 }); await settings.save()
  assert.equal(settings.getSnapshot().saveUncertain, true)
  await settings.load()
  failWrite = false
  settings.edit({ goal: 7 }); await settings.save()
  assert.equal(settings.getSnapshot().saved.goal, 7)
  assert.equal(settings.getSnapshot().needsReconcile, false)
  assert.equal(settings.getSnapshot().saveUncertain, true)
  assert.equal(settings.getSnapshot().notice, 'Настройки сохранены.')
  const html = render(settings.getSnapshot())
  assert.match(html, /Предыдущая запись могла дойти до сервера позже/)
  delete globalThis.__profileSettings; delete globalThis.__profileControllerDeps
})
