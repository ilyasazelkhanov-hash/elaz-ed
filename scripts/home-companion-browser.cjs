/** Local-only companion checks. Start Vite first; every external request is blocked. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5173'
const out = path.resolve('test-results/home-companion-ui')
;(async () => {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort())
  const page = await context.newPage(), errors = [], checks = []
  page.on('pageerror', error => errors.push(error.message))
  const region = () => page.getByRole('region', { name: 'OG-спутник: идеи для тебя' })
  const active = () => page.locator('[data-focus-layer][aria-modal="true"]').last()
  const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name) }
  try {
    await page.goto(origin + '/?demo', { waitUntil: 'domcontentloaded' })
    await region().waitFor()
    await check('compact-320-360-390-and-both-themes', async () => {
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        for (const width of [320, 360, 390, 768]) {
          await page.setViewportSize({ width, height: 844 })
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
          assert.ok((await region().boundingBox()).height <= 210, 'Hero must remain compact at normal font size')
          assert.equal(await region().getByRole('button').evaluateAll(buttons => buttons.every(button => { const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })), true)
          await page.screenshot({ path: path.join(out, `${theme}-${width}.png`) })
        }
      }
      await page.setViewportSize({ width: 390, height: 844 })
    })
    await check('reduced-motion-has-no-animations-or-auto-rotation', async () => {
      assert.equal(await region().getAttribute('data-moving'), 'false')
      assert.equal(await region().getByRole('button', { name: 'Приостановить анимацию и подсказки' }).count(), 0)
      assert.equal(await region().evaluate(node => [...node.querySelectorAll('*')].every(el => getComputedStyle(el).animationName === 'none')), true)
      const text = await region().locator('h2').textContent()
      await page.clock.install(); await page.clock.fastForward(45000)
      assert.equal(await region().locator('h2').textContent(), text)
      await page.clock.resume()
    })
    await check('free-start-opens-and-browser-back-returns-home', async () => {
      await region().getByRole('button', { name: 'Попробовать ИИ', exact: true }).click()
      await active().getByRole('heading', { name: /С ИИ можно/ }).waitFor()
      await page.goBack(); await region().getByRole('button', { name: 'Попробовать ИИ', exact: true }).waitFor()
    })
    await check('article-action-opens-the-displayed-publication', async () => {
      await region().getByRole('button', { name: 'Другая идея' }).click()
      const title = await region().locator('.og-companion-message p').textContent()
      await region().getByRole('button', { name: 'Читать статью', exact: true }).click()
      await active().getByRole('heading', { name: title, exact: true }).waitFor()
      await active().getByRole('button', { name: 'Назад', exact: true }).click()
      await region().waitFor()
    })
    await check('available-advent-opens-calendar', async () => {
      await region().getByRole('button', { name: 'Другая идея' }).click()
      const action = region().getByRole('button', { name: 'Открыть адвент', exact: true })
      // The demo may have no active campaign on this date; domain tests cover all date states.
      if (await action.count()) {
        await action.click(); await page.waitForFunction(() => location.hash.includes('advent'))
        await page.goBack(); await region().waitFor()
      } else console.log('INFO No current available advent in the demo; calendar action not exercised')
    })
    await check('collapse-is-keyboard-operable-and-survives-navigation-and-reload', async () => {
      const collapse = region().getByRole('button', { name: 'Свернуть подсказку спутника' })
      await collapse.focus(); await page.keyboard.press('Enter')
      const reopen = region().getByRole('button', { name: 'Показать подсказку спутника' })
      await reopen.waitFor(); assert.ok((await region().boundingBox()).height <= 64)
      assert.equal(await region().getByRole('button').count(), 1)
      assert.equal(await reopen.evaluate(node => node === document.activeElement), true)
      await page.reload(); await reopen.waitFor()
      await page.getByRole('navigation', { name: 'Основные разделы' }).getByRole('button', { name: 'Профиль', exact: true }).click()
      await page.goBack(); await reopen.waitFor(); await reopen.click()
      await region().getByRole('button', { name: 'Свернуть подсказку спутника' }).waitFor()
    })
    await check('motion-can-pause-and-auto-copy-is-bounded-and-quiet', async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      // Fresh session, before any pointer or keyboard action in the companion.
      await page.evaluate(() => { for (const key of Object.keys(sessionStorage)) if (key.startsWith('og:companion:')) sessionStorage.removeItem(key) })
      await page.reload(); await region().waitFor(); await page.mouse.move(0, 0)
      await page.waitForFunction(() => document.querySelector('.og-companion').dataset.moving === 'true')
      await page.clock.fastForward(15000)
      await page.waitForFunction(() => Object.keys(sessionStorage).filter(k => k.startsWith('og:companion:')).some(k => JSON.parse(sessionStorage.getItem(k)).autoChanges === 1))
      assert.equal(await region().getByRole('status').textContent(), '')
      await page.clock.fastForward(15000)
      await page.waitForFunction(() => Object.keys(sessionStorage).filter(k => k.startsWith('og:companion:')).some(k => JSON.parse(sessionStorage.getItem(k)).autoChanges === 2))
      const text = await region().locator('h2').textContent(); await page.clock.fastForward(60000)
      assert.equal(await region().locator('h2').textContent(), text)
      await page.clock.resume()
      await region().getByRole('button', { name: 'Приостановить анимацию и подсказки' }).click()
      assert.equal(await region().getAttribute('data-moving'), 'false')
      await page.reload(); await region().getByRole('button', { name: 'Включить анимацию спутника' }).waitFor()
      assert.equal(await region().getAttribute('data-moving'), 'false')
    })
    assert.deepEqual(errors, [])
  } finally {
    await fs.writeFile(path.join(out, 'checks.json'), JSON.stringify({ checks, errors }, null, 2))
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
