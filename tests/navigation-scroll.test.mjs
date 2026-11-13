import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { initialNavigationScroll, nextNavigationScroll, bindNavigationScroll } from '../src/lib/navigation-scroll.ts'
import { navigationTab, mayDiscardEditor } from '../src/lib/navigation-context.ts'

test('direction threshold hides down and reveals up without small jitter or overscroll', () => {
 let state = initialNavigationScroll()
 for (const top of [5, 15, 23, 40, 55]) { state = nextNavigationScroll(state, top, 1000); assert.equal(state.hidden, false) }
 state = nextNavigationScroll(state, 85, 1000); assert.equal(state.hidden, true)
 state = nextNavigationScroll(state, 83, 1000); assert.equal(state.hidden, true)
 state = nextNavigationScroll(state, 82, 1000); assert.equal(state.hidden, true)
 state = nextNavigationScroll(state, 77, 1000); assert.equal(state.hidden, false)
 state = nextNavigationScroll(state, 150, 1000); assert.equal(state.hidden, true)
 state = nextNavigationScroll(state, -40, 1000); assert.equal(state.hidden, false); assert.equal(state.top, 0)
 state = nextNavigationScroll(state, 50, 70); assert.equal(state.hidden, false)
 state = nextNavigationScroll(state, 450, 500); assert.equal(state.hidden, false)
 state = nextNavigationScroll(initialNavigationScroll(), 200, 1000, true); assert.equal(state.hidden, false)
})

function harness(initialTop = 0) {
 const previous = globalThis.HTMLElement
 class Element {
  constructor(options = {}) { Object.assign(this, { scrollTop: 0, scrollHeight: 1500, clientHeight: 500, outer: false, layer: null, inert: false, parentElement: null }, options) }
  matches(selector) { return selector === ':focus-visible' ? !!this.keyboardFocus : this.outer }
  closest(selector) { return selector === '[inert]' ? this.inert ? this : null : selector === '[data-focus-layer]' ? this.layer :  /input|data-main-nav/.test(selector) ? (/input/.test(selector) && this.editable || /data-main-nav/.test(selector) && this.nav) ? this : null : this.outer ? this : null }
 }
 globalThis.HTMLElement = Element
 const handlers = new Map(), visible = []
 const root = new Element(), doc = { activeElement: null }
 root.contains = node => node?.inside === true
 root.addEventListener = (name, listener) => handlers.set(name, listener)
 root.removeEventListener = name => handlers.delete(name)
 const scroller = new Element({ outer: true, ownerDocument: doc, inside: true, scrollTop: initialTop })
 root.querySelectorAll = () => [scroller]
 const cleanup = bindNavigationScroll(root, hidden => visible.push(hidden))
 const scroll = (top, target = scroller) => { target.scrollTop = top; handlers.get('scroll')({ target }); return visible.at(-1) }
 const finish = () => { cleanup(); assert.equal(handlers.size, 0); globalThis.HTMLElement = previous }
 return { Element, handlers, visible, root, doc, scroller, scroll, finish }
}

test('returning to a scrolled screen and lazy scroller replacement never invent downward movement', () => {
 const h = harness(300)
 try {
  assert.equal(h.scroll(290), false)
  assert.equal(h.scroll(350), true)
  const next = new h.Element({ outer: true, inside: true, ownerDocument: h.doc })
  assert.equal(h.scroll(700, next), false)
  assert.equal(h.scroll(770, next), true)
  assert.equal(h.scroll(758, next), false)
 } finally { h.finish() }
})

test('only outer active scrollers drive the dock; nested fields and modal sheets are ignored', () => {
 const h = harness()
 try {
  assert.equal(h.scroll(100), true)
  const before = h.visible.length
  h.scroll(20, new h.Element({ outer: true, inside: true, parentElement: h.scroller, ownerDocument: h.doc }))
  h.scroll(20, new h.Element({ outer: false, editable: true, inside: true, ownerDocument: h.doc }))
  h.scroll(20, new h.Element({ outer: true, inert: true, inside: true, ownerDocument: h.doc }))
  h.scroll(20, new h.Element({ outer: true, layer: {}, inside: true, ownerDocument: h.doc }))
  assert.equal(h.visible.length, before)
  assert.equal(h.scroll(85), false)
 } finally { h.finish() }
})

test('keyboard, editable focus and nav focus reveal and pin the menu; pointer scrolling resumes', () => {
 const h = harness()
 try {
  assert.equal(h.scroll(100), true)
  h.handlers.get('keydown')({ key: 'Tab' }); assert.equal(h.visible.at(-1), false)
  assert.equal(h.scroll(200), false)
  h.handlers.get('pointerdown')(); assert.equal(h.scroll(270), true)
  h.doc.activeElement = new h.Element({ editable: true, inside: true })
  h.handlers.get('focusin')({ target: h.doc.activeElement }); assert.equal(h.visible.at(-1), false)
  assert.equal(h.scroll(350), false)
  h.doc.activeElement = null; h.handlers.get('wheel')(); assert.equal(h.scroll(450), true)
  h.doc.activeElement = new h.Element({ nav: true, inside: true })
  h.handlers.get('focusin')({ target: h.doc.activeElement }); assert.equal(h.visible.at(-1), false)
  // Touching a tab must not pin the menu for all later touch scrolling.
  h.handlers.get('pointerdown')(); assert.equal(h.scroll(540), true)
  h.doc.activeElement.keyboardFocus = true
  assert.equal(h.scroll(620), false)
 } finally { h.finish() }
})

