/** Free discovery and synthetic paid flows. All external traffic is blocked. Start local Vite first. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path')
const modulePath=process.env.PLAYWRIGHT_MODULE||'playwright'
const {chromium}=require(modulePath),{expect:baseExpect}=require(modulePath+'/test'),expect=baseExpect.configure({timeout:15000})
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/og-discovery'),origin=process.env.OG_DISCOVERY_URL||'http://127.0.0.1:5173'
const browserPath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
;(async()=>{
 await fs.mkdir(out,{recursive:true})
 const browser=await chromium.launch({headless:true,executablePath:browserPath})
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await context.addInitScript(()=>{if(!localStorage.getItem('elaz-ed-theme'))localStorage.setItem('elaz-ed-theme','light')})
 const page=await context.newPage(),errors=[],apiRequests=[],checks=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('dialog',dialog=>dialog.accept())
 await context.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.pathname.includes('/functions/v1/'))apiRequests.push(url.href)
  return url.origin===new URL(origin).origin?route.continue():route.abort()
 })
 let stage='start',visitCount=0
 const visit=async(hash='')=>{await page.goto(origin+'/?demo&check='+ ++visitCount +hash,{waitUntil:'domcontentloaded'})}
 const active=()=>page.locator('[data-focus-layer][aria-modal="true"]').last()
 const nav=()=>page.getByRole('navigation',{name:'Основные разделы'})
 const shot=name=>page.screenshot({path:path.join(out,name+'.png')})
 const step=async(name,fn)=>{stage=name;await fn();checks.push(name);console.log('PASS '+name)}
 try{
  await step('free-first-home-and-four-visible-tabs',async()=>{
   await visit()
   await expect(nav()).toBeVisible()
   assert.deepEqual(await nav().getByRole('button').allTextContents(),['Главная','Обновления','Курсы','Профиль'])
   await expect(page.getByRole('heading',{level:1})).toContainText('Понятно об ИИ')
   const latest=page.getByRole('region',{name:'Последние обновления'}),courses=page.getByRole('region',{name:'Курсы',exact:true})
   await expect(latest.locator('.reader-post').first()).toBeVisible()
   assert.ok((await latest.boundingBox()).y<(await courses.boundingBox()).y)
   const bonus=page.getByRole('region',{name:'Бонус дня и стрик'}),advent=page.getByRole('button',{name:'Адвент-календарь',exact:true})
   assert.ok((await bonus.boundingBox()).y<(await latest.boundingBox()).y,'Daily bonus and streak appear before updates')
   if(await advent.count())assert.ok((await bonus.boundingBox()).y<(await advent.boundingBox()).y&&(await advent.boundingBox()).y<(await latest.boundingBox()).y,'Advent appears between the streak and updates')
   await shot('01-home-free-first')
  })
  await step('five-free-guides-copy-and-self-check',async()=>{
   await page.getByRole('button',{name:'Я начинаю — с чего начать?',exact:true}).click()
   await expect(active().getByRole('heading',{level:1})).toContainText('С ИИ можно')
   assert.equal(await active().locator('.free-start-card').count(),5)
   await active().locator('.free-start-card').first().click()
   await expect(active().getByRole('heading',{level:1})).toHaveText('Первый запрос, который помогает')
   await expect(active().locator('.free-start-prompt pre')).toContainText('до 500 знаков')
   await active().getByRole('button',{name:'Я попробовал',exact:true}).click()
   await expect(active().getByRole('button',{name:'Попробовал · отменить отметку',exact:true})).toHaveAttribute('aria-pressed','true')
   await shot('02-free-guide')
   await page.reload({waitUntil:'domcontentloaded'})
   await expect(active().getByRole('button',{name:'Попробовал · отменить отметку',exact:true})).toBeVisible()
  })
  await step('bookmarks-persist-and-unread-has-real-reading-state',async()=>{
   await visit('#/blog')
   await expect(page.getByRole('heading',{name:'Обновления',level:1})).toBeVisible()
   const first=page.locator('.reader-post').first(),title=await first.locator('h3').innerText()
   await first.getByRole('button',{name:'Сохранить публикацию',exact:true}).click()
   await page.getByRole('button',{name:'Сохранённые',exact:true}).click()
   await expect(page.locator('.reader-post').first().locator('h3')).toHaveText(title)
   await page.reload({waitUntil:'domcontentloaded'})
   await page.getByRole('button',{name:'Сохранённые',exact:true}).click()
   await expect(page.locator('.reader-post').first().locator('h3')).toHaveText(title)
   await page.locator('.reader-post').first().getByRole('button',{name:'Читать',exact:true}).click()
   await expect(active().getByRole('heading',{level:1})).toHaveText(title)
   await expect(active().locator('.prose-ed').first()).toBeVisible()
   await expect(active().getByRole('button',{name:'Убрать из сохранённых',exact:true})).toHaveAttribute('aria-pressed','true')
   await active().getByRole('button',{name:'Назад',exact:true}).click()
   await page.getByRole('button',{name:'Непрочитанные',exact:true}).click()
   await expect(page.locator('.reader-post h3').filter({hasText:title})).toHaveCount(0)
   await page.getByRole('button',{name:'Сохранённые',exact:true}).click()
   await shot('03-saved-updates')
  })
  await step('interests-search-and-manual-refresh',async()=>{
   await page.getByRole('button',{name:'Новые',exact:true}).click()
   await page.getByLabel('Тема публикаций',{exact:true}).selectOption('tools')
   await page.getByRole('button',{name:'Добавить в мои темы',exact:true}).click()
   await expect(page.getByRole('button',{name:'В моих темах',exact:true})).toHaveAttribute('aria-pressed','true')
   await page.getByLabel('Тема публикаций',{exact:true}).selectOption('all')
   await page.getByLabel('Поиск в блоге',{exact:true}).fill('текст которого нет в публикациях')
   await expect(page.getByRole('heading',{name:'По запросу пока пусто'})).toBeVisible()
   await page.getByRole('button',{name:'Очистить поиск',exact:true}).click()
   await page.getByRole('button',{name:'Обновить публикации',exact:true}).click()
   await expect(page.locator('.reader-post').first()).toBeVisible()
  })
  await step('five-paid-offers-and-free-preview-reader',async()=>{
   await nav().getByRole('button',{name:'Курсы',exact:true}).click()
   await expect(page.locator('[data-og-course]')).toHaveCount(5)
   await expect(page.locator('[data-practice-artwork]')).toHaveCount(5)
   await shot('04-paid-catalog')
   await page.locator('[data-og-course="foundations"]').getByRole('button',{name:'Смотреть программу',exact:true}).click()
   await expect(active().getByRole('heading',{level:1})).toHaveText('Основы ИИ и инструменты')
   await expect(active().getByText('250 ⭐',{exact:false}).first()).toBeVisible()
   await active().getByRole('button',{name:'Бесплатный пробный урок',exact:true}).click()
   await expect(active().locator('[data-og-lesson]')).toBeVisible()
   await active().getByRole('button',{name:'Самопроверка',exact:true}).click()
   await expect(active().getByRole('button',{name:'Показать разбор',exact:true})).toHaveAttribute('aria-expanded','false')
   assert.equal(await active().locator('.og-reader-answer .prose-ed').count(),0)
   await active().getByLabel('Твой ответ',{exact:true}).fill('Сверю ответ с исходными фактами.')
   await active().getByRole('button',{name:'Показать разбор',exact:true}).click()
   await expect(active().locator('.og-reader-answer .prose-ed')).toContainText('Сравни каждое утверждение')
   await shot('05-preview-reader')
   await page.reload({waitUntil:'domcontentloaded'})
   await expect(active().getByLabel('Твой ответ',{exact:true})).toHaveValue('Сверю ответ с исходными фактами.')
  })
  await step('locked-lesson-and-isolated-demo-purchase',async()=>{
   await active().getByRole('button',{name:'Назад',exact:true}).click()
   await active().locator('[data-practice-lesson]').nth(1).click()
   await expect(active().locator('[data-paid-lesson-locked]')).toBeVisible()
   await expect(active().locator('[data-og-content]')).toHaveCount(0)
   await shot('06-locked-lesson')
   await active().getByRole('button',{name:/Открыть курс за 250/}).click()
   await active().getByRole('button',{name:/Открыть за.*250/}).click()
   await expect(active().getByRole('button',{name:'Начать курс',exact:true})).toBeVisible()
   await active().getByRole('button',{name:'Назад',exact:true}).click()
   await expect(active().locator('[data-og-lesson]')).toBeVisible()
   await expect(active().locator('[data-paid-lesson-locked]')).toHaveCount(0)
   await shot('07-authorized-reader')
  })
  await step('mobile-layout-light-and-dark',async()=>{
   for(const theme of ['light','dark'])for(const width of [320,390]){
    await page.setViewportSize({width,height:844})
    await page.evaluate(theme=>{localStorage.setItem('elaz-ed-theme',theme);document.documentElement.dataset.theme=theme},theme)
    for(const hash of ['','#/blog','#/courses','#/courses/start']){
     await visit(hash);await expect(nav()).toBeVisible()
     if(hash.includes('start'))await expect(active().getByRole('heading',{level:1})).toBeVisible()
     else await expect(page.locator('[data-tab-scroll] h1').first()).toBeVisible()
     await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme)
     await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(theme==='dark'?'rgb(11, 10, 18)':'rgb(239, 236, 248)')
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document overflow '+theme+' '+width+' '+hash)
     const clipped=await page.evaluate(()=>[...document.querySelectorAll('button,input,h1,h2')].filter(el=>{
      if(el.closest('[inert]')||!el.getClientRects().length)return false
      for(let node=el.parentElement;node;node=node.parentElement)if(getComputedStyle(node).overflowX==='auto')return false
      const rect=el.getBoundingClientRect();return rect.left < -1||rect.right > innerWidth+1
     }).map(el=>el.textContent?.slice(0,60)))
     assert.deepEqual(clipped,[],'Clipped controls '+theme+' '+width+' '+hash)
     if(width===390&&hash==='')await shot('home-'+theme)
    }
   }
  })
  assert.deepEqual(errors,[]);assert.deepEqual(apiRequests,[])
  const report={checks,pageErrors:errors,apiRequests,browser:await browser.version(),mode:'Isolated local demo; all external traffic blocked; synthetic payment only.'}
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report,null,2))
 }catch(error){
  await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{})
  await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({stage,message:error.message,checks,errors,url:page.url()},null,2)+'\n')
  throw error
 }finally{await context.close();await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
