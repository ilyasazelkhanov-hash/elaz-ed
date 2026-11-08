import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createClient } from '../scripts/client.mjs'

const master = fileURLToPath(new URL('../', import.meta.url))
test('catalog regeneration respects the independent client preset, brand and enabled modules', async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'az-client-catalog-'))
  t.after(() => rm(temporary, { recursive: true, force: true }))
  const brand = JSON.parse(await readFile(path.join(master, 'brand.config.json'), 'utf8'))
  brand.name = 'Independent Academy'
  const brandPath = path.join(temporary, 'brand.json')
  await writeFile(brandPath, JSON.stringify(brand))
  const out = path.join(temporary, 'client')
  await createClient({ sourceRoot: master, out, name: 'independent-academy', preset: 'academy', brand: brandPath, modules: 'learning,events' })
  const catalogPath = path.join(out, 'content/catalog.json')
  const before = JSON.parse(await readFile(catalogPath, 'utf8'))
  const result = spawnSync(process.execPath, [path.join(out, 'scripts/catalog.mjs')], { cwd: temporary, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const after = JSON.parse(await readFile(catalogPath, 'utf8'))
  assert.deepEqual(after.map((entity) => entity.id), before.map((entity) => entity.id))
  assert.equal(after.find((entity) => entity.id === 'course-first').title, 'От идеи до первого проекта')
  assert.ok(after.every((entity) => ['content', 'learning', 'progress', 'events'].includes(entity.module)))
  assert.ok(JSON.stringify(after).includes(brand.name))
  assert.ok(!JSON.stringify(after).includes('Azelkhanov'))
  const events = after.filter((entity) => entity.kind === 'event')
  assert.ok(events.length > 0)
  assert.ok(events.every((entity) => Date.parse(entity.data.startsAt) > Date.now()))
})
