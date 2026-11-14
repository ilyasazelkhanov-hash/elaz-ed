import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { bindAppNavigation, backWithinApp, navigationFromHash, navigationHash } from '../src/lib/app-navigation.ts'

function harness(initial = { tab: 'home', stack: [] }, href = 'https://app.test/?demo') {
  let value = initial, index = 0
  const listeners = new Map(), changes = []
  const records = [{ url: new URL(href), state: null }]
  const emit = event => { for (const fn of listeners.get(event) || []) fn() }
  const browser = {
    get location() { return records[index].url },
    history: {
      get state() { return records[index].state },
      pushState(state, _, url) { records.splice(index + 1); records.push({ state, url: new URL(url, browser.location) }); index++; changes.push('push') },
      replaceState(state, _, url) { records[index] = { state, url: new URL(url, browser.location) }; changes.push('replace') },
      back() { this.go(-1) },
      go(delta) { queueMicrotask(() => { if (index + delta < 0 || index + delta >= records.length) return; index += delta; emit('popstate'); emit('hashchange') }) },
    },
    addEventListener(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn) },
    removeEventListener(event, fn) { listeners.get(event)?.delete(fn) },
  }
  const subscribers = new Set()
  const store = { getState: () => value, setState(next) { const prev = value; value = { ...value, ...next }; for (const fn of subscribers) fn(value, prev) }, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn) } }
  const close = bindAppNavigation(store, browser)
  const hash = value => { browser.history.pushState(browser.history.state, '', value); emit('hashchange') }
  const tab = tab => store.setState({ tab, stack: [] })
  const push = overlay => store.setState({ stack: [...value.stack, overlay] })
  const route = path => store.setState({ stack: value.stack.map((o, i) => i === value.stack.length - 1 ? { ...o, path } : o) })
  const pop = () => store.setState({ stack: value.stack.slice(0, -1) })
  return { browser, store, hash, tab, push, route, pop, close, records, changes, get value() { return value } }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('home → profile → browser Back/Forward renders the matching tab without leaving the app', async () => {
  const h = harness(); h.tab('profile')
  assert.equal(h.browser.location.hash, '#/profile'); assert.equal(h.records.length, 2)
  h.browser.history.back(); await tick(); assert.equal(h.value.tab, 'home'); assert.equal(h.browser.location.hash, '')
  h.browser.history.go(1); await tick(); assert.equal(h.value.tab, 'profile')
  h.tab('profile'); assert.equal(h.records.length, 2, 'repeated selection must not add history')
  h.close()
})

test('catalogue → course → lesson supports Back, Forward and app/Telegram Back', async () => {
  const h = harness({tab:'courses',stack:[]}, 'https://app.test/?demo#/courses')
  h.push({type:'learning',path:'/og-practice/foundations'})
  h.route('/courses/og-practice/foundations/block-1')
  h.browser.history.back(); await tick()
  assert.equal(h.value.stack.at(-1).path, '/og-practice/foundations')
  h.browser.history.go(1); await tick()
  assert.match(h.browser.location.hash, /block-1$/)
  backWithinApp(() => assert.fail('in-app history exists')); await tick()
  assert.equal(h.browser.location.hash, '#/courses/og-practice/foundations')
  backWithinApp(() => assert.fail('catalogue is in history')); await tick()
  assert.deepEqual(h.value.stack, []); assert.equal(h.value.tab, 'courses')
  h.close()
})

test('legacy course resolution replaces its entry so Back cannot redirect in a loop', async () => {
  const h=harness();h.push({type:'course',id:40})
  h.store.setState({stack:[{type:'learning',path:'/courses/og-practice/foundations'}]})
  assert.equal(h.records.length,2)
  h.browser.history.back();await tick();assert.equal(h.value.tab,'home');assert.deepEqual(h.value.stack,[])
  h.browser.history.go(1);await tick();assert.equal(h.value.stack[0].type,'learning');h.close()
})

test('external hashes replace an open lesson, clear transient dialogs, and normalize unknown routes', () => {
  const h = harness(); h.push({type:'learning',path:'/start/first-request'})
  h.store.setState({share:{title:'test'},reward:{test:true}})
  for (const [hash, tab] of [['#/blog','blog'],['#/profile','profile'],['#/courses','courses'],['#/unknown','home']]) {
    h.hash(hash); assert.equal(h.value.tab, tab); assert.deepEqual(h.value.stack, []); assert.equal(h.value.share,null); assert.equal(h.value.reward,null)
  }
  h.hash('#/blog/42'); assert.deepEqual(h.value.stack,[{type:'lesson',id:42,post:true}])
  h.hash('#/academy/courses/VC-101'); assert.equal(h.value.stack[0].type,'academy')
  h.hash('#/courses/start/first-request'); assert.equal(h.value.stack[0].type,'learning')
  assert.equal(h.browser.location.search,'?demo'); h.close()
})

