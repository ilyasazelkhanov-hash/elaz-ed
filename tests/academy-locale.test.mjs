import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { academyMultilingualEnabled, supportedAcademyLocales } from '../src/lib/academy-config.ts'

const key = 'og:academy:locale'

function storage(t, initial) {
 const descriptors = ['localStorage', 'window'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
 const values = new Map(initial === undefined ? [] : [[key, initial]])
 let writes = 0
 const events = new EventTarget()
 Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: name => values.get(name) ?? null, setItem: (name, value) => { writes++; values.set(name, value) } } })
 Object.defineProperty(globalThis, 'window', { configurable: true, value: events })
 t.after(() => { for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name] } })
 return { values, events, writes: () => writes }
}

async function localeModule(t, multilingual) {
 const server = await createServer({ configFile: false, envDir: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom', define: { 'import.meta.env.VITE_ACADEMY_MULTILINGUAL': JSON.stringify(multilingual) } })
 t.after(() => server.close())
 const locale = await server.ssrLoadModule('/src/lib/academy-i18n.ts')
 const config = await server.ssrLoadModule('/src/lib/academy-config.ts')
 return { ...locale, ...config }
}

test('Academy defaults to a Russian-only release', () => {
 assert.equal(academyMultilingualEnabled, false)
 assert.deepEqual(supportedAcademyLocales(), ['ru'])
})

test('Russian-only mode ignores old choices and preserves them for a later release', async t => {
 const store = storage(t, 'en')
 const locale = await localeModule(t, 'false')
 assert.deepEqual(locale.supportedAcademyLocales(), ['ru'])
 for (const oldChoice of ['en', 'kk', 'ru', 'invalid']) {
  store.values.set(key, oldChoice)
  assert.equal(locale.getAcademyLocale(), 'ru')
  assert.equal(locale.academyText('Каталог'), 'Каталог')
  assert.equal(locale.academyText('Моё обучение', 'kk'), 'Моё обучение')
  assert.equal(locale.academyText('Моё обучение', 'en'), 'Моё обучение')
  locale.setAcademyLocale('ru')
  locale.setAcademyLocale('kk')
  assert.equal(store.values.get(key), oldChoice)
 }
 const entity = { code: 'L1', kind: 'lesson', title: 'Русский урок', state: 'published', data: { translations: { en: { title: 'English lesson' }, kk: { title: 'Қазақша сабақ' } } } }
 assert.equal(locale.localizedEntity(entity, 'kk'), entity)
 assert.equal(locale.localizedEntity(entity, 'en'), entity)
 assert.equal(store.writes(), 0)
})

test('multilingual release restores stored preferences and existing translations', async t => {
 const store = storage(t, 'kk')
 const locale = await localeModule(t, 'true')
 assert.deepEqual(locale.supportedAcademyLocales(), ['ru', 'kk', 'en'])
 assert.equal(locale.getAcademyLocale(), 'kk')
 assert.equal(locale.academyText('Моё обучение'), 'Менің оқуым')
 let changes = 0
 store.events.addEventListener('og:academy-locale', () => changes++)
 locale.setAcademyLocale('en')
 assert.equal(locale.getAcademyLocale(), 'en')
 assert.equal(locale.academyText('Моё обучение'), 'My learning')
 assert.equal(changes, 1)
 const entity = { code: 'L1', kind: 'lesson', title: 'Русский урок', state: 'published', data: { description: 'Описание', translations: { en: { title: 'English lesson', data: { description: 'Description' } }, kk: { title: 'Қазақша сабақ' } } } }
 assert.equal(locale.localizedEntity(entity, locale.getAcademyLocale()).title, 'English lesson')
 assert.equal(locale.localizedEntity(entity, 'kk').title, 'Қазақша сабақ')
 assert.equal(locale.localizedEntity(entity, 'ru'), entity)
 store.values.set(key, 'invalid')
 assert.equal(locale.getAcademyLocale(), 'ru')
})

test('blocked storage still gives Russian in a multilingual release', async t => {
 storage(t)
 Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage is unavailable') } })
 const locale = await localeModule(t, 'true')
 assert.equal(locale.getAcademyLocale(), 'ru')
 assert.doesNotThrow(() => locale.setAcademyLocale('en'))
})
