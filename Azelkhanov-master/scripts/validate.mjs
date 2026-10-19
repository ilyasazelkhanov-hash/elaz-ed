import { readFile } from 'node:fs/promises'
import { validateConfig } from '../src/platform/config.ts'
const root = new URL('../', import.meta.url)
const config = JSON.parse(await readFile(new URL('app.config.json',root),'utf8'))
const brand = JSON.parse(await readFile(new URL('brand.config.json',root),'utf8'))
validateConfig(config, brand)
console.log(`Validated ${config.id}: ${config.modules.length} modules, ${config.preset} preset`)
