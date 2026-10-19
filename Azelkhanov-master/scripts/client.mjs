#!/usr/bin/env node
/** Portable client packaging. Node 24+; no network or deployment side effects. */
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MANIFEST = '.platform-kit.json'
const roots = new Set(['src', 'content', 'public', 'server', 'supabase', 'scripts', 'tests', 'docs'])
const rootFiles = new Set([
  'package.json',
  'package-lock.json',
  'index.html',
  'tsconfig.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'app.config.json',
  'brand.config.json',
  '.env.example',
  '.gitignore',
  '.prettierrc.json',
  'README.md',
  'AGENTS.md',
  'vercel.json',
])
const excluded =
  /^(?:node_modules|\.git|\.vercel|\.next|\.temp|\.branches|dist|coverage|backups?|uploads|client-data|clients|customers|exports?|logs?|sessions|generated|\.platform-kit\.json)$/i
const secret =
  /(?:^\.env(?!\.example$)|\.(?:pem|key|p12|pfx|sqlite|db|bak|csv|log)$|^(?:credentials|secrets|service-account)(?:\.|$))/i
const protectedFile = (file) =>
  file === 'app.config.json' ||
  file === 'brand.config.json' ||
  /(?:^|\/)(?:[^/]*config[^/]*|package(?:-lock)?\.json|vercel\.json|\.env\.example)$/i.test(file) ||
  file.startsWith('content/') ||
  file.startsWith('supabase/migrations/')
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const inside = (parent, target) => {
  const relative = path.relative(parent, target)
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
}
const exists = async (file) => {
  try {
    await fs.lstat(file)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

export function safeRelative(file) {
  if (
    typeof file !== 'string' ||
    !file ||
    file.includes('\\') ||
    file.includes(':') ||
    file.includes('\0') ||
    path.posix.isAbsolute(file) ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Unsafe manifest path: ${file}`)
  return file
}
export async function assertNoSymlink(target) {
  let cursor = path.resolve(target)
  for (;;) {
    if (await exists(cursor)) {
      const stat = await fs.lstat(cursor)
      if (stat.isSymbolicLink()) throw new Error(`Symlinks are not supported: ${cursor}`)
      if (cursor !== path.resolve(target) && !stat.isDirectory())
        throw new Error(`Parent is not a directory: ${cursor}`)
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
}

export async function inventory(sourceRoot, skip = []) {
  sourceRoot = path.resolve(sourceRoot)
  await assertNoSymlink(sourceRoot)
  const files = new Map()
  async function visit(directory, relative = '') {
    if (relative && (await exists(path.join(directory, MANIFEST)))) return
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (excluded.test(entry.name) || secret.test(entry.name)) continue
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      if (!relative && !roots.has(entry.name) && !rootFiles.has(entry.name)) continue
      const absolute = path.join(directory, entry.name)
      if (skip.some((target) => inside(target, absolute))) continue
      if (entry.isSymbolicLink()) throw new Error(`Source contains symlink: ${rel}`)
      if (entry.isDirectory()) await visit(absolute, rel)
      else if (entry.isFile()) files.set(safeRelative(rel), await fs.readFile(absolute))
    }
  }
  await visit(sourceRoot)
  return files
}

async function registry(sourceRoot) {
  return import(pathToFileURL(path.join(sourceRoot, 'src/platform/config.ts')).href)
}
async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}
async function templateVersion(sourceRoot) {
  return (await readJson(path.join(sourceRoot, 'package.json'))).version
}
function validBrand(brand) {
  if (
    !brand ||
    typeof brand !== 'object' ||
    typeof brand.name !== 'string' ||
    !brand.name.trim() ||
    !brand.colors ||
    !brand.fonts ||
    !['body', 'display'].every((key) => typeof brand.fonts[key] === 'string' && brand.fonts[key]) ||
    !['primary', 'ink', 'background', 'accent', 'surface', 'muted'].every((key) =>
      /^#[a-f0-9]{6}$/i.test(brand.colors[key]),
    ) ||
    !['logo', 'monogram', 'wordmark', 'tagline', 'id'].every((key) => typeof brand[key] === 'string') ||
    !Number.isFinite(brand.radius) ||
    brand.radius < 0 ||
    brand.radius > 48 ||
    !['full', 'reduced'].includes(brand.motion)
  )
    throw new Error('Invalid brand JSON; use brand.config.json as the schema example')
}
function outputPath(sourceRoot, output) {
  if (!output) throw new Error('Missing required --out')
  const target = path.resolve(output)
  if (inside(target, sourceRoot)) throw new Error('Output must not be source root or its ancestor')
  if (inside(sourceRoot, target)) {
    const top = path.relative(sourceRoot, target).split(path.sep)[0]
    if (roots.has(top) || rootFiles.has(top)) throw new Error('Output must not be inside an implementation directory')
  }
  return target
}
export async function createClient({ sourceRoot, out, name, preset, brand: brandPath, modules: selection }) {
  sourceRoot = path.resolve(sourceRoot)
  if (!name || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(name))
    throw new Error('Required --name must be a lowercase id (2–64 letters, digits, hyphens)')
  if (!preset) throw new Error('Missing required --preset')
  if (!brandPath) throw new Error('Missing required --brand')
  if (typeof selection !== 'string' || !selection.trim() || selection.split(',').some((id) => !id.trim()))
    throw new Error('Required --modules must be a comma-separated module list')
  const target = outputPath(sourceRoot, out)
  await assertNoSymlink(target)
  if ((await exists(target)) && (await fs.readdir(target)).length)
    throw new Error('Output must be absent or empty; create never overwrites files')
  await assertNoSymlink(brandPath)
  const brand = await readJson(brandPath)
  validBrand(brand)
  const files = await inventory(sourceRoot, [target])
  const { presets, resolveModules, validateConfig } = await registry(sourceRoot)
  if (!Object.hasOwn(presets, preset)) throw new Error(`Unknown preset: ${preset}`)
  const enabled = resolveModules(selection.split(',').map((id) => id.trim()))
  const blockModules = { stories: 'content', wallet: 'loyalty', missions: 'campaigns' }
  const config = {
    ...presets[preset],
    id: name,
    name: brand.name,
    modules: enabled,
    navigation: presets[preset].navigation.filter((id) => ['home', 'profile'].includes(id) || enabled.includes(id)),
    homeBlocks: presets[preset].homeBlocks.filter((id) => id === 'hero' || enabled.includes(blockModules[id] || id)),
  }
  validateConfig(config, brand)
  files.set('app.config.json', json(config))
  files.set('brand.config.json', json(brand))
  if (files.has('content/catalog.ts')) {
    const { buildCatalog } = await import(pathToFileURL(path.join(sourceRoot, 'content/catalog.ts')).href)
    files.set('content/catalog.json', json(buildCatalog(preset, brand.name).filter((e) => enabled.includes(e.module))))
  }
  if (files.has('.env.example'))
    files.set(
      '.env.example',
      Buffer.from(
        files
          .get('.env.example')
          .toString()
          .replace(/^VITE_DEMO=.*$/m, 'VITE_DEMO=false'),
      ),
    )
  if (files.has('supabase/config.toml'))
    files.set(
      'supabase/config.toml',
      Buffer.from(
        files
          .get('supabase/config.toml')
          .toString()
          .replace(/^project_id\s*=.*$/m, `project_id = "${name}"`),
      ),
    )
  const pkg = JSON.parse(files.get('package.json').toString())
  pkg.name = name
  files.set('package.json', json(pkg))
  if (files.has('package-lock.json')) {
    const lock = JSON.parse(files.get('package-lock.json').toString())
    lock.name = name
    if (lock.packages?.['']) lock.packages[''].name = name
    files.set('package-lock.json', json(lock))
  }
  await fs.mkdir(target, { recursive: true })
  const hashes = {}
  for (const [relative, bytes] of files) {
    const file = path.join(target, relative)
    await assertNoSymlink(file)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, bytes, { flag: 'wx' })
    hashes[relative] = hash(bytes)
  }
  const manifest = {
    format: 1,
    templateVersion: await templateVersion(sourceRoot),
    generatedAt: new Date().toISOString(),
    clientId: name,
    files: hashes,
  }
  await fs.writeFile(path.join(target, MANIFEST), json(manifest), { flag: 'wx' })
  return { target, files: files.size, modules: enabled, templateVersion: manifest.templateVersion }
}

/** Shared conservative updater, also used by the OG vendor operation. Never deletes. */
export async function applyInventory({
  target,
  incoming,
  manifestName = MANIFEST,
  version = 'unknown',
  apply = false,
  protect = protectedFile,
}) {
  target = path.resolve(target)
  await assertNoSymlink(target)
  const manifestPath = path.join(target, manifestName)
  await assertNoSymlink(manifestPath)
  const previous = (await exists(manifestPath)) ? await readJson(manifestPath) : { format: 1, files: {} }
  if (previous.format !== 1 || !previous.files || Array.isArray(previous.files) || typeof previous.files !== 'object')
    throw new Error('Unsupported or invalid baseline manifest')
  for (const [relative, digest] of Object.entries(previous.files)) {
    safeRelative(relative)
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid baseline hash: ${relative}`)
  }
  const report = {
    apply,
    target,
    version,
    added: [],
    updated: [],
    unchanged: [],
    conflicts: [],
    protected: [],
    removedUpstream: [],
    written: [],
  }
  const next = { ...previous.files }
  const writes = []
  for (const [relative, bytes] of incoming) {
    safeRelative(relative)
    const destination = path.join(target, relative)
    await assertNoSymlink(destination)
    const present = await exists(destination)
    if (present && !(await fs.lstat(destination)).isFile()) throw new Error(`Destination is not a file: ${relative}`)
    const current = present ? hash(await fs.readFile(destination)) : null
    const wanted = hash(bytes)
    const baseline = previous.files[relative]
    if (current === wanted) {
      report.unchanged.push(relative)
      continue
    }
    if (protect(relative) && (present || baseline)) {
      report.protected.push(relative)
      continue
    }
    if ((present && (!baseline || current !== baseline)) || (!present && baseline)) {
      report.conflicts.push(relative)
      continue
    }
    report[present ? 'updated' : 'added'].push(relative)
    writes.push([relative, bytes, current])
  }
  report.removedUpstream = Object.keys(previous.files).filter((relative) => !incoming.has(relative))
  if (apply) {
    for (const [relative, bytes, expected] of writes) {
      const destination = path.join(target, relative)
      await assertNoSymlink(destination)
      const current = (await exists(destination)) ? hash(await fs.readFile(destination)) : null
      if (current !== expected) throw new Error(`File changed during update: ${relative}; baseline not advanced`)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, bytes, expected === null ? { flag: 'wx' } : undefined)
      next[relative] = hash(bytes)
      report.written.push(relative)
    }
    await fs.mkdir(target, { recursive: true })
    await fs.writeFile(
      manifestPath,
      json({
        ...previous,
        format: 1,
        templateVersion: version,
        lastAppliedAt: new Date().toISOString(),
        lastUpdate: {
          conflicts: report.conflicts,
          protected: report.protected,
          removedUpstream: report.removedUpstream,
          written: report.written,
        },
        files: next,
      }),
    )
  }
  return report
}

