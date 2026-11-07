import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as discovery from '../src/lib/discovery.ts'

const now = Date.parse('2026-11-07T10:00:00Z')
const card = (id, extra = {}) => ({ id, kind: 'lesson', course_id: null, published: true, published_at: '2026-11-06T10:00:00Z', title: `Новость ${id}`, subtitle: '', category: 'ИИ', minutes: 2, ...extra })
const defaults = { query: '', category: 'Все', topic: 'all', filter: 'new' }

test('news filters combine topic, search, category and personal state across appended archive pages', () => {
 const firstPage = [card(1), card(2, { title: 'Дизайн в Figma' })]
 const nextPage = [card(3, { title: 'Автоматизация n8n', category: 'Инструменты' }), card(4, { title: 'Автоматизация n8n', course_id: 7 }), card(5, { title: 'Автоматизация n8n', published_at: '2026-12-01' })]
 const filters = { ...defaults, topic: 'automation', query: '  N8N ', category: 'Инструменты', filter: 'saved' }
 assert.deepEqual(discovery.filterNewsPosts(firstPage, filters, [], [3, 4, 5], now), [])
 assert.deepEqual(discovery.filterNewsPosts([...firstPage, ...nextPage], filters, [], [3, 4, 5], now).map(p => p.id), [3])
 assert.deepEqual(discovery.filterNewsPosts([...firstPage, ...nextPage], { ...filters, filter: 'unread' }, [3], [], now), [])
 assert.deepEqual(discovery.filterNewsPosts([...firstPage, ...nextPage], defaults, [3], [], now).map(p => p.id), [3, 2, 1])
 assert.equal(firstPage.length, 2)
})

