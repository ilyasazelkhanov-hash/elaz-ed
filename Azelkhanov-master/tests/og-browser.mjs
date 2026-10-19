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
  reducedMotion: 'reduce',
})
const page = await context.newPage(),
  errors = []
page.on('pageerror', (e) => errors.push(String(e)))
try {
  await page.goto('http://127.0.0.1:5181/?demo&platform', { waitUntil: 'domcontentloaded' })
  await page.locator('.az-greeting h1').waitFor()
  await page.locator('.az-hero canvas').waitFor()
  assert.equal(await page.locator('.az-app').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), true)
  assert.ok((await page.locator('.az-header-brand').innerText()).includes('OG CRE8R'))
  await page.evaluate(async () => {
    await document.fonts.load('600 33px "Unbounded Variable"')
    await document.fonts.ready
  })
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const word = await page.locator('.az-hero-copy h2').evaluate((heading) => {
      const nodes = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT)
      while (nodes.nextNode()) {
        const node = nodes.currentNode,
          index = node.textContent.indexOf('Новый сезон.')
        if (index < 0) continue
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + 'Новый сезон.'.length)
        const rects = [...range.getClientRects()],
          hero = heading.closest('.az-hero').getBoundingClientRect()
        return {
          lines: new Set(rects.map((r) => Math.round(r.top))).size,
          within: rects.every((r) => r.left >= hero.left && r.right <= hero.right),
        }
      }
    })
    assert.deepEqual(word, { lines: 1, within: true }, `Whole headline word at ${width}px`)
  }
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/og-mobile-platform.png' })
  await page.getByLabel('К основным урокам OG').click()
  await page.waitForURL((url) => !url.searchParams.has('platform'))
  await page.getByText('OG CRE8R²', { exact: false }).first().waitFor()
  assert.equal(await page.locator('.az-app').count(), 0)
  assert.deepEqual(errors, [])
  await writeFile(
    'test-results/og-browser-report.json',
    JSON.stringify(
      {
        checks: [
          'OG branded module space',
          'mobile bounds and WebGL',
          'whole headline words at 320 and 390px',
          'return to existing OG app',
        ],
        errors,
      },
      null,
      2,
    ),
  )
  console.log('PASS OG mobile modules, brand, WebGL and return to original app')
} finally {
  await context.close()
  await browser.close()
}
