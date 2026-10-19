/** Actual touch input with full animation enabled; local browser only. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AZ_CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'no-preference',
})
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(String(e)))
try {
  await page.goto('http://127.0.0.1:5180/?demo', { waitUntil: 'domcontentloaded' })
  await page.locator('.az-greeting h1').waitFor()
  await page.locator('.az-hero canvas').waitFor()
  await page.locator('.az-stories button').first().tap()
  await page.locator('.az-story-text h1').waitFor()
  const title = await page.locator('.az-story-text h1').innerText()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 335, y: 470 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 470 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForFunction((t) => document.querySelector('.az-story-text h1')?.textContent !== t, title)
  await page.getByLabel('Закрыть историю').tap()
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Свои люди', exact: true })
    .tap()
  await page.getByLabel('Текст публикации').focus()
  assert.equal(await page.locator('.az-app.az-keyboard').count(), 1)
  assert.equal(await page.getByRole('navigation', { name: 'Мобильная навигация' }).isVisible(), false)
  await page.getByLabel('Текст публикации').blur()
  await page.getByRole('navigation', { name: 'Мобильная навигация' }).waitFor()
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Главная', exact: true })
    .tap()
  await page.locator('.az-hero').scrollIntoViewIfNeeded()
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/azelkhanov-touch.png' })
  assert.deepEqual(errors, [])
  await writeFile(
    'test-results/touch-report.json',
    JSON.stringify(
      {
        checks: [
          'full motion and WebGL',
          'touch story opening',
          'horizontal swipe changes slide',
          'keyboard hides bottom navigation',
          'touch navigation',
        ],
        errors,
      },
      null,
      2,
    ),
  )
  console.log('PASS full motion, WebGL, touch navigation, story swipe and keyboard layout')
} finally {
  await context.close()
  await browser.close()
}
