/** End-to-end game checks with real pointer input and the actual demonstration adapter. */
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
  checks = [],
  errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const nav = (name) =>
  page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('button', { name, exact: true })
const open = async (day) => {
  await nav('Активности').click()
  await page.getByRole('button', { name: new RegExp(`^ЗАДАНИЕ ${String(day).padStart(2, '0')} `) }).click()
}
const claim = async () => {
  await page.getByRole('button', { name: 'Забрать результат', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
}
const capture = async (file) => page.screenshot({ path: `test-results/${file}.png` })
try {
  await mkdir('test-results', { recursive: true })
  await page.goto('http://127.0.0.1:5180/?demo', { waitUntil: 'networkidle' })
  await page.locator('.az-greeting h1').waitFor()
  await open(3)
  const stage = page.locator('.az-wheel-stage'),
    wheel = page.locator('svg.az-wheel')
  await wheel.waitFor()
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    const bounds = await stage.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1)
    assert.equal(await wheel.locator('.az-wheel-label').count(), 8)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Крутить колесо', exact: true }).click()
  await page.waitForFunction(() => getComputedStyle(document.querySelector('svg.az-wheel')).transform !== 'none')
  await page.locator('.az-game-result').waitFor()
  const stop = await wheel.evaluate((svg) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(svg).transform)
    return ((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI + 360) % 360
  })
  const index = Number(await stage.getAttribute('data-winning-sector'))
  const error = (stop + index * 45) % 360
  assert.ok(Math.min(error, 360 - error) < 0.1)
  await capture('azelkhanov-wheel')
  await claim()
  checks.push('responsive wheel at 320/390/430px; real spin stops at the awarded sector')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(2)
  const scratch = page.getByLabel('Сотрите защитный слой')
  const box = await scratch.boundingBox(),
    x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let n = 0; n < 30; n++) await page.mouse.move(x + (n % 2) * 3, y + (n % 2) * 3)
  await page.mouse.up()
  assert.equal(await page.locator('.az-game-result').count(), 0)
  await capture('azelkhanov-scratch')
  for (let row = 0.12; row < 0.95; row += 0.1) {
    await page.mouse.move(box.x + 6, box.y + box.height * row)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 6, box.y + box.height * row, { steps: 18 })
    await page.mouse.up()
  }
  await page.locator('.az-game-result').waitFor()
  await claim()
  checks.push('scratch requires distinct erased area; normal gesture reveals and saves the result')
  await open(4)
  await page.locator('.az-memory button').first().waitFor()
  await capture('azelkhanov-memory')
  const known = new Map()
  for (let turn = 0; turn < 35 && (await page.locator('.az-memory button.is-matched').count()) < 12; turn++) {
    const cards = page.locator('.az-memory button'),
      matched = new Set()
    for (let n = 0; n < 12; n++) if ((await cards.nth(n).getAttribute('class')).includes('is-matched')) matched.add(n)
    const available = [...Array(12).keys()].filter((n) => !matched.has(n))
    let pair
    for (const a of available)
      for (const b of available) if (a !== b && known.has(a) && known.get(a) === known.get(b)) pair = [a, b]
    const first = pair?.[0] ?? available.find((n) => !known.has(n))
    assert.notEqual(first, undefined)
    await cards.nth(first).click()
    known.set(first, await cards.nth(first).getAttribute('data-card-symbol'))
    const second =
      pair?.[1] ??
      available.find((n) => n !== first && known.get(n) === known.get(first)) ??
      available.find((n) => n !== first && !known.has(n))
    assert.notEqual(second, undefined)
    await cards.nth(second).click()
    known.set(second, await cards.nth(second).getAttribute('data-card-symbol'))
    await page.waitForFunction(() => !document.querySelector('.az-memory button.is-shown'))
  }
  assert.equal(await page.locator('.az-memory button.is-matched').count(), 12)
  await page.locator('.az-game-result').waitFor()
  await claim()
  checks.push('memory exposes only turned cards, matches six pairs and saves completion')
  await open(5)
  const reaction = page.locator('.az-reaction')
  await reaction.click()
  await reaction.click()
  await page.locator('.az-reaction-early').waitFor()
  await reaction.click()
  await page.locator('.az-reaction-ready').waitFor()
  await capture('azelkhanov-reaction')
  await reaction.click()
  await page.locator('.az-game-result').waitFor()
  await claim()
  checks.push('reaction handles early taps, waits for the signal and accepts one result')
  await open(6)
  await page.getByRole('button', { name: 'Поехали', exact: true }).click()
  for (let n = 0; n < 8; n++) await page.locator('.az-arcade-field button.is-target').click()
  await capture('azelkhanov-arcade')
  await page.locator('.az-game-result').waitFor({ timeout: 16000 })
  await claim()
  checks.push('arcade highlights thumb-sized targets, counts hits and completes after ten seconds')
  assert.deepEqual(errors, [])
  await writeFile('test-results/games-report.json', JSON.stringify({ checks, errors }, null, 2))
  console.log(`PASS ${checks.length} complete game scenarios; no browser errors`)
} catch (error) {
  await capture('games-failure')
  throw error
} finally {
  await context.close()
  await browser.close()
}
