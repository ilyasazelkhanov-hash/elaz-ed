import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { materializeNewsAssets, NEWS_ASSET } from '../scripts/materialize-news-assets.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'og-news-asset-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await cp(path.join(repositoryRoot, NEWS_ASSET.source), path.join(root, NEWS_ASSET.source), { recursive: true })
  return root
}

test('news GIF is reconstructed byte-for-byte and repeated builds are deterministic', async t => {
  const root = await fixture(t)
  const result = await materializeNewsAssets(root)
  const first = await readFile(path.join(root, NEWS_ASSET.output))
  assert.equal(first.length, 1989275)
  assert.equal(first.subarray(0, 6).toString(), 'GIF89a')
  assert.equal(createHash('sha256').update(first).digest('hex'), '951d3a2e33e026aa97eba0e933da653fe9642bb46d40227e958e0e60c75b35ee')
  assert.equal(result.sha256, NEWS_ASSET.sha256)
  await materializeNewsAssets(root)
  assert.deepEqual(await readFile(path.join(root, NEWS_ASSET.output)), first)
})

test('missing chunk fails before creating the public GIF', async t => {
  const root = await fixture(t)
  await rm(path.join(root, NEWS_ASSET.source, 'part-000.b64'))
  await assert.rejects(materializeNewsAssets(root), /chunk list mismatch/)
  await assert.rejects(readFile(path.join(root, NEWS_ASSET.output)), { code: 'ENOENT' })
})

test('changed chunk fails checksum and preserves an existing output', async t => {
  const root = await fixture(t)
  await materializeNewsAssets(root)
  const original = await readFile(path.join(root, NEWS_ASSET.output))
  const chunk = path.join(root, NEWS_ASSET.source, 'part-000.b64')
  const text = await readFile(chunk, 'utf8')
  await writeFile(chunk, `${text[0] === 'A' ? 'B' : 'A'}${text.slice(1)}`)
  await assert.rejects(materializeNewsAssets(root), /SHA256 mismatch/)
  assert.deepEqual(await readFile(path.join(root, NEWS_ASSET.output)), original)
})
