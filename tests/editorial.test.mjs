import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEditorial, editorialReviewStatus } from '../supabase/functions/_shared/editorial.ts'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beginnerGuides } from '../src/lib/beginner-content.ts'

const today = '2026-11-07'
const update = { kind: 'update', sources: [{ title: 'Документация', url: 'https://example.org/docs' }], checked_on: today, review_due: '2026-11-14', reviewer: 'Автор' }

test('legacy metadata and authored evergreen examples need no invented verification', () => {
  assert.equal(normalizeEditorial(undefined, { requireUpdateReview: true, today }), null)
  assert.equal(normalizeEditorial(null), null)
  const guide = normalizeEditorial({ kind: 'evergreen', example: '12 / 200 × 100 = 6%', criteria: ['Проверить расчёт'], reviewer: ' ' }, { today })
  assert.deepEqual(guide, { kind: 'evergreen', example: '12 / 200 × 100 = 6%', criteria: ['Проверить расчёт'] })
  assert.equal(editorialReviewStatus(guide, today), 'evergreen')
})

test('update drafts can be incomplete; publication requires an accountable source check', () => {
  assert.deepEqual(normalizeEditorial({ kind: 'update' }, { today }), { kind: 'update' })
  for (const key of ['sources', 'checked_on', 'review_due', 'reviewer']) {
    const draft = { ...update }; delete draft[key]
    assert.throws(() => normalizeEditorial(draft, { requireUpdateReview: true, today }), /источник|провер|ответствен/i, key)
  }
  assert.deepEqual(normalizeEditorial(update, { requireUpdateReview: true, today }), update)
})

test('sources only allow complete public http(s) URLs with no embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.org', '/docs', 'https://user:secret@example.org', 'file:///tmp/a']) {
    assert.throws(() => normalizeEditorial({ ...update, sources: [{ title: 'Источник', url }] }, { today }), /ссылк|http/i, url)
  }
  assert.throws(() => normalizeEditorial({ ...update, sources: [{ title: '', url: 'https://example.org' }] }, { today }), /название/i)
  assert.equal(normalizeEditorial({ ...update, sources: [{ title: ' Документ ', url: ' https://example.org ' }] }, { today }).sources[0].title, 'Документ')
})

test('dates must be real calendar days; a future check or reversed interval cannot imply verification', () => {
  for (const checked_on of ['2026-02-30', '2026-13-01', '07.11.2026', '2026-11-08']) {
    assert.throws(() => normalizeEditorial({ ...update, checked_on }, { today }), /дат|провер/i)
  }
  assert.throws(() => normalizeEditorial({ ...update, review_due: '2026-11-06' }, { today }), /раньше/i)
  assert.equal(normalizeEditorial({ ...update, checked_on: '2024-02-29' }, { today }).checked_on, '2024-02-29')
})

test('metadata is bounded and wrong field types are rejected', () => {
  for (const value of [[], true, 'evergreen', { kind: 'news' }, { kind: 'evergreen', reviewer: 1 }, { kind: 'evergreen', criteria: 'ok' }, { kind: 'evergreen', sources: {} }]) {
    assert.throws(() => normalizeEditorial(value, { today }))
  }
  assert.throws(() => normalizeEditorial({ ...update, correction_note: 'x'.repeat(1001) }, { today }), /1000/)
  assert.throws(() => normalizeEditorial({ ...update, sources: Array.from({ length: 6 }, () => update.sources[0]) }, { today }), /5/)
  assert.deepEqual(normalizeEditorial({ kind: 'evergreen', arbitrary: 'discard' }), { kind: 'evergreen' })
})

test('review status distinguishes legacy, incomplete, due today and upcoming work', () => {
  assert.equal(editorialReviewStatus(null, today), 'missing')
  assert.equal(editorialReviewStatus({ kind: 'update' }, today), 'incomplete')
  assert.equal(editorialReviewStatus(update, today), 'scheduled')
  assert.equal(editorialReviewStatus({ ...update, review_due: today }, today), 'due')
  assert.equal(editorialReviewStatus({ ...update, checked_on: '2026-10-01', review_due: '2026-10-30' }, today), 'due')
  assert.equal(editorialReviewStatus({ kind: 'update', checked_on: 'bad' }, today), 'incomplete')
})

test('reader renders supported dates and safe sources; absent data never implies a check', async () => {
  const file = new URL('../src/EditorialMetadata.tsx', import.meta.url)
  const source = await readFile(file, 'utf8')
  let compiled = (await transformWithOxc(source, file.pathname, { lang: 'tsx', jsx: { runtime: 'automatic' } })).code
  compiled = compiled.replace(/from ["']react\/jsx-runtime["']/g, `from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
    .replace(/from ["']\.\/lib\/editorial["']/g, `from ${JSON.stringify(new URL('../src/lib/editorial.ts', import.meta.url).href)}`)
  const { EditorialMetadata } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const render = (metadata, section = 'summary') => renderToStaticMarkup(createElement(EditorialMetadata, { metadata, section, today }))
  assert.equal(render(undefined), '')
  const evergreen = render({ kind: 'evergreen', audience: 'Новичку', access_note: 'Можно выполнить вручную' })
  assert.match(evergreen, /Новичку|Можно выполнить вручную/)
  assert.doesNotMatch(evergreen, /Проверено|Проверил/)
  const summary = render(update)
  assert.match(summary, /2026-11-07/)
  assert.match(summary, /Автор/)
  const footer = render({ ...update, correction_note: 'Исправлен расчёт' }, 'sources')
  assert.match(footer, /https:\/\/example.org\/docs/)
  assert.match(footer, /noopener noreferrer/)
  assert.match(footer, /Исправлен расчёт/)
  assert.equal(render({ ...update, sources: [{ title: 'Небезопасно', url: 'javascript:alert(1)' }] }, 'sources'), '')
  assert.match(render({ ...update, checked_on: '2026-10-01', review_due: today }), /Условия могли измениться/)
})

test('beginner metadata preserves authored examples and criteria without inventing external verification', () => {
  for (const guide of beginnerGuides) {
    const metadata = normalizeEditorial(guide.editorial, { today })
    assert.equal(metadata.kind, 'evergreen')
    assert.equal(metadata.example, guide.example)
    assert.equal(metadata.outcome, guide.result)
    assert.deepEqual(metadata.criteria, guide.checks)
    for (const key of ['checked_on', 'review_due', 'reviewer', 'sources']) assert.equal(metadata[key], undefined, `${guide.id}:${key}`)
    assert.ok(metadata.audience.length > 20)
    assert.ok(metadata.access_note.length > 50)
  }
  assert.match(beginnerGuides.find(guide => guide.id === 'image-brief').editorial.access_note, /вручную бесплатно.*бесплатный доступ к ним не обещается/)
})