test('all app overlays have a primary section and editors require safe exit', () => {
 assert.equal(navigationTab('home'), 'home')
 for (const type of ['learning', 'academy', 'course', 'certifications']) assert.equal(navigationTab('home', { type }), 'courses')
 assert.equal(navigationTab('home', { type: 'lesson', id: 5 }), 'courses')
 assert.equal(navigationTab('home', { type: 'lesson', id: 5, post: true }), 'blog')
 assert.equal(navigationTab('home', { type: 'lesson', id: 5 }, [{ id: 5, kind: 'lesson', course_id: null }]), 'blog')
 assert.equal(navigationTab('home', { type: 'stories' }), 'blog')
 for (const type of ['lab', 'journey', 'club', 'services', 'admin', 'admin-content', 'analytics', 'courses-admin', 'course-editor', 'editor', 'advent', 'door', 'advent-admin', 'companion-settings']) assert.equal(navigationTab('home', { type }), 'profile')
 for (const stack of [[{type:'editor'}], [{type:'advent-admin'}], [{type:'course-editor'},{type:'lesson'}], [{type:'learning',path:'/courses/admin'}], [{type:'academy',path:'/admin/reviews'}]]) assert.equal(mayDiscardEditor(stack), true)
 for (const stack of [[], [{type:'admin'}], [{type:'learning',path:'/courses/og-practice/coding'}]]) assert.equal(mayDiscardEditor(stack), false)
})

test('one active dock lives inside each focus scope, with safe area, animation and route reset contracts', async () => {
 const source = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
 const [app, frame, post, css, academy, nav] = await Promise.all(['App.tsx','NavigationFrame.tsx','screens/Post.tsx','index.css','screens/Academy.tsx','MainNav.tsx'].map(source))
 assert.equal((app.match(/<NavigationFrame /g) || []).length, 2)
 assert.match(app, /<FocusLayer[^>]+>[\s\S]*?<NavigationFrame active=\{i === stack.length - 1 && !reward && !share\}/)
 assert.match(frame, /active && <div ref=\{dock\}/)
 assert.match(frame, /\[active, routeKey\]/)
 assert.match(frame, /ResizeObserver/)
 assert.doesNotMatch(post, /MainNav/)
 assert.match(css, /inset: 0 0 var\(--navigation-height\)/)
 assert.match(css, /env\(safe-area-inset-bottom/)
 assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?navigation-dock \{ transition: none/)
 assert.match(css, /navigation-dock:has\(:focus-visible\)/)
 assert.match(css, /navigation-frame:has\(\.navigation-content \[data-focus-layer\]\[aria-modal='true'\], \.navigation-content dialog\[open\]\) > \.navigation-dock \{\s*visibility: hidden/)
 assert.doesNotMatch(frame, /aria-hidden|inert=/)
 assert.ok(academy.indexOf('<nav aria-label=') < academy.indexOf('<main ref={scroller}'))
 assert.match(nav, /data-course-payment="opening"/)
 assert.match(nav, /useStore.getState\(\).stack !== stack/)
 assert.match(nav, /reduced \? 'auto' : 'smooth'/)
})


test('custom story and Dots scrolling and all mutable screen surfaces expose navigation guards', async () => {
 const source = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
 const [stories,dots,dotsCss,program,lesson,door,files,quiz,shared,ui,assignment] = await Promise.all(['screens/Stories.tsx','screens/home/Companion.tsx','screens/home/companion.css','screens/courses/Program.tsx','screens/Lesson.tsx','screens/advent/Door.tsx','screens/academy/Files.tsx','screens/academy/Quiz.tsx','screens/academy/shared.tsx','ui.tsx','screens/academy/Learning.tsx'].map(source))
 assert.match(stories,/ref=\{contentRef\} data-navigation-scroll/)
 assert.match(dots,/<form data-navigation-scroll/)
 assert.match(dots,/data-navigation-dirty=\{JSON.stringify\(draft\) !== initialDraft.current/)
 assert.match(dotsCss,/max-height: calc\(100% - var\(--top\) - 12px\)/)
 assert.match(program,/data-navigation-busy=\{paying/)
 assert.match(lesson,/data-navigation-busy=\{submitting/)
 assert.match(door,/data-navigation-dirty=\{answers.length > 0/)
 assert.match(door,/data-navigation-busy=\{busy/)
 assert.match(files,/data-navigation-busy=\{busy/)
 assert.match(quiz,/data-navigation-dirty=\{!!attempt && draftStatus === 'Не удалось сохранить черновик'/)
 assert.match(shared,/busy && <span hidden data-navigation-busy="true"/)
 assert.match(ui,/data-navigation-busy=\{busy/)
 assert.match(assignment,/data-navigation-dirty=\{artifact !== savedArtifact/)
 assert.match(assignment,/if \(saved\) setSavedArtifact\(artifact\)/)
})
