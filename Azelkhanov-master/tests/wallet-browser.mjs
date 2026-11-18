/** Local demo-only wallet regression. Does not redeem coupons or issue rewards. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ executablePath: process.env.AZ_CHROME_PATH || undefined, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 320, height: 780 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
const store = async (fn, arg) => page.evaluate(async ({ fn, arg }) => {
  const { usePlatform } = await import('/src/platform/store.ts')
  // Test-local callback, never a product execution path.
  await new Function('store', 'arg', `return (${fn})(store, arg)`)(usePlatform, arg)
}, { fn: fn.toString(), arg })
try {
  await page.goto(process.env.AZ_URL || 'http://127.0.0.1:5180/?demo', { waitUntil: 'networkidle' })
  await page.locator('.az-greeting h1').waitFor()
  await store(store => {
    const snapshot = structuredClone(store.getState().snapshot)
    const coupon = (id, status, days, userId = snapshot.me.id) => ({ id, title: `Купон ${id}`, status, userId, rewardId: 'test', code: `TEST-${id}`, expiresAt: new Date(Date.now() + days * 86400000).toISOString(), pointId: null, campaignId: null })
    snapshot.coupons = [coupon('active', 'issued', 1), coupon('redeemed', 'redeemed', 1), coupon('expired', 'expired', 1), coupon('old-issued', 'issued', -1), coupon('other', 'issued', 1, 'other')]
    snapshot.config.progression = { xpPerLevel: 250, levels: ['Участник'], stampsPerReward: 10 }
    snapshot.me.stamps = 10
    store.setState({ snapshot })
    store.getState().push({ type: 'wallet' })
  })
  await page.getByRole('heading', { name: 'Хорошее возвращается' }).waitFor()
  assert.equal(await page.locator('.az-stamps > span').count(), 10)
  assert.equal(await page.locator('.az-stamps > .is-stamped').count(), 10)
  await page.getByText('В цикле: 10 из 10. Завершено циклов: 1.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Доступные (1)', exact: true }).waitFor()
  const couponButton = page.locator('button.az-coupon')
  await couponButton.click()
  await page.locator('.az-qr canvas, .az-qr img, .az-qr svg').first().waitFor()
  await couponButton.click()
  assert.equal(await page.locator('.az-qr').count(), 0)
  await couponButton.click()
  await page.getByRole('button', { name: 'История (3)', exact: true }).click()
  assert.equal(await page.locator('.az-qr').count(), 0)
  assert.equal(await page.locator('article.az-coupon').count(), 3)
  assert.equal(await page.locator('button.az-coupon').count(), 0)
  assert.equal(await page.locator('article.az-coupon').getByText('СРОК ИСТЁК', { exact: true }).count(), 2)
  assert.equal(await page.locator('article.az-coupon').getByText('ИСПОЛЬЗОВАН', { exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Доступные (1)', exact: true }).click()
  assert.equal(await page.locator('.az-qr').count(), 0)
  await couponButton.click()
  // Expiry while QR is open must remove it and update section count without a server mutation.
  await store(store => {
    const snapshot = structuredClone(store.getState().snapshot)
    snapshot.coupons[0].expiresAt = new Date(Date.now() + 500).toISOString()
    store.setState({ snapshot })
  })
  await page.getByRole('button', { name: 'Доступные (0)', exact: true }).waitFor()
  assert.equal(await page.locator('.az-qr').count(), 0)
  await page.getByText('Нет доступных купонов', { exact: true }).waitFor()
  await store(store => store.getState().push({ type: 'profile' }))
  await page.getByRole('heading', { name: 'Профиль', exact: true }).waitFor()
  assert.equal(await page.locator('.az-profile-quick button').filter({ hasText: 'доступные купоны' }).locator('strong').innerText(), '0')
  await page.locator('.az-profile-quick button').filter({ hasText: 'доступные купоны' }).click()
  await page.getByRole('heading', { name: 'Хорошее возвращается' }).waitFor()
  await store(store => {
    const snapshot = structuredClone(store.getState().snapshot)
    snapshot.config.progression.stampsPerReward = 1000
    snapshot.me.stamps = 1000
    store.setState({ snapshot })
  })
  await page.getByText('Отметки в цикле: 1000 из 1000', { exact: true }).waitFor()
  assert.equal(await page.locator('.az-stamps > span').count(), 0)
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await store(store => store.getState().push({ type: 'profile' }))
      await page.getByRole('button', { name: 'Включить светлую тему', exact: true }).click()
      await page.locator('.az-profile-quick button').filter({ hasText: 'доступные купоны' }).click()
      await page.getByRole('heading', { name: 'Хорошее возвращается' }).waitFor()
    }
    assert.equal(await page.locator('.az-app').evaluate(el => el.classList.contains('az-dark')), theme === 'dark')
    assert.equal(await page.locator('.az-app').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
    await mkdir('test-results', { recursive: true })
    await page.screenshot({ path: `test-results/wallet-${theme}-320.png`, fullPage: true })
  }
  assert.deepEqual(errors, [])
  console.log('PASS wallet: statuses, ownership, expiry while open, repeated toggle, section reset, profile count, custom cycles, narrow themes')
} finally { await browser.close() }
