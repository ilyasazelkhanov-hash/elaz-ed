import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bindAppNavigation } from '../src/lib/app-navigation.ts'

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
  ...Object.fromEntries(['knowledge', 'og-practice', 'content', 'news-reader', 'og-course-access'].map(name => [`../lib/${name}`, new URL(`../src/lib/${name}.ts`, import.meta.url).href])),
}))
const labels = ['Главная', 'Новости', 'Курсы', 'Профиль']
const ids = ['home', 'blog', 'courses', 'profile']
let stopNavigation
function reset(tab = 'home') {
  stopNavigation?.()
  state.clicks = []; state.effects = []; state.scrolls = []; state.urls = []
  globalThis.location = new URL('https://example.test/?demo#/blog/42')
  globalThis.window = { get location(){return globalThis.location}, addEventListener(){},removeEventListener(){}, history: { state:null, pushState(value, _title, path) { this.state=value;state.urls.push(path); globalThis.location = new URL(path, location) }, replaceState(value, _title, path) { this.state=value;state.urls.push(path); globalThis.location = new URL(path, location) } } }
  globalThis.document = { querySelector(selector) { assert.equal(selector, '[data-tab-scroll]'); return { scrollTo: options => state.scrolls.push(options) } } }
  useStore.setState({ me: { id: 1 }, tab, stack: [{ type: 'lesson', id: 42, post: true }], reward: null, share: null })
  stopNavigation=bindAppNavigation(useStore,window);state.urls=[]
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
  reset('blog'); useStore.setState({ stack: [] }); state.urls=[]
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
    const cleanup = () => { for (const effect of state.effects) effect()?.() }
    assert.equal(location.hash, '#/blog/42')
    state.clicks.find(button => button['aria-label'] === 'Назад').onClick()
    cleanup()
    assert.equal(useStore.getState().tab, origin)
    assert.deepEqual(useStore.getState().stack, [])
    assert.equal(location.hash, origin === 'home' ? '' : `#/${origin}`)

    reset(origin); renderPost()
    const staleCleanup = () => { for (const effect of state.effects) effect()?.() }
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
  assert.match(app, /navigationFromHash\(entryHash\)/)
  const navigation = await readFile(new URL('../src/lib/app-navigation.ts', import.meta.url), 'utf8')
  assert.match(navigation, /type: 'lesson', id: Number\(post\[1\]\), post: true/)
  assert.match(app, /post=\{overlay\.post\}/)
  assert.match(feed, /id: card\.id, post: true/)
  assert.match(lesson, /isBlogPost\(view\) \|\| \(!view && post\)/)
  assert.match(app, /inert=\{stack\.length > 0 \|\| !!reward \|\| !!share\}/)
  assert.match(app, /active=\{i === stack\.length - 1 && !reward && !share\}/)
  assert.match(focus, /inert=\{!enabled\}/)
})


test('reader ends with real relevant courses or an honest empty state, with working navigation', () => {
 reset()
 useStore.setState({ courses: [] })
 let html = renderPost({ post: { ...post, title: 'Codex: агенты проверяют pull request' } })
 assert.match(html, /Курсы по теме/)
 assert.match(html, /пока нет подходящего курса/)
 assert.doesNotMatch(html, /Программа и условия доступа/)
 useStore.setState({ courses: [{ id: 51, practice_key: 'coding', title: 'Курс разработки', lessons: 6, access: true, price_stars: 0 }] })
 html = renderPost({ post: { ...post, title: 'Codex: агенты проверяют pull request' } })
 assert.match(html, /Курс разработки/)
 assert.match(html, /Доступ открыт/)
 assert.doesNotMatch(html, /пока нет подходящего курса/)
 assert.ok(html.indexOf('Курсы по теме') > html.indexOf('Вернуться к публикациям'))
 const link = state.clicks.find(button => button.className?.includes('min-h-16'))
 link.onClick()
 assert.deepEqual(useStore.getState().stack.at(-1), { type: 'learning', path: '/og-practice/coding' })
})
