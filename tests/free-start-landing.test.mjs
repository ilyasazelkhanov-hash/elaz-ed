import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, writeFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {absoluteShellPreview, buildFreeStartPages, FREE_START_SLUGS, prerenderFreeStart, WARMUP_SLUG} from '../scripts/free-start-prerender.mjs'
import {covers} from '../scripts/og-covers.mjs'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
import {isWarmupStartParam, parseGuideStartParam} from '../src/lib/discovery-events.ts'
import {entryHashFromParam, publicEntryHash} from '../src/lib/outside-entry.ts'

const root = new URL('../', import.meta.url)
const SITE = 'https://elaz-ed.vercel.app'
const pages = buildFreeStartPages({siteUrl: SITE})
const meta = (html, key) => html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`))?.[1]

test('one public page per guide, plus the start and the warm-up', () => {
 assert.deepEqual([...pages.keys()], ['/start', ...beginnerGuides.map(guide => `/start/${guide.id}`), `/start/${WARMUP_SLUG}`])
 assert.deepEqual(FREE_START_SLUGS, [...beginnerGuides.map(guide => guide.id), WARMUP_SLUG])
})

test('every page carries a complete link preview and one canonical address', () => {
 for (const [pathname, html] of pages) {
  assert.match(html, /^<!doctype html>\n<html lang="ru">/)
  const title = html.match(/<title>([^<]+)<\/title>/)[1]
  assert.match(title, / · OG CRE8R²$/)
  const description = meta(html, 'description')
  assert.ok(description.length >= 60 && description.length <= 200, `${pathname}: description ${description.length}`)
  assert.equal(meta(html, 'og:description'), description)
  assert.equal(meta(html, 'og:title') + ' · OG CRE8R²', title)
  assert.equal(meta(html, 'og:url'), SITE + pathname)
  assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)[1], SITE + pathname)
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1)
  assert.match(meta(html, 'og:image'), new RegExp(`^${SITE}/og/[a-z-]+\\.png$`))
  assert.equal(meta(html, 'og:image:width'), '1200'); assert.equal(meta(html, 'og:image:height'), '630')
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image')
  assert.equal(meta(html, 'og:locale'), 'ru_RU')
 }
})

test('pages need no JavaScript and satisfy the site content policy', () => {
 for (const [pathname, html] of pages) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length, 1, pathname)
  assert.match(scripts[0][1], /type="application\/ld\+json"/)
  const data = JSON.parse(scripts[0][2])
  assert.equal(data['@context'], 'https://schema.org'); assert.equal(data.isAccessibleForFree, true); assert.equal(data.inLanguage, 'ru')
  assert.doesNotMatch(html, /\son[a-z]+=|javascript:|<iframe|<form|<img|https?:\/\/(?!elaz-ed\.vercel\.app|t\.me\/elazart_bot|schema\.org)/, pathname)
  assert.match(html, /<h1>[^<]+<\/h1>/); assert.equal((html.match(/<h1>/g) ?? []).length, 1)
  assert.doesNotMatch(html, /[—–]/, `${pathname}: long dash`)
 }
})

test('both entry buttons lead to a route the app accepts', () => {
 const links = html => [...html.matchAll(/<a class="btn (main|alt)" href="([^"]+)"/g)].map(match => [match[1], match[2]])
 assert.deepEqual(links(pages.get('/start')), [['main', 'https://t.me/elazart_bot?start=open_courses_start'], ['alt', '/?demo#/courses/start']])
 assert.equal(entryHashFromParam('open_courses_start'), '#/courses/start')
 for (const guide of beginnerGuides) {
  const found = links(pages.get(`/start/${guide.id}`))
  assert.deepEqual([...new Set(found.map(String))], [`main,https://t.me/elazart_bot?start=g_${guide.id}`, `alt,/?demo#/courses/start/${guide.id}`])
  assert.equal(found.length, 4, 'the buttons repeat after the content')
  assert.equal(parseGuideStartParam(`g_${guide.id}`)?.guideId, guide.id)
  assert.equal(publicEntryHash(`/courses/start/${guide.id}`), `#/courses/start/${guide.id}`)
 }
 assert.deepEqual(links(pages.get(`/start/${WARMUP_SLUG}`)), [['main', `https://t.me/elazart_bot?start=g_${WARMUP_SLUG}`], ['alt', `/?demo#/courses/start/${WARMUP_SLUG}`]])
 assert.equal(isWarmupStartParam(`g_${WARMUP_SLUG}`), true)
 assert.equal(publicEntryHash(`/courses/start/${WARMUP_SLUG}`), `#/courses/start/${WARMUP_SLUG}`)
})

test('a guide page teaches from the same content as the app and links to the other guides', () => {
 const guide = beginnerGuides[0], html = pages.get(`/start/${guide.id}`)
 assert.ok(html.includes(`<h1>${guide.title}</h1>`))
 for (const step of guide.steps) assert.ok(html.includes(`<b>${step.title}</b>`), step.title)
 assert.equal((html.match(/<ul class="checks">[\s\S]*?<\/ul>/)[0].match(/<li>/g) ?? []).length, guide.checks.length)
 for (const other of beginnerGuides.slice(1)) assert.ok(html.includes(`href="/start/${other.id}"`), other.id)
 assert.ok(!html.includes(`<li class="card"><a href="/start/${guide.id}"`), 'a page does not list itself')
 const start = pages.get('/start')
 for (const item of beginnerGuides) assert.ok(start.includes(`href="/start/${item.id}"`))
 assert.ok(start.includes(`href="/start/${WARMUP_SLUG}"`))
 assert.match(start, /Около \d+ минут на всё/)
})

