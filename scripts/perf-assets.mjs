import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, posix, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

// Build inventory, not a network waterfall. Example:
// node scripts/perf-assets.mjs --include App,Academy --out docs/performance/assets.json
const options = { dist: 'dist', include: [], out: null }
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index]
  const value = process.argv[index + 1]
  if (!value || !['--dist', '--include', '--out'].includes(flag)) {
    throw new Error('Usage: node scripts/perf-assets.mjs [--dist dist] [--include App,Academy] [--out report.json]')
  }
  options[flag.slice(2)] = flag === '--include' ? value.split(',').filter(Boolean) : value
}

const root = resolve(options.dist)
const files = new Map()
function walk(directory, prefix = '') {
  for (const name of readdirSync(directory).sort()) {
    const file = prefix ? `${prefix}/${name}` : name
    const path = join(directory, name)
    if (statSync(path).isDirectory()) walk(path, file)
    else {
      const bytes = readFileSync(path)
      files.set(file, { bytes: bytes.length, gzipBytes: gzipSync(bytes).length, content: bytes })
    }
  }
}
walk(root)

const manifestPath = join(root, '.vite/manifest.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const chunksByFile = new Map(Object.entries(manifest ?? {}).map(([key, chunk]) => [chunk.file, { key, ...chunk }]))
const localUrl = (url, from = 'index.html') => {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(url)) return null
  const path = decodeURIComponent(url.split(/[?#]/)[0])
  return path.startsWith('/') ? path.slice(1) : posix.normalize(posix.join(posix.dirname(from), path))
}
const summarize = (paths) => {
  const selected = [...new Set(paths)].filter(path => files.has(path)).sort()
  return {
    count: selected.length,
    bytes: selected.reduce((sum, path) => sum + files.get(path).bytes, 0),
    gzipBytes: selected.reduce((sum, path) => sum + files.get(path).gzipBytes, 0),
    files: selected,
  }
}
const matching = (extension) => [...files.keys()].filter(file => extname(file) === extension)

function staticClosure(seeds) {
  const seen = new Set()
  const queue = [...seeds]
  while (queue.length) {
    const file = queue.pop()
    if (!file || seen.has(file) || !files.has(file)) continue
    seen.add(file)
    const chunk = chunksByFile.get(file)
    if (chunk) {
      queue.push(...(chunk.imports ?? []).map(key => manifest[key]?.file), ...(chunk.css ?? []))
    } else if (extname(file) === '.js') {
      // Older snapshots lack a manifest. Only static declarations are counted;
      // runtime import() calls and Vite's lazy preload arrays are excluded.
      const source = files.get(file).content.toString('utf8')
      for (const match of source.matchAll(/\b(?:import|export)\s*(?:\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?|\*\s*as\s+[\w$]+)\s*from\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g)) {
        queue.push(localUrl(match[1] ?? match[2], file))
      }
    }
  }
  return seen
}

const html = readFileSync(join(root, 'index.html'), 'utf8')
const htmlFiles = []
for (const match of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
  const tag = match[0]
  if (!tag.startsWith('<script') && !/\brel=["'](?:stylesheet|modulepreload)["']/.test(tag)) continue
  const url = tag.match(/\b(?:src|href)=["']([^"']+)["']/)?.[1]
  if (url) htmlFiles.push(localUrl(url))
}
const initial = staticClosure(htmlFiles)
const selectedChunks = options.include.flatMap(selector => {
  const found = [...files.keys()].filter(file => extname(file) === '.js' && (
    chunksByFile.get(file)?.key === selector || basename(file).startsWith(`${selector}-`) || file === selector
  ))
  if (!found.length) throw new Error(`No built chunk matches ${selector}`)
  return found
})
const selected = staticClosure([...initial, ...selectedChunks])
const closureSummary = (paths) => ({
  js: summarize([...paths].filter(path => extname(path) === '.js')),
  css: summarize([...paths].filter(path => extname(path) === '.css')),
})

const fonts = new Map()
for (const file of matching('.css')) {
  const css = files.get(file).content.toString('utf8')
  for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const declaration = match[1]
    const url = declaration.match(/\bsrc:\s*url\(["']?([^\s)"']+)/)?.[1]
    if (!url) continue
    const embedded = url.startsWith('data:')
    const path = embedded ? null : localUrl(url, file)
    const content = embedded ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') : files.get(path)?.content
    const key = embedded ? createHash('sha256').update(content).digest('hex') : path
    if (fonts.has(key)) continue
    const property = name => declaration.match(new RegExp(`\\b${name}:([^;]+)`))?.[1]?.trim()
    fonts.set(key, {
      family: property('font-family'), weight: property('font-weight'), display: property('font-display'),
      unicodeRange: property('unicode-range'), file: path, embedded, bytes: content?.length ?? null,
      sha256: content ? createHash('sha256').update(content).digest('hex') : null,
    })
  }
}

const report = {
  schemaVersion: 1,
  graphSource: manifest ? 'vite-manifest' : 'static-import-declarations (no manifest in snapshot)',
  notes: [
    'gzipBytes is the sum of individually gzipped files, not measured transfer size.',
    'The initial graph includes HTML scripts/styles and static imports; runtime lazy routes are excluded.',
    'Explicit --include chunks add their static dependencies; they are a scenario inventory, not an observed request list.',
    'Font faces use unicode-range: emitted font bytes do not imply downloads. Embedded font bytes are already included in CSS.',
    ...(manifest ? [] : ['Without a manifest, CSS attached only to lazy chunks is not inferred; use the browser waterfall for that snapshot.']),
  ],
  emitted: { js: summarize(matching('.js')), css: summarize(matching('.css')), externalFonts: summarize(matching('.woff2')) },
  htmlInitial: closureSummary(initial),
  selectedScenario: { selectors: options.include, chunks: selectedChunks, ...closureSummary(selected) },
  fonts: { faces: fonts.size, bytesIncludingEmbedded: [...fonts.values()].reduce((sum, font) => sum + (font.bytes ?? 0), 0), files: [...fonts.values()] },
  largestJs: matching('.js').sort((a, b) => files.get(b).bytes - files.get(a).bytes).slice(0, 12).map(file => ({ file, bytes: files.get(file).bytes, gzipBytes: files.get(file).gzipBytes })),
}

const output = `${JSON.stringify(report, null, 2)}\n`
if (options.out) {
  const destination = resolve(options.out)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, output)
  console.log(`Asset report: ${destination}`)
} else process.stdout.write(output)
