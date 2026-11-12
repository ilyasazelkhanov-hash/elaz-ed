import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { discoveryRate, discoveryTimestamp, coursePaymentTotals } from '../src/lib/discovery-analytics.ts'

test('rates distinguish no denominator from measured zero and use the supplied mature cohort', () => {
 assert.equal(discoveryRate(0, 0), '-')
 assert.equal(discoveryRate(0, 3), '0%')
 assert.equal(discoveryRate(1, 3), '33%')
 assert.equal(discoveryRate(2, 4), '50%')
})

test('report timestamps always identify the same UTC moment, with an honest missing date', () => {
 assert.equal(discoveryTimestamp('2026-11-07T01:05:00+05:00'), '06.11.2026, 20:05 UTC')
 assert.equal(discoveryTimestamp('invalid'), 'дата неизвестна')
})

test('purchase summary sums current confirmed, refunded and pending states without deducting refunds twice', () => {
 const totals = coursePaymentTotals([
  {buyers:2,purchases:3,stars:300,refunded:1,refunded_stars:100,refund_pending:1},
  {buyers:2,purchases:2,stars:80,refunded:2,refunded_stars:60,refund_pending:0},
 ])
 assert.deepEqual(totals, {purchases:5,stars:380,refunded:3,refunded_stars:160,refund_pending:1})
 assert.deepEqual(coursePaymentTotals([]), {purchases:0,stars:0,refunded:0,refunded_stars:0,refund_pending:0})
})

