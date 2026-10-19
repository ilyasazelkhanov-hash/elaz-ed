import {chromium,expect as rawExpect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const expect=rawExpect.configure({timeout:20000}),base=process.env.OG_URL||'http://127.0.0.1:5181/'
const browser=await chromium.launch({executablePath:process.env.AZ_CHROME_PATH||undefined})
const report=[]
await mkdir('test-results',{recursive:true})
try{
 for(const width of [320,360,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:true,reducedMotion:'reduce'}),errors=[]
  page.on('pageerror',e=>errors.push(String(e)))
  await page.addInitScript(()=>localStorage.setItem('og:academy:locale','kk'))
  await page.route('https://telegram.org/js/**',r=>r.fulfill({body:'',contentType:'application/javascript'}))
  await page.goto(`${base}?demo#/academy/courses/VC-201`,{waitUntil:'domcontentloaded'})
  const academy=page.locator('.academy'),cta=academy.locator('main .cta').first()
  await expect(cta).toHaveText('В лист ожидания')
  await cta.click();await expect(cta).toHaveText('Вы в листе ожидания')
  await expect(academy.getByRole('combobox',{name:'Язык',exact:true})).toHaveCount(0)
  await expect.poll(()=>cta.evaluate(el=>el.scrollHeight<=el.clientHeight+1&&el.scrollWidth<=el.clientWidth+1)).toBe(true)
  expect(await academy.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:`test-results/academy-waitlist-${width}.png`})
  await page.evaluate(()=>{location.hash='/academy'})
  await expect(academy.getByRole('heading',{name:'Можно начать сейчас',exact:true})).toBeVisible()
  await expect(academy.locator('.academy-cover').first()).toBeVisible()
  await page.screenshot({path:`test-results/academy-authored-catalog-${width}.png`})
  await page.evaluate(()=>{location.hash='/academy/courses/VC-101'})
  await expect(academy.getByRole('button',{name:'Сначала AI Core',exact:true})).toBeVisible()
  await academy.getByRole('button',{name:'Сначала AI Core',exact:true}).click()
  await academy.getByRole('button',{name:'Записаться на курс',exact:true}).click()
  await academy.getByRole('button',{name:'Продолжить обучение',exact:false}).click()
  await expect(academy.getByRole('heading',{name:'Основные типы моделей и ограничения',exact:true})).toBeVisible()
  expect((await academy.locator('main').innerText()).length).toBeGreaterThan(1200)
  await expect(academy.getByRole('heading',{name:'Источники занятия',exact:true})).toBeVisible()
  expect(await academy.getByRole('button',{name:/NIST/}).count()).toBeGreaterThan(0)
  if(width===390)await page.screenshot({path:'test-results/academy-authored-lesson-390.png'})
  await academy.getByRole('textbox',{name:'Описание решения',exact:true}).fill('Учебная карта: черновик письма проверю вручную; факты сверю с первоисточником; персональные данные заменю вымышленными; итоговое решение оставлю за человеком.')
  await academy.getByRole('button',{name:'Отправить на проверку →',exact:true}).click()
  await expect(academy.getByText('На проверке',{exact:true})).toBeVisible()
  await page.reload({waitUntil:'domcontentloaded'})
  await expect(academy.getByText('На проверке',{exact:true})).toBeVisible()
  expect(errors).toEqual([])
  report.push({width,checks:['Russian-only UI ignores stale KK choice','waitlist fits','OG covers','ready courses','Core prerequisite','authored lesson and verified source','authored practice submission persists'],errors})
  await page.close()
 }
 await writeFile('test-results/academy-authored-browser.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
