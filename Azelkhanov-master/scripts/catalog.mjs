import { readFile, writeFile } from 'node:fs/promises'
import { buildCatalog } from '../content/catalog.ts'
import { validateConfig } from '../src/platform/config.ts'

const root = new URL('../', import.meta.url)
const readJson = async (file) => JSON.parse(await readFile(new URL(file, root), 'utf8'))
const { config, brand } = validateConfig(await readJson('app.config.json'), await readJson('brand.config.json'))
const entities = buildCatalog(config.preset, brand.name).filter((entity) => config.modules.includes(entity.module))
await writeFile(new URL('content/catalog.json', root), JSON.stringify(entities, null, 2) + '\n')
console.log('Wrote private provisioning catalog; do not serve content/ as public assets.')
