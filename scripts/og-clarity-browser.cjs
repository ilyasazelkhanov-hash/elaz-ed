/** Current production build with synthetic local API; never the user's Telegram browser. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
const root=path.resolve(__dirname,'..')
;(async()=>{
 const {createAcademyEngine}=await import(pathToFileURL(path.join(root,'src/lib/academy-domain.ts')).href)
 const catalog=JSON.parse(await fs.readFile(path.join(root,'content/ai-academy/catalog.learning.json'),'utf8'))
 let state={...structuredClone(catalog),enrollments:[{user_id:55,course_code:'CORE-000',state:'active'}],progress:[{user_id:55,lesson_code:'CORE-000-M1-L1',state:'completed',completed_at:'2026-10-28T12:00:00Z'}],attempts:[],submissions:[],certificates:[],placements:[],audit:[]}
 const engine=createAcademyEngine(catalog,{load:()=>state,save:v=>state=v}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  const fixtures=await setup.evaluate(async()=>{const {mockApi}=await import('/src/lib/mock.ts'),boot=await mockApi.boot(),card=boot.feed.find(c=>c.kind==='lesson'&&!c.course_id);return{boot,post:await mockApi.lesson(card.id)}});await setup.close()
  fixtures.boot.me={...fixtures.boot.me,id:55,is_admin:false};fixtures.boot.courses=fixtures.boot.courses.map(c=>({...c,title:'LEGACY HIDDEN COURSE'}))
  fixtures.post={...fixtures.post,title:'Новость об инструментах ИИ',category:'Новости ИИ',subtitle:'Синтетическая публикация для проверки интерфейса.',body:'## Что изменилось\n\nЭто локальный пример публикации. Он проверяет интерфейс чтения, а не учебный результат.',quiz:[{q:'Legacy quiz should stay invisible',options:['A','B']}],quiz_count:1,xp:50,liked:false,likes:34}
  Object.assign(fixtures.boot.feed.find(c=>c.id===fixtures.post.id),{...fixtures.post,body:null})
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[]
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_OG_UX',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){}}}})
  await context.route('**/telegram.org/**',r=>r.abort())
  await context.route(/\/functions\/v1\/api\//,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}'),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});requests.push({name,action:body.action})
   if(name==='boot')return send(fixtures.boot)
   if(name==='lesson')return send(fixtures.post)
   if(name==='like')return send({error:'db'},500)
   if(name==='admin_list')return send({lessons:[],stats:{users:1}})
   if(name==='admin_courses')return send({courses:[],requests:[]})
   if(name==='admin_stats')return send({})
   if(name!=='academy')return send({})
   try{const data=await engine({id:55,is_admin:false},body.action,body.payload)
    // Exactly the persisted PostgreSQL progress shape: no local-engine state flag.
    if(body.action==='my')data.progress=data.progress.map(({state,status,completed,...rest})=>rest)
    return send(data)
   }catch(e){return send({error:e.message},400)}
  })
  const page=await context.newPage(),errors=[],out=path.join(root,'test-results/og-clarity');await fs.mkdir(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message))
  const shot=async name=>{await page.waitForTimeout(200);await page.screenshot({path:path.join(out,name)})}
  await page.goto('http://127.0.0.1:5180/');const nav=page.getByRole('navigation',{name:'Основные разделы'});await nav.waitFor()
  for(const label of ['Главная','Рейтинг','Профиль']){const button=nav.getByRole('button',{name:label,exact:true});await button.waitFor();assert.ok(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.width>=44}))}
  const game=page.getByRole('button',{name:'Мой уровень и прогресс',exact:true});await game.waitFor();assert.ok(await game.evaluate(el=>el.getBoundingClientRect().bottom<innerHeight))
  assert.equal(await nav.getByRole('button',{name:'Блог',exact:true}).count(),0);assert.equal(await nav.getByRole('button',{name:'Курсы',exact:true}).count(),0)
  assert.equal(await page.getByRole('heading',{name:'Все уроки',exact:true}).count(),0)
  assert.equal(await page.getByText('LEGACY HIDDEN COURSE',{exact:true}).count(),0)
  await shot('01-home.png')
  await page.getByRole('button',{name:'Все публикации',exact:true}).click();await page.getByRole('heading',{name:'Блог',exact:true,level:1}).waitFor();await page.getByLabel('Поиск в блоге').fill('Новость об инструментах')
  const articleButton=page.getByRole('button',{name:'Читать публикацию: Новость об инструментах ИИ',exact:true});await articleButton.waitFor()
  assert.doesNotMatch(await articleButton.innerText(),/XP|Пройдено|квиз/i)
  await shot('02-blog.png');await articleButton.click();const article=page.getByRole('region',{name:'Публикация блога'});await article.getByRole('heading',{level:1}).waitFor();await article.getByText('Что изменилось',{exact:true}).waitFor()
  assert.doesNotMatch(await article.innerText(),/XP|квиз|Пройдено|Скопировать для нейронки/i)
  assert.ok(page.url().includes('#/blog/'+fixtures.post.id));await page.reload();await page.getByRole('region',{name:'Публикация блога'}).getByRole('heading',{level:1}).waitFor()
  await shot('03-post.png')
  await page.getByRole('button',{name:'Нравится',exact:true}).click();await page.waitForFunction(()=>document.querySelector('button[aria-label="Нравится"] svg')?.getAttribute('fill')==='none')
  assert.match(await page.getByRole('button',{name:'Нравится',exact:true}).innerText(),/34/)
  assert.equal(requests.filter(r=>['complete','quiz_start','quiz_answer'].includes(r.name)).length,0)
  assert.equal(state.progress.length,1)
  await page.getByText('Не удалось сохранить лайк. Попробуй ещё раз.',{exact:true}).waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('heading',{name:'Блог',exact:true,level:1}).waitFor();await page.getByRole('button',{name:'Непрочитанные',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Читать публикацию: Новость об инструментах ИИ',exact:true}).count(),0)
  await nav.getByRole('button',{name:'Главная',exact:true}).click();await page.getByRole('button',{name:'Все курсы',exact:true}).click();const catalogUI=page.locator('[data-course-catalog]');await catalogUI.waitFor();assert.equal(await catalogUI.getByRole('button',{name:/Открыть курс/}).count(),28)
  await shot('04-courses.png');await catalogUI.getByRole('button',{name:/Открыть курс/}).first().click();const program=page.locator('[data-course-program]');await program.waitFor()
  await program.getByText('Твой прогресс · 1 из 16 уроков',{exact:true}).waitFor()
  assert.equal(await page.getByRole('navigation',{name:'Разделы курсов'}).count(),0)
  assert.equal(await page.locator('img[src$="/core.svg"]').count(),0)
  await shot('05-program.png');await program.getByRole('button',{name:'Продолжить обучение',exact:false}).click();await page.locator('.academy-reading-prose').first().waitFor();assert.ok(page.url().endsWith('CORE-000-M1-L2'))
  await shot('06-lesson.png')
  for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  await page.goto('http://127.0.0.1:5180/?sp=c1#/blog');await page.getByRole('heading',{name:'Блог',exact:true,level:1}).waitFor();assert.equal(await page.getByRole('heading',{name:'Старый курс скрыт'}).count(),0)
  await nav.getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:'Демо Академии',exact:true}).waitFor();await page.getByRole('button',{name:'ИИ-сертификации',exact:true}).waitFor()
  // All three primary controls remain available and large enough on a narrow phone.
  await nav.getByRole('button',{name:'Главная',exact:true}).click()
  await page.setViewportSize({width:320,height:844})
  for(const label of ['Главная','Рейтинг','Профиль'])assert.ok(await nav.getByRole('button',{name:label,exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth}))
  fixtures.boot.me.is_admin=true
  await page.goto('http://127.0.0.1:5180/#/profile')
  await page.getByRole('button',{name:'Админка',exact:true}).click()
  await page.getByRole('button',{name:'Публикация',exact:false}).click()
  await page.getByText('Новая публикация',{exact:true}).waitFor()
  assert.equal(await page.getByText('Квиз',{exact:true}).count(),0)
  assert.equal(await page.getByText('XP за урок',{exact:true}).count(),0)
  assert.deepEqual(errors,[])
  const result={mainNavigation:['Главная','Рейтинг','Профиль'],homeGamificationVisible:true,blog:'separate article reader with no quiz or XP claims',blogReload:true,blogLikeRollback:true,readMarkers:'local, separate from learning',courseCatalog:28,courseUI:'native OG, no Academy navigation or branded cover',sqlProgress:'1 of 16; resumes lesson 2',legacyCourses:'hidden',additionalFeatures:'available in profile',blogEditor:'publication, no quiz or XP controls',viewports:[320,390,1024],pageErrors:errors,evidence:'local production build + synthetic API, not live Telegram'}
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
