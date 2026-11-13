import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HOME_ASSEMBLY_DURATION, startAssemblyLifetime } from '../src/lib/home-assembly.ts'
const source = readFileSync(new URL('../src/screens/home/HomeAssembly.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/screens/home/home-assembly.css', import.meta.url), 'utf8')
class TrackedTarget extends EventTarget {
  listeners = 0
  hidden = false
  addEventListener(...args) { this.listeners++; super.addEventListener(...args) }
  removeEventListener(...args) { this.listeners--; super.removeEventListener(...args) }
}
function setup() {
  const root = new TrackedTarget(), page = new TrackedTarget(), viewport = new TrackedTarget(), motion = new TrackedTarget()
  const timers = new Map(); let calls = 0
  const dispose = startAssemblyLifetime({ root, page, viewport, motion, onStop: () => calls++, schedule(callback, delay) { assert.equal(delay, 3600); timers.set(1, callback); return 1 }, cancel(id) { timers.delete(id) } })
  return { root, page, viewport, motion, timers, dispose, get calls() { return calls }, assertClean() { assert.equal(timers.size, 0); for (const target of [root,page,viewport,motion]) assert.equal(target.listeners, 0) } }
}
test('finite lifetime ends once and releases every resource', () => {
  assert.equal(HOME_ASSEMBLY_DURATION, 3600)
  const run = setup(); const timeout = run.timers.get(1); timeout(); timeout();
  assert.equal(run.calls, 1); run.assertClean()
})
for (const [target, event] of [['root','scroll'],['root','pointerdown'],['page','keydown'],['viewport','resize'],['motion','change']]) test(`${event} interrupts immediately and cancels timeout`, () => {
  const run = setup(); run[target].dispatchEvent(new Event(event)); assert.equal(run.calls, 1); run.assertClean()
})
test('hidden page cancels; visible notification does not', () => {
  const run = setup(); run.page.dispatchEvent(new Event('visibilitychange')); assert.equal(run.calls, 0)
  run.page.hidden = true; run.page.dispatchEvent(new Event('visibilitychange')); assert.equal(run.calls, 1); run.assertClean()
})
test('unmount is idempotent and never calls state setter afterward', () => {
  const run = setup(); const timeout = run.timers.get(1); run.dispose(); run.dispose(); timeout()
  assert.equal(run.calls, 0); run.assertClean()
})
test('decorative only, three visible targets, no cloning or blocking controls', () => {
  assert.match(source, /aria-hidden="true"/); assert.match(source, /slice\(0, 3\)/); assert.match(source, /opacity: \.72/)
  assert.doesNotMatch(source, /cloneNode|innerHTML|fetch\(|<button/)
  assert.match(css, /pointer-events:none/); assert.doesNotMatch(css, /pointer-events:auto/)
  assert.match(source, /sessionStorage.getItem/); assert.match(source, /claimed.current/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(source + css, /requestAnimationFrame|setInterval|infinite/)
})