async function presentation() {
 const file = new URL('../src/screens/Analytics.tsx', import.meta.url)
 let compiled = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, {lang:'tsx',jsx:{runtime:'automatic'}})).code
 // Avoid application initialization in this presentational SSR test. No API or store is exercised.
 compiled = compiled.replace(/import[^;\n]*from ["']\.\.\/lib\/api["'];?/g, 'const api = {}; const errorText = String;')
  .replace(/import[^;\n]*from ["']\.\.\/store["'];?/g, 'const useStore = {};')
  .replace(/import[^;\n]*from ["']\.\.\/ui["'];?/g, 'const EmojiTile = () => null; const Tap = () => null;')
  .replace(/import[^;\n]*from ["']\.\/Admin["'];?/g, 'const Header = () => null; const sheet = {};')
 for (const name of ['react','react/jsx-runtime','motion/react']) compiled = compiled.replaceAll(`from "${name}"`, `from ${JSON.stringify(import.meta.resolve(name))}`)
 for (const name of ['discovery-analytics','beginner-content']) compiled = compiled.replaceAll(`from "../lib/${name}"`, `from ${JSON.stringify(new URL(`../src/lib/${name}.ts`,import.meta.url).href)}`)
 const { DiscoveryAnalytics } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
 return report => renderToStaticMarkup(createElement(DiscoveryAnalytics,{report}))
}

test('discovery presentation never substitutes legacy stats and shows exact cohorts, independent stages and receipts', async () => {
 const render = await presentation()
 for (const missing of [undefined,{available:false}]) {
  const html = render(missing)
  assert.match(html, /Пока недоступно/)
  assert.doesNotMatch(html, /0%|0 звёзд/)
 }
 const report = {available:true,as_of:'2026-11-20T00:00:00Z',started_at:'2026-11-01T00:00:00Z',window_days:30,
  activation:{eligible:0,attempted:0,waiting:5},return14:{eligible:4,returned:2,waiting:3},repeat7:{readers:4,repeated:0},feedback:{positive:0,responses:0},
  guides:[{id:'first-request',opened:4,copied:2,tried:1}],sources:[{source:'telegram_guide',users:2}],
  courses:[{id:1,title:'Course <example>',viewed:1,previewed:3,checkout_users:6,mature_checkout_users:4,converted:1,buyers:2,purchases:3,stars:300,refunded:1,refunded_stars:100,refund_pending:1}]}
 const html = render(report)
 for(const text of ['Бесплатная польза','Самооценка','168–336','UTC','Ожидают полного окна: 5','Ожидают полного окна: 3','50%','25%','Первый запрос, который помогает','Telegram: упражнение','Course &lt;example&gt;','300','100','независимые','подтверждённые сервером']) assert.ok(html.includes(text),text)
 assert.match(html,/Нет ответов/)
 const empty = render({...report,guides:[],sources:[],courses:[]})
 assert.match(empty,/Открытий упражнений пока нет/)
 assert.match(empty,/Источники новых участников пока не зафиксированы/)
 assert.match(empty,/Курсов для отчёта пока нет/)
})

// Exercise the actual screen's hooks and handlers without initializing Telegram/store.
async function screenHarness() {
 const pending = [], states = [], effects = [], guards = []
 let cursor = 0, deps, cleanup
 const guard = error => guards.push(error)
 const harness = {
  api: {adminAnalytics: () => new Promise((resolve,reject) => pending.push({resolve,reject}))},
  useStore: {getState: () => ({guard})},
  useState: initial => {
   const slot = cursor++
   if (!(slot in states)) states[slot] = initial
   return [states[slot], value => {states[slot] = typeof value === 'function' ? value(states[slot]) : value}]
  },
  useEffect: (effect,next) => {
   if (!deps || next.some((value,i) => value !== deps[i])) {
    deps = next
    effects.push(() => {cleanup?.(); cleanup = effect()})
   }
  },
 }
 const key = `__analyticsTest${Math.random().toString(36).slice(2)}`
 globalThis[key] = harness
 const file = new URL('../src/screens/Analytics.tsx', import.meta.url)
 let compiled = (await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 compiled = `const harness = globalThis[${JSON.stringify(key)}];\n` + compiled
  .replace(/import[^;\n]*from ["']react["'];?/g,'const {useState,useEffect} = harness;')
  .replace(/import[^;\n]*from ["']motion\/react["'];?/g,'const motion = new Proxy({}, {get: (_, tag) => tag});')
  .replace(/import[^;\n]*from ["']\.\.\/lib\/api["'];?/g,'const {api} = harness; const errorText = e => e.message;')
  .replace(/import[^;\n]*from ["']\.\.\/store["'];?/g,'const {useStore} = harness;')
  .replace(/import[^;\n]*from ["']\.\.\/ui["'];?/g,'const EmojiTile = () => null; const Tap = "button";')
  .replace(/import[^;\n]*from ["']\.\/Admin["'];?/g,'const Header = () => null; const sheet = {};')
 compiled = compiled.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 for(const name of ['discovery-analytics','beginner-content']) compiled = compiled.replaceAll(`from "../lib/${name}"`,`from ${JSON.stringify(new URL(`../src/lib/${name}.ts`,import.meta.url).href)}`)
 const {AnalyticsScreen} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
 delete globalThis[key]
 return {
  pending,guards,
  render: () => {cursor=0; return AnalyticsScreen()},
  flush: () => {while(effects.length) effects.shift()()},
  unmount: () => cleanup?.(),
 }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
function button(tree,label) {
 if (!tree || typeof tree !== 'object') return null
 if (tree.type === 'button' && tree.props.children === label) return tree
 for(const child of [tree.props?.children].flat(Infinity)) {const found=button(child,label);if(found)return found}
 return null
}

test('analytics failure is persistent and accessible; retry loads genuine empty results rather than fake zero metrics',async()=>{
 const screen = await screenHarness()
 assert.match(renderToStaticMarkup(screen.render()),/role="status"/)
 screen.flush()
 assert.equal(screen.pending.length,1)
 screen.pending[0].reject(new Error('HTTP 503'))
 await tick()
 const failed = screen.render(), html = renderToStaticMarkup(failed)
 assert.match(html,/role="alert"/)
 assert.match(html,/HTTP 503/)
 assert.doesNotMatch(html,/animate-pulse|Заходили сегодня/)
 assert.equal(screen.guards.length,1)
 button(failed,'Повторить загрузку').props.onClick()
 assert.match(renderToStaticMarkup(screen.render()),/Загрузка аналитики/)
 screen.flush()
 assert.equal(screen.pending.length,2)
 screen.pending[1].resolve({totals:{dau:0,wau:0,mau:0,new7:0},series:[],retention:{d1:0,d1n:0,d7:0,d7n:0},funnel:{opened:0,subscribed:0,done1:0,done3:0,streak3:0},lessons:[],shares:[],invited:0})
 await tick()
 const success = renderToStaticMarkup(screen.render())
 assert.match(success,/Заходили сегодня/)
 assert.match(success,/Опубликуй первый урок/)
 assert.doesNotMatch(success,/role="alert"|Загрузка аналитики/)
 screen.unmount()
})

test('analytics late rejection after unmount does not trigger guard or mutate the visible state',async()=>{
 const screen = await screenHarness()
 screen.render();screen.flush();screen.unmount()
 screen.pending[0].reject(new Error('late HTTP error'))
 await tick()
 assert.equal(screen.guards.length,0)
 assert.doesNotMatch(renderToStaticMarkup(screen.render()),/late HTTP error|role="alert"/)
})
