/** Separate admin areas, local production build + synthetic API only. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright')
;(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  const fixtures=await setup.evaluate(async()=>{const {mockApi}=await import('/src/lib/mock.ts'),boot=await mockApi.boot(),card=boot.feed.find(p=>p.kind==='lesson'&&!p.course_id);return {boot,lesson:await mockApi.lesson(card.id)}});await setup.close();fixtures.boot.me.is_admin=true
  const template={...fixtures.lesson,quiz:[],course_id:null,published:true}
  let materials=[...Array.from({length:620},(_,i)=>({...template,id:i+1,title:i===0?'Самая ранняя статья':`Блог: публикация ${i+1}`,pinned:false})),...Array.from({length:40},(_,i)=>({...template,id:1001+i,title:`Сторис: история ${i+1}`,kind:'story',xp:5})),...Array.from({length:10},(_,i)=>({...template,id:2001+i,title:`Архив: урок ${i+1}`,course_id:1}))]
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),saves=[],calls=[]
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_ADMIN_SECTIONS',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},BackButton:{show(){},hide(){},onClick(fn){window.__adminBack=fn},offClick(fn){if(window.__adminBack===fn)window.__adminBack=null}}}}})
  await context.route('**/telegram.org/**',r=>r.abort());await context.route('**/fonts.gstatic.com/**',r=>r.abort())
  await context.route(/\/(?:functions\/v1\/api\/)?(?:boot|blog_feed|admin_list|admin_courses|admin_save|academy)$/,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}');calls.push({name,...body,auth:undefined})
   const send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}})
   if(name==='boot')return send(fixtures.boot)
   if(name==='blog_feed')return send({posts:[],next:null})
   if(name==='admin_courses')return send({courses:[{id:1,title:'Архивный курс'}],requests:[]})
   if(name==='admin_list'){
    let rows=materials.filter(item=>body.scope==='summary'?false:body.scope==='stories'?item.kind==='story':item.kind==='lesson'&&(body.scope==='blog'?item.course_id==null:item.course_id!=null)).sort((a,b)=>b.id-a.id)
    if(body.cursor)rows=rows.filter(item=>item.id<body.cursor)
    if(body.query)rows=rows.filter(item=>item.title.toLowerCase().includes(body.query.toLowerCase()))
    const page=rows.slice(0,30);return send({lessons:page,next:rows.length>30?page.at(-1).id:null,stats:{users:10,subscribed:9,active:8,completions:7}})
   }
   if(name==='admin_save'){const item={...body.lesson,id:body.lesson.id||3001,published_at:'2026-10-28T00:00:00Z'};saves.push(item);materials=materials.filter(old=>old.id!==item.id).concat(item);return send(item)}
   if(name==='academy'){
    if(body.action==='permissions')return send({admin:true,editor:true,instructor:true})
    if(body.action==='admin_list')return send({entities:[{code:'CORE-000',kind:'course',title:'Актуальный курс',state:'published',version:1,position:0,data:{}}],total:1})
    return send({roles:[],events:[],items:[]})
   }
   return send({})
  })
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message))
  const out=path.resolve(__dirname,'../test-results/full-audit/admin');await fs.mkdir(out,{recursive:true})
  await page.goto(`${process.env.ADMIN_AUDIT_URL||'http://127.0.0.1:5180'}/#/profile`);await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:'Админка',exact:true}).click().catch(async error=>{console.log('body',(await page.locator('body').innerText()).slice(-2000),'errors',errors,'calls',calls.map(c=>c.name));throw error})
  const hub=()=>page.getByRole('region',{name:'Разделы контента',exact:true})
  await hub().waitFor();assert.equal(await page.getByRole('button',{name:/^Редактировать:/}).count(),0)
  await page.screenshot({path:path.join(out,'01-admin-hub.png')})
  await hub().getByRole('button',{name:/^Блог/}).click();const blog=page.getByRole('region',{name:'Блог: управление',exact:true});await blog.waitFor()
  await blog.getByRole('button',{name:'Редактировать: Блог: публикация 620',exact:true}).waitFor()
  assert.equal(await blog.getByRole('button',{name:/Редактировать: (Сторис|Архив)/}).count(),0)
  await blog.getByRole('textbox',{name:'Поиск по заголовку'}).fill('Самая ранняя статья')
  await blog.getByRole('button',{name:'Редактировать: Самая ранняя статья',exact:true}).waitFor()
  await blog.getByRole('textbox',{name:'Поиск по заголовку'}).fill('')
  await blog.getByRole('button',{name:'Редактировать: Блог: публикация 620',exact:true}).waitFor()
  for(let i=0;i<25&&await blog.getByRole('button',{name:'Загрузить ещё',exact:true}).count();i++){const count=await blog.getByRole('button',{name:/^Редактировать:/}).count();await blog.getByRole('button',{name:'Загрузить ещё',exact:true}).click();await page.waitForFunction(previous=>document.querySelectorAll('[aria-label^="Редактировать:"]').length>previous,count)}
  assert.equal(await blog.getByRole('button',{name:/^Редактировать:/}).count(),620)
  await blog.getByRole('button',{name:'Новая публикация',exact:true}).click();await page.getByRole('heading',{name:'Новая публикация',level:1,exact:true}).waitFor()
  assert.equal(await page.getByRole('switch',{name:'Продвигать',exact:true}).count(),1)
  assert.equal(await page.getByText('Квиз',{exact:true}).count(),0);assert.equal(await page.getByText('XP за урок',{exact:true}).count(),0);assert.equal(await page.getByText('Курс',{exact:true}).count(),0)
  await page.getByPlaceholder('Как собрать бота за вечер').fill('Отдельная запись блога');await page.getByRole('switch',{name:'Продвигать',exact:true}).click();await page.getByRole('button',{name:'Опубликовать',exact:true}).click()
  await page.getByRole('button',{name:'Сохранить',exact:true}).waitFor();assert.equal(saves.at(-1).kind,'lesson');assert.equal(saves.at(-1).course_id,null);assert.equal(saves.at(-1).pinned,true)
  await page.screenshot({path:path.join(out,'02-blog-settings.png')})
  const back=async()=>{await page.evaluate(()=>window.__adminBack?.());await page.waitForTimeout(220)}
  await back();await back();await hub().getByRole('button',{name:/^Сторис/}).click()
  const stories=page.getByRole('region',{name:'Сторис: управление',exact:true});await stories.getByRole('button',{name:'Редактировать: Сторис: история 40',exact:true}).waitFor()
  assert.equal(await stories.getByRole('button',{name:/Редактировать: (Блог|Архив)/}).count(),0)
  await stories.getByRole('button',{name:'Новая сторис',exact:true}).click();await page.getByPlaceholder('Вышло обновление').fill('Отдельная сторис')
  assert.equal(await page.getByRole('switch',{name:'Продвигать',exact:true}).count(),0);assert.equal(await page.getByText('XP за просмотр',{exact:true}).count(),1)
  await page.getByRole('spinbutton').fill('7');await page.getByRole('button',{name:'Новый слайд',exact:true}).click();await page.getByRole('button',{name:'Опубликовать',exact:true}).click();await page.getByRole('button',{name:'Сохранить',exact:true}).waitFor()
  assert.equal(saves.at(-1).kind,'story');assert.equal(saves.at(-1).xp,7)
  await page.screenshot({path:path.join(out,'03-story-settings.png')})
  await back();await back();await page.getByRole('button',{name:/^Архивные уроки/}).click()
  const legacy=page.getByRole('region',{name:'Архивные уроки: управление',exact:true});await legacy.getByRole('button',{name:'Редактировать: Архив: урок 10',exact:true}).waitFor();assert.equal(await legacy.getByRole('button',{name:/^Редактировать:/}).count(),10);assert.equal(await legacy.getByRole('button',{name:/Редактировать: (Блог|Сторис)/}).count(),0)
  await back();await hub().getByRole('button',{name:/^Материалы курсов/}).click();await page.getByRole('region',{name:'Курсы OG CRE8R',exact:true}).waitFor();await page.getByRole('heading',{name:'Студия академии',exact:true}).waitFor();assert.ok(page.url().includes('#/courses/admin'))
  assert.deepEqual(errors,[])
  const result={hub:'blog / stories / current course materials',blogArchive:620,serverSearch:'old title outside first 500',separateLists:true,blogSettings:'promotion, no quiz/XP/course selector',storySettings:'slides and view XP, no blog promotion',legacy:'separate archive',courses:'current LMS admin, not demo',backNavigation:true,saves:saves.map(s=>({kind:s.kind,course_id:s.course_id,xp:s.xp,pinned:s.pinned})),pageErrors:errors,evidence:'local production build + synthetic API; no live Telegram or database writes'}
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})
