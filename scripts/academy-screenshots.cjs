/**
 * Capture actual local teaching interfaces; no external AI/API or production data.
 * Run: node scripts/academy-screenshots.cjs
 * Requires Node 24, available Playwright and /usr/bin/chromium. No browser download.
 * All servers use ephemeral loopback ports; booking data is in-memory; CLI copies are temporary.
 */
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')
const root = path.resolve(__dirname, '..')
const projects = path.join(root, 'content/ai-academy/projects')
const output = path.join(root, 'public/learning/academy/screenshots')
const servers = [], temporary = [], shots = new Set(), errors = []
const manifest = { lessons: {} }
const mapping = (file, alt, caption, codes) => {
  const src = file.startsWith('/') ? file : '/learning/academy/screenshots/' + file + '.png'
  for (const code of codes) (manifest.lessons[code] ??= []).push({ src, alt, caption })
}
async function start(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}
async function staticServer(folder) {
  return start(http.createServer(async (req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1) || 'index.html'
    const file = path.resolve(folder, relative)
    if (!file.startsWith(folder + path.sep)) { res.writeHead(403); res.end(); return }
    try {
      const type = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.vtt': 'text/vtt' }[path.extname(file)] || 'application/octet-stream'
      const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': type }); res.end(body)
    } catch { res.writeHead(404); res.end() }
  }))
}
async function localModule(folder, name) { return import(pathToFileURL(path.join(projects, folder, name)).href) }
async function loaded(page) {
  await page.waitForFunction(() => [...document.images].filter(i => i.loading !== 'lazy').every(i => i.complete && i.naturalWidth > 0))
  await page.evaluate(() => document.fonts.ready)
}
async function shot(page, name, target) {
  await loaded(page)
  if (target) await target.evaluate(el => el.scrollIntoView({ block: 'start', inline: 'nearest' }))
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false, animations: 'disabled' })
  shots.add(name)
}
async function reportPage(folder, title, explanation, data) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  await fs.writeFile(path.join(folder, 'index.html'), `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:17px/1.6 system-ui;color:#18352e;background:#eff5f2;margin:0;padding:28px}main{max-width:900px;margin:auto;background:white;border:1px solid #c5d8cf;border-radius:18px;padding:28px}h1{font-size:30px;line-height:1.2}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef5f1;padding:20px;border-radius:12px;font:15px/1.6 ui-monospace,monospace}p{color:#38564b}</style><main><p>AI Academy · фактический локальный вывод</p><h1>${escape(title)}</h1><p>${escape(explanation)}</p><pre>${escape(JSON.stringify(data, null, 2))}</pre></main></html>`)
  return staticServer(folder)
}
async function main() {
  await fs.mkdir(output, { recursive: true })
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'ru-RU' })
    page.on('pageerror', error => errors.push(error.message))
    // Real in-memory booking server: browser actions create one synthetic account and booking.
    const { createBookingServer } = await localModule('VC-201', 'server.mjs')
    const booking = await start(createBookingServer())
    await page.goto(booking); await shot(page, 'booking-login')
    await page.getByLabel('Email', { exact: true }).fill('visual-learner@example.test')
    await page.getByLabel('Учебный пароль', { exact: true }).fill('local-visual-fixture-only')
    await page.getByRole('button', { name: 'Создать учебный аккаунт' }).click()
    await page.getByText('Вход выполнен.', { exact: true }).waitFor()
    await page.getByLabel('Дата и время', { exact: true }).fill('2030-01-06T10:00')
    await page.getByRole('button', { name: 'Записаться', exact: true }).click()
    await page.getByText('Запись сохранена в учебной базе. Уведомление не отправлялось.', { exact: true }).waitFor()
    await shot(page, 'booking-created')
    // Browser simulator with visible row and explicit failure state.
    const workflow = await staticServer(path.join(projects, 'AU-101'))
    await page.goto(workflow)
    await page.getByRole('button', { name: 'Запустить процесс', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'Сохранено.' }).waitFor()
    await shot(page, 'workflow-success', page.locator('#status'))
    await page.getByLabel('ID заявки', { exact: true }).fill('REQ-002')
    await page.getByLabel(/Учебный сбой/).selectOption('notification')
    await page.getByRole('button', { name: 'Запустить процесс', exact: true }).click()
    await page.getByRole('status').filter({ hasText: 'требует внимания' }).waitFor()
    await shot(page, 'workflow-notification-failure', page.locator('#status'))
    const { createLabServer } = await localModule('automation-lab', 'server.mjs')
    const automation = await start(createLabServer())
    await page.goto(automation)
    for (const [scenario, name] of [['429', 'integration-retry'], ['queue', 'integration-queue']]) {
      await page.getByLabel('Сценарий', { exact: true }).selectOption(scenario)
      await page.getByRole('button', { name: 'Выполнить', exact: true }).click()
      await page.waitForFunction(s => { try { return JSON.parse(document.getElementById('result').textContent).scenario === s } catch { return false } }, scenario)
      await shot(page, name, page.locator('#result'))
    }
    const { createAssistantServer } = await localModule('assistant-lab', 'server.mjs')
    const assistant = await start(createAssistantServer())
    await page.goto(assistant)
    await page.getByRole('button', { name: 'Найти ответ', exact: true }).click()
    await page.waitForFunction(() => document.getElementById('answer').textContent.includes('1500'))
    await shot(page, 'assistant-answer')
    await page.getByLabel('Вопрос', { exact: true }).fill('Какая погода завтра?')
    await page.getByRole('button', { name: 'Найти ответ', exact: true }).click()
    await page.getByText('Нужна проверка человеком. Модель не вызывалась.', { exact: true }).waitFor()
    await shot(page, 'assistant-human-review')
    await page.getByLabel('JSON: answer, citations [{id, quote}], needsHuman', { exact: true }).fill('{"answer":"Неподтверждённый срок","citations":[{"id":"MISSING","quote":"Выдуманная цитата"}],"needsHuman":false}')
    await page.getByRole('button', { name: 'Проверить структуру', exact: true }).click()
    await page.waitForFunction(() => document.getElementById('validation').textContent.length > 0)
    await shot(page, 'assistant-rejected-citation', page.locator('#validation'))
    // Actual harness execution and repeat; never mutates the starter or invokes a model.
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'academy-visuals-')); temporary.push(tmp)
    const copy = path.join(tmp, 'harness-copy'); await fs.cp(path.join(projects, 'engineering-lab/starter'), copy, { recursive: true })
    const { runPlan } = await localModule('engineering-lab', 'harness.mjs')
    const plan = JSON.parse(await fs.readFile(path.join(projects, 'engineering-lab/plan.json'), 'utf8'))
    const first = await runPlan(copy, plan), repeated = await runPlan(copy, plan)
    assert.equal(first.status, 'done'); assert.deepEqual(repeated.audit, first.audit)
    const harnessReport = { status: first.status, completedSteps: first.index, passedChecks: first.audit.find(entry => entry.action === 'test').result.passed, repeatedAuditEntries: repeated.audit.length, audit: first.audit.map(({ step, role, action, status, result }) => ({ step, role, action, status, ...(action === 'test' ? { result } : {}) })) }
    const reportFolder = path.join(tmp, 'harness-report'); await fs.mkdir(reportFolder)
    await page.goto(await reportPage(reportFolder, 'Три шага и повтор без новой работы', 'Браузерный просмотр фактического JSON-вывода runPlan на временной учебной копии. Это не интерфейс AI-провайдера; модель не вызывалась.', harnessReport))
    await shot(page, 'engineering-harness-audit')
    // Actual assistant checkpoint receipt, viewed as a read-only local report.
    const checkpoint = path.join(tmp, 'checkpoint.sqlite'), cli = path.join(projects, 'assistant-lab/checkpoint.mjs')
    execFileSync(process.execPath, [cli, 'prepare', checkpoint], { stdio: ['ignore', 'pipe', 'pipe'] })
    const execute = () => JSON.parse(execFileSync(process.execPath, [cli, 'execute', checkpoint], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
    const executed = execute(), replay = execute(); assert.equal(executed.localTickets, 1); assert.equal(replay.localTickets, 1)
    const checkpointFolder = path.join(tmp, 'checkpoint-report'); await fs.mkdir(checkpointFolder)
    await page.goto(await reportPage(checkpointFolder, 'Checkpoint: повтор сохраняет одну локальную задачу', 'Фактический вывод учебного checkpoint.mjs после первого и повторного выполнения. Запись остаётся в локальной SQLite; внешние сообщения не отправляются.', { firstExecution: executed, repeatExecution: replay }))
    await shot(page, 'assistant-checkpoint')
    const creative = await staticServer(path.join(projects, 'creative-lab'))
    await page.goto(creative); await page.locator('#gallery figure').nth(4).waitFor()
    await shot(page, 'creative-series', page.locator('#gallery'))
    const video = page.locator('video').first(); await video.scrollIntoViewIfNeeded()
    await video.evaluate(async el => { if (el.readyState < 2) await new Promise(resolve => el.addEventListener('loadeddata', resolve, { once: true })) })
    await shot(page, 'creative-video', video)
    const data = await staticServer(path.join(projects, 'data-lab'))
    await page.goto(data); await page.locator('#kpis').filter({ hasText: '13500' }).waitFor(); await shot(page, 'data-overview')
    await page.getByLabel('Канал для KPI и таблицы').selectOption('phone'); assert.equal(await page.locator('#rows tr').count(), 3); await shot(page, 'data-filter')
    const marketing = await staticServer(path.join(projects, 'marketing-lab'))
    await page.goto(marketing); await page.locator('#kpis').filter({ hasText: '52000' }).waitFor(); await shot(page, 'marketing-overview')
    await page.getByLabel('Расходы, ₸', { exact: true }).fill('60000'); await shot(page, 'marketing-budget', page.locator('#forecast'))
    const business = await staticServer(path.join(projects, 'business-lab'))
    await page.goto(business); await page.locator('#selection').filter({ hasText: 'DATA + FAQ' }).waitFor(); await shot(page, 'business-quality')
    await page.getByLabel('Доступные часы команды').fill('50'); await page.locator('#selection').filter({ hasText: 'DATA + MEET' }).waitFor(); await shot(page, 'business-portfolio', page.locator('#portfolio'))
    await page.getByLabel('Учебный инструмент').selectOption('external_demo'); await page.getByLabel('Класс данных').selectOption('internal'); await page.locator('#policy-result').filter({ hasText: 'отклоняет' }).waitFor(); await shot(page, 'business-policy', page.locator('#policy'))
    assert.deepEqual(errors, [])
    // Each mapping is a related example, not a claim the synthetic exercise was done by a student.
    mapping('assistant-answer', 'Локальный помощник показывает ответ о диагностике и ссылку на учебный источник.', 'Скриншот локальной лаборатории «Маяк»: синтетические документы, без вызова модели. Сверь факт в ответе с цитатой и идентификатором источника.', ['CORE-000-M2-L1','CORE-000-M4-L2','AG-101-M1-L2','AG-101-M3-L2','AG-201-M2-L1','AG-201-M2-L4'])
    mapping('business-policy', 'Учебное правило отклоняет внутренние данные для внешнего инструмента.', 'Скриншот локальной синтетической панели: внешний пример + internal отклонены декларацией. Это пример проверки, а не действующая серверная авторизация.', ['CORE-000-M2-L2','CORE-000-M4-L1','BI-301-M2-L1','BI-301-M2-L3'])
    mapping('/learning/academy/design/start-390.png', 'Первый экран учебной заявки объясняет порядок из пяти шагов.', 'Скриншот локального прототипа вымышленной мастерской. Сначала видны цель и порядок, затем начинается ввод.', ['VC-101-M2-L1','VC-101-M2-L3','DS-101-M2-L1','DS-101-M2-L3'])
    mapping('/learning/academy/design/error-390.png', 'В учебной форме ошибки находятся рядом с полями описания и email.', 'Реальное состояние ошибки локального учебного прототипа, вымышленные данные. Проверь, понятно ли, какое поле исправить и почему.', ['VC-101-M2-L4','VC-101-M3-L4','DS-101-M3-L3','DS-101-M3-L4','DS-201-M2-L1','DS-201-M2-L4'])
    mapping('/learning/academy/design/review-390.png', 'Экран проверки показывает услугу, описание и контакт до подтверждения.', 'Скриншот локального прототипа: данные синтетические, заявка не отправлена. Сверь введённое с итогом до подтверждения.', ['DS-101-M2-L3','DS-201-M3-L3','DS-201-M3-L4','DS-301-M2-L2','DS-301-M3-L1'])
    mapping('/learning/academy/design/review-1024.png', 'Тот же экран проверки заявки на широком экране.', 'Скриншот того же локального учебного состояния при ширине 1024 px. Сравни структуру с мобильным примером; это не исследование настоящих пользователей.', ['DS-201-M3-L3','DS-301-M3-L2','DS-301-M3-L3'])
    mapping('booking-login', 'Учебная форма входа с email и паролем до открытия рабочего раздела.', 'Скриншот действующего локального сервера VC-201. Аккаунт создаётся только в памяти процесса, данные вымышлены.', ['VC-201-M3-L1','VC-201-M3-L4'])
    mapping('booking-created', 'Учебная запись на 6 января 2030 сохранена и показана в списке пользователя.', 'Скриншот локального MVP после реального запроса к учебному серверу. Обрати внимание: запись сохранена, уведомление не отправлялось.', ['VC-101-M3-L3','VC-201-M3-L3','VC-201-M4-L4','VC-301-M1-L1'])
    mapping('engineering-harness-audit', 'Фактический аудит трёх локальных шагов: чтение, известная правка, семь проверок.', 'Браузерный просмотр фактического JSON-вывода учебного harness: роли разделены, семь тестов прошли. Это не экран coding-модели; она не вызывалась.', ['ENG-101-M2-L1','ENG-101-M4-L1','ENG-201-M1-L4','ENG-201-M4-L4','ENG-301-M1-L3','ENG-301-M2-L2','VC-301-M3-L3','VC-301-M4-L4'])
    mapping('workflow-success', 'Процесс заявки показывает сохранённую строку и подготовленный черновик.', 'Скриншот локального AU-101 симулятора. Проследи заявку до строки и черновика; AI и внешние сервисы не вызывались.', ['AU-101-M1-L2','AU-101-M2-L3'])
    mapping('workflow-notification-failure', 'Строка сохранена, но учебный сбой уведомления требует внимания.', 'Скриншот локальной симуляции сбоя: запись в таблице и доставка — разные результаты. Настоящие уведомления не отправляются.', ['AU-101-M2-L4','AU-101-M4-L2','AU-101-M4-L4'])
    mapping('integration-retry', 'Учебный HTTP 429 показывает ограниченные повторы и логические задержки.', 'Скриншот локального сервера automation-lab: Retry-After и журнал попыток. Внешний API не вызывается, ожидание учебное и ускоренное.', ['AU-201-M1-L4','AU-201-M4-L1','AU-301-M2-L2','AU-301-M2-L3'])
    mapping('integration-queue', 'Очередь показывает выполненное учебное задание и подтверждённый результат.', 'Скриншот локальной очереди с синтетическим заданием: ищи владельца аренды, повтор и итоговую метрику done.', ['AU-201-M4-L3','AU-301-M1-L2','AU-301-M2-L1'])
    mapping('assistant-human-review', 'Помощник не находит подтверждения погоды и отправляет вопрос на проверку человеком.', 'Скриншот локального поиска по синтетическому справочнику. Отсутствие источника остаётся отсутствием ответа; модель не вызывалась.', ['AG-101-M1-L4','AG-101-M3-L4','AG-201-M3-L4'])
    mapping('assistant-rejected-citation', 'Проверка отклоняет JSON с отсутствующим источником и выдуманной цитатой.', 'Скриншот локальной проверки собственного JSON: структура и ссылка проверяются отдельно от смысла. Ошибочный пример введён намеренно.', ['AG-101-M2-L2','AG-201-M2-L4','AG-301-M3-L1','AG-301-M3-L3'])
    mapping('assistant-checkpoint', 'Первый и повторный запуск checkpoint оставляют одну локальную задачу.', 'Браузерный просмотр реального вывода checkpoint.mjs из временной SQLite. Повтор проверен, внешние действия и сообщения отсутствуют.', ['AG-301-M2-L1','AG-301-M2-L3','AG-301-M2-L4'])
    mapping('creative-series', 'Галерея пяти согласованных авторских визуалов учебной мастерской.', 'Скриншот локального creative-lab: авторские векторные материалы, не выдаваемые за AI-генерацию. Сравни композицию и повторяемые признаки серии.', ['CR-101-M2-L3','CR-101-M2-L4','CR-201-M2-L3','CR-301-M1-L3'])
    mapping('creative-video', 'Видеоплеер показывает кадр технического ролика и управление воспроизведением.', 'Скриншот реального локального MP4 в браузерном плеере. Ролик — учебный монтаж авторских карточек; звук синтезирован локально, субтитры отдельные.', ['CR-101-M3-L3','CR-101-M4-L1','CR-201-M3-L3','CR-301-M3-L3'])
    mapping('data-overview', 'Учебный BI-отчёт показывает KPI, восемь строк и обзор выручки.', 'Скриншот локального data-lab с синтетическими заказами. Сверь показатель с таблицей и не переноси учебную выручку на реальный бизнес.', ['DT-101-M2-L3','DT-101-M3-L2','DT-201-M1-L3','DT-301-M3-L1'])
    mapping('data-filter', 'Фильтр phone оставляет три учебных заказа и KPI 4300 тенге.', 'Скриншот после реального изменения фильтра локальной панели. KPI и таблица меняются; обзорные графики ниже относятся ко всему набору.', ['DT-201-M4-L3','DT-201-M4-L4','DT-301-M3-L2'])
    mapping('marketing-overview', 'Панель кампании сравнивает уникальную выручку и пересекающиеся платформенные кредиты.', 'Скриншот локального marketing-lab: синтетические заказы. 52000 ₸ уникальной выручки и 75000 ₸ платформенных кредитов показывают риск двойного счёта.', ['MK-101-M4-L2','MK-101-M4-L3','MK-201-M4-L1','MK-201-M4-L2','MK-301-M2-L2'])
    mapping('marketing-budget', 'Сценарий бюджета изменён до 60000 тенге; панель показывает расчёт и календарь.', 'Скриншот локального сценарного расчёта, не прогноза реальных продаж. Изменён один параметр расходов; коэффициенты воронки вымышлены.', ['MK-101-M3-L3','MK-201-M4-L3','MK-301-M4-L1','MK-301-M4-L2'])
    mapping('business-quality', 'Панель времени показывает 250 минут вручную, 187 с AI-процессом и качество 75%.', 'Скриншот локального business-lab на восьми синтетических задачах. Быстрее не означает допустимое качество: порог требует доработки.', ['BI-101-M4-L4','BI-201-M4-L1','BI-201-M4-L4'])
    mapping('business-portfolio', 'При ограничении 50 часов панель выбирает DATA и MEET.', 'Скриншот после изменения часов в синтетическом портфеле. Сопоставь выбор с зависимостями и лимитом внедрения; бюджет не утверждается.', ['BI-201-M1-L4','BI-301-M1-L3','BI-301-M4-L3'])
    await fs.writeFile(path.join(root, 'content/ai-academy/lesson-visuals.json'), JSON.stringify(manifest, null, 2) + '\n')
    const allCourses = JSON.parse(await fs.readFile(path.join(root, 'content/ai-academy/authored/index.json'), 'utf8'))
    const covered = new Set(Object.keys(manifest.lessons).map(code => code.replace(/-M\d+-L\d+$/, '')))
    assert.deepEqual(allCourses.filter(code => !covered.has(code)), [])
    console.log(JSON.stringify({ screenshots: shots.size, referencedExistingScreenshots: 4, lessons: Object.keys(manifest.lessons).length, courses: covered.size, pageErrors: errors }))
  } finally {
    await browser.close()
    await Promise.all(servers.map(server => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve) })))
    await Promise.all(temporary.map(folder => fs.rm(folder, { recursive: true, force: true })))
  }
}
main().catch(error => { console.error(error); process.exit(1) })
