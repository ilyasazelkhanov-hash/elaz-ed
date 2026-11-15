/** Local demo-only regression. No production requests or real user data. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({executablePath: process.env.AZ_CHROME_PATH || undefined, headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']})
const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'no-preference'})
const errors=[]
page.on('pageerror',e=>errors.push(String(e)))
try {
 await page.goto(process.env.AZ_URL || 'http://127.0.0.1:5191/?demo',{waitUntil:'networkidle'})
 await page.locator('.az-greeting h1').waitFor()
 await page.evaluate(async()=>{
  const {usePlatform}=await import('/src/platform/store.ts')
  const {UnknownOutcomeError}=await import('/src/platform/uncertain-action.ts')
  const old=usePlatform.getState(),snapshot=old.snapshot
  window.__originalApi=old.api;window.__dispatches=0
  usePlatform.setState({uncertain:{},checkingOutcome:false,api:{bootstrap:async()=>snapshot,dispatch:async()=>{window.__dispatches++;throw new UnknownOutcomeError()}}})
  await usePlatform.getState().act('post.create',{body:'Local simulated request'})
  await usePlatform.getState().act('post.create',{body:'Local simulated request'})
 })
 await page.getByText('Результат действия не подтверждён',{exact:true}).waitFor()
 assert.equal(await page.evaluate(()=>window.__dispatches),1)
 await page.getByRole('button',{name:'Обновить данные',exact:true}).click()
 assert.equal(await page.evaluate(()=>window.__dispatches),1)
 await page.getByRole('button',{name:'Уточнить результат вручную',exact:true}).click()
 const unlock=page.getByRole('button',{name:'Снять блокировку без повтора запроса',exact:true})
 assert.equal(await unlock.isDisabled(),true)
 await page.getByRole('button',{name:'Отмена',exact:true}).click()
 assert.equal(await page.locator('.az-uncertain').count(),1)
 await page.getByRole('button',{name:'Уточнить результат вручную',exact:true}).click()
 await page.getByLabel('Действие выполнено',{exact:true}).check()
 assert.equal(await unlock.isDisabled(),true)
 await page.getByRole('checkbox').check()
 assert.equal(await page.locator('.az-app').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)
 await mkdir('test-results',{recursive:true})
 await page.screenshot({path:'test-results/master-uncertain-mobile.png'})
 await unlock.click()
 assert.equal(await page.locator('.az-uncertain').count(),0)
 assert.equal(await page.evaluate(()=>window.__dispatches),1)
 await page.evaluate(async()=>{const {usePlatform}=await import('/src/platform/store.ts');usePlatform.setState({api:window.__originalApi,uncertain:{}})})
 const canvas=page.locator('.az-hero canvas').first()
 await canvas.waitFor()
 await canvas.scrollIntoViewIfNeeded()
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.waitForTimeout(200)
 const first=await canvas.screenshot();await page.waitForTimeout(300);const second=await canvas.screenshot()
 assert.equal(first.equals(second),true,'reduced motion canvas remains static after live change')
 await page.emulateMedia({reducedMotion:'no-preference'})
 await page.waitForTimeout(150)
 const moving=await canvas.screenshot();await page.waitForTimeout(300);const moved=await canvas.screenshot()
 assert.equal(moving.equals(moved),false,'animation resumes after live preference change')
 assert.deepEqual(errors,[])
 console.log('PASS mobile warning, duplicate guard, manual confirm/cancel, no implicit retry, width, live reduced-motion stop/resume, no page errors')
} finally {await browser.close()}