export async function updateClient({ sourceRoot, out, apply = false }) {
  sourceRoot = path.resolve(sourceRoot)
  const target = outputPath(sourceRoot, out)
  await assertNoSymlink(target)
  if (!(await exists(path.join(target, MANIFEST))))
    throw new Error('Missing client baseline manifest; update refuses an unmanaged directory')
  return applyInventory({
    target,
    incoming: await inventory(sourceRoot, [target]),
    version: await templateVersion(sourceRoot),
    apply,
  })
}

export function parseOptions(argv, allowed) {
  const options = {}
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (!key.startsWith('--') || !allowed.includes(key.slice(2))) throw new Error(`Unknown option: ${key}`)
    if (Object.hasOwn(options, key.slice(2))) throw new Error(`Duplicate option: ${key}`)
    if (key === '--apply') options.apply = true
    else {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
      options[key.slice(2)] = value
    }
  }
  return options
}
async function main() {
  const [command, ...args] = process.argv.slice(2)
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  if (command === 'create')
    console.log(
      JSON.stringify(
        await createClient({ sourceRoot, ...parseOptions(args, ['name', 'preset', 'brand', 'modules', 'out']) }),
        null,
        2,
      ),
    )
  else if (command === 'update' || command === 'upgrade') {
    const options = parseOptions(args, ['out', 'source', 'apply'])
    console.log(
      JSON.stringify(
        await updateClient({ ...options, sourceRoot: options.source ? path.resolve(options.source) : sourceRoot }),
        null,
        2,
      ),
    )
  } else
    throw new Error(
      'Usage: client.mjs create --name id --preset club|team|academy|services --brand file --modules list --out directory | update --out directory [--source master] [--apply]',
    )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
