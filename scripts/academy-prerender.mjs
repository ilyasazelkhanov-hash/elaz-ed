import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const visible = entity => ['outline', 'published'].includes(entity.state)
const scalar = value => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
export const escapeHtml = value => scalar(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))
const e = escapeHtml
const ordered = entities => [...entities].sort((a,b) => (Number(a.position)||0)-(Number(b.position)||0) || a.code.localeCompare(b.code))
const route = entity => entity.kind === 'direction' ? `/courses/directions/${encodeURIComponent(entity.code)}` : `/courses/${encodeURIComponent(entity.code)}`
const status = entity => entity.state === 'published' ? 'Опубликована публичная программа' : 'Программа формируется'
const link = entity => `<a href="${e(route(entity))}">${e(entity.title)}</a>`
const card = entity => `<li><h2>${link(entity)}</h2><p>${e(entity.data?.outcome || entity.data?.description)}</p><p>${e(status(entity))}</p></li>`
const previewStyle = `<style>.academy-static{line-height:1.7}.academy-static nav{margin-bottom:24px}.academy-static h1{font-size:clamp(26px,5vw,42px);font-weight:700;line-height:1.25;margin:24px 0}.academy-static h2{font-size:22px;font-weight:600;margin:24px 0 12px}.academy-static h3{font-size:18px;font-weight:600;margin:20px 0 10px}.academy-static p{margin:12px 0}.academy-static a{color:var(--color-violet,#a58bff);text-decoration:underline;text-underline-offset:4px}.academy-static ul{list-style:none;padding:0}.academy-static ul>li,.academy-static section{border:1px solid var(--color-line,#666);border-radius:16px;padding:20px;margin:16px 0}.academy-static ol{list-style:decimal;padding-left:24px}.academy-static li{margin:8px 0}.academy-static dt{font-weight:600;margin-top:12px}.academy-static dd{margin:0}</style>`

function origin(siteUrl) {
  if (!siteUrl) return ''
  const url = new URL(siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`)
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Academy site URL must be an HTTP(S) origin without credentials')
  return url.origin
}
function document(shell, page, siteOrigin) {
  const title = `${page.title} · OG CRE8R²`, description = scalar(page.description).slice(0,350)
  const metadata = `<meta name="description" content="${e(description)}">\n<meta property="og:title" content="${e(title)}">\n<meta property="og:description" content="${e(description)}">\n<meta property="og:type" content="website">\n<link rel="canonical" href="${e(siteOrigin + page.path)}">`
  let html = shell.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => `<title>${e(title)}</title>`)
  html = html.replace(/<meta\b[^>]*(?:name=["']description["']|property=["']og:(?:title|description|type)["'])[^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'')
  // Public curriculum stays readable outside Telegram. The explicit app link opens the unchanged SPA shell.
  html = html.replace(/<script\b[^>]*type=["']module["'][^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi,'')
  html = html.replace(/<\/head>/i, () => `${metadata}\n${previewStyle}\n</head>`)
  const preview = `<main class="academy-static" aria-label="Публичная программа курсов" style="max-width:960px;margin:auto;padding:32px 24px;max-height:100dvh;overflow:auto"><nav><a href="/courses">Курсы</a> · <a href="/?demo#/academy">Демо Академии</a> · <a href="/#${e(page.path)}">Открыть приложение</a></nav><h1>${e(page.title)}</h1>${page.body}<p>Это публичная программа из каталога. Учебные материалы, запись, доступ и актуальный статус занятий доступны в приложении. Готовность программы не означает, что учебные материалы уже опубликованы.</p></main>`
  if (!/<div\s+id=["']root["']\s*>\s*<\/div>/i.test(html)) throw new Error('Vite shell is missing an empty root element')
  return html.replace(/<div\s+id=["']root["']\s*>\s*<\/div>/i, () => `<div id="root">${preview}</div>`)
}

export function buildAcademyPages(catalog, shell, { siteUrl = '' } = {}) {
  if (!Array.isArray(catalog?.entities)) throw new Error('Academy catalog requires entities')
  const publicEntities = catalog.entities.filter(visible)
  const seen = new Set()
  for (const entity of publicEntities) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(entity.code) || seen.has(entity.code)) throw new Error('Unsafe or duplicate Academy entity code')
    seen.add(entity.code)
  }
  const directions = ordered(publicEntities.filter(entity => entity.kind === 'direction'))
  const courses = ordered(publicEntities.filter(entity => entity.kind === 'course' && (!entity.parent_code || directions.some(direction => direction.code === entity.parent_code))))
  const pages = [{ path:'/courses',title:'Курсы',description:'Публичная программа курсов: направления, курсы и занятия. Готовность материалов указана у каждого курса.',body:`<p>Готовность материалов указана у каждого курса. Это план направлений и курсов; готовность учебных материалов подтверждается отдельно в приложении.</p><h2>Направления</h2><ul>${directions.map(card).join('')}</ul><h2>Все курсы</h2><ul>${courses.map(card).join('')}</ul>` }]
  for (const direction of directions) pages.push({ path:route(direction),title:scalar(direction.title),description:scalar(direction.data?.description),body:`<p>${e(direction.data?.description)}</p><p>${e(status(direction))}</p><ul>${courses.filter(course => course.parent_code === direction.code).map(card).join('')}</ul>` })
  for (const course of courses) {
    const modules = ordered(publicEntities.filter(entity => entity.kind === 'module' && entity.parent_code === course.code))
    const d = course.data || {}
    pages.push({ path:route(course),title:scalar(course.title),description:scalar(d.outcome || d.description),body:`<p>${e(status(course))}</p><p>${e(d.outcome || d.description)}</p><dl><dt>Уровень</dt><dd>${e(d.level)}</dd><dt>Плановая продолжительность, часов</dt><dd>${e(d.hours)}</dd><dt>Предварительная подготовка</dt><dd>${e(d.prerequisites)}</dd></dl><h2>План модулей и занятий</h2>${modules.map(module => `<section><h3>${e(module.title)}</h3><p>${e(status(module))}</p><ol>${ordered(publicEntities.filter(entity => entity.kind === 'lesson' && entity.parent_code === module.code)).map(lesson => `<li>${e(lesson.title)} — ${e(status(lesson))}</li>`).join('')}</ol></section>`).join('')}` })
  }
  const siteOrigin = origin(siteUrl)
  return new Map(pages.map(page => [page.path, document(shell,page,siteOrigin)]))
}

export async function prerenderAcademy({ distDir = path.join(ROOT,'dist'), catalogPath = path.join(ROOT,'content/ai-academy/catalog.learning.json'), siteUrl = process.env.ACADEMY_SITE_URL || process.env.VITE_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '' } = {}) {
  const [catalog,shell] = await Promise.all([readFile(catalogPath,'utf8').then(JSON.parse),readFile(path.join(distDir,'index.html'),'utf8')])
  const pages = buildAcademyPages(catalog,shell,{siteUrl})
  for (const [url,html] of pages) {
    const destination = path.join(distDir,...url.split('/').filter(Boolean),'index.html')
    await mkdir(path.dirname(destination),{recursive:true})
    await writeFile(destination,html,'utf8')
  }
  return pages.size
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(`Academy: prerendered ${await prerenderAcademy()} public curriculum pages (metadata only).`)
}
