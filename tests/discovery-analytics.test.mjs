import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { discoveryRate, discoveryTimestamp, coursePaymentTotals } from '../src/lib/discovery-analytics.ts'

test('rates distinguish no denominator from measured zero and use the supplied mature cohort', () => {
 assert.equal(discoveryRate(0, 0), '—')
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
