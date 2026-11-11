import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
async function compile(path, imports = {}) {
  const file = new URL(path, import.meta.url)
  let { code } = await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: path.endsWith('.tsx') ? 'tsx' : 'ts' })
  code = code.replace(/import ["'][^"']+\.css["'];?/g, '').replaceAll('import.meta.env', '({DEV:false})')
  code = code.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`)
  return moduleUrl(code)
}
const storeUrl = await compile('../src/store.ts', {
  './lib/api': moduleUrl('export const api={};export class ApiError extends Error{};export const isDemo=false'),
  './lib/game': moduleUrl('export const achievement=()=>null'),
  './lib/journey': moduleUrl('export const projectProgress=me=>me'),
  './lib/experience': moduleUrl('export const demoPlatformXp=()=>0'),
})
const { useStore } = await import(storeUrl)
const state = { clicks: [], effects: [], scrolls: [], urls: [] }
globalThis.__postNavigationHarness = state
const storeFacade = moduleUrl(`import {useStore as store} from ${JSON.stringify(storeUrl)};export const useStore=selector=>selector(store.getState());useStore.getState=store.getState`)
const ui = moduleUrl(`import {createElement} from ${JSON.stringify(import.meta.resolve('react'))};export function Tap({children,onClick,feedback,...props}){globalThis.__postNavigationHarness.clicks.push({onClick,...props});return createElement('button',props,children)};export const Cta=Tap`)
const navUrl = await compile('../src/MainNav.tsx', { './store': storeFacade, './ui': ui, 'motion/react': moduleUrl(`import {createElement} from ${JSON.stringify(import.meta.resolve('react'))};export const motion={span:({layoutId,transition,...props})=>createElement('span',props)}`) })
const { MainNav } = await import(navUrl)
const { PostScreen } = await import(await compile('../src/screens/Post.tsx', {
  react: moduleUrl('export const useEffect=fn=>globalThis.__postNavigationHarness.effects.push(fn)'),
  '../MainNav': navUrl, '../store': storeFacade, '../ui': ui,
  '../CoverImage': moduleUrl('export const CoverImage=()=>null'),
  '../Video': moduleUrl('export const Video=()=>null'),
  '../Markdown': moduleUrl('export const Markdown=({text})=>text'),
  '../EditorialMetadata': moduleUrl('export const EditorialMetadata=()=>null'),
  '../lib/blog-read': moduleUrl('export const markPostRead=()=>{}'),
  '../lib/blog-library': moduleUrl('export const useSavedPosts=()=>[];export const toggleSavedPost=()=>true'),
  '../lib/track': moduleUrl('export const track=()=>{}'),
  ...Object.fromEntries(['knowledge', 'og-practice', 'content'].map(name => [`../lib/${name}`, new URL(`../src/lib/${name}.ts`, import.meta.url).href])),
}))
const labels = ['Главная', 'Новости', 'Курсы', 'Профиль']
const ids = ['home', 'blog', 'courses', 'profile']
function reset(tab = 'home') {
  state.clicks = []; state.effects = []; state.scrolls = []; state.urls = []
  globalThis.location = new URL('https://example.test/?demo#/blog/42')
  globalThis.window = { history: { replaceState(_state, _title, path) { state.urls.push(path); globalThis.location = new URL(path, location) } } }
  globalThis.document = { querySelector(selector) { assert.equal(selector, '[data-tab-scroll]'); return { scrollTo: options => state.scrolls.push(options) } } }
  useStore.setState({ me: { id: 1 }, tab, stack: [{ type: 'lesson', id: 42, post: true }], reward: null, share: null })
}
const renderNav = inPost => { state.clicks = []; return renderToStaticMarkup(createElement(MainNav, { inPost })) }
const post = { id: 42, kind: 'lesson', course_id: null, title: 'Новость', category: 'ИИ', minutes: 2, body: 'Текст публикации', liked: false, likes: 0 }
function renderPost(extra = {}) {
  state.clicks = []; state.effects = []
  return renderToStaticMarkup(createElement(PostScreen, { id: 42, post, preview: undefined, error: false, retry() {}, like() {}, share() {}, ...extra }))
}

test('every reader tab closes all overlays, including its highlighted or originating tab', () => {
  for (const origin of ids) for (const [i, destination] of ids.entries()) {
    reset(origin)
    useStore.setState({ stack: [{ type: 'journey' }, { type: 'lesson', id: 42, post: true }] })
    const transitions = []
    const unsubscribe = useStore.subscribe(next => transitions.push({ tab: next.tab, depth: next.stack.length }))
    const html = renderNav(true)
    assert.match(html, /aria-label="Новости" aria-current="page"/)
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1)
    state.clicks.find(button => button['aria-label'] === labels[i]).onClick()
    unsubscribe()
    assert.equal(useStore.getState().tab, destination)
    assert.deepEqual(useStore.getState().stack, [])
    assert.deepEqual(transitions, [{ tab: destination, depth: 0 }])
    assert.equal(location.hash, destination === 'home' ? '' : `#/${destination}`)
    assert.equal(location.search, '?demo')
    assert.deepEqual(state.scrolls, [])
  }
})

