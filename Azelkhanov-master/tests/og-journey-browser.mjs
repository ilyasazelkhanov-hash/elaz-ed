import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ executablePath: process.env.AZ_CHROME_PATH || undefined })
const base = process.env.OG_URL || 'http://127.0.0.1:5181/'
let fixture
await mkdir('test-results', { recursive: true })
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true, reducedMotion: 'reduce' })
    const errors = []
    await page.route('https://telegram.org/js/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }))
    page.on('pageerror', error => errors.push(String(error)))
    await page.goto(`${base}?demo`)
    await page.getByRole('button', { name: /Мой следующий шаг/ }).click()
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Твой следующий шаг', exact: true }) })
    const step = section.getByRole('button').first()
    await step.click()
    // Visibility alone passes when the lesson is painted behind the journey.
    // A trial click checks that its controls actually receive pointer input.
    try {
      await page.getByRole('button', { name: 'Поделиться', exact: true }).click({ trial: true, timeout: 3000 })
    } catch (error) {
      await page.screenshot({ path: `test-results/og-journey-blocked-${width}.png` })
      throw error
    }
    await expect(page.getByRole('button', { name: /Скопировать для нейронки/ })).toBeVisible()
    await page.getByRole('button', { name: 'Назад', exact: true }).last().click()
    await expect(section).toBeVisible()
    await step.click({ trial: true })
    await expect(page.getByRole('button', { name: 'Поделиться', exact: true })).toHaveCount(0)
    fixture = await page.evaluate(() => {
      const { me, feed, meta } = window.__store.getState()
      return { me, card: feed.find(card => card.kind === 'lesson' && !card.course_id), ...meta }
    })
    expect(errors).toEqual([])
    await page.close()
    console.log(`PASS journey → usable lesson → journey at ${width}px`)
  }

  // Exercise the real HTTP client with a unique catalog ID, without contacting
  // the live database or requiring a signed Telegram login in a local test.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('https://telegram.org/js/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }))
  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: 'test-only-init-data', initDataUnsafe: {}, platform: 'android',
      isVersionAtLeast: () => false,
      BackButton: { show() {}, hide() {}, onClick(fn) { window.__journeyBack = fn }, offClick() {} },
    } }
  })
  const card = { ...fixture.card, id: 987654, title: 'Материал из API: основы Telegram', completed: false }
  const requests = []
  await page.route('**/*', async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/boot')) return route.fulfill({ json: { status: 'ok', me: fixture.me, feed: [card], courses: [], channel: fixture.channel, bot: fixture.bot } })
    if (path.endsWith('/lesson')) {
      const payload = request.postDataJSON()
      requests.push(payload.id)
      return route.fulfill({ json: { ...card, body: 'Содержимое выбранного материала, полученное через API.', quiz: [], video_url: null, copy_text: null } })
    }
    return route.fulfill({ json: {} })
  })
  await page.goto(base)
  await page.getByRole('button', { name: /Мой следующий шаг/ }).click()
  const apiSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Твой следующий шаг', exact: true }) })
  await apiSection.getByRole('button', { name: /Материал из API: основы Telegram/ }).click()
  await expect(page.getByRole('heading', { name: card.title, exact: true, level: 1 })).toBeVisible()
  await expect(page.getByText('Содержимое выбранного материала, полученное через API.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Поделиться', exact: true }).click({ trial: true })
  expect(requests).toEqual([card.id])
  await page.evaluate(() => window.__journeyBack())
  await expect(page.getByRole('button', { name: 'Поделиться', exact: true })).toHaveCount(0)
  await apiSection.getByRole('button', { name: /Материал из API: основы Telegram/ }).click({ trial: true })
  await page.close()
  console.log('PASS HTTP catalog ID → lesson request and body → Telegram BackButton')
} finally {
  await browser.close()
}
