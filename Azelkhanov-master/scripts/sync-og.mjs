#!/usr/bin/env node
/** Vendor an independent copy into the OG checkout; dry-run unless --apply. */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inventory, applyInventory, assertNoSymlink, parseOptions } from './client.mjs'

const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const prefix = 'src/platform-kit/'
function assetPath(value) {
  if (typeof value === 'string')
    return value.startsWith('/') && !value.startsWith('//') ? `/platform-assets${value}` : value
  if (Array.isArray(value)) return value.map(assetPath)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, assetPath(item)]))
  return value
}
function mapFile(file) {
  if (file.startsWith('docs/')) return 'docs/platform-kit/' + file.slice(5)
  if (file.startsWith('src/') || file.startsWith('content/') || ['app.config.json', 'brand.config.json'].includes(file))
    return prefix + file
  if (file.startsWith('public/')) return 'public/platform-assets/' + file.slice(7)
  if (file.startsWith('server/')) return 'server/platform-kit/' + file.slice(7)
  if (file.startsWith('supabase/functions/'))
    return file
      .replace('supabase/functions/master-api/', 'supabase/functions/az-master-api/')
      .replace('supabase/functions/notification-worker/', 'supabase/functions/az-notification-worker/')
  if (file.startsWith('supabase/migrations/')) return file
  return null
}
function rewriteImports(text, original, destination, mappings) {
  return text.replace(
    /((?:from\s*|import\s*\(\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
    (whole, start, specifier, end) => {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(original), specifier))
      const mapped = mappings.get(resolved)
      if (!mapped) return whole
      const relative = path.posix.relative(path.posix.dirname(destination), mapped)
      return start + (relative.startsWith('.') ? relative : './' + relative) + end
    },
  )
}
export async function syncOg({ sourceRoot, target, apply = false }) {
  sourceRoot = path.resolve(sourceRoot)
  target = path.resolve(target)
  if (target === sourceRoot || path.relative(sourceRoot, target).split(path.sep)[0] !== '..')
    throw new Error('OG target must be outside the standalone master')
  await assertNoSymlink(target)
  const source = await inventory(sourceRoot)
  const mappings = new Map([...source.keys()].map((file) => [file, mapFile(file)]).filter(([, mapped]) => mapped))
  const incoming = new Map()
  for (const [file, mapped] of mappings) {
    let bytes = source.get(file)
    if (/\.(?:tsx?|m?js)$/.test(file)) {
      let text = rewriteImports(bytes.toString(), file, mapped, mappings)
      // Static public paths in seed/demo catalog also use the copied asset namespace.
      if (file.startsWith('content/')) text = text.replace(/(['"`])\/(brand|art)\//g, '$1/platform-assets/$2/')
      bytes = Buffer.from(text)
    } else if (file.startsWith('content/') && file.endsWith('.json'))
      bytes = json(assetPath(JSON.parse(bytes.toString())))
    incoming.set(mapped, bytes)
  }
  const app = JSON.parse(source.get('app.config.json').toString())
  incoming.set(
    prefix + 'app.config.json',
    json({ ...app, id: 'og-cre8r', name: 'OG CRE8R²', access: 'channel', apiPublicPath: '/platform-api' }),
  )
  const brand = assetPath(JSON.parse(source.get('brand.config.json').toString()))
  incoming.set(
    prefix + 'brand.config.json',
    json({
      ...brand,
      id: 'og-cre8r',
      name: 'OG CRE8R²',
      tagline: 'Твоя среда. Твои возможности.',
      logo: '/icon.svg',
      monogram: '/icon.svg',
      wordmark: '/icon.svg',
      colors: {
        primary: '#A58BFF',
        ink: '#F3F1FF',
        background: '#0B0A12',
        accent: '#FF8AC9',
        surface: '#15141F',
        muted: '#A39FBF',
        onPrimary: '#211536',
        onAccent: '#211536',
        card: '#211536',
        heroHighlight: '#5D123F',
        gradientFrom: '#7C6BFF',
        gradientVia: '#B26BFF',
        gradientTo: '#FF85C0',
      },
      fonts: { body: 'Onest Variable', display: 'Unbounded Variable' },
    }),
  )
  // Track this vendor copy independently. Existing OG files without a baseline conflict.
  return applyInventory({
    target,
    incoming,
    manifestName: '.platform-kit-og.json',
    version: JSON.parse(source.get('package.json').toString()).version,
    apply,
    protect: (file) =>
      file.endsWith('app.config.json') ||
      file.endsWith('brand.config.json') ||
      file.startsWith(prefix + 'content/') ||
      file.startsWith('supabase/migrations/'),
  })
}
async function main() {
  const options = parseOptions(process.argv.slice(2), ['target', 'apply'])
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  if (!options.target) throw new Error('Usage: node scripts/sync-og.mjs --target OG_DIRECTORY [--apply]')
  console.log(JSON.stringify(await syncOg({ sourceRoot, ...options }), null, 2))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
