import { chromium, expect as baseExpect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const browser=await chromium.launch({executablePath:process.env.AZ_CHROME_PATH||undefined})
const base=process.env.OG_URL||'http://127.0.0.1:5181/'
const report=[]
const expect=baseExpect.configure({timeout:20000})
await mkdir('test-results',{recursive:true})
try {
 for(const width of [360,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'})
  const errors=[];page.on('pageerror',e=>errors.push(String(e)))
  await page.route('https://telegram.org/js/**',route=>route.fulfill({body:'',contentType:'application/javascript'}))
  try {
   await page.goto(`${base}?demo#/academy`,{waitUntil:'domcontentloaded'})
   const academy=page.locator('.academy')
   await expect(academy.getByRole('heading',{name:'Найди свой вектор'})).toBeVisible()
   await expect(academy.getByRole('button',{name:'Junior',exact:true})).toBeVisible()
   await expect.poll(()=>academy.locator('.academy-course').count()).toBeGreaterThan(0)
   expect(await academy.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
   await page.screenshot({path:`test-results/academy-catalog-${width}.png`})
   await academy.getByRole('button',{name:'Junior',exact:true}).click()
   await expect(academy.getByRole('heading',{name:'Уровень Junior',exact:true})).toBeVisible()
   await expect(academy.locator('.academy-course')).toHaveCount(9)
   await academy.getByRole('button',{name:'Все уровни',exact:true}).click()
   await academy.getByLabel('Поиск курсов').fill('RAG')
   await expect(academy.getByRole('heading',{name:'Результаты поиска'})).toBeVisible()
   await expect.poll(()=>academy.locator('.academy-course').count()).toBeGreaterThan(0)
   await page.evaluate(()=>{location.hash='/academy/courses/VC-201'})
   await expect(academy.getByRole('heading',{name:'Full-stack MVP с AI',exact:true})).toBeVisible()
   await academy.getByRole('button',{name:'В лист ожидания',exact:true}).click()
   await expect(academy.getByRole('button',{name:'Вы в листе ожидания',exact:true})).toBeDisabled()
   await page.reload({waitUntil:'domcontentloaded'})
   await expect(academy.getByRole('button',{name:'Вы в листе ожидания',exact:true})).toBeDisabled()
   await academy.getByRole('navigation',{name:'Разделы академии'}).getByRole('button',{name:'Моё обучение',exact:true}).click()
   await expect(academy.getByRole('button',{name:/Full-stack MVP с AI/})).toBeVisible()
   await expect(academy.getByText('Лист ожидания',{exact:true})).toBeVisible()
   await page.evaluate(()=>{location.hash='/academy/lessons/VC-201-M1-L1'})
   await expect(academy.getByText('Программа формируется',{exact:true}).first()).toBeVisible()
   await expect(academy.getByRole('button',{name:'Отметить изученным',exact:true})).toHaveCount(0)
   expect(errors).toEqual([])
   report.push({width,checks:['deep link','responsive bounds','9 Junior courses','RAG search','waiting list persists','outline cannot complete'],errors})
  }catch(error){await page.screenshot({path:`test-results/academy-failure-${width}.png`});throw error}
  finally{await page.close()}
 }
 await writeFile('test-results/academy-browser.json',JSON.stringify(report,null,2))
 console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
