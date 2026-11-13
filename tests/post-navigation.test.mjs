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
const navUrl = await compile('../src/MainNav.tsx', { './store': storeFacade, './ui': ui, './lib/navigation-context': new URL('../src/lib/navigation-context.ts', import.meta.url).href, './lib/tg': moduleUrl('export const confirmDialog=message=>globalThis.__postNavigationHarness.confirm(message)'), 'motion/react': moduleUrl(`import {createElement} from ${JSON.stringify(import.meta.resolve('react'))};export const motion={span:({layoutId,transition,...props})=>createElement('span',props)}`) })
const { MainNav } = await import(navUrl)
const { NavigationFrame } = await import(await compile('../src/NavigationFrame.tsx', { './MainNav': navUrl, './lib/navigation-scroll': new URL('../src/lib/navigation-scroll.ts', import.meta.url).href }))
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
  state.clicks = []; state.effects = []; state.scrolls = []; state.urls = []; state.notices = []; state.confirm = async () => true
  globalThis.location = new URL('https://example.test/?demo#/blog/42')
  globalThis.window = { get location(){return globalThis.location}, addEventListener(){},removeEventListener(){}, history: { state:null, pushState(value, _title, path) { this.state=value;state.urls.push(path); globalThis.location = new URL(path, location) }, replaceState(value, _title, path) { this.state=value;state.urls.push(path); globalThis.location = new URL(path, location) } } }
  globalThis.document = { querySelector(selector) { assert.equal(selector, '[data-tab-scroll]'); return { scrollTo: options => state.scrolls.push(options) } } }
  useStore.setState({ toast: text => state.notices.push(text), me: { id: 1 }, tab, stack: [{ type: 'lesson', id: 42, post: true }], reward: null, share: null })
  stopNavigation=bindAppNavigation(useStore,window);state.urls=[]
}
const renderNav = (inPost, extra = {}) => { state.clicks = []; return renderToStaticMarkup(createElement(MainNav, { overlay: inPost, currentTab: inPost ? 'blog' : undefined, ...extra })) }
const post = { id: 42, kind: 'lesson', course_id: null, title: 'Новость', category: 'ИИ', minutes: 2, body: 'Текст публикации', liked: false, likes: 0 }
function renderPost(extra = {}) {
  state.clicks = []; state.effects = []
  return renderToStaticMarkup(createElement(NavigationFrame, { active: true, routeKey: 'post-42', currentTab: 'blog', overlay: true }, createElement(PostScreen, { id: 42, post, preview: undefined, error: false, retry() {}, like() {}, share() {}, ...extra })))
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
  assert.match(html, /padding-bottom:calc\(14px \+ var\(--navigation-safe-bottom\)\)/)
  state.clicks.find(button => button['aria-label'] === 'Новости').onClick()
  assert.deepEqual(state.scrolls, [{ top: 0, behavior: 'smooth' }])
  assert.deepEqual(state.urls, [])
  state.clicks.find(button => button['aria-label'] === 'Профиль').onClick()
  assert.equal(useStore.getState().tab, 'profile')
  useStore.setState({ tab: 'top' })
  assert.match(renderNav(false), /aria-label="Профиль" aria-current="page"/)
})

test('editor exit is confirmed once, cancellation and stale replies cannot navigate', async () => {
 reset('profile')
 const editor = { type: 'editor', lesson: null, kind: 'lesson' }
 useStore.setState({ stack: [editor] })
 let resolve, prompts = 0
 state.confirm = () => { prompts++; return new Promise(yes => { resolve = yes }) }
 renderNav(true)
 const click = state.clicks.find(button => button['aria-label'] === 'Главная').onClick
 const cancelled = click(); await click(); assert.equal(prompts, 1)
 resolve(false); await cancelled
 assert.deepEqual(useStore.getState().stack, [editor])
 const stale = click()
 useStore.getState().push({type: 'lesson', id: 42})
 resolve(true); await stale
 assert.equal(useStore.getState().stack.length, 2)
 state.confirm = async () => true
 renderNav(true)
 await state.clicks.find(button => button['aria-label'] === 'Главная').onClick()
 assert.equal(useStore.getState().tab, 'home'); assert.deepEqual(useStore.getState().stack, [])
})

test('pending mutation or invoice blocks tab exit without starting any payment', async () => {
 reset('courses')
 const stack = useStore.getState().stack
 const scope = { current: { querySelector(selector) { assert.match(selector, /data-navigation-busy/); assert.match(selector, /data-course-payment="opening"/); return {} } } }
 renderNav(true, { scope })
 await state.clicks.find(button => button['aria-label'] === 'Главная').onClick()
 assert.equal(useStore.getState().stack, stack)
 assert.equal(useStore.getState().tab, 'courses')
 assert.deepEqual(state.notices, ['Дождись завершения текущей операции'])
})