test('text from content is escaped and the honesty note is on every page', () => {
 for (const [pathname, html] of pages) {
  const body = html.slice(html.indexOf('<main>'))
  assert.doesNotMatch(body.replace(/<[^>]+>/g, ''), /[<>]/, pathname)
  assert.match(html, /Тренировки не ставят оценку и не подтверждают навык/)
 }
 assert.ok(pages.get('/start/first-request').includes('«идеальный промпт»'))
})

test('without a known address the links stay root-relative instead of pointing at a guess', () => {
 const local = buildFreeStartPages().get('/start')
 assert.equal(meta(local, 'og:image'), '/og/start.png'); assert.equal(meta(local, 'og:url'), '/start')
 assert.throws(() => buildFreeStartPages({siteUrl: 'ftp://example.com'}), /HTTP\(S\) origin/)
 assert.throws(() => buildFreeStartPages({siteUrl: 'https://user:pass@example.com'}), /without credentials/)
 assert.equal(meta(buildFreeStartPages({siteUrl: 'elaz-ed.vercel.app/some/path'}).get('/start'), 'og:url'), SITE + '/start')
})

test('hosting serves each page before the app shell catches the route', () => {
 const {rewrites} = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
 const sources = rewrites.map(rule => rule.source), shell = sources.findIndex(source => source.startsWith('/((?!assets/)'))
 const index = sources.indexOf('/start'), guide = sources.findIndex(source => source.startsWith('/start/:guide('))
 assert.ok(index >= 0 && guide >= 0 && index < shell && guide < shell)
 assert.equal(rewrites[index].destination, '/start/index.html'); assert.equal(rewrites[guide].destination, '/start/:guide/index.html')
 assert.deepEqual(sources[guide].match(/\(([^)]+)\)/)[1].split('|'), FREE_START_SLUGS)
})

test('every preview image exists as a 1200x630 PNG small enough for messengers', () => {
 const expected = ['cover', 'start', ...FREE_START_SLUGS].sort()
 assert.deepEqual(covers.map(cover => cover.file).sort(), expected)
 for (const name of expected) {
  const file = readFileSync(new URL(`public/og/${name}.png`, root))
  assert.equal(file.subarray(1, 4).toString('latin1'), 'PNG', name)
  assert.equal(file.readUInt32BE(16), 1200, name); assert.equal(file.readUInt32BE(20), 630, name)
  assert.ok(file.length < 150_000, `${name}: ${file.length} bytes`)
 }
 for (const [, html] of pages) assert.ok(expected.includes(meta(html, 'og:image').match(/\/og\/([a-z-]+)\.png$/)[1]))
 for (const cover of covers) for (const text of [cover.title, cover.sub, cover.chip]) assert.doesNotMatch(text, /[—–]/)
})

test('the app shell has a preview of its own, made absolute only by a build that knows its address', async () => {
 const shell = readFileSync(new URL('index.html', root), 'utf8')
 assert.ok(meta(shell, 'description').length > 60)
 assert.equal(shell.match(/<meta property="og:image" content="([^"]+)"/)[1], '/og/cover.png')
 assert.doesNotMatch(shell, /og:url|rel="canonical"/, 'pages built from the shell must not inherit the home address')
 assert.equal(absoluteShellPreview(shell), shell)
 const absolute = absoluteShellPreview(shell, SITE)
 assert.equal(absolute.match(/<meta property="og:image" content="([^"]+)"/)[1], SITE + '/og/cover.png')
 assert.equal(absolute.replace(SITE + '/og/cover.png', '/og/cover.png'), shell, 'nothing else changes')
 assert.equal(absoluteShellPreview(absolute, SITE), absolute, 'running twice is safe')

 const dist = await mkdtemp(path.join(tmpdir(), 'free-start-'))
 await writeFile(path.join(dist, 'index.html'), shell)
 assert.equal(await prerenderFreeStart({distDir: dist, siteUrl: SITE}), 7)
 assert.equal(await readFile(path.join(dist, 'start', 'index.html'), 'utf8'), pages.get('/start'))
 assert.equal(await readFile(path.join(dist, 'start', WARMUP_SLUG, 'index.html'), 'utf8'), pages.get(`/start/${WARMUP_SLUG}`))
 assert.equal(await readFile(path.join(dist, 'index.html'), 'utf8'), absolute)
 const untouched = await mkdtemp(path.join(tmpdir(), 'free-start-'))
 await writeFile(path.join(untouched, 'index.html'), shell)
 await prerenderFreeStart({distDir: untouched, siteUrl: ''})
 assert.equal(await readFile(path.join(untouched, 'index.html'), 'utf8'), shell)
})

test('quick start links on the outside entry screen point at public free-start routes', () => {
 const source = readFileSync(new URL('src/screens/States.tsx', root), 'utf8')
 const block = source.slice(source.indexOf('const QUICK_START'), source.indexOf('export function Outside'))
 const routes = [...block.matchAll(/'\/\?demo#(\/courses\/start[^']*)'/g)].map(match => match[1])
 assert.deepEqual(routes, [`/courses/start/${WARMUP_SLUG}`, `/courses/start/${beginnerGuides[0].id}`, '/courses/start'])
 for (const route of routes) assert.equal(publicEntryHash(route), `#${route}`, route)
 assert.match(source, /Попробовать в браузере/)
 assert.match(source, /В браузере открывается демо: ответы и отметки хранятся на этом устройстве/)
})
