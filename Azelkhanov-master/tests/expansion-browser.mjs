/** Local expansion acceptance. Uses explicit demo fixtures; no production requests, raw CDP or external pages. */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
expect.configure({timeout:20000})
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
const page = await context.newPage()
page.setDefaultTimeout(20000)
const checks = []
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const url = 'http://127.0.0.1:5180/?demo'
const snapshot = () =>
  page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    return usePlatform.getState().snapshot
  })
const route = async (type, id) => {
  await page.evaluate(
    async ({ type, id }) => {
      const { usePlatform } = await import('/src/platform/store.ts')
      usePlatform.getState().push({ type, id })
    },
    { type, id },
  )
  await expect(page.locator('.az-page-heading')).toBeVisible()
}
const load = async (query = '') => {
  await page.goto(url + query)
  await expect(page.locator('.az-bottom-nav')).toBeVisible()
  await expect(page.locator('.az-splash')).toHaveCount(0)
}
await mkdir('test-results', { recursive: true })
try {
  await load()
  await page.evaluate(() => localStorage.clear())
  await load()
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const industry of ['coffee', 'fashion', 'construction', 'company', 'expert']) {
      await load('&industry=' + industry)
      await expect(page.locator('.az-industry-intro')).toBeVisible()
      assert.ok(
        await page.locator('.az-app').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        `${industry}/${width} overflow`,
      )
    }
    checks.push(`five industry pages at ${width}px`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await load('&industry=fashion')
  await page.getByLabel('Верх', { exact: true }).fill('M')
  await page.getByLabel('Низ', { exact: true }).fill('32')
  await page.getByLabel('Обувь', { exact: true }).fill('42')
  await page.getByLabel('Предпочтения по стилю').fill('Спокойный городской')
  await page.getByRole('button', { name: 'Сохранить размеры и стиль' }).click()
  await expect.poll(async () => (await snapshot()).preferences?.sizes.top).toBe('M')
  await load('&industry=fashion')
  await expect(page.getByLabel('Верх', { exact: true })).toHaveValue('M')
  checks.push('fashion preferences save and reload')
  await load('&industry=coffee')
  await page.getByLabel('Когда заберёте').fill('К 18:45')
  await page
    .getByRole('button', { name: /Заказать к приходу/ })
    .first()
    .click()
  await expect.poll(async () => (await snapshot()).orders[0]?.note).toContain('18:45')
  await load('&industry=coffee')
  assert.ok((await snapshot()).orders.some((o) => o.note.includes('18:45')))
  checks.push('coffee preorder persists pickup note')
  await route('gifts')
  await page.locator('.az-exp-grid button').first().click()
  await page.getByLabel('Ваше послание').fill('Спасибо за помощь!')
  await page.getByRole('button', { name: /Зарезервировать за баллы/ }).click()
  await expect(page.getByLabel('Ссылка подарка')).toHaveValue(/gift=/)
  const giftLink = await page.getByLabel('Ссылка подарка').inputValue()
  const token = new URL(giftLink).searchParams.get('gift')
  assert.match(token, /^[a-f0-9]{64}$/)
  assert.ok(!JSON.stringify(await snapshot()).includes(token))
  const senderState = await page.evaluate(() => localStorage.getItem('az-master:v1:azelkhanov:club'))
  await page.evaluate(() => {
    const key = 'az-master:v1:azelkhanov:club'
    const state = JSON.parse(localStorage.getItem(key))
    state.me = state.members.find((m) => m.id === 'demo-alina')
    localStorage.setItem(key, JSON.stringify(state))
  })
  await page.goto(giftLink)
  await page.getByRole('button', { name: '↓ Потянуть за ленту' }).click()
  await expect(page.getByRole('heading', { name: 'Подарок получен' })).toBeVisible()
  assert.equal((await snapshot()).gifts[0].status, 'claimed')
  await page.reload()
  await page.getByRole('button', { name: '↓ Потянуть за ленту' }).click()
  await expect(page.getByRole('heading', { name: 'Подарок получен' })).toBeVisible()
  checks.push('gift sender token absent from snapshot; recipient pull reveal is server-backed and idempotent')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.goto(giftLink)
  const ribbon=page.getByRole('button',{name:'↓ Потянуть за ленту',exact:true})
  await ribbon.scrollIntoViewIfNeeded()
  const ribbonBox=await ribbon.boundingBox()
  assert.ok(ribbonBox)
  await page.mouse.move(ribbonBox.x+ribbonBox.width/2,ribbonBox.y+ribbonBox.height/2)
  await page.mouse.down()
  await page.mouse.move(ribbonBox.x+ribbonBox.width/2,ribbonBox.y+ribbonBox.height/2+65,{steps:12})
  await page.mouse.up()
  await expect(page.getByRole('heading',{name:'Подарок получен',exact:true})).toBeVisible()
  checks.push('gift ribbon drag confirms the claim with full motion')
  await page.screenshot({path:'test-results/expansion-gift-390.png'})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.evaluate((state) => localStorage.setItem('az-master:v1:azelkhanov:club', state), senderState)
  await load()
  await route('gifts')
  await page.getByRole('button', { name: 'Отменить и вернуть баллы' }).click()
  await expect.poll(async () => (await snapshot()).gifts[0].status).toBe('cancelled')
  checks.push('sender cancellation reclaims demo reservation')
  await route('projects', 'demo-project')
  await page.getByRole('button', { name: 'Согласовать этап' }).click()
  await expect(page.getByText('Согласовано', { exact: true })).toBeVisible()
  await route('project-admin')
  await page.getByRole('button', { name: 'Редактировать проект' }).first().click()
  await page.getByLabel('Название', { exact: true }).fill('Проверенный кабинет')
  await page.getByRole('button', { name: 'Сохранить проект' }).click()
  await expect.poll(async () => (await snapshot()).projects[0].title).toBe('Проверенный кабинет')
  await load()
  assert.equal((await snapshot()).projects[0].title, 'Проверенный кабинет')
  checks.push('client approval and admin update survive reload')
  const entity = (await snapshot()).entities.find((e) => e.kind === 'article')
  await page.evaluate(async (id) => {
    const { usePlatform } = await import('/src/platform/store.ts')
    await usePlatform.getState().act('content.complete', { entityId: id })
  }, entity.id)
  await route('passport')
  await page.getByRole('button', { name: 'В коллекцию' }).first().click()
  await expect.poll(async () => (await snapshot()).passport.length).toBeGreaterThan(0)
  checks.push('verified passport claim')
  await route('recap')
  await expect(page.locator('.az-recap')).toContainText('завершённых шагов')
  await page.getByLabel('Период').selectOption('90')
  await expect(page.locator('.az-recap')).toContainText('заказов')
  await page.screenshot({ path: 'test-results/expansion-recap-390.png' })
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true)
  checks.push('dated weekly and seasonal recap with reduced motion')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors }, null, 2))
  await writeFile('test-results/expansion-browser.json', JSON.stringify({ checks, errors }, null, 2))
} catch(error) {
  await writeFile('test-results/expansion-browser.json',JSON.stringify({checks,errors,failure:String(error)},null,2))
  await page.screenshot({path:'test-results/expansion-failure.png'}).catch(()=>{})
  throw error
} finally {
  await browser.close()
}
