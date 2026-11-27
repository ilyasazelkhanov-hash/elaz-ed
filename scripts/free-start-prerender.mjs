// Static pages for the free start: readable without JavaScript and with a link preview.
// The app itself lives behind a hash route, which crawlers and messengers never see.
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
import {warmupTasks} from '../src/lib/warmup.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BOT = 'https://t.me/elazart_bot'
export const WARMUP_SLUG = 'warmup'
export const FREE_START_SLUGS = [...beginnerGuides.map(guide => guide.id), WARMUP_SLUG]

const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]))
const minutesWord = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'минута' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'минуты' : 'минут'}`
const totalMinutes = beginnerGuides.reduce((sum, guide) => sum + guide.minutes, 0)
const TASK_LABEL = {choice: 'Выбрать, что делать с ответом', number: 'Пересчитать цифру за ИИ', sort: 'Разложить задачи по инструментам', build: 'Собрать бриф из блоков', spot: 'Найти то, что нельзя отправлять', order: 'Расставить шаги по порядку', 'multi-select': 'Отметить всё подходящее'}

function origin(siteUrl) {
 if (!siteUrl) return ''
 const url = new URL(siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`)
 if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Site URL must be an HTTP(S) origin without credentials')
 return url.origin
}

const STYLE = `:root{color-scheme:dark light;--bg:#0b0a12;--card:#15141f;--line:rgb(255 255 255/.1);--ink:#f3f1ff;--mute:#a39fbf;--violet:#a58bff;--on:#14102b;--mint:#7bebc0}
@media (prefers-color-scheme:light){:root{--bg:#efecf8;--card:#fff;--line:rgb(26 20 51/.12);--ink:#16122b;--mute:#5d5878;--violet:#6a4df0;--on:#fff;--mint:#076c4c}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 20px 56px}a{color:var(--violet)}a:focus-visible{outline:2px solid var(--violet);outline-offset:3px;border-radius:8px}
.crumbs{font-size:13px;color:var(--mute)}.crumbs a{text-decoration:none;font-weight:600}
h1{font-size:clamp(26px,7vw,36px);line-height:1.15;margin:18px 0 12px;letter-spacing:-.01em}h2{font-size:19px;line-height:1.3;margin:36px 0 12px}
.lead{font-size:17px;color:var(--mute);margin:0}.facts{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none;font-size:13px;font-weight:600}
.facts li{border:1px solid var(--line);border-radius:999px;padding:6px 12px}
.cta{display:grid;gap:10px;margin:24px 0 0}.btn{display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border-radius:16px;font-weight:700;text-decoration:none;text-align:center}
.btn.main{background:var(--violet);color:var(--on)}.btn.alt{border:1px solid var(--line);color:var(--ink)}
.card{border:1px solid var(--line);background:var(--card);border-radius:20px;padding:16px 18px}
ol.steps,ul.plain{margin:0;padding:0;list-style:none;display:grid;gap:10px}ol.steps{counter-reset:step}
ol.steps li{counter-increment:step;display:grid;grid-template-columns:32px 1fr;gap:12px}
ol.steps li:before{content:counter(step);display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--violet);color:var(--on);font-weight:700;font-size:14px}
ol.steps b,ul.plain b{display:block;line-height:1.35}ol.steps span,ul.plain span{display:block;color:var(--mute);font-size:15px;margin-top:2px}
ul.checks{margin:0;padding-left:20px;display:grid;gap:6px}ul.checks li::marker{color:var(--mint)}
ul.plain a{display:block;text-decoration:none;color:var(--ink)}ul.plain a b{color:var(--violet)}ul.plain small{color:var(--mute);font-size:13px}
.note{margin:36px 0 0;padding-top:18px;border-top:1px solid var(--line);font-size:13px;color:var(--mute)}`

