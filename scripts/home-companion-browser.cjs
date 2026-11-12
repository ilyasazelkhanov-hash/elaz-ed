/** Local-only demo checks. Start Vite first; every external request is blocked. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5173'
const out = path.resolve('test-results/home-companion-ui')
;(async () => {
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort())
  const page = await context.newPage(), errors = [], checks = []
  page.on('pageerror', error => errors.push(error.message))
  const region = () => page.getByRole('region', { name: 'Твой Dots' })
  const active = () => page.locator('[data-focus-layer][aria-modal="true"]').last()
  const pet = () => region().getByRole('button', { name: /погладить и показать другую идею/ })
  const check = async (name, run) => { await run(); checks.push(name); console.log('PASS ' + name) }
  const findCue = async (label) => {
    for (let count=0; count<8; count++) {
      const action=region().getByRole('button',{name:new RegExp('^'+label+':')})
      if(await action.count()) return action
      await pet().click()
    }
    throw new Error('No actual companion cue for '+label)
  }
  try {
    await page.goto(origin + '/?demo', { waitUntil: 'domcontentloaded' }); await region().waitFor()
    await check('compact-320-360-390-768-both-themes-and-44px-targets', async () => {
      for (const theme of ['dark','light']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        for (const width of [320,360,390,768]) {
          await page.setViewportSize({width,height:844})
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true)
          assert.ok((await region().boundingBox()).height <= 135,'Only one compact form at normal font size')
          assert.equal(await region().getByRole('button').evaluateAll(buttons => buttons.every(button => {const r=button.getBoundingClientRect();return r.width>=44&&r.height>=44})),true)
          await page.screenshot({path:path.join(out,`${theme}-${width}.png`)})
        }
      }
      await page.setViewportSize({width:390,height:844})
    })
    await check('daily-and-advent-are-immediately-under-dots-before-news', async () => {
      const order=await page.evaluate(()=>{
        const companion=document.querySelector('.og-companion'),daily=document.querySelector('#daily-check-in'),news=document.querySelector('[aria-label="Последние новости"]'),advent=document.querySelector('[aria-label="Адвент-календарь"]')
        return {daily:!!(companion.compareDocumentPosition(daily)&Node.DOCUMENT_POSITION_FOLLOWING),news:!!(daily.compareDocumentPosition(news)&Node.DOCUMENT_POSITION_FOLLOWING),advent:!advent||!!(daily.compareDocumentPosition(advent)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(advent.compareDocumentPosition(news)&Node.DOCUMENT_POSITION_FOLLOWING)}
      }); assert.deepEqual(order,{daily:true,news:true,advent:true})
    })
    await check('reduced-motion-and-silent-auto-copy', async () => {
      assert.equal(await region().getAttribute('data-moving'),'false')
      assert.equal(await region().evaluate(node=>[...node.querySelectorAll('*')].every(el=>getComputedStyle(el).animationName==='none')),true)
      const text=await region().locator('.og-dots-line').textContent()
      await page.clock.install();await page.clock.fastForward(45000)
      assert.equal(await region().locator('.og-dots-line').textContent(),text)
      assert.equal(await region().getByRole('status').textContent(),'');await page.clock.resume()
    })
    await check('touch-and-keyboard-change-real-cue-with-visible-emotion', async () => {
      const before=await region().locator('.og-dots-line').textContent()
      await pet().focus();await page.keyboard.press('Enter')
      assert.notEqual(await region().locator('.og-dots-line').textContent(),before)
      assert.equal(await region().getAttribute('data-mood'),'happy')
      assert.ok((await region().getByRole('status').textContent()).length>0)
    })
    await check('free-start-and-exact-article-action-and-back', async () => {
      await (await findCue('Попробовать ИИ')).click()
      await active().getByRole('heading',{name:/С ИИ можно/}).waitFor()
      await page.goBack();await region().waitFor()
      const action=await findCue('Читать статью'),title=await region().locator('.og-dots-detail').textContent()
      await action.click();await active().getByRole('heading',{name:title,exact:true}).waitFor()
      await active().getByRole('button',{name:'Назад',exact:true}).click();await region().waitFor()
    })
    await check('daily-link-focuses-real-claim-not-fabricated-points', async () => {
      await page.evaluate(()=>{const s=window.__store;s.setState({me:{...s.getState().me,daily_claimed:false}})})
      const before=await page.evaluate(()=>window.__store.getState().me.xp)
      await (await findCue('К отметке дня')).click()
      assert.equal(await page.getByRole('button',{name:'Забрать бонус дня',exact:true}).evaluate(node=>node===document.activeElement),true)
      assert.equal(await page.evaluate(()=>window.__store.getState().me.xp),before)
      await page.evaluate(()=>{const s=window.__store;s.setState({me:{...s.getState().me,daily_claimed:true}})})
      await region().getByRole('button',{name:/^Моя отметка:/}).waitFor()
      assert.equal(await region().getAttribute('data-mood'),'happy')
    })
    await check('appearance-save-name-palette-shape-accessory-reload-and-cancel', async () => {
      await region().getByRole('button',{name:'Настроить Dots'}).click()
      await active().getByLabel('Имя',{exact:true}).fill('Луна')
      await active().getByRole('radio',{name:'Мята',exact:true}).check()
      await active().getByRole('radio',{name:'Искра',exact:true}).check()
      await active().getByRole('radio',{name:'Наушники',exact:true}).check()
      await page.screenshot({path:path.join(out,'customization.png')})
      await active().getByRole('button',{name:'Это мой Dots'}).click()
      await region().getByRole('button',{name:/^Луна: погладить/}).waitFor()
      assert.equal(await region().locator('.og-dots-creature').getAttribute('data-color'),'mint')
      assert.equal(await region().locator('.og-dots-creature').getAttribute('data-shape'),'spark')
      assert.equal(await region().locator('.og-dots-creature').getAttribute('data-accessory'),'headphones')
      await page.reload();await region().getByRole('button',{name:/^Луна: погладить/}).waitFor()
      const settings=region().getByRole('button',{name:'Настроить Dots'});await settings.click()
      await active().getByLabel('Имя',{exact:true}).fill('Не сохранять');await page.keyboard.press('Escape')
      await region().getByRole('button',{name:/^Луна: погладить/}).waitFor()
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Настроить Dots')
    })
    await check('browser-back-closes-settings-without-leaving-home', async () => {
      await region().getByRole('button',{name:'Настроить Dots'}).click()
      await active().getByRole('heading',{name:/Знакомься/}).waitFor()
      await page.goBack()
      await region().getByRole('button',{name:'Настроить Dots'}).waitFor()
      await page.getByRole('dialog',{name:'Настроить своего Dots'}).waitFor({state:'detached'})
      assert.equal(new URL(page.url()).origin,new URL(origin).origin)
    })
    await check('settings-focus-trap-and-small-screen-large-text', async () => {
      await region().getByRole('button',{name:'Настроить Dots'}).click()
      await active().getByRole('button',{name:'Это мой Dots'}).focus();await page.keyboard.press('Tab')
      assert.equal(await active().evaluate(node=>node.contains(document.activeElement)),true)
      await page.setViewportSize({width:320,height:568})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      await active().getByRole('button',{name:'Закрыть настройки Dots'}).click()
      await page.addStyleTag({content:'.og-companion {font-size:200%} .og-dots-line {font-size:26px} .og-dots-name {font-size:20px} .og-dots-detail,.og-dots-action {font-size:22px}'})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      await page.screenshot({path:path.join(out,'large-text-320.png')});await page.reload();await region().waitFor()
    })
    await check('account-switch-does-not-leak-name-or-look',async()=>{
      const original=await page.evaluate(()=>window.__store.getState().me.id)
      await page.evaluate(()=>{const s=window.__store;s.setState({me:{...s.getState().me,id:999919}})})
      await region().getByRole('button',{name:/^Dots: погладить/}).waitFor()
      await page.evaluate(id=>{const s=window.__store;s.setState({me:{...s.getState().me,id}})},original)
      await region().getByRole('button',{name:/^Луна: погладить/}).waitFor()
    })
    await check('motion-pauses-and-bounded-rotation-does-not-speak-or-steal-focus',async()=>{
      await page.emulateMedia({reducedMotion:'no-preference'})
      await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('og:companion:v2:'))sessionStorage.removeItem(key)})
      await page.reload();await region().waitFor();await page.mouse.move(0,0)
      await page.waitForFunction(()=>document.querySelector('.og-companion').dataset.moving==='true')
      await page.clock.fastForward(15000)
      await page.waitForFunction(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('og:companion:v2:')).some(k=>JSON.parse(sessionStorage.getItem(k)).autoChanges===1))
      assert.equal(await region().getByRole('status').textContent(),'')
      await page.clock.fastForward(15000)
      await page.waitForFunction(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('og:companion:v2:')).some(k=>JSON.parse(sessionStorage.getItem(k)).autoChanges===2))
      const text=await region().locator('.og-dots-line').textContent();await page.clock.fastForward(60000)
      assert.equal(await region().locator('.og-dots-line').textContent(),text);await page.clock.resume()
      await region().getByRole('button',{name:'Настроить Dots'}).click()
      await active().getByRole('checkbox',{name:/Живые анимации/}).uncheck()
      await active().getByRole('button',{name:'Закрыть настройки Dots'}).click()
      assert.equal(await region().getAttribute('data-moving'),'false')
      await page.reload();await region().waitFor();assert.equal(await region().getAttribute('data-moving'),'false')
    })
    assert.deepEqual(errors,[])
  } finally {
    await fs.writeFile(path.join(out,'checks.json'),JSON.stringify({checks,errors},null,2));await browser.close()
  }
})().catch(error=>{console.error(error);process.exitCode=1})