test('unsaved learner answers require consent and mutations started during confirmation still block exit', async () => {
 reset('courses')
 const stack = [{type:'learning',path:'/courses/lessons/AI-CORE-M1-L1'}]
 useStore.setState({stack})
 let pending = false, resolve, prompts = []
 state.confirm = message => { prompts.push(message); return new Promise(yes => { resolve = yes }) }
 const scope = {current:{querySelector(selector){return selector.includes('data-navigation-dirty') || pending ? {} : null}}}
 renderNav(true,{scope})
 const click = state.clicks.find(button => button['aria-label'] === 'Новости').onClick
 const cancel = click(); resolve(false); await cancel
 assert.equal(useStore.getState().stack,stack)
 const delayed = click(); pending = true; resolve(true); await delayed
 assert.equal(useStore.getState().stack,stack)
 assert.deepEqual(state.notices,['Дождись завершения текущей операции'])
 pending = false
 const leave = click(); resolve(true); await leave
 assert.deepEqual(useStore.getState().stack,[]); assert.equal(useStore.getState().tab,'blog')
 assert.equal(prompts.length,3); assert.match(prompts[0],/Несохранённые ответы/)
})

test('reduced motion avoids smooth scrolling and inactive scopes render no duplicate dock', async () => {
 reset('blog'); useStore.setState({ stack: [] })
 const previous = globalThis.matchMedia
 globalThis.matchMedia = () => ({ matches: true })
 try {
  renderNav(false)
  await state.clicks.find(button => button['aria-label'] === 'Новости').onClick()
  assert.deepEqual(state.scrolls, [{ top: 0, behavior: 'auto' }])
 } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia }
 for (const active of [false, true]) {
  const html = renderToStaticMarkup(createElement(NavigationFrame, { active, routeKey: 'test', currentTab: 'courses' }, createElement('div', {}, 'Screen')))
  assert.equal((html.match(/aria-label="Основные разделы"/g) || []).length, active ? 1 : 0)
 }
})

test('post navigation remains present during loading and retry, with a separate safe-area footer', () => {
  reset()
  for (const extra of [{}, { post: null, preview: post }, { post: null }, { post: null, error: true }]) {
    const html = renderPost(extra)
    for (const label of labels) assert.ok(state.clicks.some(button => button['aria-label'] === label), label)
    assert.match(html, /navigation-content/); assert.match(html, /navigation-dock/)
    assert.equal((html.match(/aria-label="Основные разделы"/g) || []).length, 1)
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
  assert.match(app, /navigationFromHash\(location.hash\)/)
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

test('assignment dirty guard tracks text, URL and files and clears only the successfully saved snapshot', async () => {
 const original = await readFile(new URL('../src/screens/academy/Learning.tsx', import.meta.url), 'utf8')
 const assignment = original.slice(original.indexOf('function Assignment('), original.indexOf('\nexport function Lesson('))
 const harness = {values:[],cursor:0,calls:[],result:{id:'saved'}}
 harness.useState = initial => {
  const index = harness.cursor++
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial
  return [harness.values[index], value => { harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value }]
 }
 globalThis.__assignmentNavigation = harness
 const prelude = `const h=globalThis.__assignmentNavigation; const useState=h.useState; const text=value=>String(value??''); const useAcademyTranslation=()=>value=>value; const useAction=()=>({run:async (...args)=>{h.calls.push(args);return h.result},feedback:null}); const panel='';const Tap='button',AcademyFiles='file-input',AcademyAttachmentLinks='file-links',External='a',Status='status';`
 let {code} = await transformWithOxc(`${prelude}\nexport ${assignment}`, '/test-assignment.tsx', {lang:'tsx'})
 code = code.replace(/from (["'])([^"']+)\1/g, (_,quote,name)=>`from ${JSON.stringify(import.meta.resolve(name))}`)
 const {Assignment} = await import(moduleUrl(code))
 const render = () => {harness.cursor=0;return Assignment({code:'L1',submissions:[],refresh(){}})}
 const nodes = element => !element || typeof element !== 'object' ? [] : [element,...[element.props?.children].flat(Infinity).flatMap(nodes)]
 const input = (tree,type) => nodes(tree).find(node=>node.type===type)
 let tree=render();assert.equal(tree.props['data-navigation-dirty'],undefined)
 input(tree,'textarea').props.onChange({target:{value:'Мой ответ'}})
 tree=render();assert.equal(tree.props['data-navigation-dirty'],true)
 input(tree,'input').props.onChange({target:{value:'https://example.test/project'}})
 input(tree,'file-input').props.onChange(['file-1'])
 tree=render()
 harness.result=undefined
 nodes(tree).find(node=>node.type==='button'&&node.props.children==='Сохранить черновик').props.onClick()
 await new Promise(resolve=>setImmediate(resolve))
 tree=render();assert.equal(tree.props['data-navigation-dirty'],true)
 harness.result={id:'saved'}
 nodes(tree).find(node=>node.type==='button'&&node.props.children==='Сохранить черновик').props.onClick()
 await new Promise(resolve=>setImmediate(resolve))
 tree=render();assert.equal(tree.props['data-navigation-dirty'],undefined)
 assert.deepEqual(harness.calls.at(-1)[1].artifact,{text:'Мой ответ',url:'https://example.test/project',file_ids:['file-1']})
 input(tree,'file-input').props.onChange([])
 assert.equal(render().props['data-navigation-dirty'],true)
 delete globalThis.__assignmentNavigation
})