test('closing nested overlays restores their origin and Forward restores the closed route', async () => {
  const h = harness({tab:'blog',stack:[]})
  h.push({type:'lesson',id:42,post:true}); h.push({type:'learning',path:'/og-practice/coding'}); h.route('/og-practice/coding/block-1')
  h.pop(); await tick()
  assert.deepEqual(h.value.stack,[{type:'lesson',id:42,post:true}]); assert.equal(h.browser.location.hash,'#/blog/42')
  h.pop(); await tick(); assert.deepEqual(h.value.stack,[]); assert.equal(h.browser.location.hash,'#/blog')
  h.browser.history.go(1); await tick(); assert.equal(h.value.stack[0].id,42)
  h.close()
})

test('a newer destination wins while an earlier Back is pending; repeated Back is coalesced', async () => {
  const h = harness(); h.tab('blog'); h.push({type:'lesson',id:42,post:true})
  backWithinApp(() => {}); backWithinApp(() => {}); h.tab('profile'); await tick()
  assert.equal(h.value.tab,'profile'); assert.deepEqual(h.value.stack,[]); assert.equal(h.browser.location.hash,'#/profile')
  h.close()
})

test('direct lesson entry Back normalizes its parent without a Back loop or leaving the app', () => {
  const initial = navigationFromHash('#/courses/og-practice/foundations/block-1')
  const h = harness(initial,'https://app.test/?demo#/courses/og-practice/foundations/block-1')
  backWithinApp(() => h.route('/og-practice/foundations'))
  backWithinApp(() => h.route('/og-practice'))
  backWithinApp(() => h.pop())
  assert.equal(h.records.length,1); assert.equal(h.browser.location.hash,'#/courses'); assert.deepEqual(h.value.stack,[])
  h.close()
})

test('home hash overrides pathname entry on reload and listener cleanup stops synchronization', () => {
  const h = harness({tab:'courses',stack:[]},'https://app.test/courses?demo')
  h.tab('home'); assert.equal(h.browser.location.hash,'#/'); assert.deepEqual(navigationFromHash('#/'),{tab:'home',stack:[]})
  const count=h.changes.length; h.close(); h.tab('profile'); assert.equal(h.changes.length,count)
})

test('history state contains no editor data; fresh binding restores only explicitly provided route state', () => {
  const h=harness(); h.push({type:'editor',lesson:{body:'private draft'},kind:'lesson'})
  assert.doesNotMatch(JSON.stringify(h.browser.history.state),/private|draft|body/)
  assert.equal(navigationHash(h.value),''); h.close()
  assert.deepEqual(navigationFromHash('#/blog/9007199254740993'),{tab:'home',stack:[]})
})

test('zoom is enabled, daily rituals follow Dots, and profile groups optional destinations', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8')
  assert.doesNotMatch(html,/maximum-scale|user-scalable/); assert.match(html,/viewport-fit=cover/)
  const home=await readFile(new URL('../src/screens/Home.tsx',import.meta.url),'utf8')
  assert.ok(home.indexOf('<Companion')<home.indexOf('aria-label="Бонус дня и стрик"') && home.indexOf('aria-label="Бонус дня и стрик"')<home.indexOf('<SeasonBanner') && home.indexOf('<SeasonBanner')<home.indexOf('aria-label="Последние новости"'))
  const profile=await readFile(new URL('../src/screens/Profile.tsx',import.meta.url),'utf8')
  assert.ok(profile.indexOf('Моё обучение')<profile.indexOf('Настройки'))
  assert.ok(profile.indexOf('<HoloCard')<profile.indexOf('Моё обучение'))
  assert.ok(profile.indexOf('<HoloCard')<profile.indexOf('<details'))
  assert.equal((profile.match(/<HoloCard/g) || []).length, 1)
  assert.ok(profile.indexOf('<details')<profile.indexOf('label:\'Рейтинг\''))
  assert.ok(profile.lastIndexOf('<details')<profile.indexOf('onClick={()=>push({type:\'academy\''))
})

test('Dots settings use one real navigation entry, Back/Forward, close and no personal data in history', async () => {
 const h=harness();h.push({type:'companion-settings'})
 assert.equal(h.records.length,2);assert.equal(h.browser.location.hash,'')
 assert.doesNotMatch(JSON.stringify(h.browser.history.state),/name|draft|color|accessory/)
 h.browser.history.back();await tick();assert.deepEqual(h.value.stack,[]);assert.equal(h.value.tab,'home')
 h.browser.history.go(1);await tick();assert.deepEqual(h.value.stack,[{type:'companion-settings'}])
 h.pop();await tick();assert.deepEqual(h.value.stack,[])
 h.close()
 const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8')
 assert.match(app,/case 'companion-settings': return <CompanionSettings\/>/)
 assert.match(app,/onClose=\{o.type === 'companion-settings' \? pop : undefined\}/)
})