let feedHarnessId = 0
async function feedPresentation() {
 const file = new URL('../src/screens/home/Feed.tsx', import.meta.url)
 let compiled = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: 'tsx', jsx: { runtime: 'automatic' } })).code
 const mocks = {
  '../../lib/blog-feed': 'useBlogFeed', '../../lib/blog-read': 'useReadPosts',
  '../../lib/blog-library': 'toggleFollowedTopic, toggleSavedPost, useFollowedTopics, useSavedPosts',
  '../../store': 'useStore', '../../ui': 'Tap', './blog-view': 'useBlogView', '../../lib/track': 'track',
 }
 for (const [path, names] of Object.entries(mocks)) compiled = compiled.replace(new RegExp(`import[^;\\n]*from ["']${path.replaceAll('.', '\\.')}["'];?`, 'g'), `const { ${names} } = globalThis.__homeNewsHarness;`)
 compiled = compiled.replace(/import ["']\.\/free-first\.css["'];?/g, '')
 for (const name of ['react', 'react/jsx-runtime', 'lucide-react']) compiled = compiled.replaceAll(`from "${name}"`, `from ${JSON.stringify(import.meta.resolve(name))}`)
 for (const name of ['content', 'discovery', 'knowledge']) compiled = compiled.replaceAll(`from "../../lib/${name}"`, `from ${JSON.stringify(new URL(`../src/lib/${name}.ts`, import.meta.url).href)}`)
 const state = { view: { ...defaults }, posts: null, more: true, legacy: false, busy: false, error: '', read: [], saved: [], requests: [], clicks: [], actions: [], loadCalls: [] }
 const store = { me: { id: 1 }, push() {}, setTab(tab) { state.actions.push(tab) } }
 const useStore = selector => selector(store)
 useStore.getState = () => store
 globalThis.__homeNewsHarness = {
  useBlogView: () => ({ ...state.view, set: value => Object.assign(state.view, value) }), useStore,
  useBlogFeed: (enabled, user, revision) => { state.requests.push({ enabled, user, revision }); return { posts: state.posts, more: state.more, legacy: state.legacy, busy: state.busy, error: state.error, load: retry => { state.loadCalls.push(retry); state.actions.push('load') } } },
  useReadPosts: () => state.read, useSavedPosts: () => state.saved, useFollowedTopics: () => [],
  toggleFollowedTopic() {}, toggleSavedPost() {}, track() {},
  Tap: ({ children, onClick, feedback, ...props }) => { state.clicks.push({ ...props, onClick, children }); return createElement('button', props, children) },
 }
 const { Feed } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#fixture-${++feedHarnessId}`)
 return { state, render: lessons => { state.clicks = []; return renderToStaticMarkup(createElement(Feed, { lessons, compact: true })) } }
}

test('home renders accessible filters, a bounded matching list and an explicit path through the archive', async () => {
 const { state, render } = await feedPresentation()
 const posts = [card(1), card(2), card(3), card(4)]
 let html = render(posts)
 for (const label of ['Режим публикаций', 'Новые', 'Непрочитанные', 'Сохранённые', 'Поиск в новостях', 'Тема публикаций']) assert.ok(html.includes(label), label)
 assert.equal((html.match(/<article /g) || []).length, 3)
 assert.match(html, /в загруженной подборке/)
 assert.match(html, /Все подходящие публикации/)
 assert.equal(state.requests.length, 1)
 assert.equal(state.requests[0].enabled, true)
 state.view = { ...defaults, topic: 'automation', filter: 'saved', query: 'n8n' }
 html = render(posts)
 assert.match(html, /В загруженной подборке пока пусто/)
 assert.match(html, /Искать дальше в архиве/)
 assert.match(html, /Все новости/)
 state.clicks.find(button => button['aria-label'] === 'Загрузить следующую страницу публикаций').onClick()
 assert.deepEqual(state.actions, ['load'])
 state.clicks.find(button => button['aria-label'] === 'Все подходящие публикации').onClick()
 assert.deepEqual(state.actions, ['load', 'blog'])
 assert.deepEqual(state.view, { ...defaults, topic: 'automation', filter: 'saved', query: 'n8n' })
 state.posts = [...posts, card(8, { title: 'Автоматизация n8n' })]; state.saved = [8]; state.more = false
 html = render(posts)
 assert.match(html, /Автоматизация n8n/)
 assert.equal((html.match(/<article /g) || []).length, 1)
 state.clicks.find(button => button['aria-label'] === 'Сбросить фильтры публикаций').onClick()
 assert.deepEqual(state.view, defaults)
 state.clicks.find(button => button.children === 'Непрочитанные').onClick()
 state.read = [1, 2, 3, 4, 8]
 html = render(posts)
 assert.match(html, /Всё прочитано/)
 assert.ok(state.clicks.some(button => button['aria-pressed'] === true && button.children === 'Непрочитанные'))
 assert.ok(state.clicks.some(button => button['aria-label'] === 'Сбросить фильтры публикаций'))
 // A category remains visible even if the refreshed page no longer contains it.
 state.view = { ...defaults, category: 'Из архива' }
 state.error = 'offline'; state.more = true
 html = render(posts)
 assert.ok(state.clicks.some(button => button['aria-pressed'] === true && button.children === 'Из архива'))
 assert.match(html, /role="alert"/)
 state.clicks.find(button => button.children === 'Повторить загрузку').onClick()
 assert.equal(state.actions.at(-1), 'load')
 assert.ok(state.requests.every(request => request.revision === state.requests[0].revision))
 state.legacy = true; state.more = false; state.error = ''; state.view = { ...defaults, filter: 'saved' }
 html = render(posts)
 assert.match(html, /Показана загруженная подборка/)
 assert.doesNotMatch(html, /Все доступные публикации загружены/)
 state.view.query = 'несуществующая новость'
 html = render(posts)
 assert.match(html, /В загруженной подборке пока пусто/)
})


test('home news keeps error, loading and empty states distinct without losing cached posts or retry behavior', async () => {
 const { state, render } = await feedPresentation()
 state.busy = true
 let html = render([])
 assert.match(html, /Загружаем публикации/)
 assert.doesNotMatch(html, /reader-empty|В загруженной подборке пока пусто|Пока без публикаций/)
 state.busy = false; state.error = 'PRIVATE_BACKEND_ERROR'
 html = render([])
 assert.match(html, /role="alert"/)
 assert.doesNotMatch(html, /PRIVATE_BACKEND_ERROR|reader-empty|В загруженной подборке пока пусто|Пока без публикаций/)
 let retry = state.clicks.find(button => button.children === 'Повторить загрузку')
 assert.ok(retry); assert.equal(retry.disabled, false)
 retry.onClick(); assert.equal(state.loadCalls.at(-1), true)
 const cached = card(91, { title: 'Сохранённая загруженная новость' })
 html = render([cached]); assert.match(html, /Сохранённая загруженная новость/); assert.match(html, /role="alert"/)
 state.busy = true
 html = render([cached]); assert.match(html, /Сохранённая загруженная новость/)
 retry = state.clicks.find(button => button.children === 'Повторить загрузку'); assert.equal(retry.disabled, true)
 state.busy = false; state.error = ''; state.posts = []; state.more = false
 html = render([]); assert.match(html, /Пока без публикаций/); assert.doesNotMatch(html, /role="alert"|Повторить загрузку/)
 state.posts = [cached]
 html = render([]); assert.match(html, /Сохранённая загруженная новость/); assert.doesNotMatch(html, /reader-empty|role="alert"/)
})
