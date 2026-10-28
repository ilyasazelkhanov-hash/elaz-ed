/** Local production build + synthetic API; never the user's Telegram account. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{chromium}=require('playwright')
;(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  const boot=await setup.evaluate(async()=>{const {mockApi}=await import('/src/lib/mock.ts');return mockApi.boot()});await setup.close();boot.me.is_admin=true
  const template=boot.feed.find(p=>p.kind==='lesson'&&!p.course_id)
  let posts=Array.from({length:367},(_,i)=>({...template,id:i+1,title:`Публикация ${i+1}`,subtitle:'Материал архива',course_id:null,pinned:i<38,published_at:'2026-01-01T00:00:00Z'}))
  boot.feed=posts.filter(p=>p.id>300)
  const sorted=()=>posts.slice().sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.id-a.id)
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_BLOG_FEED',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){}}}})
  await context.route('**/telegram.org/**',r=>r.abort());await context.route('**/fonts.gstatic.com/**',r=>r.abort())
  let failed=false,requests=0,saves=[]
  await context.route(/\/functions\/v1\/api\//,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}'),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}})
   if(name==='boot')return send(boot)
   if(name==='blog_feed'){
    requests++
    if(body.cursor&&!failed){failed=true;return send({error:'db'},500)}
    const all=sorted(),start=body.cursor?all.findIndex(p=>p.id===body.cursor.id)+1:0,page=all.slice(start,start+30),last=page.at(-1)
    return send({posts:page,next:start+page.length<all.length?{pinned:last.pinned,date:last.published_at,id:last.id}:null})
   }
   if(name==='admin_list')return send({lessons:[],stats:{users:1}})
   if(name==='admin_courses')return send({courses:[],requests:[]})
   if(name==='admin_save'){saves.push(body.lesson);const post={...body.lesson,id:900,published_at:'2026-10-28T00:00:00Z'};posts=posts.filter(p=>p.id!==900).concat(post);boot.feed=posts.slice(-100);return send(post)}
   return send({})
  })
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message))
  const out=path.resolve(__dirname,'../test-results/blog-feed');await fs.mkdir(out,{recursive:true})
  await page.goto('http://127.0.0.1:5180/#/blog')
  await page.getByRole('heading',{name:'Блог',exact:true,level:1}).waitFor()
  const cards=page.getByRole('region',{name:'Публикации блога',exact:true}).getByRole('button',{name:/^Читать публикацию:/})
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Публикации блога"]').length===1&&document.querySelector('[aria-label^="Читать публикацию:"]')?.getAttribute('aria-label')==='Читать публикацию: Публикация 38')
  assert.equal(await cards.first().getAttribute('aria-label'),'Читать публикацию: Публикация 38')
  await cards.first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'promoted-first.png')})
  const scroll=async()=>page.locator('[data-tab-scroll]').evaluateAll(nodes=>nodes.forEach(node=>node.scrollTop=node.scrollHeight))
  await scroll();await page.getByRole('button',{name:'Попробовать ещё раз',exact:true}).click().catch(async error=>{console.log('errors',errors,'body', (await page.locator('body').innerText()).slice(-2200));throw error})
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Читать публикацию:"]').length>=60)
  for(let i=0;i<30&&await cards.count()<367;i++){await scroll();await page.waitForTimeout(120)}
  assert.equal(await cards.count(),367);assert.equal(new Set(await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))).size,367)
  await page.getByText('Это все публикации — ты дошёл до самой первой.',{exact:true}).waitFor()
  assert.equal(await cards.last().getAttribute('aria-label'),'Читать публикацию: Публикация 39')
  // Deep archive filtering remains available after pagination.
  await page.getByRole('textbox',{name:'Поиск в блоге'}).fill('Публикация 1');assert.ok(await cards.count()>0)
  await page.getByRole('button',{name:'Очистить поиск'}).click()
  for(const width of [320,390,1024]){await page.setViewportSize({width,height:844});assert.ok(await page.locator('[data-tab-scroll]').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)))}
  await page.setViewportSize({width:390,height:844})
  // Home itself has the full, automatically growing feed, preserving gamification.
  await page.goto('http://127.0.0.1:5180/');await page.getByRole('button',{name:'Мой уровень и прогресс',exact:true}).waitFor()
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Публикации блога"]').length===1&&document.querySelector('[aria-label^="Читать публикацию:"]')?.getAttribute('aria-label')==='Читать публикацию: Публикация 38')
  await scroll();await page.waitForFunction(()=>document.querySelectorAll('[aria-label^="Читать публикацию:"]').length>=60)
  await page.screenshot({path:path.join(out,'home-feed.png')})
  // Admin switch is explicit, saved by the existing protected editor API.
  await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('button',{name:'Профиль',exact:true}).click();await page.getByRole('button',{name:'Админка',exact:true}).click();await page.getByRole('button',{name:'Публикация',exact:false}).click()
  const toggle=page.getByRole('switch',{name:'Продвигать',exact:true});await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-checked'),'false');await toggle.click();await page.screenshot({path:path.join(out,'admin-promote.png')})
  await page.getByPlaceholder('Как собрать бота за вечер').fill('Новая продвигаемая публикация');await page.getByRole('button',{name:'Опубликовать',exact:true}).click()
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.textContent==='Сохранить'));assert.equal(saves.at(-1).pinned,true)
  await toggle.click();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForTimeout(200);assert.equal(saves.at(-1).pinned,false)
  assert.deepEqual(errors,[])
  const result={archive:367,duplicates:0,promotedOldPostsFirst:true,autoLoad:true,homeInfiniteFeed:true,retry:true,adminPromoteAndUnpromote:true,requests,viewports:[320,390,1024],pageErrors:errors,evidence:'local production build + synthetic API, not live Telegram'}
  await fs.writeFile(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
