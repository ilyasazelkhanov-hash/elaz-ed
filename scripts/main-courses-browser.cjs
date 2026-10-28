/** Run dev:5173 + normal production preview:5180. Synthetic API only. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
const root=path.resolve(__dirname,'..')
;(async()=>{
 const {createAcademyEngine}=await import(pathToFileURL(path.join(root,'src/lib/academy-domain.ts')).href)
 const catalog=JSON.parse(await fs.readFile(path.join(root,'content/ai-academy/catalog.learning.json'),'utf8'))
 let state={...structuredClone(catalog),enrollments:[{user_id:55,course_code:'CORE-000',state:'active'}],progress:[],attempts:[],submissions:[],certificates:[],placements:[],audit:[]}
 const engine=createAcademyEngine(catalog,{load:()=>state,save:v=>state=v}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  const fixture=await setup.evaluate(async()=>await(await import('/src/lib/mock.ts')).mockApi.boot());await setup.close()
  fixture.me={...fixture.me,id:55,is_admin:false};fixture.courses=fixture.courses.map(c=>({...c,title:'LEGACY HIDDEN COURSE'}))
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_MAIN_COURSES',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){}}}})
  await context.route('**/telegram.org/**',r=>r.abort())
  let liveRequests=0,videoRequests=0
  await context.route('**/learning/academy/videos/**',r=>{videoRequests++;return r.abort()})
  await context.route(/\/functions\/v1\/api\//,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}'),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}})
   if(name==='boot')return send(fixture)
   if(name!=='academy')return send({})
   liveRequests++
   try{return send(await engine({id:55,is_admin:false},body.action,body.payload))}catch(e){return send({error:e.message},400)}
  })
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5180/')
  const courses=page.getByRole('region',{name:'Курсы',exact:true});await courses.waitFor()
  assert.equal(await courses.getByRole('button',{name:/Открыть курс/}).count(),3)
  await courses.getByRole('button',{name:'Все курсы',exact:true}).click();await page.locator('[data-course-catalog]').waitFor()
  assert.equal(await page.locator('[data-course-catalog]').getByRole('button',{name:/Открыть курс/}).count(),28)
  assert.equal(await page.getByText('LEGACY HIDDEN COURSE',{exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'Видео',exact:true}).count(),0)
  await page.locator('[data-course-catalog]').getByRole('button',{name:/Открыть курс/}).first().click()
  await page.locator('[data-course-program]').waitFor();assert.ok(page.url().endsWith('#/courses/CORE-000'))
  await page.getByRole('button',{name:/Продолжить обучение/}).click()
  await page.locator('.academy-reading-prose').first().waitFor();assert.ok(page.url().includes('#/courses/lessons/CORE-000-'))
  assert.equal(await page.locator('video').count(),0)
  await page.reload();await page.locator('.academy-reading-prose').first().waitFor()
  for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/main-courses-lesson.png'})
  // Old numeric product links reveal neither an order form nor a legacy catalog.
  await page.goto('http://127.0.0.1:5180/?sp=c1');await page.getByRole('heading',{name:'Старый курс скрыт'}).waitFor()
  await page.getByRole('button',{name:'Открыть курсы →',exact:true}).click();await page.locator('[data-course-catalog]').waitFor();await page.waitForURL(url=>url.hash==='#/courses')
  await page.reload();await page.locator('[data-course-catalog]').waitFor();assert.equal(await page.getByRole('heading',{name:'Старый курс скрыт'}).count(),0)
  const realState=JSON.stringify(state),requestsBefore=liveRequests
  fixture.me.is_admin=true // Even a real administrator gets a student-only demo.
  await page.goto('http://127.0.0.1:5180/#/academy');await page.getByRole('note').waitFor()
  await page.locator('.academy-course').first().click();await page.locator('.academy-course-hero').waitFor()
  await page.getByRole('button',{name:'Записаться на курс',exact:true}).click()
  await page.getByRole('button',{name:/Продолжить обучение/}).click();await page.locator('.academy-reading-prose').first().waitFor()
  assert.ok(page.url().includes('#/academy/lessons/CORE-000-M1-L1'))
  assert.equal(await page.getByRole('button',{name:'Студия',exact:true}).count(),0)
  assert.equal(liveRequests,requestsBefore);assert.equal(JSON.stringify(state),realState)
  assert.ok(await page.evaluate(()=>localStorage.getItem('og:academy:sample:v1')))
  assert.equal(videoRequests,0);assert.deepEqual(errors,[])
  await page.screenshot({path:'/tmp/academy-isolated-demo.png'})
  console.log(JSON.stringify({mainCatalog:28,mainLesson:'readable, reloadable',legacyCatalog:'hidden',demo:'one module, local and isolated even for admin',demoLiveRequests:0,videoRequests,viewports:[320,390,1024],pageErrors:errors,backend:'synthetic local API; not live publication'}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
