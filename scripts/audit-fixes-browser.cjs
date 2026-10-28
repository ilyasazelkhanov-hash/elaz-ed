/** Production UI with synthetic local API; no production users or external writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright')
const root=path.resolve(__dirname,'..')
;(async()=>{
 const {createAcademyEngine}=await import(pathToFileURL(path.join(root,'src/lib/academy-domain.ts')).href)
 const catalog=JSON.parse(await fs.readFile(path.join(root,'content/ai-academy/catalog.learning.json'),'utf8'))
 let state={...structuredClone(catalog),enrollments:[{user_id:55,course_code:'CORE-000',state:'active'}],placements:[],progress:[],submissions:[],attempts:[],certificates:[],audit:[]}
 const engine=createAcademyEngine(catalog,{load:()=>state,save:v=>state=v}),browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 try{
  const setup=await browser.newPage();await setup.goto('http://127.0.0.1:5173/?demo')
  console.log('browser boot fixture')
  const {fixture,ordinary}=await setup.evaluate(async()=>{const {mockApi}=await import('/src/lib/mock.ts'),fixture=await mockApi.boot();const card=fixture.feed.find(l=>l.kind==='lesson'&&!l.locked);return {fixture,ordinary:await mockApi.lesson(card.id)}})
  fixture.me={...fixture.me,id:55,is_admin:false};ordinary.liked=false;ordinary.likes=34;ordinary.quiz=[];await setup.close()
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
  await context.addInitScript(()=>{window.Telegram={WebApp:{initData:'SYNTHETIC_AUDIT',initDataUnsafe:{user:{id:55,first_name:'Student'}},platform:'android',isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){}}}})
  let failComplete=true,completions=0,delaySave=false,saveStarted,releaseSave
  await context.route('**/telegram.org/**',r=>r.abort())
  await context.route(/\/functions\/v1\/api\//,async route=>{
   const name=new URL(route.request().url()).pathname.split('/').pop(),body=JSON.parse(route.request().postData()||'{}'),send=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}})
   if(name==='boot')return send(fixture)
   if(name==='lesson')return send(ordinary)
   if(name==='like')return send({error:'db'},500)
   if(name!=='academy')return send({})
   if(body.action==='complete'){completions++;if(failComplete){failComplete=false;return send({error:'db'},500)}}
   if(body.action==='submission_save'&&delaySave){saveStarted?.();await new Promise(resolve=>releaseSave=resolve)}
   try{return send(await engine({id:55,is_admin:false},body.action,body.payload))}catch(e){return send({error:e.message},400)}
  })
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))console.log('browser console:',m.text())})
  const quiz=catalog.entities.find(n=>n.kind==='assessment'&&n.parent_code==='CORE-000-M1-L4')
  state.attempts=Array.from({length:4},(_,i)=>({id:'failed'+i,user_id:55,assessment_code:quiz.code,version:quiz.version,state:'failed',score:0}))
  console.log('quiz begins')
  await page.goto('http://127.0.0.1:5180/#/academy/lessons/'+quiz.parent_code)
  const section=page.locator('.academy-lesson-quiz');await section.getByRole('button',{name:'Начать попытку',exact:true}).click()
  for(let i=0;i<quiz.data.questions.length;i++){const q=quiz.data.questions[i];assert.equal(q.type??'mcq','mcq');await section.locator('fieldset').nth(i).locator('input').nth(q.answer).check()}
  await section.getByRole('button',{name:'Проверить ответы',exact:true}).click()
  await section.getByRole('alert').waitFor();assert.equal(state.progress.length,0);assert.equal(state.attempts.length,5)
  await page.reload();await page.locator('.academy-lesson-quiz').getByRole('button',{name:'Завершить занятие',exact:true}).click()
  await page.getByText('Пройдено',{exact:true}).first().waitFor();assert.equal(state.progress.length,1);assert.equal(state.attempts.length,5);assert.equal(completions,2)
  console.log('quiz recovered')
  const assignment=catalog.entities.find(n=>n.kind==='assessment'&&n.code.startsWith('CORE-000')&&n.data.kind==='assignment')
  await page.goto('http://127.0.0.1:5180/#/academy/lessons/'+assignment.parent_code)
  const textarea=page.locator('#assignment-text');await textarea.fill('My saved solution')
  delaySave=true;const started=new Promise(resolve=>saveStarted=resolve)
  await page.getByRole('button',{name:'Сохранить черновик',exact:true}).click();await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(Error('save request did not start')),10000))])
  assert.equal(await textarea.isDisabled(),true);assert.equal(await page.locator('#assignment-url').isDisabled(),true)
  console.log('save disabled')
  releaseSave();await page.getByText('My saved solution',{exact:true}).waitFor();await textarea.waitFor();assert.equal(await textarea.inputValue(),'My saved solution')
  console.log('save retained')
  await page.goto('http://127.0.0.1:5180/?sp=l'+ordinary.id)
  const like=page.getByRole('button',{name:'Нравится',exact:true});await like.waitFor({timeout:5000}).catch(async e=>{await fs.writeFile('/tmp/audit-like-dom.txt',await page.locator('body').innerText());console.error(errors);throw e});await like.click()
  await page.getByText('Ошибка сервера. Попробуй ещё раз',{exact:false}).waitFor({timeout:3000}).catch(()=>{})
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Нравится"] svg')?.getAttribute('fill')==='none')
  assert.match(await like.innerText(),/34/);assert.deepEqual(errors,[])
  console.log(JSON.stringify({quizCompletionRetry:'passed including reload at exhausted limit',draftDuringSave:'disabled and retained',likeFailure:'rolled back to 34',pageErrors:errors}))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)})
