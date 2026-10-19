import { chromium, expect as baseExpect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const base = process.env.OG_URL || 'http://127.0.0.1:5179/'
const expect = baseExpect.configure({ timeout: 20000 })
const browser = await chromium.launch({ executablePath: process.env.AZ_CHROME_PATH || undefined })
const report = { checks: [], measurements: {} }
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
// A deterministic image response exercises successful WebP discovery without a CDN dependency.
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWl0AAAAASUVORK5CYII=', 'base64')
await context.route('https://fonts.gstatic.com/s/e/notoemoji/**', (route) => route.fulfill({ contentType: 'image/png', body: image }))
await context.route('https://telegram.org/js/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }))
await context.addInitScript(() => {
  window.__emojiPreloads = []
  const OriginalImage = window.Image
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  window.Image = new Proxy(OriginalImage, {
    construct(Target, args) {
      const image = Reflect.construct(Target, args)
      Object.defineProperty(image, 'src', {
        set(value) { if (value.endsWith('/512.webp')) window.__emojiPreloads.push(value); srcDescriptor.set.call(image, value) },
        get() { return srcDescriptor.get.call(image) },
      })
      return image
    },
  })
})

try {
  await page.goto(`${base}?demo#/academy`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.academy-cover')).not.toHaveCount(0)
  await expect(page.locator('.academy-cover img[src$="512.webp"]').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__emojiPreloads.length)).toBeGreaterThan(0)

  const initial = await page.evaluate(() => {
    const covers = [...document.querySelectorAll('.academy-cover')]
    return {
      coverCount: covers.length,
      visibleCoverCount: covers.filter((cover) => { const r = cover.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight }).length,
      animatedImageCount: document.querySelectorAll('.academy-cover img[src$="512.webp"]').length,
      preloadCount: window.__emojiPreloads.length,
      preloadUrls: [...new Set(window.__emojiPreloads)],
      lazyCount: document.querySelectorAll('.academy-cover img[loading="lazy"][decoding="async"]').length,
      offscreenAnimatedImages: [...document.querySelectorAll('.academy-cover img[src$="512.webp"]')].filter((img) => { const r = img.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight }).length,
      offscreenRunningCovers: covers.filter((cover) => { const r = cover.getBoundingClientRect(); return r.top >= innerHeight && cover.querySelector('.floaty').style.animationPlayState !== 'paused' }).length,
      dimensions: covers.slice(0, 2).map((cover) => { const image = cover.querySelector('.academy-cover-emoji'); return [image.clientWidth, image.clientHeight] }),
    }
  })
  assert.ok(initial.coverCount > initial.visibleCoverCount)
  assert.ok(initial.preloadCount < initial.coverCount, JSON.stringify(initial))
  assert.equal(initial.lazyCount, initial.coverCount)
  assert.equal(initial.offscreenAnimatedImages, 0)
  assert.equal(initial.offscreenRunningCovers, 0)
  report.measurements.initialAcademy = initial
  report.checks.push('below-fold WebP requests deferred; static images lazy/async; full-size cover geometry retained')

  const lastCover = page.locator('.academy-direction .academy-cover').last()
  await lastCover.scrollIntoViewIfNeeded()
  await expect(lastCover.locator('img')).toHaveAttribute('src', /512\.webp$/)
  await expect(lastCover.locator('.academy-cover-emoji-image')).toHaveCSS('animation-play-state', 'running')
  await expect(page.locator('.academy-cover').first().locator('.academy-cover-emoji-image')).toHaveCSS('animation-play-state', 'paused')
  assert.ok((await page.locator('.academy-cover').first().locator('img').getAttribute('src')).endsWith('emoji.svg'))
  report.checks.push('scrolling activates visible art and pauses previous offscreen art')

  // Native matchMedia change must disable both CSS movement and image animation.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.academy-cover img[src$="512.webp"]')).toHaveCount(0)
  await expect(lastCover.locator('.academy-cover-emoji-image')).toHaveCSS('animation-name', 'none')
  assert.equal(await lastCover.locator('.academy-cover-emoji-image').evaluate((element) => element.style.animationPlayState), 'paused')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(lastCover.locator('img')).toHaveAttribute('src', /512\.webp$/)
  report.checks.push('reduced-motion preference disables WebP and CSS movement, then restores visible art')

  // Exercise the actual visibilitychange subscription with a deterministic hidden document.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.academy-cover img[src$="512.webp"]')).toHaveCount(0)
  await expect(lastCover.locator('.academy-cover-emoji-image')).toHaveCSS('animation-play-state', 'paused')
  await page.evaluate(() => {
    delete document.visibilityState
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(lastCover.locator('img')).toHaveAttribute('src', /512\.webp$/)
  report.checks.push('visibilitychange hidden/visible states pause and resume visible art')

  // Scrolling through every repeated direction tests the shared asset-discovery cache.
  await page.locator('.academy-program-list > summary').click()
  for (const cover of await page.locator('.academy-cover').all()) await cover.scrollIntoViewIfNeeded()
  await expect.poll(() => page.evaluate(() => window.__emojiPreloads.length)).toBeGreaterThan(1)
  const preloads = await page.evaluate(() => window.__emojiPreloads)
  assert.equal(preloads.length, new Set(preloads).size, 'One animation discovery image per URL across repeated cards and visibility changes')
  report.measurements.afterScroll = { preloadCount: preloads.length, uniqueUrlCount: new Set(preloads).size }
  report.checks.push('repeated cards and visibility changes reuse one animation discovery per URL')

  const failedPage = await context.newPage()
  try {
    await failedPage.route('**/1f9e0/512.webp', (route) => route.fulfill({ status: 404, body: '' }))
    await failedPage.goto(`${base}?demo#/academy`, { waitUntil: 'domcontentloaded' })
    const firstImage = failedPage.locator('.academy-cover').first().locator('img')
    await expect(firstImage).toBeVisible()
    await expect.poll(() => failedPage.evaluate(() => window.__emojiPreloads.filter((url) => url.includes('/1f9e0/')).length)).toBe(1)
    await expect(firstImage).toHaveAttribute('src', /emoji\.svg$/)
    await failedPage.emulateMedia({ reducedMotion: 'reduce' })
    await failedPage.emulateMedia({ reducedMotion: 'no-preference' })
    await failedPage.locator('.academy-program-list > summary').click()
    const repeated = failedPage.locator('.academy-program-list img[alt="🧠"]').first()
    await repeated.scrollIntoViewIfNeeded()
    await expect(repeated).toHaveAttribute('src', /emoji\.svg$/)
    assert.equal(await failedPage.evaluate(() => window.__emojiPreloads.filter((url) => url.includes('/1f9e0/')).length), 1)
    report.checks.push('missing WebP stays static and is not rediscovered for repeated cards or motion changes')
    // If every SVG candidate fails, the original native cover fallback keeps its full geometry.
    await failedPage.route('**/1f9e0/emoji.svg', (route) => route.fulfill({ status: 404, body: '' }))
    await failedPage.reload({ waitUntil: 'domcontentloaded' })
    await failedPage.locator('.academy-cover').first().scrollIntoViewIfNeeded()
    const fallback = failedPage.locator('.academy-cover').first().locator('.academy-cover-emoji-fallback')
    await expect(fallback).toHaveCSS('opacity', '1')
    await expect(failedPage.locator('.academy-cover').first().locator('.academy-cover-emoji-image')).toHaveCSS('opacity', '0')
    assert.deepEqual(await failedPage.locator('.academy-cover').first().locator('.academy-cover-emoji').evaluate((element) => [element.clientWidth, element.clientHeight]), [124, 124])
    report.checks.push('image failures retain the original full-size native cover fallback')
  } finally {
    await failedPage.close()
  }
  assert.deepEqual(errors, [])
  report.checks.push('no uncaught browser errors')
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/perf-effects.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await context.close()
  await browser.close()
}
