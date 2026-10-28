/** Production build, synthetic signed context. All course APIs deliberately unavailable. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright')
const root=path.resolve(__dirname,'..')
;(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  const fixtures=await setup.evaluate(async()=>{const {mockApi}=await import('/src/lib/mock.ts');return{boot:await mockApi.boot(),top:await mockApi.top()}});await setup.close()
  fixtures.boot.me={...fixtures.boot.me,id:55,is_admin:false,xp:235,streak:3,daily_claimed:false}
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),actions=[]
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_GAMEPLAY',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){}}}})
  await context.route('**/telegram.org/**',r=>r.abort());await context.route('**/fonts.gstatic.com/**',r=>r.abort())
  await context.route(/\/functions\/v1\/api\//,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}');actions.push({name,action:body.action})
   const send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}})
   if(name==='boot')return send(fixtures.boot)
   if(name==='top')return send(fixtures.top)
   // This must not prevent the actual course texts from opening.
   return send({error:'academy_not_ready'},503)
  })
  const page=await context.newPage(),errors=[],out=path.join(root,'test-results/og-gameplay');await fs.mkdir(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message))
  const shot=async name=>{await page.waitForTimeout(400);await page.screenshot({path:path.join(out,name)})}
  await page.goto('http://127.0.0.1:5180/');const nav=page.getByRole('navigation',{name:'Основные разделы'});await nav.waitFor()
  assert.deepEqual(await nav.getByRole('button').evaluateAll(list=>list.map(b=>b.getAttribute('aria-label'))),['Главная','Рейтинг','Профиль'])
  const level=page.getByRole('button',{name:'Мой уровень и прогресс',exact:true});await level.waitFor()
  assert.ok(await level.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}))
  await page.getByRole('button',{name:'Зажми, чтобы забрать бонус дня',exact:true}).waitFor()
  assert.ok(await page.locator('#xp-pill').isVisible());await page.waitForFunction(()=>[...document.querySelectorAll('img')].filter(el=>el.src.includes('fonts.gstatic.com')&&el.getBoundingClientRect().top<innerHeight&&el.getBoundingClientRect().bottom>0).length===0);await shot('01-home-gameplay.png')
  await nav.getByRole('button',{name:'Рейтинг',exact:true}).click();await page.getByRole('heading',{name:'Рейтинг',level:1,exact:true}).waitFor();await page.getByText('Подписчики канала по XP',{exact:true}).waitFor()
  await nav.getByRole('button',{name:'Главная',exact:true}).click()
  const cards=page.getByRole('region',{name:'Курсы',exact:true}),first=cards.getByRole('button',{name:/Открыть курс/}).first();await first.scrollIntoViewIfNeeded();await first.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}))
  const art=first.locator('[data-course-artwork]');await page.waitForFunction(()=>document.querySelector('[data-course-artwork]')?.dataset.animated==='true')
  const before=await art.locator('.og-art-cube').evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(350);const after=await art.locator('.og-art-cube').evaluate(el=>getComputedStyle(el).transform);assert.notEqual(before,after)
  await shot('02-animated-courses.png')
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await art.locator('.og-art-cube').evaluate(el=>getComputedStyle(el).animationName),'none')
  await first.click();await page.getByRole('region',{name:'Материалы курса',exact:true}).waitFor()
  await page.getByRole('button',{name:'Открыть первый урок',exact:false}).click()
  const reader=page.locator('[data-public-course-material]');await reader.waitFor();await reader.locator('.academy-reading-prose').first().waitFor()
  assert.ok(page.url().endsWith('/read/CORE-000-M1-L1'))
  assert.ok((await reader.innerText()).length>1500)
  await shot('03-real-material.png')
  await page.getByRole('button',{name:'Следующий урок',exact:false}).click();await reader.locator('.academy-reading-prose').first().waitFor();assert.ok(page.url().endsWith('CORE-000-M1-L2'))
  await page.reload();await reader.locator('.academy-reading-prose').first().waitFor();assert.ok(page.url().endsWith('CORE-000-M1-L2'))
  await page.goto('http://127.0.0.1:5180/#/courses/read/CORE-000-M1-L4');await reader.locator('.academy-reading-prose').first().waitFor();await page.getByRole('button',{name:'Следующий урок',exact:false}).click();await reader.locator('.academy-reading-prose').first().waitFor();assert.ok(page.url().endsWith('CORE-000-M2-L1'))
  const index=JSON.parse(await fs.readFile(path.join(root,'content/ai-academy/materials-manifest.json'),'utf8'))
  const counts=await page.evaluate(async courses=>Promise.all(courses.map(async c=>{const response=await fetch(c.url),book=await response.json();return {code:book.course.code,status:response.status,lessons:book.lessons.length,substantive:book.lessons.every(l=>l.data.content_blocks.some(b=>(b.text||b.body||'').length>500))}})),index.courses)
  assert.equal(counts.length,28);assert.ok(counts.every(c=>c.status===200&&c.lessons===16&&c.substantive))
  assert.equal(actions.filter(a=>['enroll','complete','quiz_start','quiz_submit','submission_save'].includes(a.action)).length,0)
  for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  assert.deepEqual(errors,[])
  const result={navigation:['Главная','Рейтинг','Профиль'],levelXpStreakAndDailyBonus:'visible on home',emojiCdnFailure:'native fallback, no broken visible images',covers:'animated in view; paused for reduced motion',publicMaterialHttpChecks:counts,lessons:448,readingWithCourseApi503:true,reload:true,crossModule:'1.4 → 2.1',fakeEnrollmentsAndGrades:0,viewports:[320,390,1024],pageErrors:errors,evidence:'local production build; course API deliberately returns 503, not live Telegram'}
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
