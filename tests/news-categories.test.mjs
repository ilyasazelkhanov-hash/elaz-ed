import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { newsCategoryGroups, newsCategory, newsCategories, matchesNewsCategory } from '../src/lib/news-categories.ts'
import { filterNewsPosts } from '../src/lib/discovery.ts'
import { blogPostEntry } from '../src/lib/content.ts'

const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
const original = await read('content/elaz-ed-2026-10/payload.json')
const revision = await read('content/ai-practice-2026-10-25/revision.json')
const references = await read('content/ai-practice-2026-10-25/reference-posts.json')
const recent = await read('content/news/2026-11-07.json')
const legacy = new Map(revision.legacy.map(post => [post.key, post]))
// Reconstruct only the committed source packages, not a claim about production inventory.
const sourcePosts = [
 ...original.lessons.map(post => ({ ...post, ...legacy.get(post.key) })),
 ...revision.updates, ...revision.added, ...references.posts.map(post => ({ ...post, kind: 'lesson' })),
 ...recent.map(post => ({ ...post, kind: 'lesson' })),
].filter(post => post.kind === 'lesson' && post.course_key == null && post.course_id == null)
const defaults = { query: '', category: 'Все', topic: 'all', filter: 'new' }
const now = Date.parse('2026-11-11T12:00:00Z')
const card = (id, category, extra = {}) => ({ id, kind: 'lesson', course_id: null, published: true, published_at: '2026-11-07T12:00:00Z', title: `Материал ${id}`, subtitle: '', minutes: 2, category, ...extra })

test('only the three intended category families are consolidated', () => {
 assert.equal(newsCategoryGroups.length, 3)
 for (const group of newsCategoryGroups) {
  for (const alias of [group.label, ...group.aliases]) {
   assert.equal(newsCategory(alias), group.label)
   assert.equal(newsCategory(`  ${alias.toLocaleUpperCase('ru')}  `), group.label)
   assert.ok(matchesNewsCategory(alias, group.label))
   assert.ok(matchesNewsCategory(group.label, alias))
  }
 }
 assert.equal(newsCategory('  Видео   и монтаж  '), 'Видео и контент')
 for (const label of ['Автоматизация', 'Вайбкодинг', 'Маркетинг', 'Безопасность', 'Закон', 'Агенты и исследование', 'Новая область ИИ']) assert.equal(newsCategory(label), label)
 assert.equal(newsCategory(null), '')
 assert.equal(newsCategory(undefined), '')
 assert.equal(newsCategory('   '), '')
 assert.equal(matchesNewsCategory('Неизвестная рубрика', 'Все'), true)
 assert.equal(matchesNewsCategory('Новая область ИИ', 'Видео и контент'), false)
})

test('source corpus reduces 22 news labels to 17, with all 28 historical labels compatible and no metadata changes', () => {
 const before = JSON.stringify(sourcePosts)
 const rawCategories = [...new Set(sourcePosts.map(post => post.category))]
 const categories = newsCategories(rawCategories)
 assert.equal(sourcePosts.length, 134)
 assert.equal(rawCategories.length, 28)
 assert.equal(categories.length, 22)
 const posts = sourcePosts.map((post, index) => card(index + 1, post.category, { ...post, course_id: null }))
 const seen = new Set()
 for (const category of categories) {
  const matches = filterNewsPosts(posts, { ...defaults, category }, [], [], now)
  for (const post of matches) {
   assert.ok(!seen.has(post.id), `duplicate membership: ${post.id}`)
   seen.add(post.id)
   assert.strictEqual(post, posts.find(item => item.id === post.id))
   assert.equal(blogPostEntry(`#/blog/${post.id}`), post.id)
  }
 }
 const eligible = sourcePosts.filter(post => post.news_eligible !== false)
 assert.equal(eligible.length, 126)
 assert.equal(new Set(eligible.map(post => post.category)).size, 22)
 assert.equal(newsCategories(eligible.map(post => post.category)).length, 17)
 assert.equal(seen.size, eligible.length)
 for (const post of posts.filter(post => post.news_eligible === false)) {
  assert.ok(!seen.has(post.id))
  assert.equal(blogPostEntry(`#/blog/${post.id}`), post.id)
 }
 assert.equal(JSON.stringify(sourcePosts), before)
})

test('canonical and legacy selection combine with search, personal filters and archive pagination', () => {
 const first = [card(1, 'Видео')]
 const next = [card(2, 'Видео и монтаж'), card(3, 'Видео и контент'), card(4, 'Маркетинг')]
 const source = [...first, ...next]
 const snapshot = structuredClone(source)
 for (const category of ['Видео', 'Видео и монтаж', 'Видео и контент']) {
  assert.deepEqual(filterNewsPosts(first, { ...defaults, category }, [], [], now).map(post => post.id), [1])
  assert.deepEqual(filterNewsPosts(source, { ...defaults, category }, [], [], now).map(post => post.id), [3, 2, 1])
  assert.deepEqual(filterNewsPosts(source, { ...defaults, category, filter: 'saved' }, [], [1, 2, 4], now).map(post => post.id), [2, 1])
  assert.deepEqual(filterNewsPosts(source, { ...defaults, category, filter: 'unread' }, [1], [], now).map(post => post.id), [3, 2])
 }
 assert.deepEqual(filterNewsPosts(source, { ...defaults, query: 'Видео и контент' }, [], [], now).map(post => post.id), [3, 2, 1])
 assert.deepEqual(filterNewsPosts(source, { ...defaults, query: 'Видео и монтаж' }, [], [], now).map(post => post.id), [2])
 assert.deepEqual(source, snapshot)
})

test('unknown future categories and empty pages stay compatible with selected filters', () => {
 assert.deepEqual(newsCategories(['Видео', 'Видео и монтаж', 'Будущая рубрика', '', null]), ['Видео и контент', 'Будущая рубрика'])
 assert.deepEqual(newsCategories([], 'Видео'), ['Видео и контент'])
 assert.deepEqual(newsCategories(['Видео'], 'Не загружена'), ['Видео и контент', 'Не загружена'])
 assert.deepEqual(newsCategories([], 'Все'), [])
 const posts = [card(1, 'Будущая рубрика'), card(2, ''), card(3, 'Видео', { course_id: 2 }), card(4, 'Видео', { published_at: '2027-01-01' }), card(5, 'Видео', { news_eligible: false })]
 assert.deepEqual(filterNewsPosts(posts, defaults, [], [], now).map(post => post.id), [2, 1])
 assert.deepEqual(filterNewsPosts(posts, { ...defaults, category: 'Будущая рубрика' }, [], [], now).map(post => post.id), [1])
})

test('editor suggestions group news labels but never rewrite existing drafts or course categories', async () => {
 const editor = await readFile(new URL('../src/screens/AdminEditor.tsx', import.meta.url), 'utf8')
 assert.match(editor, /lesson\?\.course_id \? \[\.\.\.new Set\(labels\)\] : newsCategories\(labels\)/)
 assert.match(editor, /lesson \? \{ \.\.\.lesson \} : blank\(kind\)/)
 assert.doesNotMatch(editor, /category:\s*newsCategory\(/)
})
