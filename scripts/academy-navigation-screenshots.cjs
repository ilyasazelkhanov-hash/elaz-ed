/** Start npm run dev first, then node scripts/academy-navigation-screenshots.cjs.
 * Captures explicit local demo UI, never a live Telegram session or provider UI.
 */
const {chromium}=require('playwright')
const fs=require('node:fs/promises'),path=require('node:path')
const output=path.resolve(__dirname,'../public/learning/academy/screenshots')
;(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 await fs.mkdir(output,{recursive:true})
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.goto('http://127.0.0.1:5173/?demo#/courses/courses/CORE-000')
 const program=page.getByRole('heading',{name:'Программа по порядку',exact:true});await program.waitFor();await program.evaluate(element=>element.scrollIntoView({block:'start',behavior:'instant'}))
 await page.screenshot({path:path.join(output,'learning-course-order.png'),animations:'disabled'})
 await page.goto('http://127.0.0.1:5173/?demo#/courses/lessons/CORE-000-M1-L4')
 await page.locator('.academy-journey-location').filter({hasText:'Урок 4 из 16'}).waitFor()
 await page.screenshot({path:path.join(output,'learning-lesson-order.png'),animations:'disabled'})
 await page.goto('http://127.0.0.1:5173/?demo#/courses/lessons/CORE-000-M2-L1')
 const enlarge=page.getByRole('button',{name:/Увеличить скриншот:/}).first();await enlarge.waitFor();await enlarge.click()
 const dialog=page.getByRole('dialog',{name:'Скриншот учебного примера'});await dialog.waitFor();await dialog.locator('figure img').evaluate(el=>el.decode())
 await page.screenshot({path:path.join(output,'learning-image-viewer.png'),animations:'disabled'})
 if(errors.length)throw Error(errors.join('\n'))
 console.log('Three actual local demo navigation screenshots captured; pageErrors [].')
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)})
