/** Local, isolated OG practice regression. Start Vite first; never uses a Telegram session. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const base = process.env.OG_PRACTICE_URL || 'http://127.0.0.1:5173/'
const out = path.join(root, 'test-results', 'og-practice')
const catalog = require('../content/ai-practice-2026-10-25/paths.json')

function playwright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'npm', 'node_modules', '@playwright', 'cli', 'node_modules', 'playwright')].filter(Boolean)
  for (const name of candidates) {
    try { return { ...require(name), expect: require(`${name}/test`).expect } } catch {}
  }
  throw new Error('Playwright unavailable. Set PLAYWRIGHT_MODULE to an existing Playwright package directory.')
}

function executable(chromium) {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  if (fsSync.existsSync(chromium.executablePath())) return undefined
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
  if (!fsSync.existsSync(cache)) return undefined
  for (const name of fsSync.readdirSync(cache).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
    for (const file of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const candidate = path.join(cache, name, file)
      if (fsSync.existsSync(candidate)) return candidate
    }
  }
}

const target = route => {
  const url = new URL(base)
  url.searchParams.set('demo', '')
  const publicRoute = route?.startsWith('/og-practice') ? `/courses${route}` : route
  url.hash = publicRoute ? `#${publicRoute}` : ''
  return url.href
}

;(async () => {
  await fs.mkdir(out, { recursive: true })
  const { chromium, expect: baseExpect } = playwright()
  const expect = baseExpect.configure({ timeout: 15000 })
  const browser = await chromium.launch({ headless: true, executablePath: executable(chromium) })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const requests = [], pageErrors = [], checks = [], origin = new URL(base).origin
  let stage = 'start', page
  // Demo mode serves synthetic APIs locally. Block every external request, including tracking.
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (/\/functions\/v1\//.test(url.pathname)) requests.push(url.href)
    return url.origin === origin ? route.continue() : route.abort()
  })
  try {
    page = await context.newPage()
    page.on('pageerror', error => pageErrors.push(error.message))
    page.setDefaultTimeout(15000)
    const visit = async route => {
      // Hash-only goto may reuse the document. A direct-link check must mount from that URL.
      const response = await page.goto(target(route))
      if (!response) await page.reload()
    }
    const shot = name => page.screenshot({ path: path.join(out, name), fullPage: true })
    const step = async (name, run) => { stage = name; await run(); checks.push(name); console.log(`PASS ${name}`) }
    const active = page.locator(':not([inert] *)')
    const headings = page.getByRole('heading', { level: 1 }).and(active)
    const h1 = name => page.getByRole('heading', { level: 1, name, exact: true }).and(active)
    const courseButton = course => page.getByRole('button', { name: new RegExp(course.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    const firstCourse = catalog.courses[0], first = firstCourse.lessons[0], second = firstCourse.lessons[1]
    const nav = page.getByRole('navigation', { name: 'Основные разделы' })

    await step('home-to-topic', async () => {
      await visit()
      await nav.waitFor()
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('button', { name: /Выбрать тему/ })).toBeVisible()
      await shot('01-home.png')
      await page.getByRole('button', { name: /Выбрать тему/ }).click()
      await expect(h1('Выбери задачу — сделай результат')).toBeVisible()
      for (const course of catalog.courses) await expect(courseButton(course)).toBeVisible()
      await shot('02-topics.png')
    })

    await step('category-and-lesson-search', async () => {
      const topics = page.getByRole('region', { name: 'Обучение OG Cre8r' })
      const category = name => topics.getByRole('button', { name, exact: true })
      await category('Код').click()
      await expect(courseButton(catalog.courses.find(c => c.key === 'coding'))).toBeVisible()
      await expect(courseButton(firstCourse)).toHaveCount(0)
      await category('Дизайн').click()
      await expect(courseButton(catalog.courses.find(c => c.key === 'media'))).toBeVisible()
      await expect(courseButton(catalog.courses.find(c => c.key === 'coding'))).toHaveCount(0)
      await category('С нуля').click()
      await expect(courseButton(firstCourse)).toBeVisible()
      await category('Все').click()
      const search = page.getByRole('textbox', { name: 'Найти учебную тему' })
      await search.fill('карусель')
      await expect(courseButton(catalog.courses.find(c => c.key === 'text'))).toBeVisible()
      await search.fill('несуществующая-тема-12345')
      await expect(topics.getByText(/Ничего не найдено|По этому запросу курсов нет/)).toBeVisible()
      await search.fill('')
      await courseButton(firstCourse).click()
      await expect(h1(firstCourse.title)).toBeVisible()
      await shot('03-course.png')
    })

    await step('topic-to-lesson-and-reading-sections', async () => {
      await page.getByRole('button', { name: 'Начать курс', exact: true }).click()
      await expect(h1(first.title)).toBeVisible()
      assert.ok(page.url().endsWith(`/og-practice/${firstCourse.key}/${first.key}`))
      await page.getByRole('button', { name: 'Практика', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Сделай по шагам', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Как это работает', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Самопроверка', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Проверь себя', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Инструменты и файлы', exact: true }).click()
      await expect(page.getByRole('link', { name: /Скачать учебный бриф/ })).toBeVisible()
      const explanation = page.getByRole('button', { name: 'Объяснение', exact: true })
      await explanation.focus()
      await expect(explanation).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(explanation).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByRole('heading', { name: 'Как это работает', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Весь урок', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Сделай по шагам', exact: true })).toBeVisible()
      await shot('04-lesson.png')
    })

    await step('completion-persists-and-home-resumes-next-lesson', async () => {
      await page.getByRole('button', { name: 'Отметить урок пройденным', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Урок отмечен · отменить', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await expect(h1(first.title)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Урок отмечен · отменить', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await visit()
      await nav.waitFor()
      const resume = page.getByRole('button', { name: /Продолжить обучение/ })
      await expect(resume).toContainText(second.title)
      await shot('05-home-progress.png')
      await resume.click()
      await expect(h1(second.title)).toBeVisible()
      await page.reload()
      await expect(h1(second.title)).toBeVisible()
      assert.ok(page.url().endsWith(`/og-practice/${firstCourse.key}/${second.key}`))
    })

    await step('next-and-previous-lesson-navigation', async () => {
      await page.getByRole('button', { name: '← Предыдущий', exact: true }).click()
      await expect(h1(first.title)).toBeVisible()
      await page.getByRole('button', { name: /Следующий урок/ }).click()
      await expect(h1(second.title)).toBeVisible()
    })

    await step('direct-lesson-header-back-and-base-courses', async () => {
      await visit(`/og-practice/${firstCourse.key}/${first.key}`)
      await expect(h1(first.title)).toBeVisible()
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await expect(h1(firstCourse.title)).toBeVisible()
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await expect(h1('Выбери задачу — сделай результат')).toBeVisible()
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Продолжить обучение/ })).toBeVisible()
      await visit('/courses')
      await expect(h1('Выбери задачу — сделай результат')).toBeVisible()
      await expect(page.locator('[data-og-course]:not([inert] *)')).toHaveCount(catalog.courses.length)
    })

    await step('same-document-practice-hash-navigation', async () => {
      await visit('/courses')
      await expect(h1('Выбери задачу — сделай результат')).toBeVisible()
      assert.equal(await page.goto(target('/og-practice/missing-topic')), null)
      await expect(h1('Этот урок не найден')).toBeVisible()
      await visit('/courses')
      await expect(h1('Выбери задачу — сделай результат')).toBeVisible()
      assert.equal(await page.goto(target(`/og-practice/${firstCourse.key}`)), null)
      await expect(h1(firstCourse.title)).toBeVisible()
      assert.equal(await page.goto(target(`/og-practice/${firstCourse.key}/${first.key}`)), null)
      await expect(h1(first.title)).toBeVisible()
      assert.equal(await page.goto(target(`/og-practice/${firstCourse.key}/missing-lesson`)), null)
      await expect(h1('Этот урок не найден')).toBeVisible()
    })

    await step('mobile-overflow-and-keyboard-focus', async () => {
      for (const width of [320, 390, 1024]) {
        await page.setViewportSize({ width, height: 844 })
        for (const route of ['/og-practice', `/og-practice/${firstCourse.key}`, `/og-practice/${firstCourse.key}/${first.key}`]) {
          await visit(route)
          await headings.waitFor()
          await page.waitForLoadState('networkidle')
          const overflow = await page.evaluate(() => {
            const visible = [...document.querySelectorAll('[data-og-practice], [data-tab-scroll], article, main, section')].filter(el => !el.closest('[inert]') && getComputedStyle(el).display !== 'none')
            const clipped = [...document.querySelectorAll('button, input, h1, h2')].filter(el => {
              if (el.closest('[inert]') || !el.getClientRects().length) return false
              for (let parent = el.parentElement; parent; parent = parent.parentElement) if (getComputedStyle(parent).overflowX === 'auto') return false
              const rect = el.getBoundingClientRect()
              return rect.left < -1 || rect.right > innerWidth + 1
            }).map(el => ({ name: el.tagName, text: el.textContent?.slice(0, 70) }))
            return { document: document.documentElement.scrollWidth - innerWidth, clipped, containers: visible.map(el => ({ name: el.tagName, excess: el.scrollWidth - el.clientWidth })).filter(x => x.excess > 1) }
          })
          assert.ok(overflow.document <= 1, `Document overflow at ${width}px: ${JSON.stringify(overflow)}`)
          assert.deepEqual(overflow.clipped, [], `Clipped controls at ${width}px: ${JSON.stringify(overflow)}`)
          // Horizontal course filters are intentionally scrollable; the page itself must fit.
          if (width <= 390) await shot(`mobile-${width}-${route.split('/').length}.png`)
        }
      }
      await page.keyboard.press('Tab')
      const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, disabled: document.activeElement?.getAttribute('aria-disabled'), inert: !!document.activeElement?.closest('[inert]') }))
      assert.ok(['BUTTON', 'A', 'INPUT'].includes(focus.tag), JSON.stringify(focus))
      assert.equal(focus.inert, false)
      const layer = page.locator('[data-focus-layer]:not([inert])').last()
      const lastControl = layer.getByRole('button', { name: 'Следующий урок →', exact: true })
      const firstControl = layer.getByRole('button', { name: 'Назад', exact: true })
      await lastControl.focus()
      await page.keyboard.press('Tab')
      await expect(firstControl).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(lastControl).toBeFocused()
    })

    await step('invalid-topic-and-lesson-recovery', async () => {
      for (const route of ['/og-practice/missing-topic', `/og-practice/${firstCourse.key}/missing-lesson`]) {
        await visit(route)
        await expect(h1('Этот урок не найден')).toBeVisible()
        const back = page.getByRole('button', { name: /^(Все темы|К программе|Выбрать тему)$/ }).and(active)
        await expect(back).toBeVisible()
        await back.click()
        await headings.waitFor()
      }
    })

    assert.deepEqual(pageErrors, [])
    assert.deepEqual(requests, [])
    const result = { checks, courseCount: catalog.courses.length, lessonCount: catalog.courses.reduce((n, c) => n + c.lessons.length, 0), pageErrors, apiRequests: requests, browser: await browser.version(), evidence: 'Local Vite app, synthetic demo data, isolated localStorage, every external origin blocked.' }
    await fs.writeFile(path.join(out, 'checks.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {})
    await fs.writeFile(path.join(out, 'failure.json'), `${JSON.stringify({ stage, message: error.message, url: page?.url(), pageErrors, checks }, null, 2)}\n`)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
