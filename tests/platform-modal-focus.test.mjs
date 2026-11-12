import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mountModalFocus } from '../src/platform-kit/src/components/modal-focus.ts'

// Deterministic DOM contract tests; browser layout/keyboard acceptance is separate.
class Element {
  constructor(doc, options = {}) {
    Object.assign(this, { ownerDocument: doc, isConnected: true, tabIndex: 0, children: [], visibility: 'visible' }, options)
  }
  matches() { return !!this.disabled }
  closest() { return this.hidden || this.inert || this.ariaHidden ? this : null }
  getClientRects() { return this.noLayout ? [] : [{}] }
  querySelectorAll() { return this.children }
  contains(node) { return node === this || this.children.includes(node) }
  focus() { this.ownerDocument.activeElement = this; this.ownerDocument.dispatch('focusin', { target: this }) }
}
function setup() {
  const listeners = new Map()
  const doc = {
    activeElement: null,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
    dispatch(type, event) { for (const fn of listeners.get(type) ?? []) { fn(event); if (event.stopped) break } },
  }
  globalThis.HTMLElement = Element
  globalThis.getComputedStyle = element => ({ visibility: element.visibility })
  const opener = new Element(doc)
  opener.focus()
  const root = new Element(doc, { tabIndex: -1 })
  const first = new Element(doc), last = new Element(doc)
  root.children = [first, last]
  const key = (key, shiftKey = false) => {
    const event = { key, shiftKey, prevented: false, preventDefault() { this.prevented = true }, stopImmediatePropagation() { this.stopped = true } }
    doc.dispatch('keydown', event)
    return event
  }
  return { doc, opener, root, first, last, key }
}
test('container, both boundaries and escaped focus remain inside dialog', () => {
  const { doc, opener, root, first, last, key } = setup()
  const cleanup = mountModalFocus(root, () => {})
  assert.equal(doc.activeElement, root)
  assert.equal(key('Tab', true).prevented, true)
  assert.equal(doc.activeElement, last)
  key('Tab'); assert.equal(doc.activeElement, first)
  key('Tab', true); assert.equal(doc.activeElement, last)
  root.focus(); key('Tab'); assert.equal(doc.activeElement, first)
  opener.focus(); assert.equal(doc.activeElement, first)
  cleanup(); assert.equal(doc.activeElement, opener)
})
test('disabled, hidden, inert and negative tabindex controls are skipped; empty scope is trapped', () => {
  const { doc, root, first, key } = setup()
  root.children = [
    ...[{ disabled: true }, { hidden: true }, { inert: true }, { ariaHidden: true }, { visibility: 'hidden' }, { visibility: 'collapse' }, { noLayout: true }, { tabIndex: -1 }].map(options => new Element(doc, options)), first,
  ]
  const cleanup = mountModalFocus(root, () => {})
  key('Tab'); assert.equal(doc.activeElement, first)
  first.disabled = true
  key('Tab'); assert.equal(doc.activeElement, root)
  key('Tab', true); assert.equal(doc.activeElement, root)
  cleanup()
})
test('only top dialog handles escape and restores its opener on close', () => {
  const { doc, root, first, opener, key } = setup()
  let parentCloses = 0, childCloses = 0
  const cleanParent = mountModalFocus(root, () => parentCloses++)
  first.focus()
  const child = new Element(doc, { tabIndex: -1 })
  const cleanChild = mountModalFocus(child, () => childCloses++)
  first.focus(); assert.equal(doc.activeElement, child)
  assert.equal(key('Escape').prevented, true)
  assert.equal(parentCloses, 0); assert.equal(childCloses, 1)
  cleanChild(); assert.equal(doc.activeElement, first)
  key('Escape'); assert.equal(parentCloses, 1)
  cleanParent(); assert.equal(doc.activeElement, opener)
})
test('closing a background dialog does not move focus; removed opener is ignored', () => {
  const { doc, root, opener } = setup()
  const cleanParent = mountModalFocus(root, () => {})
  const child = new Element(doc)
  const cleanChild = mountModalFocus(child, () => {})
  cleanParent(); assert.equal(doc.activeElement, child)
  root.isConnected = false; opener.isConnected = false
  cleanChild(); assert.equal(doc.activeElement, child)
})
test('positive tabindex order and changes to controls are evaluated per keypress', () => {
  const { doc, root, first, last, key } = setup()
  last.tabIndex = 1
  const cleanup = mountModalFocus(root, () => {})
  key('Tab'); assert.equal(doc.activeElement, last)
  root.focus(); key('Tab', true); assert.equal(doc.activeElement, first)
  root.children = [last]; first.focus(); key('Tab'); assert.equal(doc.activeElement, last)
  cleanup()
})
test('Modal close callback updates do not tear down its focus scope', () => {
  const source = readFileSync(new URL('../src/platform-kit/src/components/ui.tsx', import.meta.url), 'utf8')
  assert.match(source, /useLayoutEffect\(\(\) => \{ close.current = onClose \}, \[onClose\]\)/)
  assert.match(source, /mountModalFocus\(ref.current, \(\) => close.current\(\)\)[\s\S]*?\}, \[present\]\)/)
})
test('native summary without explicit tabindex participates in modal focus order', () => {
  const { doc, root, first, last, key } = setup()
  const summary = new Element(doc)
  root.children = [first, summary, last]
  root.querySelectorAll = selector => selector.split(',').map(value => value.trim()).includes('summary') ? root.children : [first, last]
  const cleanup = mountModalFocus(root, () => {})
  summary.focus()
  assert.equal(key('Tab').prevented, false)
  assert.equal(doc.activeElement, summary)
  assert.equal(key('Tab', true).prevented, false)
  cleanup()
})
