import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

let instance = 0
async function browser(t, initial = {}) {
 const values = new Map(Object.entries(initial)), events = new EventTarget()
 let readBlocked = false, writeBlocked = false, writes = 0, changes = 0
 const storage = {
  getItem(key) { if (readBlocked) throw new Error('Storage blocked'); return values.get(key) ?? null },
  setItem(key, value) { writes++; if (writeBlocked) throw new DOMException('Storage full', 'QuotaExceededError'); values.set(key, value) },
 }
 for (const [name, value] of [['localStorage', storage], ['window', events]]) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { configurable: true, value })
  t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name])
 }
 events.addEventListener('og:blog-read', () => changes++)
 const file = new URL('../src/lib/blog-read.ts', import.meta.url)
 // Read the real hook's client snapshot without mounting the rest of the app.
 const source = stripTypeScriptTypes(await readFile(file, 'utf8')).replace(
  /import\s*{\s*useSyncExternalStore\s*}\s*from\s*['"]react['"]/,
  'const useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot()',
 )
 const module = await import(`data:text/javascript;base64,${Buffer.from(source + `\n// instance ${instance++}`).toString('base64')}`)
 return { ...module, values, blockReads: value => { readBlocked = value }, blockWrites: value => { writeBlocked = value }, writes: () => writes, changes: () => changes }
}

test('quota failures preserve new read markers over stale stored values, including repeated marks', async t => {
 const app = await browser(t, { 'og:blog:read:1': '[11]' })
 app.blockWrites(true)
 app.markPostRead(1, 12)
 assert.deepEqual(app.useReadPosts(1), [11, 12])
 app.markPostRead(1, 13)
 app.markPostRead(1, 12)
 assert.deepEqual(app.useReadPosts(1), [11, 12, 13])
 assert.equal(app.values.get('og:blog:read:1'), '[11]')
 assert.equal(app.writes(), 2)
 assert.equal(app.changes(), 2)
})

test('read markers stay isolated by account when storage is fully blocked', async t => {
 const app = await browser(t)
 app.blockReads(true); app.blockWrites(true)
 app.markPostRead(1, 21)
 app.markPostRead(2, 22)
 app.markPostRead(1, 23)
 assert.deepEqual(app.useReadPosts(1), [21, 23])
 assert.deepEqual(app.useReadPosts(2), [22])
})

test('storage recovery persists all session marks and later external writes remain visible', async t => {
 const app = await browser(t, { 'og:blog:read:1': '[31]' })
 app.blockWrites(true)
 app.markPostRead(1, 32)
 app.blockWrites(false)
 app.markPostRead(1, 33)
 assert.equal(app.values.get('og:blog:read:1'), '[31,32,33]')
 app.values.set('og:blog:read:1', '[31,32,33,34]')
 assert.deepEqual(app.useReadPosts(1), [31, 32, 33, 34])
 app.blockReads(true)
 assert.deepEqual(app.useReadPosts(1), [31, 32, 33])
})

test('quota fallback keeps the 500-marker limit', async t => {
 const app = await browser(t, { 'og:blog:read:1': JSON.stringify(Array.from({ length: 500 }, (_, i) => i + 1)) })
 app.blockWrites(true)
 app.markPostRead(1, 501)
 app.markPostRead(1, 502)
 const read = app.useReadPosts(1)
 assert.equal(read.length, 500)
 assert.equal(read[0], 3)
 assert.equal(read.at(-1), 502)
})

test('pending session marks merge other-tab updates and persist them on recovery', async t => {
 const app = await browser(t, { 'og:blog:read:1': '[11]' })
 app.blockWrites(true)
 app.markPostRead(1, 12)
 app.values.set('og:blog:read:1', '[11,13]')
 assert.deepEqual(app.useReadPosts(1), [11, 13, 12])
 app.blockWrites(false)
 app.markPostRead(1, 14)
 assert.deepEqual(JSON.parse(app.values.get('og:blog:read:1')), [11, 13, 12, 14])
 app.values.set('og:blog:read:1', '[11,13,12,14,15]')
 assert.deepEqual(app.useReadPosts(1), [11, 13, 12, 14, 15])
})

test('merging another tab with pending marks does not reintroduce evicted old storage IDs', async t => {
 const range = start => Array.from({ length: 500 }, (_, i) => start + i)
 const app = await browser(t, { 'og:blog:read:1': JSON.stringify(range(1)) })
 app.blockWrites(true)
 app.markPostRead(1, 501)
 app.values.set('og:blog:read:1', JSON.stringify(range(3)))
 const read = app.useReadPosts(1)
 assert.deepEqual(read, range(3))
})
