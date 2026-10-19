/** Local UI acceptance checks. Requires npm run dev on port 5180. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AZ_CHROME_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage(),
  errors = [],
  checks = []
page.on('pageerror', (error) => errors.push(String(error)))
const check = async (name, fn) => {
  await fn()
  checks.push(name)
  console.log(`PASS ${name}`)
}
const nav = (name) =>
  page.getByRole('navigation', { name: 'Мобильная навигация' }).getByRole('button', { name, exact: true })
const closeCelebration = async () => {
  const close = page.getByRole('button', { name: 'Продолжить', exact: true })
  await close.waitFor()
  await close.click()
}
await mkdir('test-results', { recursive: true })
try {
  await page.goto('http://127.0.0.1:5180/?demo', { waitUntil: 'networkidle' })
  await check('Mobile home, brand, 3D and horizontal bounds', async () => {
    await page.locator('.az-greeting h1').waitFor()
    await page.locator('.az-hero .az-sculpture').waitFor()
    await page.screenshot({ path: 'test-results/azelkhanov-mobile.png' })
    assert.equal(await page.locator('.az-hero canvas').count(), 1)
    assert.equal(await page.locator('.az-app').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), true)
  })
  await check('Daily claim updates actual balance and survives reload', async () => {
    await page.getByRole('button', { name: 'Забрать бонус дня', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await closeCelebration()
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Бонус уже ваш', { exact: true }).waitFor()
  })
  await check('Reward exchange creates a persistent QR coupon', async () => {
    await nav('Привилегии').click()
    await page.getByRole('button', { name: /Напиток за наш счёт/ }).click()
    await page.getByRole('button', { name: 'Это моё' }).click()
    await page.getByRole('dialog').waitFor()
    await closeCelebration()
    await page.getByRole('heading', { name: 'Подарки уже ждут' }).waitFor()
    await page.locator('.az-coupon').click()
    await page.locator('.az-qr canvas').waitFor()
    assert.equal(await page.locator('.az-qr canvas').count(), 1)
    await page.reload({ waitUntil: 'networkidle' })
    await nav('Мой круг').click()
    await page.getByRole('button', { name: 'Кошелёк привилегий' }).click()
    await page.locator('.az-coupon').waitFor()
    assert.equal(await page.locator('.az-coupon').count(), 1)
  })
  await check('Community publication and comment work', async () => {
    await nav('Свои люди').click()
    await page.getByLabel('Текст публикации').fill('Проверка: маленькая идея стала настоящим действием.')
    await page.getByRole('button', { name: 'Поделиться', exact: true }).click()
    await page.getByText('Проверка: маленькая идея стала настоящим действием.', { exact: true }).waitFor()
    await page
      .locator('.az-post')
      .filter({ hasText: 'Проверка: маленькая идея' })
      .getByRole('button', { name: /Комментарии/ })
      .click()
    await page.getByLabel('Комментарий', { exact: true }).fill('И это только начало!')
    await page.getByLabel('Отправить комментарий').click()
    await page.locator('.az-comments').getByText('И это только начало!', { exact: false }).waitFor()
  })
  await check('Quiz fixes answer and awards completion', async () => {
    await nav('Главная').click()
    await page.getByRole('button', { name: /^Вопрос с изюминкой/ }).click()
    await page.getByRole('button', { name: /Небольшая привычка каждый день/ }).click()
    await page.getByText('Хорошая интуиция!', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Забрать результат' }).click()
    await closeCelebration()
  })
  await check('Event booking displays usable QR ticket', async () => {
    await nav('Главная').click()
    await page.getByRole('button', { name: /Разговоры, которые вдохновляют/ }).click()
    await page.getByRole('button', { name: 'Я с вами' }).click()
    await closeCelebration()
    await page.getByRole('heading', { name: 'Место — ваше!' }).waitFor()
    assert.equal(await page.locator('.az-ticket canvas').count(), 1)
  })
  await check('Catalog cart and order flow', async () => {
    await nav('Главная').click()
    await page.getByRole('button', { name: /^Все разделы/ }).click()
    await page.getByRole('button', { name: /Коллекция Вещи и услуги/ }).click()
    await page.getByRole('button', { name: /Everyday cup/ }).click()
    await page.getByRole('button', { name: 'Хочу себе' }).click()
    await page.getByRole('button', { name: 'Перейти к оформлению' }).click()
    await page.getByLabel('Комментарий к заказу').fill('Заберу в клубе.')
    await page.getByRole('button', { name: /Оформить · оплата/ }).click()
    await closeCelebration()
    await page.getByRole('heading', { name: 'Ваши хорошие покупки' }).waitFor()
  })
  await check('Service brief is saved with the application', async () => {
    await nav('Главная').click()
    await page.getByRole('button', { name: /^Все разделы/ }).click()
    await page.getByRole('button', { name: /Коллекция Вещи и услуги/ }).click()
    await page.getByRole('button', { name: /Творческая сессия 1:1/ }).click()
    await page.getByLabel('Ваш проект', { exact: true }).fill('Клуб впечатлений')
    await page.getByLabel('Что хотите получить', { exact: true }).fill('Обсудить первую программу сообщества')
    await page.getByLabel('Как с вами связаться', { exact: true }).fill('@demo_member')
    await page.getByRole('button', { name: 'Отправить заявку', exact: true }).click()
    await closeCelebration()
    await page.getByRole('heading', { name: 'Ваши хорошие покупки' }).waitFor()
  })
  await check('Admin editor persists article and participant can read it', async () => {
    await nav('Мой круг').click()
    await page.getByRole('button', { name: 'Управлять пространством' }).click()
    await page.getByRole('heading', { name: 'Управление', exact: true }).waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Материалы', exact: true }).click()
    await page.getByRole('button', { name: 'Создать', exact: true }).click()
    await page.getByLabel('Название', { exact: true }).fill('Новая глава из админки')
    await page.getByLabel('Короткое описание').fill('Материал создан в браузерной проверке.')
    await page
      .getByLabel('Текст материала')
      .fill('## Работает\n\nМатериал сохранён, опубликован и доступен участникам.')
    await page.getByLabel('Опубликовать', { exact: true }).check()
    await page.getByRole('button', { name: 'Сохранить изменения' }).click()
    await page.getByRole('heading', { name: 'Новая глава из админки', exact: true }).waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    await nav('Главная').click()
  })
  await check('Team and Academy showcase switch without losing independent state', async () => {
    await page.getByLabel('Демонстрационный сценарий').selectOption('team')
    await page.getByRole('heading', { name: 'Ваша команда. Общие идеи.' }).waitFor()
    await nav('Команда').click()
    await page.getByRole('button', { name: 'Творческая мастерская', exact: true }).click()
    await page.getByText('Ваш голос учтён. Спасибо!', { exact: true }).waitFor()
    await page.getByLabel('Демонстрационный сценарий').selectOption('academy')
    await page.getByRole('heading', { name: 'От идеи к навыку.' }).waitFor()
    await page.screenshot({ path: 'test-results/azelkhanov-academy.png' })
  })
  await check('Compact phone layout at 320px', async () => {
    await page.setViewportSize({ width: 320, height: 780 })
    await nav('Главная').click()
    assert.equal(await page.locator('.az-app').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), true)
    await page.screenshot({ path: 'test-results/azelkhanov-320.png' })
  })
  await check('Desktop layout and dark theme', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await nav('Мой круг').click()
    assert.equal(await page.locator('.az-app.az-dark').count(), 1)
    await page.getByRole('button', { name: 'Включить светлую тему', exact: true }).click()
    assert.equal(await page.locator('.az-app.az-dark').count(), 0)
    await page.getByRole('button', { name: 'Включить тёмную тему', exact: true }).click()
    assert.equal(await page.locator('.az-app.az-dark').count(), 1)
    await page.screenshot({ path: 'test-results/azelkhanov-desktop-dark.png' })
    await page.getByRole('button', { name: 'Включить светлую тему', exact: true }).click()
    await page.getByLabel('Демонстрационный сценарий').selectOption('club')
    await page.locator('.az-greeting h1').waitFor()
    await page.screenshot({ path: 'test-results/azelkhanov-desktop.png' })
  })
  assert.deepEqual(errors, [])
  await writeFile(
    'test-results/browser-report.json',
    JSON.stringify({ checks, errors, viewport: '390x844,1440x1000' }, null, 2),
  )
} catch (error) {
  await page.screenshot({ path: 'test-results/browser-failure.png' })
  console.error((await page.locator('body').innerText()).slice(-7000))
  console.error(errors)
  throw error
} finally {
  await context.close()
  await browser.close()
}
