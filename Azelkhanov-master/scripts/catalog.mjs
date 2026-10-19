import { writeFile } from 'node:fs/promises'
import { buildCatalog } from '../content/catalog.ts'
await writeFile(new URL('../content/catalog.json',import.meta.url),JSON.stringify(buildCatalog(),null,2)+'\n')
console.log('Wrote private provisioning catalog; do not serve content/ as public assets.')
