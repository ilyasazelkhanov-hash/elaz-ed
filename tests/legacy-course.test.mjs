import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { practiceKeyForCourse } from '../src/lib/og-course-access.ts'
import { ogPracticeCourses, practicePath } from '../src/lib/og-practice.ts'
import { learningPath, learningUrl } from '../src/lib/learning-entry.ts'

const compiled = {}
for (const file of ['LegacyCourse', 'Courses']) {
 const bundle = await rolldown({ input: fileURLToPath(new URL(`../src/screens/${file}.tsx`, import.meta.url)), external: (_id, parent) => !!parent, transform: { jsx: { runtime: 'automatic' } } })
 try { compiled[file] = (await bundle.generate({ format: 'cjs' })).output[0].code } finally { await bundle.close() }
}
// Only replace the chunk-loading boundary. Exercise the actual component, matcher,
// handlers and effect cleanup offline, following course-funnel.test.mjs's hook harness.
assert.equal(compiled.LegacyCourse.split('import("../lib/og-practice")').length, 2)
compiled.LegacyCourse = compiled.LegacyCourse.replace('import("../lib/og-practice")', '__loadPractice()')
const practiceModule = { ogPracticeCourses, practicePath }
const course = (id, key) => ({ id, practice_key: key, title: key, access: false })
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