function page({pathname, title, description, image, type, body, ld}, siteOrigin) {
 const url = siteOrigin + pathname, picture = siteOrigin + image
 return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0A12">
<title>${e(title)} · OG CRE8R²</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(url)}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="OG CRE8R²">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(url)}">
<meta property="og:image" content="${e(picture)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(title)}">
<meta name="twitter:card" content="summary_large_image">
<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<main>
${body}
<p class="note">OG CRE8R²: приложение в Telegram о работе с ИИ. Тренировки не ставят оценку и не подтверждают навык: это практика для себя. Свои ответы ты хранишь на своём устройстве.</p>
</main>
</body>
</html>
`
}

const cta = (param, demoHash) => `<div class="cta"><a class="btn main" href="${BOT}?start=${e(param)}">Открыть в Telegram</a><a class="btn alt" href="/?demo#${e(demoHash)}">Попробовать в браузере</a></div>`
const guideLink = guide => `<li class="card"><a href="/start/${e(guide.id)}"><b>${e(guide.title)}</b><span>${e(guide.result)}</span><small>${minutesWord(guide.minutes)}</small></a></li>`

function indexPage() {
 const title = 'Научись работать с ИИ: пять разборов по пять минут'
 const description = 'Бесплатный старт для новичков: собираешь запрос из блоков, ищешь выдуманное в ответе, выбираешь инструмент под задачу и пробуешь на своей.'
 return {
  pathname: '/start', title, description, image: '/og/start.png', type: 'website',
  ld: {'@context': 'https://schema.org', '@type': 'Course', name: title, description, inLanguage: 'ru', isAccessibleForFree: true, provider: {'@type': 'Organization', name: 'OG CRE8R²'}, hasPart: beginnerGuides.map(guide => ({'@type': 'LearningResource', name: guide.title, timeRequired: `PT${guide.minutes}M`}))},
  body: `<p class="crumbs">OG CRE8R² · Бесплатный старт</p>
<h1>${e(title)}</h1>
<p class="lead">Без лекций. В каждом разборе ты сразу делаешь: собираешь запрос из блоков, ищешь выдуманное в ответе, раскладываешь задачи по инструментам. Потом пробуешь на своей задаче.</p>
<ul class="facts"><li>Бесплатно</li><li>Без регистрации</li><li>Около ${minutesWord(totalMinutes)} на всё</li></ul>
${cta('open_courses_start', '/courses/start')}
<h2>Не знаешь, с чего начать?</h2>
<ul class="plain"><li class="card"><a href="/start/${WARMUP_SLUG}"><b>AI-разминка: ${warmupTasks.length} заданий за две минуты</b><span>Покажет, какой разбор открыть первым. В конце результат, которым можно поделиться.</span></a></li></ul>
<h2>Пять разборов</h2>
<ul class="plain">${beginnerGuides.map(guideLink).join('')}</ul>
<h2>Что дальше</h2>
<p>Когда захочется глубже, в приложении есть курсы с пробным уроком и итоговым проектом. Сначала пройди бесплатные разборы: по ним станет понятно, нужен ли тебе курс.</p>`,
 }
}

function guidePage(guide) {
 const description = `${guide.result} ${minutesWord(guide.minutes)}, бесплатно, с заданиями и своей попыткой.`
 const others = beginnerGuides.filter(item => item.id !== guide.id)
 return {
  pathname: `/start/${guide.id}`, title: guide.title, description, image: `/og/${guide.id}.png`, type: 'article',
  ld: {'@context': 'https://schema.org', '@type': 'LearningResource', name: guide.title, description, inLanguage: 'ru', isAccessibleForFree: true, timeRequired: `PT${guide.minutes}M`, learningResourceType: 'Практический разбор', provider: {'@type': 'Organization', name: 'OG CRE8R²'}},
  body: `<p class="crumbs"><a href="/start">Бесплатный старт</a> · ${e(guide.eyebrow)}</p>
