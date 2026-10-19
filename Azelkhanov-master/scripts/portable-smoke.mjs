import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createClient } from './client.mjs'
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  temp = await mkdtemp(path.join(tmpdir(), 'az-portable-')),
  out = path.join(temp, 'client')
await createClient({
  sourceRoot,
  out,
  name: 'portable-smoke',
  preset: 'academy',
  brand: path.join(sourceRoot, 'brand.config.json'),
  modules: 'learning,campaigns,loyalty,commerce,events,community,team,retention,analytics',
})
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: out,
      windowsHide: true,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error('Portable smoke command failed: ' + args.join(' '))),
    )
  })
await run(['ci', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'])
await run(['run', 'build'])
const manifest = JSON.parse(await readFile(path.join(out, '.platform-kit.json'), 'utf8'))
await mkdir(path.join(sourceRoot, 'test-results'), { recursive: true })
await writeFile(
  path.join(sourceRoot, 'test-results/portable-report.json'),
  JSON.stringify(
    {
      out,
      files: Object.keys(manifest.files).length,
      checks: ['outside workspace', 'own node_modules via npm ci', 'TypeScript', 'production build'],
      version: manifest.templateVersion,
    },
    null,
    2,
  ),
)
console.log('PASS portable project installed and built independently: ' + out)
