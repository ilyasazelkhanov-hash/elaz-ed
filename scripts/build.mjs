import {spawnSync} from 'node:child_process'
import {writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {frontendSourceIdentity, frontendRelease} from './frontend-release.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
// Capture the source checkout before generators refresh derived books/materials.
// Their output is covered by the final build fingerprint, not mistaken for edits.
const identity = frontendSourceIdentity(root)
for (const args of [
  ['scripts/academy-content.mjs'],
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vite/bin/vite.js', 'build'],
  ['scripts/academy-prerender.mjs'],
]) {
  const result = spawnSync(process.execPath, args, {cwd: root, env: process.env, stdio: 'inherit', windowsHide: true})
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}
const release = await frontendRelease(root, process.env, identity)
await writeFile(new URL('../dist/release.json', import.meta.url), JSON.stringify(release, null, 2) + '\n')
console.log(`Frontend identity: ${release.commit || 'unknown commit'}, ${release.file_count} files, dirty=${release.dirty}`)
