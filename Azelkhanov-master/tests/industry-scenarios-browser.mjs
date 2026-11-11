/** Local UI regressions with the explicit demo adapter. No live service or production checks. */
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true, executablePath: process.env.AZ_CHROME_PATH || undefined })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
})
await context.route('https://telegram.org/js/**', (route) =>
  route.fulfill({ body: '', contentType: 'application/javascript' }),
)
const page = await context.newPage()
const checks = [],
  errors = []
page.on('pageerror', (error) => errors.push(String(error)))
const base = process.env.AZ_TEST_URL || 'http://127.0.0.1:5180/'
const load = async (industry) => {
  await page.goto(`${base}?demo&industry=${industry}`)
  await expect(page.locator('.az-industry-intro')).toBeVisible()
  await expect(page.locator('.az-splash')).toHaveCount(0)
}
const snapshot = () =>
  page.evaluate(async () => (await import('/src/platform/store.ts')).usePlatform.getState().snapshot)
await mkdir('test-results', { recursive: true })
try {
  await load('fashion')
  await page.evaluate(() => localStorage.clear())
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    for (const industry of ['fashion', 'expert', 'company']) {
      await load(industry)
      assert.ok(
        await page.locator('.az-app').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        `${industry}/${width} overflow`,
      )
    }
  }
  checks.push('Fashion, expert and company render without overflow at 320/390/430px')
  await page.setViewportSize({ width: 390, height: 844 })
  await load('fashion')
  const fittings = page.getByRole('region', { name: 'Примерка со стилистом' })
  await expect(fittings).toContainText('Слоты примерки пока не опубликованы')
  await expect(fittings.locator('.az-entity-card')).toHaveCount(0)
  await page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    const s = usePlatform.getState().snapshot
    const existing = s.entities.find((e) => e.kind === 'slot')
    const valid = {
      ...existing,
      id: 'fitting-fixture',
      title: 'Тестовый слот примерки',
      data: {
        ...existing.data,
        industry: 'fashion',
        appointmentType: 'fitting',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }
    usePlatform.setState({
      snapshot: {
        ...s,
        entities: [
          ...s.entities,
          valid,
          {
            ...valid,
            id: 'expired-fixture',
            title: 'Прошедшая примерка',
            data: { ...valid.data, startsAt: '2020-01-01T12:00:00Z' },
          },
        ],
      },
    })
  })
  await expect(fittings.locator('.az-entity-card')).toHaveCount(1)
  await expect(fittings).toContainText('Тестовый слот примерки')
  checks.push('Fashion excludes generic/expired meetings; explicit future fitting renders')

  await load('expert')
  await expect(page.getByRole('button', { name: 'Пройти диагностику' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Открыть учебный квиз' })).toBeVisible()
  await page.getByRole('button', { name: 'Освоить инструменты', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Освоить инструменты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('status').filter({ hasText: 'Ваша цель:' })).toContainText('Выберите один инструмент')
  await load('expert')
  await expect(page.getByRole('button', { name: 'Освоить инструменты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Создавать контент', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Ваша цель:' })).toContainText('подготовьте черновик')
  await page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    const api = usePlatform.getState().api,
      original = api.dispatch.bind(api)
    api.dispatch = (action, payload) =>
      action === 'journey.choose' ? Promise.reject(Error('Тестовая ошибка сохранения цели')) : original(action, payload)
  })
  await page.getByRole('button', { name: 'Развивать услуги', exact: true }).click()
  await expect(page.getByText('Тестовая ошибка сохранения цели', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Создавать контент', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Развивать услуги', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('button', { name: 'Открыть учебный квиз' }).click()
  await expect(page.locator('.az-industry-intro')).toHaveCount(0)
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page.locator('.az-industry-intro')).toBeVisible()
  checks.push(
    'Quiz is explicitly educational; saved goals change advice, survive reload, and failed saves retain the old goal',
  )

  await load('company')
  await expect(page.getByRole('button', { name: 'Выбрать маршрут адаптации' })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Пройдено шагов:' })).toHaveText('Пройдено шагов: 0 из 3')
  await page.getByRole('button', { name: 'Начать адаптацию', exact: true }).click()
  await expect.poll(async () => (await snapshot()).journey?.entityId).toBe('company-welcome')
  await expect(page.getByRole('heading', { name: 'Первые ориентиры', exact: true })).toBeVisible()
  assert.equal((await snapshot()).progress.length, 0)
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Продолжить адаптацию', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    await usePlatform.getState().act('content.complete', { entityId: 'company-welcome' })
  })
  await load('company')
  await expect(page.getByRole('status').filter({ hasText: 'Пройдено шагов:' })).toHaveText('Пройдено шагов: 1 из 3')
  await page.getByRole('button', { name: 'Продолжить адаптацию', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Рабочий ритм', exact: true })).toBeVisible()
  checks.push(
    'Company starts one actual route, does not award progress on opening, and resumes the next incomplete step after reload',
  )

  await load('company')
  await page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    const s = usePlatform.getState().snapshot
    usePlatform.setState({ snapshot: { ...s, entities: s.entities.filter((e) => e.data.industry !== 'company') } })
  })
  await expect(page.getByText('Материалы адаптации пока не опубликованы.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^(Начать|Продолжить) адаптацию$/ })).toHaveCount(0)
  checks.push('Empty company catalog shows no nonfunctional route action')

  // Delayed save must not pull a user back after they leave the screen.
  await page.evaluate(() => localStorage.clear())
  await load('company')
  await page.evaluate(async () => {
    const { usePlatform } = await import('/src/platform/store.ts')
    const api = usePlatform.getState().api,
      original = api.dispatch.bind(api)
    api.dispatch = async (action, payload) => {
      if (action === 'journey.choose')
        await new Promise((resolve) => {
          window.finishJourneySave = resolve
        })
      return original(action, payload)
    }
  })
  await page.getByRole('button', { name: 'Начать адаптацию', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Начать адаптацию', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Назад', exact: true }).click()
  await page.evaluate(() => window.finishJourneySave())
  await expect.poll(async () => (await snapshot()).journey?.entityId).toBe('company-welcome')
  await expect(page.locator('.az-industry-intro')).toHaveCount(0)
  assert.equal(
    await page.evaluate(async () => (await import('/src/platform/store.ts')).usePlatform.getState().stack.at(-1).type),
    'home',
  )
  checks.push('Delayed company save respects Back navigation and repeated-click busy state')

  await load('company')
  await page.screenshot({ path: 'test-results/industry-company-390.png', fullPage: true })
  await load('expert')
  await page.screenshot({ path: 'test-results/industry-expert-390.png', fullPage: true })
  await load('fashion')
  await page.screenshot({ path: 'test-results/industry-fashion-390.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors }, null, 2))
  await writeFile('test-results/industry-scenarios-browser.json', JSON.stringify({ checks, errors }, null, 2))
} catch (error) {
  await writeFile(
    'test-results/industry-scenarios-browser.json',
    JSON.stringify({ checks, errors, failure: String(error) }, null, 2),
  )
  await page.screenshot({ path: 'test-results/industry-scenarios-failure.png', fullPage: true }).catch(() => {})
  throw error
} finally {
  await browser.close()
}
