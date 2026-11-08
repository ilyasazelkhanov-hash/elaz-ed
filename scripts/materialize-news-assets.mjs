import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
export const NEWS_ASSET = Object.freeze({
  source: 'content/news-assets/chatgpt-images-2-6',
  output: 'public/news/chatgpt-images-2-6.gif',
  chunks: 42,
  bytes: 1989275,
  sha256: '951d3a2e33e026aa97eba0e933da653fe9642bb46d40227e958e0e60c75b35ee',
})

// Decode locally before Vite copies public/. No network or credentials are used.
export async function materializeNewsAssets(root = repositoryRoot) {
  const source = path.join(root, NEWS_ASSET.source)
  const expected = Array.from({ length: NEWS_ASSET.chunks }, (_, i) => `part-${String(i).padStart(3, '0')}.b64`)
  const actual = (await readdir(source)).filter(name => name.endsWith('.b64')).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('News asset chunk list mismatch')
  const parts = await Promise.all(expected.map(async name => {
    const text = (await readFile(path.join(source, name), 'utf8')).trim()
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error(`Invalid base64 chunk: ${name}`)
    return text
  }))
  const encoded = parts.join('')
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) throw new Error('Non-canonical news asset base64')
  if (bytes.length !== NEWS_ASSET.bytes) throw new Error('News asset size mismatch')
  if (createHash('sha256').update(bytes).digest('hex') !== NEWS_ASSET.sha256) throw new Error('News asset SHA256 mismatch')
  const output = path.join(root, NEWS_ASSET.output)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, bytes)
  return { output: NEWS_ASSET.output, bytes: bytes.length, sha256: NEWS_ASSET.sha256 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await materializeNewsAssets()))
}
