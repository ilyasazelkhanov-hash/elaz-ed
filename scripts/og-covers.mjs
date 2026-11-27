// Draws the 1200x630 link preview images into public/og/. Run by hand after a title changes:
//   node --experimental-strip-types scripts/og-covers.mjs
// Needs the Playwright browser that the browser checks already use. The build does not run it:
// the PNG files are committed, so a deploy never depends on a headless browser.
import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
import {warmupTasks} from '../src/lib/warmup.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const font = file => pathToFileURL(path.join(ROOT, 'node_modules/@fontsource-variable', file)).href
const e = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]))
const minutesWord = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'минута' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'минуты' : 'минут'}`

export const covers = [
 {file: 'cover', chip: 'Telegram Mini App', title: 'Научись работать с ИИ на практике', sub: 'Бесплатный старт · новости · курсы с проектом', step: 0},
 {file: 'start', chip: 'Бесплатный старт', title: 'Пять разборов по пять минут', sub: 'Задания с проверкой · своя попытка · без регистрации', step: 0},
 ...beginnerGuides.map((guide, index) => ({file: guide.id, chip: `Разбор ${index + 1} из ${beginnerGuides.length}`, title: guide.title, sub: `${minutesWord(guide.minutes)} · задания с проверкой · своя попытка`, step: index + 1})),
 {file: 'warmup', chip: 'AI-разминка', title: `${warmupTasks.length} заданий за две минуты`, sub: 'Узнай, с какого разбора начать', step: -1},
]

export const coverHtml = cover => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
@font-face{font-family:Unbounded;src:url(${font('unbounded/files/unbounded-cyrillic-wght-normal.woff2')}) format('woff2');font-weight:200 900}
@font-face{font-family:Unbounded;src:url(${font('unbounded/files/unbounded-latin-wght-normal.woff2')}) format('woff2');font-weight:200 900;unicode-range:U+0000-00FF,U+2070-209F}
@font-face{font-family:Onest;src:url(${font('onest/files/onest-cyrillic-wght-normal.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:Onest;src:url(${font('onest/files/onest-latin-wght-normal.woff2')}) format('woff2');font-weight:100 900;unicode-range:U+0000-00FF}
*{box-sizing:border-box}html,body{margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0b0a12;color:#f3f1ff;font-family:Onest,sans-serif;position:relative}
.glow{position:absolute;inset:0;background:radial-gradient(720px 520px at 92% -8%,rgb(165 139 255/.34),transparent 62%),radial-gradient(560px 420px at -6% 108%,rgb(123 235 192/.16),transparent 64%)}
.frame{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{font-family:Unbounded,sans-serif;font-weight:700;font-size:30px;letter-spacing:.01em}.brand sup{font-size:.55em;color:#a58bff}
.chip{border:2px solid rgb(165 139 255/.55);color:#cfc2ff;border-radius:999px;padding:10px 22px;font-size:24px;font-weight:600}
h1{font-family:Unbounded,sans-serif;font-weight:700;font-size:${cover.title.length > 34 ? 60 : cover.title.length > 26 ? 68 : 78}px;line-height:1.1;margin:auto 0 0;max-width:1000px;letter-spacing:-.01em}
p{font-size:31px;line-height:1.35;color:#b9b4d6;margin:26px 0 0;font-weight:500}
.route{display:flex;gap:14px;margin-top:44px}.route i{display:block;height:12px;width:92px;border-radius:99px;background:rgb(255 255 255/.14)}
.route i.on{background:#a58bff}.route i.all{background:#7bebc0}
</style></head><body><div class="glow"></div><div class="frame">
<div class="top"><div class="brand">OG CRE8R<sup>2</sup></div><div class="chip">${e(cover.chip)}</div></div>
<h1>${e(cover.title)}</h1><p>${e(cover.sub)}</p>
<div class="route">${beginnerGuides.map((_, index) => `<i class="${cover.step < 0 ? 'all' : index + 1 === cover.step ? 'on' : ''}"></i>`).join('')}</div>
</div></body></html>`

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
 const out = path.join(ROOT, 'public/og')
 await mkdir(out, {recursive: true})
 const {chromium} = await import('playwright')
 const browser = await chromium.launch(), page = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1})
 for (const cover of covers) {
  await page.setContent(coverHtml(cover), {waitUntil: 'load'})
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({path: path.join(out, `${cover.file}.png`), type: 'png'})
 }
 await browser.close()
 console.log(`Link preview images: ${covers.length} files in public/og/.`)
}
