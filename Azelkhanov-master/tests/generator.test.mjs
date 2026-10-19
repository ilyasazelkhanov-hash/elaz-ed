import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createClient, updateClient, inventory, applyInventory, MANIFEST, hash, safeRelative } from '../scripts/client.mjs'
import { syncOg } from '../scripts/sync-og.mjs'

const master = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'az-generator-'))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const sourceRoot = path.join(temporary, 'master')
  await fs.mkdir(path.join(sourceRoot, 'src/platform'), { recursive: true })
  // Use the real registry, configuration, manifests and generator rather than a fake schema.
  for (const file of ['src/platform/config.ts', 'src/platform/contracts.ts', 'app.config.json', 'brand.config.json', 'package.json', 'scripts/client.mjs', 'scripts/sync-og.mjs']) {
    await fs.mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true })
    await fs.copyFile(path.join(master, file), path.join(sourceRoot, file))
  }
  const add = async (relative, contents = 'export const original = 1\n') => {
    await fs.mkdir(path.dirname(path.join(sourceRoot, relative)), { recursive: true })
    await fs.writeFile(path.join(sourceRoot, relative), contents)
  }
  await add('src/App.tsx')
  await add('public/art/hero.svg', '<svg/>')
  await add('content/example.json', '{"image":"/art/hero.svg"}')
  await add('server/handler.ts', 'import type { Data } from "../src/platform/contracts.ts"\n')
  await add('supabase/functions/master-api/index.ts', 'import "../../../server/handler.ts"\n')
  await add('supabase/migrations/20261017010000_az_master.sql', 'create table az_example(id text);')
  await add('docs/GUIDE.md', '# Guide')
  await add('tests/example.test.mjs', '// portable test')
  await add('README.md', '# Portable')
  await add('.env.example', 'VITE_DEMO=true\n# BOT_TOKEN=replace_me')
  for (const file of ['.env', '.env.production', '.git/config', 'node_modules/secret.js', 'public/service-account.json', 'server/private.key', 'uploads/client.csv', 'content/members.csv', 'src/exports/user.json', 'unlisted-private.json', 'clients/acme/src/customer.ts', 'src/generated-client/.platform-kit.json', 'src/generated-client/private.ts']) await add(file, 'NEVER_COPY_ME')
  return { temporary, sourceRoot, add, out: path.join(temporary, 'outside-client'), brand: path.join(sourceRoot, 'brand.config.json'), name: 'client-test', preset: 'academy', modules: 'learning' }
}

test('creates an independent outside-root client, dependency closure and filtered navigation', async t => {
  const f = await fixture(t)
  const result = await createClient(f)
  assert.deepEqual([...result.modules].sort(), ['content', 'learning', 'progress'])
  const config = JSON.parse(await fs.readFile(path.join(f.out, 'app.config.json'), 'utf8'))
  assert.deepEqual(config.navigation, ['home', 'learning', 'profile'])
  assert.deepEqual(config.homeBlocks, ['stories', 'hero', 'learning', 'content'])
  assert.equal(config.id, 'client-test')
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(f.out, 'brand.config.json'), 'utf8')), JSON.parse(await fs.readFile(f.brand, 'utf8')))
  assert.match(await fs.readFile(path.join(f.out, '.env.example'), 'utf8'), /VITE_DEMO=false/)
  for (const file of ['src/App.tsx', 'server/handler.ts', 'supabase/functions/master-api/index.ts', 'public/art/hero.svg', 'content/example.json', 'scripts/client.mjs', 'tests/example.test.mjs', 'docs/GUIDE.md', '.env.example']) assert.ok((await fs.stat(path.join(f.out, file))).isFile(), file)
  const files = await inventory(f.out)
  assert.ok(![...files.values()].some(bytes => bytes.includes('NEVER_COPY_ME')))
  const manifest = JSON.parse(await fs.readFile(path.join(f.out, MANIFEST), 'utf8'))
  for (const [relative, digest] of Object.entries(manifest.files)) assert.equal(hash(await fs.readFile(path.join(f.out, relative))), digest)
  await assert.rejects(createClient(f), /absent or empty/)
})

test('recursive dependency resolution and source inventory exclude nested generated clients', async t => {
  const f = await fixture(t)
  f.modules = 'team'
  const result = await createClient({ ...f, out: path.join(f.sourceRoot, 'deliveries/client') })
  assert.deepEqual([...result.modules].sort(), ['community', 'content', 'learning', 'progress', 'team'])
  assert.ok(!(await inventory(f.sourceRoot)).has('src/generated-client/private.ts'))
  assert.ok(!(await inventory(f.sourceRoot)).has('deliveries/client/src/App.tsx'))
})

