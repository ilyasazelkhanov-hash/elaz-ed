import {chromium,expect as rawExpect} from '@playwright/test'
const expect=rawExpect.configure({timeout:20000})
const base=process.env.OG_URL||'http://127.0.0.1:5181/',enabled=process.env.EXPECT_MULTILINGUAL==='true'
const browser=await chromium.launch({executablePath:process.env.AZ_CHROME_PATH||undefined})
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 await context.addInitScript(()=>localStorage.setItem('og:academy:locale','kk'))
 await context.route('https://telegram.org/js/**',route=>route.fulfill({body:'',contentType:'application/javascript'}))
 const page=await context.newPage()
 await page.goto(`${base}?demo#/academy`)
 const picker=page.getByRole('combobox',{name:/Язык|Тіл|Language/})
 if(enabled){
  await expect(picker).toBeVisible();await expect(picker.locator('option')).toHaveCount(3)
  await expect(page.getByRole('button',{name:'Менің оқуым',exact:true})).toBeVisible()
  await picker.selectOption('en')
  await expect(page.getByRole('button',{name:'My learning',exact:true})).toBeVisible()
 }else{
  await expect(page.getByRole('button',{name:'Моё обучение',exact:true})).toBeVisible()
  await expect(picker).toHaveCount(0)
 }
 await page.goto(`${base}academy/verify/unknown-public-credential?demo`)
 if(enabled){await expect(page.getByRole('combobox')).toBeVisible();await expect(page.getByRole('combobox').locator('option')).toHaveCount(3)}
 else{await expect(page.getByRole('heading',{name:'Проверка подтверждения',exact:true})).toBeVisible();await expect(page.getByRole('combobox')).toHaveCount(0)}
 console.log(`Academy and public page: ${enabled?'optional three-language mode works':'Russian only; stale KK does not override release'} .`)
}finally{await browser.close()}
