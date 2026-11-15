import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createClient, inventory } from '../scripts/client.mjs'

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
  assert.equal(await readFile(catalogPath, 'utf8'), JSON.stringify(before, null, 2) + '\n')
  const after = JSON.parse(await readFile(path.join(out, 'content/catalog.preview.json'), 'utf8'))
  assert.deepEqual(after.map((entity) => entity.id), before.map((entity) => entity.id))
  assert.equal(after.find((entity) => entity.id === 'course-first').title, 'От идеи до первого проекта')
  assert.ok(after.every((entity) => ['content', 'learning', 'progress', 'events'].includes(entity.module)))
  assert.ok(JSON.stringify(after).includes(brand.name))
  assert.ok(!JSON.stringify(after).includes('Azelkhanov'))
  const events = after.filter((entity) => entity.kind === 'event')
  assert.ok(events.length > 0)
  assert.ok(events.every((entity) => Date.parse(entity.data.startsAt) > Date.now()))
})


test('catalog replacement rejects missing/stale fingerprint and backs up exact original bytes', async (t) => {
 const temporary = await mkdtemp(path.join(tmpdir(), 'az-catalog-guard-'))
 t.after(() => rm(temporary, { recursive: true, force: true }))
 const out=path.join(temporary,'client')
 await createClient({sourceRoot:master,out,name:'guarded-client',preset:'club',brand:path.join(master,'brand.config.json'),modules:'content'})
 const catalog=path.join(out,'content/catalog.json'), original=await readFile(catalog,'utf8')
 const run=(...args)=>spawnSync(process.execPath,[path.join(out,'scripts/catalog.mjs'),...args],{cwd:temporary,encoding:'utf8'})
 const preview=run();assert.equal(preview.status,0,preview.stderr)
 const sha=JSON.parse(preview.stdout).sourceSha256
 assert.notEqual(run('--replace-demo').status,0)
 assert.notEqual(run('--replace-demo','--expected-sha256=bad').status,0)
 assert.equal(await readFile(catalog,'utf8'),original)
 await writeFile(catalog,original+' ')
 assert.notEqual(run('--replace-demo',`--expected-sha256=${sha}`).status,0)
 assert.equal(await readFile(catalog,'utf8'),original+' ')
 const next=JSON.parse(run().stdout)
 const result=run('--replace-demo',`--expected-sha256=${next.sourceSha256}`)
 assert.equal(result.status,0,result.stderr)
 assert.equal(await readFile(path.join(out,`content/catalog.backup-${next.sourceSha256}.json`),'utf8'),original+' ')
 const files=await inventory(out)
 assert.equal(files.has('content/catalog.preview.json'),false)
 assert.equal(files.has(`content/catalog.backup-${next.sourceSha256}.json`),false)
})