test('dry-run is byte-for-byte read-only; explicit apply updates safe files and preserves conflicts/config/content', async t => {
  const f = await fixture(t)
  await createClient(f)
  const manifestFile = path.join(f.out, MANIFEST)
  const before = await fs.readFile(manifestFile, 'utf8')
  await f.add('src/App.tsx', 'export const original = 2\n')
  await f.add('src/new.ts', 'export const next = 3\n')
  await f.add('src/platform/contracts.ts', '// upstream replacement')
  await fs.appendFile(path.join(f.out, 'src/platform/contracts.ts'), '\n// customer edit')
  await f.add('content/example.json', '{"customer":"upstream"}')
  await fs.writeFile(path.join(f.out, 'brand.config.json'), '{"name":"Customer original"}')
  const dry = await updateClient(f)
  assert.ok(dry.updated.includes('src/App.tsx'))
  assert.ok(dry.conflicts.includes('src/platform/contracts.ts'))
  assert.ok(dry.protected.includes('brand.config.json'))
  assert.ok(dry.protected.includes('content/example.json'))
  assert.equal(await fs.readFile(manifestFile, 'utf8'), before)
  assert.equal(await fs.readFile(path.join(f.out, 'src/App.tsx'), 'utf8'), 'export const original = 1\n')
  const applied = await updateClient({ ...f, apply: true })
  assert.ok(applied.written.includes('src/App.tsx'))
  assert.ok(applied.written.includes('src/new.ts'))
  assert.equal(await fs.readFile(path.join(f.out, 'src/App.tsx'), 'utf8'), 'export const original = 2\n')
  assert.match(await fs.readFile(path.join(f.out, 'src/platform/contracts.ts'), 'utf8'), /customer edit/)
  assert.equal(await fs.readFile(path.join(f.out, 'brand.config.json'), 'utf8'), '{"name":"Customer original"}')
  assert.equal(await fs.readFile(path.join(f.out, 'content/example.json'), 'utf8'), '{"image":"/art/hero.svg"}')
  const after = JSON.parse(await fs.readFile(manifestFile, 'utf8'))
  assert.equal(after.files['src/platform/contracts.ts'], JSON.parse(before).files['src/platform/contracts.ts'])
  assert.equal(after.files['src/App.tsx'], hash(await fs.readFile(path.join(f.out, 'src/App.tsx'))))
})

test('rejects missing/invalid CLI options and unsafe output without mutation', async t => {
  const f = await fixture(t)
  for (const change of [{ name: undefined }, { name: '../escape' }, { preset: undefined }, { preset: 'invalid' }, { modules: undefined }, { modules: 'learning,' }, { modules: 'unknown' }, { brand: undefined }, { out: undefined }, { out: f.sourceRoot }, { out: path.join(f.sourceRoot, 'src/client') }]) await assert.rejects(createClient({ ...f, ...change }))
  for (const args of [['create'], ['create', '--name'], ['update', '--out', f.out, '--apply', 'yes'], ['update', '--unknown', 'value'], ['create', '--out', f.out, '--out', f.out]]) {
    const cli = spawnSync(process.execPath, [path.join(master, 'scripts/client.mjs'), ...args], { encoding: 'utf8' })
    assert.equal(cli.status, 1, cli.stderr)
  }
  await fs.writeFile(path.join(f.temporary, 'invalid-brand.json'), '{}')
  await assert.rejects(createClient({ ...f, brand: path.join(f.temporary, 'invalid-brand.json') }), /Invalid brand/)
  for (const invalid of ['../evil', '/absolute', 'C:/escape', 'src\\evil', 'a//b', 'a/./b']) assert.throws(() => safeRelative(invalid), /Unsafe/)
})

test('tampered manifest traversal and unknown pre-existing files are protected', async t => {
  const f = await fixture(t)
  await createClient(f)
  await fs.writeFile(path.join(f.out, MANIFEST), JSON.stringify({ format: 1, files: { '../outside.txt': 'a'.repeat(64) } }))
  await assert.rejects(updateClient({ ...f, apply: true }), /Unsafe manifest/)
  const target = path.join(f.temporary, 'unmanaged')
  await fs.mkdir(target)
  await fs.writeFile(path.join(target, 'src.txt'), 'Original')
  const report = await applyInventory({ target, incoming: new Map([['src.txt', Buffer.from('Changed')]]), apply: true })
  assert.deepEqual(report.conflicts, ['src.txt'])
  assert.equal(await fs.readFile(path.join(target, 'src.txt'), 'utf8'), 'Original')
})

