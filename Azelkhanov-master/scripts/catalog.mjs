import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildCatalog } from '../content/catalog.ts'
import { validateConfig } from '../src/platform/config.ts'

const root = new URL('../', import.meta.url)
const args = process.argv.slice(2)
const replace = args.includes('--replace-demo')
const expected = args.find((arg) => arg.startsWith('--expected-sha256='))?.split('=')[1]
if (args.some((arg) => arg !== '--replace-demo' && !arg.startsWith('--expected-sha256=')))
  throw new Error('Use no flags for preview, or --replace-demo --expected-sha256=<preview source SHA256>.')
const catalog = new URL('content/catalog.json', root)
const original = await readFile(catalog)
const sha = (value) => createHash('sha256').update(value).digest('hex')
const fingerprint = sha(original)
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const { config, brand } = validateConfig(await readJson('app.config.json'), await readJson('brand.config.json'))
const entities = buildCatalog(config.preset, brand.name).filter((entity) => config.modules.includes(entity.module))
const output = JSON.stringify(entities, null, 2) + '\n'
const before = JSON.parse(original.toString('utf8'))
const old = new Map(before.map((entity) => [entity.id, entity]))
const next = new Map(entities.map((entity) => [entity.id, entity]))
const report = {
  sourceSha256: fingerprint,
  added: entities.filter((entity) => !old.has(entity.id)).map((entity) => entity.id),
  removed: before.filter((entity) => !next.has(entity.id)).map((entity) => entity.id),
  changed: entities.filter((entity) => old.has(entity.id) && JSON.stringify(old.get(entity.id)) !== JSON.stringify(entity)).map((entity) => entity.id),
}
if (replace) {
  if (!expected || expected !== fingerprint) throw new Error('Catalog fingerprint mismatch or missing. Run preview and review the diff first; catalog unchanged.')
  // Keep an exact preimage. Never replace an existing backup silently.
  const backup = new URL(`content/catalog.backup-${fingerprint}.json`, root)
  try { await writeFile(backup, original, { flag: 'wx' }) }
  catch (error) { if (error.code !== 'EEXIST' || sha(await readFile(backup)) !== fingerprint) throw error }
  if (sha(await readFile(catalog)) !== fingerprint) throw new Error('Catalog changed during generation; replacement cancelled.')
  await writeFile(catalog, output)
  console.log(JSON.stringify({ ...report, replaced: true, backup: backup.pathname }, null, 2))
} else {
  await writeFile(new URL('content/catalog.preview.json', root), output)
  console.log(JSON.stringify({ ...report, replaced: false, preview: 'content/catalog.preview.json' }, null, 2))
}