function setup() {
 let frame
 const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
 const react = {
  lazy: () => 'lazy-screen', Suspense: 'suspense',
  useRef(initial) { const i = frame.index++; return frame.hooks[i] ??= { current: initial } },
  useState(initial) {
   const target = frame, i = target.index++
   if (!(i in target.hooks)) target.hooks[i] = typeof initial === 'function' ? initial() : initial
   return [target.hooks[i], value => { target.updates++; target.hooks[i] = typeof value === 'function' ? value(target.hooks[i]) : value }]
  },
  useEffect(fn, deps) {
   const i = frame.index++, old = frame.hooks[i]
   if (!old || !same(old.deps, deps)) { frame.hooks[i] = { deps, fn, cleanup: old?.cleanup }; frame.effects.push(i) }
  },
 }
 const source = { type: 'lesson', id: 90 }, overlay = { type: 'course', id: 40 }
 const state = { courses: [course(40, 'foundations'), course(41, 'text')], stack: [source, overlay], tab: 'home', pop() { state.stack = state.stack.slice(0, -1) }, setTab(tab) { state.tab = tab } }
 const requests = [], writes = [], urls = [], listeners = new Map()
 const useStore = selector => selector(state)
 useStore.getState = () => state
 useStore.setState = update => { writes.push(update); Object.assign(state, update(state)) }
 const location = { pathname: '/', search: '', hash: '' }
 const window = {
  history: { replaceState(_state, _title, url) { urls.push(url); location.hash = url.includes('#') ? '#' + url.split('#')[1] : '' } },
  addEventListener(name, fn) { listeners.set(name, fn) }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name) },
 }
 const modules = {
  react, 'react/jsx-runtime': jsxRuntime, '../store': { useStore },
  '../lib/og-course-access': { practiceKeyForCourse }, '../lib/learning-entry': { learningPath, learningUrl },
  '../lib/learning-scope': { LearningProvider: 'provider' }, '../ui': { Tap: 'button' },
  './home/OGPractice': { OGPractice: 'practice' }, './home/FreeStart': { FreeStart: 'free-start' },
  './academy/shared': { useAcademy: () => ({ data: null }), Empty: 'empty' },
  'lucide-react': { ArrowLeft: 'arrow', BookOpen: 'book' }, '../academy.css': {},
 }
 function load(file) {
  const module = { exports: {} }
  vm.runInNewContext(compiled[file], {
   exports: module.exports, module, location, window,
   require(id) { assert.ok(Object.hasOwn(modules, id), `Unexpected import: ${id}`); return modules[id] },
   __loadPractice() { const request = Promise.withResolvers(); requests.push(request); return request.promise },
  }, { filename: file + '.tsx' })
  return module.exports
 }
 function mount(fn, props) {
  const target = { hooks: [], effects: [], index: 0, updates: 0 }
  return {
   render(next = props) {
    props = next; frame = target; target.index = 0
    const tree = fn(props)
    for (const i of target.effects.splice(0)) { const hook = target.hooks[i]; hook.cleanup?.(); hook.cleanup = hook.fn() }
    return tree
   },
   unmount() { for (const hook of target.hooks) hook?.cleanup?.() },
   get updates() { return target.updates },
  }
 }
 return { state, source, overlay, requests, writes, urls, listeners, load, mount, legacy: () => mount(load('LegacyCourse').LegacyCourse, { overlay }) }
}
function find(tree, predicate) {
 if (!tree || typeof tree !== 'object') return
 if (predicate(tree)) return tree
 for (const child of [tree.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found }
}
const button = (tree, label) => find(tree, node => node.type === 'button' && node.props.children === label)
const html = screen => renderToStaticMarkup(screen.render())

async function fail(h, screen) {
 screen.render(); h.requests.at(-1).reject(new Error('PRIVATE_CHUNK_URL'))
 await settle()
 const result = html(screen)
 assert.match(result, /role="alert"/)
 assert.match(result, /Не удалось загрузить курс/)
 assert.doesNotMatch(result, /Старый курс скрыт|PRIVATE_CHUNK_URL|aria-busy/)
 assert.equal(h.requests.length, 1) // no automatic retry loop
}

test('chunk failure is retryable, repeated taps make one request, and success replaces only the old overlay', async () => {
 const h = setup(), screen = h.legacy()
 await fail(h, screen)
 assert.deepEqual(h.state.stack, [h.source, h.overlay])
 const retry = button(screen.render(), 'Повторить загрузку').props.onClick
 retry(); retry()
 assert.match(html(screen), /aria-busy="true"/)
 assert.doesNotMatch(html(screen), /Старый курс скрыт|role="alert"|Повторить загрузку/)
 retry(); screen.render()
 assert.equal(h.requests.length, 2)
 h.requests[1].resolve(practiceModule); await settle()
 assert.equal(h.writes.length, 1)
 assert.equal(h.state.stack.length, 2)
 assert.equal(h.state.stack[0], h.source)
 assert.equal(h.state.stack[1].type, 'learning')
 assert.equal(h.state.stack[1].path, '/courses/og-practice/foundations')
 assert.equal(h.state.courses[0].access, false)
 screen.unmount()
})

test('a failed retry remains an error and another explicit retry is allowed', async () => {
 const h = setup(), screen = h.legacy()
 await fail(h, screen)
 button(screen.render(), 'Повторить загрузку').props.onClick(); screen.render()
 h.requests[1].reject(new Error('still offline')); await settle()
 assert.match(html(screen), /Не удалось загрузить курс/)
 assert.equal(h.requests.length, 2)
 button(screen.render(), 'Повторить загрузку').props.onClick(); screen.render()
 assert.equal(h.requests.length, 3)
 h.requests[2].resolve(practiceModule); await settle()
 assert.equal(h.writes.length, 1)
 screen.unmount()
})

for (const id of [7, 99]) test(`retired or missing course ${id} keeps the original notice and catalog action`, async () => {
 const h = setup(); h.overlay.id = id; h.state.courses.push(course(7, 'retired'))
 const screen = h.legacy(); screen.render(); h.requests[0].resolve(practiceModule); await settle()
 assert.match(html(screen), /Старый курс скрыт/)
 assert.doesNotMatch(html(screen), /Не удалось загрузить|Повторить загрузку/)
 assert.equal(h.writes.length, 0)
 button(screen.render(), 'Открыть курсы →').props.onClick()
 assert.deepEqual(h.state.stack, [h.source]); assert.equal(h.state.tab, 'courses')
 screen.unmount()
})

test('repeated error Back dismisses only that overlay without changing tab', async () => {
 const h = setup(), screen = h.legacy()
 await fail(h, screen)
 const back = button(screen.render(), 'Назад').props.onClick
 back(); back(); screen.unmount()
 await settle()
 assert.deepEqual(h.state.stack, [h.source]); assert.equal(h.state.tab, 'home')
 assert.equal(h.requests.length, 1); assert.equal(h.writes.length, 0)
})

test('stale error Back cannot dismiss a newer overlay', async () => {
 const h = setup(), screen = h.legacy()
 await fail(h, screen)
 const back = button(screen.render(), 'Назад').props.onClick, newer = { type: 'course', id: 41 }
 h.state.stack = [h.source, newer]; back()
 assert.deepEqual(h.state.stack, [h.source, newer]); screen.unmount()
})

for (const outcome of ['resolve', 'reject']) test(`pending ${outcome} after unmount cannot update state or reopen a dismissed course`, async () => {
 const h = setup(), screen = h.legacy(); screen.render()
 h.state.pop(); screen.unmount(); const updates = screen.updates
 h.requests[0][outcome](outcome === 'resolve' ? practiceModule : new Error('late failure')); await settle()
 assert.deepEqual(h.state.stack, [h.source]); assert.equal(h.writes.length, 0)
 assert.equal(screen.updates, updates)
})

for (const outcome of ['resolve', 'reject']) test(`old course ${outcome} cannot replace a newer course or overwrite its error`, async () => {
 const h = setup(), screen = h.legacy(); screen.render()
 const newer = { type: 'course', id: 41 }
 h.state.stack = [h.source, newer]; screen.render({ overlay: newer })
 h.requests[1].reject(new Error('new course offline')); await settle()
 assert.match(html(screen), /Не удалось загрузить курс/)
 h.requests[0][outcome](outcome === 'resolve' ? practiceModule : new Error('old failure')); await settle()
 assert.equal(h.writes.length, 0); assert.equal(h.state.stack[1], newer)
 assert.match(html(screen), /Не удалось загрузить курс/)
 button(screen.render(), 'Повторить загрузку').props.onClick(); screen.render()
 h.requests[2].resolve(practiceModule); await settle()
 assert.equal(h.state.stack[1].path, '/courses/og-practice/text')
 screen.unmount()
})

test('updated course data invalidates an older resolution and clears a stale retired notice', async () => {
 const h = setup(), screen = h.legacy(); h.state.courses = []
 screen.render(); h.requests[0].resolve(practiceModule); await settle()
 assert.match(html(screen), /Старый курс скрыт/)
 h.state.courses = [course(40, 'text')]; screen.render()
 assert.match(html(screen), /aria-busy="true"/)
 h.state.courses = [course(40, 'foundations')]; screen.render()
 h.requests[2].resolve(practiceModule); await settle()
 h.requests[1].resolve(practiceModule); await settle()
 assert.equal(h.writes.length, 1); assert.equal(h.state.stack[1].path, '/courses/og-practice/foundations')
 screen.unmount()
})

test('dismissal before effect cleanup does not reopen or replace a later overlay with the same id', async () => {
 const h = setup(), screen = h.legacy(); screen.render()
 const later = { ...h.overlay }; h.state.stack = [h.source, later]
 h.requests[0].resolve(practiceModule); await settle()
 assert.equal(h.state.stack.length, 2); assert.equal(h.state.stack[1], later)
 screen.unmount()
})

test('redirect preserves existing OG Back behavior: catalog first, then dismiss to the source', async () => {
 const h = setup(), legacy = h.legacy(); legacy.render()
 h.requests[0].resolve(practiceModule); await settle(); legacy.unmount()
 const wrapper = h.load('Courses').CoursesScreen({ path: h.state.stack[1].path })
 const child = wrapper.props.children, screen = h.mount(child.type, child.props)
 let tree = screen.render()
 assert.equal(find(tree, node => node.type === 'practice').props.path, '/og-practice/foundations')
 find(tree, node => node.props?.['aria-label'] === 'Назад').props.onClick()
 tree = screen.render()
 assert.equal(find(tree, node => node.type === 'practice').props.path, '/og-practice')
 assert.equal(h.state.stack.length, 2)
 h.listeners.get('og:courses-back')(); screen.unmount()
 assert.deepEqual(h.state.stack, [h.source]); assert.equal(h.state.tab, 'home')
 assert.equal(h.listeners.has('og:courses-back'), false)
})
