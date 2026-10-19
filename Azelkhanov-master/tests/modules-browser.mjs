import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AZ_CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  }),
  page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(String(e)))
try {
  await page.goto('http://127.0.0.1:5180/tests/fixtures/thin.html', { waitUntil: 'domcontentloaded' })
  await page.locator('.az-greeting h1').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Уведомления', exact: true }).count(), 0)
  assert.equal(await page.locator('.az-level-chip').count(), 0)
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('button', { name: 'Мой круг', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Кошелёк привилегий', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Прогресс и достижения', exact: true }).count(), 0)
  await page.locator('#force-disabled').evaluate((e) => e.click())
  await page.getByRole('heading', { name: 'Раздел отключён' }).waitFor()
  assert.deepEqual(errors, [])
  await writeFile(
    'test-results/modules-report.json',
    JSON.stringify(
      {
        checks: [
          'thin preset commerce/events',
          'disabled header links hidden',
          'disabled profile links hidden',
          'direct disabled route blocked',
        ],
        errors,
      },
      null,
      2,
    ),
  )
  console.log('PASS disabled modules disappear from UI and direct routes are blocked')
} finally {
  await context.close()
  await browser.close()
}