<h1>${e(guide.title)}</h1>
<p class="lead">${e(guide.intro)}</p>
<ul class="facts"><li>${minutesWord(guide.minutes)}</li><li>Бесплатно</li><li>Задания с проверкой</li></ul>
${cta(`g_${guide.id}`, `/courses/start/${guide.id}`)}
<h2>Что получишь</h2>
<p class="card">${e(guide.result)}</p>
<h2>Три шага разбора</h2>
<ol class="steps">${guide.steps.map(step => `<li><div><b>${e(step.title)}</b><span>${e(step.text)}</span></div></li>`).join('')}</ol>
<h2>Как понять, что получилось</h2>
<ul class="checks">${guide.checks.map(check => `<li>${e(check)}</li>`).join('')}</ul>
<h2>Своя попытка</h2>
<p>${e(guide.task)}</p>
${cta(`g_${guide.id}`, `/courses/start/${guide.id}`)}
<h2>Другие разборы</h2>
<ul class="plain">${others.map(guideLink).join('')}</ul>`,
 }
}

function warmupPage() {
 const title = `AI-разминка: ${warmupTasks.length} заданий за две минуты`
 const description = 'Пять коротких заданий о работе с ИИ: одно на каждую тему. В конце результат и разбор, с которого лучше начать.'
 return {
  pathname: `/start/${WARMUP_SLUG}`, title, description, image: `/og/${WARMUP_SLUG}.png`, type: 'website',
  ld: {'@context': 'https://schema.org', '@type': 'Quiz', name: title, description, inLanguage: 'ru', isAccessibleForFree: true, provider: {'@type': 'Organization', name: 'OG CRE8R²'}},
  body: `<p class="crumbs"><a href="/start">Бесплатный старт</a> · Разминка</p>
<h1>${e(title)}</h1>
<p class="lead">По одному заданию из каждого разбора. На каждое одна попытка, сразу видно верный ответ. В конце результат и совет, какой разбор открыть первым.</p>
<ul class="facts"><li>2 минуты</li><li>Бесплатно</li><li>Без регистрации</li></ul>
${cta(`g_${WARMUP_SLUG}`, `/courses/start/${WARMUP_SLUG}`)}
<h2>Что внутри</h2>
<ol class="steps">${warmupTasks.map(task => `<li><div><b>${e(TASK_LABEL[task.question.type] ?? 'Задание')}</b><span>${e(task.question.prompt)}</span></div></li>`).join('')}</ol>
<h2>После разминки</h2>
<ul class="plain">${beginnerGuides.map(guideLink).join('')}</ul>`,
 }
}

/** Map of public path to a complete HTML document. Pure: the same input gives the same pages. */
export function buildFreeStartPages({siteUrl = ''} = {}) {
 const siteOrigin = origin(siteUrl), pages = new Map()
 for (const item of [indexPage(), ...beginnerGuides.map(guidePage), warmupPage()]) pages.set(item.pathname, page(item, siteOrigin))
 return pages
}

/** The app shell keeps root-relative preview tags in the source; a build that knows its address makes them absolute. */
export function absoluteShellPreview(shell, siteUrl = '') {
 const siteOrigin = origin(siteUrl)
 if (!siteOrigin) return shell
 return shell
  .replace(/(<meta\s+property="og:(?:image|url)"\s+content=")\/(?!\/)/g, `$1${siteOrigin}/`)
  .replace(/(<link\s+rel="canonical"\s+href=")\/(?!\/)/g, `$1${siteOrigin}/`)
}

export async function prerenderFreeStart({distDir = path.join(ROOT, 'dist'), siteUrl = process.env.VITE_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || ''} = {}) {
 const pages = buildFreeStartPages({siteUrl})
 for (const [url, html] of pages) {
  const destination = path.join(distDir, ...url.split('/').filter(Boolean), 'index.html')
  await mkdir(path.dirname(destination), {recursive: true})
  await writeFile(destination, html, 'utf8')
 }
 const shellPath = path.join(distDir, 'index.html'), shell = await readFile(shellPath, 'utf8')
 const absolute = absoluteShellPreview(shell, siteUrl)
 if (absolute !== shell) await writeFile(shellPath, absolute, 'utf8')
 return pages.size
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
 console.log(`Free start: prerendered ${await prerenderFreeStart()} public pages.`)
}
