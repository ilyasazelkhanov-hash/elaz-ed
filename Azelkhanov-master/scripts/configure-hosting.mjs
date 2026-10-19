/** Generate an explicit same-origin API proxy. No deploy or cloud mutation. */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const args = process.argv.slice(2),
  value = (k) => args[args.indexOf(k) + 1]
if (!args.includes('--api'))
  throw new Error(
    'Usage: node scripts/configure-hosting.mjs --api https://PROJECT.supabase.co/functions/v1/master-api [--root CLIENT_FOLDER] [--prefix /api]',
  )
const api = new URL(value('--api')),
  root = resolve(args.includes('--root') ? value('--root') : '.'),
  prefix = args.includes('--prefix') ? value('--prefix') : '/api'
if (
  api.protocol !== 'https:' ||
  api.username ||
  api.password ||
  api.search ||
  api.hash ||
  !/^\/[a-zA-Z0-9_-]+$/.test(prefix)
)
  throw new Error('Use a public HTTPS function URL and a plain /api prefix')
const file = resolve(root, 'vercel.json'),
  config = JSON.parse(await readFile(file, 'utf8'))
const route = { source: `${prefix}/v1/:path*`, destination: `${api.href.replace(/\/$/, '')}/v1/:path*` }
config.rewrites = [route, ...(config.rewrites ?? []).filter((r) => r.source !== route.source)]
await writeFile(file, JSON.stringify(config, null, 2) + '\n')
console.log(`Configured ${prefix}/v1 proxy. Deploy separately; no credentials were written.`)
