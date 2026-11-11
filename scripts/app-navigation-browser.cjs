/** Local-only navigation/zoom checks. Start Vite first; all external traffic is blocked. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5173'
const out = path.resolve('test-results/app-navigation-ui')
;(async () => {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort())
  const page = await context.newPage(), errors = [], checks = []
  page.on('pageerror', error => errors.push(error.message))
  const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name) }
  const nav = () => page.getByRole('navigation', { name: 'Основные разделы' })
  const active = () => page.locator('[data-focus-layer][aria-modal="true"]').last()
  const hash = async value => { await page.evaluate(value => { location.hash = value }, value); await page.waitForFunction(value => location.hash === value, value) }
  try {
    await page.goto(origin + '/?demo', { waitUntil: 'domcontentloaded' })
    await nav().waitFor()
    await check('home-profile-browser-back-forward', async () => {
      await nav().getByRole('button', { name: 'Профиль', exact: true }).click()
      await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
      await page.goBack(); await page.getByRole('heading', { name: /OG CRE8R/ }).waitFor()
      await page.goForward(); await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
    })
    await check('catalogue-course-lesson-back-forward', async () => {
      await nav().getByRole('button', { name: 'Курсы', exact: true }).click()
      await page.getByRole('button', { name: 'Программа курса: Основы ИИ и инструменты', exact: true }).click()
      await active().getByRole('button', { name: /Бесплатный пробный урок|Начать курс|Продолжить курс/ }).first().click()
      await page.waitForFunction(() => location.hash.includes('/foundations/'))
      const lesson = new URL(page.url()).hash
      await page.goBack(); await page.waitForFunction(() => location.hash.endsWith('/foundations'))
      await active().getByRole('heading', { name: 'Программа курса', exact: true }).waitFor()
      await page.goForward(); await page.waitForFunction(value => location.hash === value, lesson)
      await active().getByRole('button', { name: 'Назад', exact: true }).click()
      await page.waitForFunction(() => location.hash.endsWith('/foundations'))
    })
    await check('hash-switch-closes-reader-and-reload-restores-route', async () => {
      await hash('#/blog'); await page.getByRole('heading', { name: 'Новости', exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelectorAll('[data-focus-layer]').length === 0)
      await hash('#/courses/start/first-request'); await active().getByRole('heading', { name: 'Первый запрос, который помогает', exact: true }).waitFor()
      await page.reload(); await active().getByRole('heading', { name: 'Первый запрос, который помогает', exact: true }).waitFor()
      await hash('#/profile'); await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
      await hash('#/unknown'); await page.getByRole('heading', { name: /OG CRE8R/ }).waitFor()
    })
    await check('profile-keyboard-disclosure-and-320-360-390-layout', async () => {
      await hash('#/profile'); await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
      const summary = page.locator('summary').filter({ hasText: 'Дополнительно' })
      await summary.focus(); await page.keyboard.press('Enter')
      await page.getByRole('button', { name: 'Демо Академии', exact: true }).waitFor()
      for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 844 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.equal(await nav().getByRole('button').evaluateAll(buttons => buttons.every(button => { const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })), true)
        await page.screenshot({ path: path.join(out, `profile-${width}.png`) })
      }
    })
    await check('viewport-permits-200-percent-pinch-zoom', async () => {
      assert.doesNotMatch(await page.locator('meta[name="viewport"]').getAttribute('content'), /maximum-scale|user-scalable/)
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
      assert.ok(await page.evaluate(() => visualViewport.scale >= 2))
      await page.screenshot({ path: path.join(out, 'profile-zoom-200.png') })
    })
    assert.deepEqual(errors, [])
  } finally {
    await fs.writeFile(path.join(out, 'checks.json'), JSON.stringify({ checks, errors }, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
