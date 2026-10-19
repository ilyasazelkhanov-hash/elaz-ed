// The real browser HTTP adapter is bridged to local PostgreSQL, never production.
import { chromium, expect as baseExpect } from '@playwright/test'
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
const {PGlite}=createRequire(new URL('../../package.json',import.meta.url))('@electric-sql/pglite')
const expect=baseExpect.configure({timeout:20000})
const db=new PGlite()
const browser=await chromium.launch({executablePath:process.env.AZ_CHROME_PATH||undefined})
const base=process.env.OG_URL||'http://127.0.0.1:5181/'
const checks=[],errors=[],requests=[]
await mkdir('test-results',{recursive:true})
const rpc=async(user,action,payload={})=>(await db.query('select academy_action($1,$2,$3::jsonb) as value',[user,action,JSON.stringify(payload)])).rows[0].value
const node=(code,kind,parent_code=null,data={},position=0)=>({code,kind,parent_code,title:code,position,state:'draft',version:1,data,seed_managed:true})
try {
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
 for(const file of ['001_init.sql','006_courses_stars_freezes.sql','20261018080000_ai_academy.sql','20261018150000_ai_academy_completion.sql','20261018170000_ai_academy_files.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
 await db.exec(`insert into users(id) values(1),(2);insert into settings(key,value) values('admins','{"owner":1}');`)
 const entities=[node('B-D','direction'),node('B-C','course','B-D',{level:'Core',outcome:'Учебный тестовый результат'}),node('B-M','module','B-C'),node('B-L','lesson','B-M',{format:'microlecture',content_blocks:[{type:'markdown',text:'Авторский материал только для проверки учебного сценария.'}]}),node('B-Q','assessment','B-L',{kind:'quiz',questions:[{id:'q1',prompt:'Два плюс два?',choices:['Три','Четыре'],answer:1},{id:'q2',type:'multi',prompt:'Выбери системы контроля версий',choices:['Git','Mercurial','Figma'],answer:[0,1]},{id:'q3',type:'text',prompt:'Название протокола',answer:'MCP'},{id:'q4',type:'code',prompt:'SQL константа',answer:'SELECT 1;'}]}),node('B-R','rubric',null,{criteria:[{code:'quality',max_score:100}],critical_gates:['no_secrets']}),node('B-CAP','assessment','B-C',{kind:'capstone',rubric_code:'B-R',instructions:'Передайте ссылку на тестовый проект.'},1)]
 await rpc(1,'admin_import',{entities,links:[],prerequisites:[],dry_run:false})
 await rpc(2,'enroll',{code:'B-C'})
 for(const code of ['B-Q','B-R','B-CAP','B-L','B-M','B-C']){
  for(const state of ['approved','published']){
   const entity=(await db.query('select * from aa_nodes where code=$1',[code])).rows[0]
   await rpc(1,'admin_save',{entity:{...entity,state},expected_version:entity.version})
  }
 }
 async function makePage(user){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'})
  page.on('pageerror',e=>errors.push(String(e)))
  await page.route('https://telegram.org/js/**',route=>route.fulfill({body:'',contentType:'application/javascript'}))
  await page.addInitScript(()=>{window.Telegram={WebApp:{initData:'local-test-only',initDataUnsafe:{},platform:'android',isVersionAtLeast:()=>false,BackButton:{show(){},hide(){},onClick(fn){window.__academyBack=fn},offClick(){}}}}})
  await page.route('**/*',async route=>{
   const request=route.request()
   if(request.method()!=='POST')return route.continue()
   const path=new URL(request.url()).pathname,body=request.postDataJSON()
   const headers={'access-control-allow-origin':'*'}
   if(path.endsWith('/boot'))return route.fulfill({headers,json:{status:'ok',me:{id:user,name:`Тест ${user}`,username:null,photo:null,xp:0,streak:0,best_streak:0,daily_claimed:true,lessons_done:0,is_admin:user===1,achievements:[],rank:1,invited:0,freezes:0},feed:[],courses:[],channel:{title:null,invite:null},bot:{username:null,main_app:false}}})
   if(path.endsWith('/academy_public')){
    const key=body.action==='certificate_public'?body.payload.code:body.payload.slug
    const result=body.action==='certificate_public'?(await db.query('select academy_certificate_public($1) value',[key])).rows[0].value:(await db.query("select academy_portfolio(null,'public',$1::jsonb) value",[JSON.stringify({slug:key})])).rows[0].value
    return route.fulfill({headers,json:result})
   }
   if(path.endsWith('/academy')){
    requests.push({user,action:body.action})
    try{const result=body.action.startsWith('portfolio_')?(await db.query('select academy_portfolio($1,$2,$3::jsonb) value',[user,body.action.slice(10),JSON.stringify(body.payload||{})])).rows[0].value:await rpc(user,body.action,body.payload||{});return route.fulfill({headers,json:result})}
    catch(error){return route.fulfill({headers,status:400,json:{error:String(error.message).match(/academy_[a-z_]+/)?.[0]||'academy_invalid_payload'}})}
   }
   return route.fulfill({headers,json:{}})
  })
  return page
 }
 const student=await makePage(2)
 await student.goto(`${base}#/academy/courses/B-C`,{waitUntil:'domcontentloaded'})
 await student.getByRole('button',{name:'Начать обучение',exact:true}).click()
 await expect(student.getByRole('button',{name:'Продолжить обучение',exact:false})).toBeVisible()
 checks.push('published waitlisted course activates real enrollment')
 await student.getByRole('button',{name:'Продолжить обучение',exact:false}).click()
 await expect(student.getByText('Авторский материал только для проверки учебного сценария.',{exact:true})).toBeVisible()
 await student.getByRole('button',{name:'Начать попытку',exact:true}).click()
 await student.getByRole('radio',{name:'Четыре',exact:true}).check()
 await student.getByRole('checkbox',{name:'Git',exact:true}).check()
 await student.getByRole('checkbox',{name:'Mercurial',exact:true}).check()
 await student.getByRole('textbox',{name:'Название протокола',exact:true}).fill('mcp')
 await student.getByRole('textbox',{name:'SQL константа',exact:true}).fill('SELECT 1;')
 await student.getByRole('button',{name:'Проверить ответы',exact:true}).click()
 await expect.poll(async()=>(await db.query('select count(*)::int n from aa_progress where user_id=2')).rows[0].n).toBe(1)
 checks.push('real SQL quiz grade completes lesson without client score')
 await student.evaluate(()=>{location.hash='/academy/assessments/B-CAP'})
 await student.getByLabel('Описание решения',{exact:true}).fill('Версия один — собственный тестовый артефакт')
 await student.getByRole('button',{name:'Отправить на проверку →',exact:true}).click()
 await expect.poll(async()=>(await db.query("select count(*)::int n from aa_submissions where state='submitted'")).rows[0].n).toBe(1)
 const admin=await makePage(1)
 await admin.goto(`${base}#/academy/admin/review`,{waitUntil:'domcontentloaded'})
 await admin.getByRole('spinbutton',{name:'Баллы: quality',exact:true}).fill('50')
 await admin.getByLabel('Обратная связь студенту',{exact:true}).fill('Добавьте описание проверки результата')
 await admin.getByRole('button',{name:'На доработку',exact:true}).click()
 await expect.poll(async()=>(await db.query('select state from aa_submissions order by id desc limit 1')).rows[0].state).toBe('needs_revision')
 await student.reload({waitUntil:'domcontentloaded'})
 await student.getByLabel('Описание решения',{exact:true}).fill('Версия два — добавлена проверка результата')
 await student.getByRole('button',{name:'Отправить на проверку →',exact:true}).click()
 await expect.poll(async()=>(await db.query("select max(version)::int n from aa_submissions where state='submitted'")).rows[0].n).toBe(2)
 await admin.reload({waitUntil:'domcontentloaded'})
 await admin.getByRole('spinbutton',{name:'Баллы: quality',exact:true}).fill('90')
 await admin.getByRole('checkbox',{name:'no_secrets',exact:true}).check()
 await admin.getByLabel('Обратная связь студенту',{exact:true}).fill('Работа принята по сохранённой рубрике')
 await admin.getByRole('button',{name:'Зачесть',exact:true}).click()
 await expect.poll(async()=>(await db.query("select count(*)::int n from aa_submissions where state='passed'")).rows[0].n).toBe(1)
 checks.push('submission V1 → independent review → revision V2 → passed')
 await student.evaluate(()=>{location.hash='/academy/courses/B-C'})
 await student.getByRole('button',{name:'Получить подтверждение',exact:true}).click()
 await expect.poll(async()=>(await db.query('select count(*)::int n from aa_certificates')).rows[0].n).toBe(1)
 checks.push('server-issued certificate requires completed lessons and reviewed capstone')
 await student.evaluate(()=>{location.hash='/academy/my-learning'})
 await student.getByRole('checkbox',{name:'Я согласен опубликовать эту работу по общедоступной ссылке.',exact:true}).check()
 await student.getByRole('button',{name:'Опубликовать работу',exact:true}).click()
 await expect(student.getByRole('link',{name:'Открыть публичную работу',exact:true})).toBeVisible()
 const portfolio=(await db.query('select slug from aa_portfolio where revoked_at is null')).rows[0].slug
 const certificate=(await db.query('select code from aa_certificates')).rows[0].code
 const publicPage=await makePage(0)
 await publicPage.goto(`${base}academy/verify/${certificate}`,{waitUntil:'domcontentloaded'})
 await expect(publicPage.getByText('Подтверждение действительно',{exact:true})).toBeVisible()
 await publicPage.goto(`${base}academy/portfolio/${portfolio}`,{waitUntil:'domcontentloaded'})
 await expect(publicPage.getByText('Версия два — добавлена проверка результата',{exact:true})).toBeVisible()
 expect(await publicPage.locator('body').innerText()).not.toContain('Тест 2')
 await student.getByRole('button',{name:'Отозвать публикацию',exact:true}).click()
 await expect.poll(async()=>(await db.query('select revoked_at from aa_portfolio where slug=$1',[portfolio])).rows[0].revoked_at).not.toBeNull()
 checks.push('consented portfolio and certificate public pages work without Telegram login; publication revokes')
 await publicPage.close()
 await student.screenshot({path:'test-results/academy-server-course.png'})
 expect(errors).toEqual([])
 await writeFile('test-results/academy-server-browser.json',JSON.stringify({checks,errors,requests},null,2))
 console.log(JSON.stringify({checks,errors},null,2))
 await student.close();await admin.close()
}catch(error){
 for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:`test-results/academy-server-failure-${browser.contexts().indexOf(context)}.png`}).catch(()=>{})
 throw error
}finally{await browser.close();await db.close()}