test('regular tab repeat keeps scroll-to-top and profile covers the leaderboard', () => {
  reset('blog'); useStore.setState({ stack: [] })
  const html = renderNav(false)
  // Root tabs reserve space with --bottom; keep the dock on that same contract.
  assert.match(html, /padding-bottom:calc\(14px \+ var\(--bottom\)\)/)
  assert.doesNotMatch(html, /env\(safe-area-inset-bottom/)
  state.clicks.find(button => button['aria-label'] === 'Новости').onClick()
  assert.deepEqual(state.scrolls, [{ top: 0, behavior: 'smooth' }])
  assert.deepEqual(state.urls, [])
  state.clicks.find(button => button['aria-label'] === 'Профиль').onClick()
  assert.equal(useStore.getState().tab, 'profile')
  useStore.setState({ tab: 'top' })
  assert.match(renderNav(false), /aria-label="Профиль" aria-current="page"/)
})

test('post navigation remains present during loading and retry, with a separate safe-area footer', () => {
  reset()
  for (const extra of [{}, { post: null, preview: post }, { post: null }, { post: null, error: true }]) {
    const html = renderPost(extra)
    for (const label of labels) assert.ok(state.clicks.some(button => button['aria-label'] === label), label)
    assert.match(html, /<\/article><div class="[^"]*relative shrink-0 pt-2/)
    assert.match(html, /calc\(14px \+ max\(var\(--bottom\), env\(safe-area-inset-bottom, 0px\)\)\)/)
    assert.match(html, /min-h-\[52px\]/)
    assert.match(html, /aria-label="Основные разделы"/)
    assert.match(html, /scroll selectable min-h-0 flex-1/)
    if (extra.error) assert.match(html, /role="alert"/)
    else if (extra.post === null) assert.match(html, /aria-label="Загрузка публикации"/)
  }
})

test('back preserves the original tab; late reader cleanup cannot overwrite a new destination', () => {
  for (const origin of ids) {
    reset(origin); renderPost()
    const cleanup = state.effects[0]()
    assert.equal(location.hash, '#/blog/42')
    state.clicks.find(button => button['aria-label'] === 'Назад').onClick()
    cleanup()
    assert.equal(useStore.getState().tab, origin)
    assert.deepEqual(useStore.getState().stack, [])
    assert.equal(location.hash, origin === 'home' ? '' : `#/${origin}`)

    reset(origin); renderPost()
    const staleCleanup = state.effects[0]()
    state.clicks.find(button => button['aria-label'] === 'Профиль').onClick()
    const writes = state.urls.length
    staleCleanup()
    assert.equal(state.urls.length, writes)
    assert.equal(location.hash, '#/profile')
  }
})

test('explicit article links and archive cards retain the reader while metadata loads', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const lesson = await readFile(new URL('../src/screens/Lesson.tsx', import.meta.url), 'utf8')
  const feed = await readFile(new URL('../src/screens/home/Feed.tsx', import.meta.url), 'utf8')
  const focus = await readFile(new URL('../src/FocusLayer.tsx', import.meta.url), 'utf8')
  assert.match(app, /id:postId,post:true/)
  assert.match(app, /post=\{overlay\.post\}/)
  assert.match(feed, /id: card\.id, post: true/)
  assert.match(lesson, /isBlogPost\(view\) \|\| \(!view && post\)/)
  assert.match(app, /inert=\{stack\.length > 0 \|\| !!reward \|\| !!share\}/)
  assert.match(app, /active=\{i === stack\.length - 1 && !reward && !share\}/)
  assert.match(focus, /inert=\{!enabled\}/)
})
