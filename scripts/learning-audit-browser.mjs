import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright-core')
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out=new URL('../test-results/learning-audit',import.meta.url).pathname
const origin=new URL(process.env.OG_LEARNING_URL || 'http://127.0.0.1:5173').origin
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']})
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort())
const page=await context.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
const visit=async hash=>{await page.goto(origin+'/?demo&check='+Date.now()+'#'+hash);await page.waitForTimeout(700)}
const shot=async name=>{await page.screenshot({path:out+'/'+name+'.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No viewport overflow')}
try{
 await visit('/courses/start/first-request')
 await page.getByRole('heading',{name:'Первый запрос, который помогает',exact:true}).waitFor()
 assert.ok(await page.locator('[data-free-guide]').textContent().then(t=>t.includes('Нужны свои или вымышленные исходные данные.')))
 await shot('01-free-start-conditions')
 const action=page.getByRole('link',{name:'Открыть ChatGPT в новой вкладке'})
 await action.scrollIntoViewIfNeeded()
 assert.equal(await action.getAttribute('href'),'https://chatgpt.com/')
 assert.equal(await action.getAttribute('rel'),'noopener noreferrer')
 assert.ok((await action.boundingBox()).height>=44)
 await shot('02-free-start-action')
 await page.getByRole('button',{name:'Я попробовал',exact:true}).click()
 await page.reload();await page.getByRole('button',{name:'Попробовал · отменить отметку',exact:true}).waitFor()
 assert.ok((await page.evaluate(()=>Object.keys(localStorage))).some(k=>k.startsWith('og:free-start:v2:demo:')))
 checks.push('free-start: visible conditions, safe external link, 44px action, attempt survives reload in demo namespace')
 await visit('/courses/og-practice/foundations/block-1')
 await page.locator('[data-og-lesson]').waitFor()
 const reading=page.getByRole('button',{name:'Я ознакомился',exact:true})
 if(await reading.count()){
  await reading.scrollIntoViewIfNeeded();await shot('03-reading-status');await reading.click()
  await page.getByText('Ознакомление отмечено',{exact:true}).first().waitFor()
 }
 const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('og-practice-v2:demo:')))
 assert.ok(saved.length>0);assert.equal(JSON.parse(saved[0][1]).lastLesson,'block-1')
 checks.push('practice: explicit reading status and account/mode-scoped resume metadata')
 await visit('/courses/og-practice/text')
 const project=page.getByRole('button',{name:'Задание итогового проекта',exact:true})
 await project.scrollIntoViewIfNeeded();await shot('04-project-status');await project.click()
 assert.ok(page.url().includes('/text/text-project'))
 assert.ok(!page.url().includes('carousel-brief'))
 checks.push('text program: capstone action targets text-project rather than last extra lesson')
 await visit('/courses/start/image-brief')
 const note=page.locator('[data-free-guide] [role="note"]')
 assert.ok((await note.textContent()).includes('бесплатный доступ к ним не обещается'))
 await page.locator('[data-free-guide]').evaluate(el=>el.closest('.scroll')?.scrollTo(0,0));await shot('05-image-conditions')
 checks.push('visual free guide: generation/export access limits shown before exercise')
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({checks,errors},null,2));await writeFile(out+'/browser-results.json',JSON.stringify({checks,errors},null,2))
}finally{await browser.close()}