test('symlink/junction output and source trees are rejected', async t => {
  const f = await fixture(t)
  const real = path.join(f.temporary, 'real')
  const link = path.join(f.temporary, 'linked')
  await fs.mkdir(real)
  try { await fs.symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('Host cannot create symlinks'); return } throw error }
  await assert.rejects(createClient({ ...f, out: path.join(link, 'client') }), /Symlinks/)
  await fs.symlink(real, path.join(f.sourceRoot, 'src/linked'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(createClient(f), /symlink/i)
})

test('OG sync copies independent namespaces and rewrites backend relative imports; preserves OG original', async t => {
  const f = await fixture(t)
  const target = path.join(f.temporary, 'og')
  await fs.mkdir(target)
  await fs.writeFile(path.join(target, 'README.md'), 'OG original')
  const dry = await syncOg({ sourceRoot: f.sourceRoot, target })
  assert.ok(dry.added.includes('src/platform-kit/src/App.tsx'))
  assert.deepEqual(await fs.readdir(target), ['README.md'])
  await syncOg({ sourceRoot: f.sourceRoot, target, apply: true })
  assert.equal(await fs.readFile(path.join(target, 'README.md'), 'utf8'), 'OG original')
  const config = JSON.parse(await fs.readFile(path.join(target, 'src/platform-kit/app.config.json'), 'utf8'))
  const brand = JSON.parse(await fs.readFile(path.join(target, 'src/platform-kit/brand.config.json'), 'utf8'))
  assert.equal(config.id, 'og-cre8r')
  assert.equal(brand.colors.primary, '#A58BFF')
  assert.match(await fs.readFile(path.join(target, 'server/platform-kit/handler.ts'), 'utf8'), /\.\.\/\.\.\/src\/platform-kit\/src\/platform\/contracts.ts/)
  assert.match(await fs.readFile(path.join(target, 'supabase/functions/az-master-api/index.ts'), 'utf8'), /server\/platform-kit\/handler.ts/)
  assert.match(await fs.readFile(path.join(target, 'src/platform-kit/content/example.json'), 'utf8'), /platform-assets/)
  await fs.writeFile(path.join(target, 'src/platform-kit/src/App.tsx'), 'OG edit')
  const report = await syncOg({ sourceRoot: f.sourceRoot, target, apply: true })
  assert.ok(report.conflicts.includes('src/platform-kit/src/App.tsx'))
  assert.equal(await fs.readFile(path.join(target, 'src/platform-kit/src/App.tsx'), 'utf8'), 'OG edit')
})

test('actual master inventory produces a portable, hash-complete client outside checkout', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'az-full-package-'))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const out = path.join(temporary, 'complete-client')
  await createClient({ sourceRoot: master, out, name: 'complete-client', preset: 'services', brand: path.join(master, 'brand.config.json'), modules: 'commerce,events' })
  const manifest = JSON.parse(await fs.readFile(path.join(out, MANIFEST), 'utf8'))
  for (const required of ['package.json', 'src/platform/contracts.ts', 'src/platform/config.ts', 'app.config.json', 'brand.config.json', 'scripts/client.mjs', 'scripts/sync-og.mjs', 'tests/generator.test.mjs', 'README.md', 'AGENTS.md', 'docs/DEPLOYMENT.md', 'vercel.json']) assert.ok(Object.hasOwn(manifest.files, required), required)
  for (const [relative, digest] of Object.entries(manifest.files)) {
    assert.equal(hash(await fs.readFile(path.join(out, relative))), digest, relative)
    assert.doesNotMatch(relative, /(?:^|\/)(?:node_modules|\.git|clients)(?:\/|$)|(?:^|\/)\.env(?:$|\.(?!example$))/)
  }
  assert.match(await fs.readFile(path.join(out, '.env.example'), 'utf8'), /VITE_DEMO=false/)
  const configCheck = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/config.test.mjs'], { cwd: out, encoding: 'utf8' })
  assert.equal(configCheck.status, 0, configCheck.stdout + configCheck.stderr)
})
