/** Local-only regression QA for the ENG-201 / AG-301 freshness additions.
 * Start dev on 5173 and a fresh production preview on 5180 first.
 * Node 24; NODE_PATH can point to a separately installed Playwright.
 * Every non-local request is fulfilled by a synthetic API or aborted.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const auth = 'SYNTHETIC_COURSE_FRESHNESS_FIXTURE'
const cases = [
  { code: 'ENG-201-M2-L4', zip: 'mcp-authorization-lab.zip', heading: 'Практика: авторизация удалённого MCP' },
  { code: 'AG-301-M2-L2', zip: 'voice-confirmation-lab.zip', heading: 'Практика: согласие на услышанное предложение' },
  { code: 'AG-301-M3-L2', zip: 'voice-confirmation-lab.zip', heading: 'Практика: гонка реплики и позднего handoff' },
]
;(async () => {
  const { createAcademyEngine } = await import(pathToFileURL(path.join(root, 'src/lib/academy-domain.ts')).href)
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'content/ai-academy/catalog.learning.json'), 'utf8'))
  const courses = ['ENG-201', 'AG-301']
  let state = { ...structuredClone(catalog), enrollments: courses.map(course_code => ({ user_id: 55, course_code, state: 'active' })), placements: courses.map(course_code => ({ user_id: 55, course_code, state: 'approved' })), progress: [], submissions: [], attempts: [], certificates: [], audit: [] }
  const engine = createAcademyEngine(catalog, { load: () => state, save: value => state = value })
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  const errors = [], blockedExternal = [], apiActions = [], results = []
  try {
    const setup = await browser.newContext()
    await setup.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    const source = await setup.newPage()
    await source.goto('http://127.0.0.1:5173/?demo')
    const fixture = await source.evaluate(async () => await (await import('/src/lib/mock.ts')).mockApi.boot())
    fixture.me = { ...fixture.me, id: 55, is_admin: false }
    await setup.close()
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    await context.addInitScript(value => {
      window.Telegram = { WebApp: { initData: value, initDataUnsafe: { user: { id: 55, first_name: 'Student' } }, platform: 'android', isVersionAtLeast: () => false, ready() {}, expand() {}, onEvent() {}, offEvent() {}, openLink(url) { window.__opened = url } } }
    }, auth)
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (/\/functions\/v1\/api\//.test(url.pathname)) {
        const name = url.pathname.split('/').pop()
        const payload = JSON.parse(route.request().postData() || '{}')
        assert.equal(payload.auth, auth)
        const send = (json, status = 200) => route.fulfill({ json, status, headers: { 'access-control-allow-origin': '*' } })
        if (name === 'boot') return send(fixture)
        if (name !== 'academy') return send({})
        apiActions.push(payload.action)
        try { return send(await engine({ id: 55, is_admin: false }, payload.action, payload.payload)) }
        catch (error) { return send({ error: error.message }, 400) }
      }
      if (url.hostname === '127.0.0.1' && ['5173', '5180'].includes(url.port)) return route.continue()
      blockedExternal.push(url.origin)
      return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    const ready = async code => {
      await page.locator('.academy-study-nav').waitFor()
      await page.locator('.academy-reading-prose').first().waitFor()
      assert.equal(new URL(page.url()).hash, `#/courses/lessons/${code}`)
    }
    for (const item of cases) {
      const initialProgress = state.progress.length
      await page.goto(`http://127.0.0.1:5180/#/courses/lessons/${item.code}`)
      await ready(item.code)
      await page.getByRole('navigation', { name: 'Разделы урока' }).getByRole('button', { name: /Практика/ }).click()
      const heading = page.getByRole('heading', { name: item.heading, exact: true })
      await heading.waitFor()
      await heading.scrollIntoViewIfNeeded()
      const measurements = []
      for (const width of [320, 390, 1024]) {
        await page.setViewportSize({ width, height: 844 })
        const measure = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
        assert.ok(measure.document <= width && measure.body <= width, `${item.code}: overflow at ${width}: ${JSON.stringify(measure)}`)
        measurements.push(measure)
      }
      await page.setViewportSize({ width: 390, height: 844 })
      await heading.scrollIntoViewIfNeeded()
      const screenshot = `/tmp/course-freshness-${item.code}.png`
      await page.screenshot({ path: screenshot })
      const downloads = page.getByRole('region', { name: 'Файлы для практики' })
      const buttons = downloads.getByRole('button')
      let opened = false
      for (let index = 0; index < await buttons.count(); index++) {
        await page.evaluate(() => { window.__opened = null })
        await buttons.nth(index).click()
        const url = await page.evaluate(() => window.__opened)
        if (url && new URL(url, page.url()).pathname.endsWith(`/${item.zip}`)) { opened = true; break }
      }
      assert.ok(opened, `${item.code}: new practice archive button missing`)
      // Verify the local built archive exists without contacting an external download service.
      const archive = await page.request.get(`http://127.0.0.1:5180/learning/academy/${item.zip}`)
      assert.equal(archive.status(), 200)
      const bytes = await archive.body()
      assert.equal(bytes.subarray(0, 2).toString(), 'PK')
      assert.ok(bytes.length > 1000)
      assert.equal(state.progress.length, initialProgress)
      await page.reload()
      await ready(item.code)
      await page.getByRole('heading', { name: item.heading, exact: true }).waitFor()
      const journey = page.getByRole('navigation', { name: 'Предыдущий и следующий урок' })
      await journey.getByRole('button', { name: /Следующий/ }).click()
      await page.waitForURL(url => url.hash !== `#/courses/lessons/${item.code}`)
      await page.locator('.academy-study-nav').waitFor()
      await page.goBack()
      await ready(item.code)
      await page.getByRole('heading', { name: item.heading, exact: true }).waitFor()
      assert.equal(state.progress.length, initialProgress)
      results.push({ code: item.code, practice: 'passed', archive: item.zip, archiveBytes: bytes.length, reloadAndBack: 'passed', measurements, screenshot })
    }
    assert.deepEqual(errors, [])
    assert.equal(state.progress.length, 0)
    assert.equal(state.submissions.length, 0)
    assert.equal(state.attempts.length, 0)
    console.log(JSON.stringify({ results, pageErrors: errors, progress: state.progress.length, submissions: state.submissions.length, attempts: state.attempts.length, apiActions: [...new Set(apiActions)], blockedExternal: [...new Set(blockedExternal)], backend: 'synthetic local API only; no production writes' }, null, 2))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exit(1) })
