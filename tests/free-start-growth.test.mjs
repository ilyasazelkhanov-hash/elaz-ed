import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {rolldown} from 'rolldown'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
import {guideStartParam,isWarmupStartParam,parseGuideStartParam,WARMUP_ID} from '../src/lib/discovery-events.ts'
import {entryHashFromParam,outsideEntryLinks,publicEntryHash} from '../src/lib/outside-entry.ts'
import {navigationFromHash} from '../src/lib/app-navigation.ts'
import {evaluateGuideAnswer,guideAnswerPresent,initialGuideAnswer} from '../src/lib/guide-interactions.ts'
import {fitTitle,guideCard,isServerShareKind,shareUploadKind,warmupCard} from '../src/lib/shareCard.ts'
import {WARMUP_TOTAL,readWarmup,saveWarmup,warmupSolution,warmupSummary,warmupTasks} from '../src/lib/warmup.ts'

const read=path=>readFile(new URL(path,import.meta.url),'utf8')
const right=q=>q.type==='build'?q.slots.map(slot=>slot.card):q.type==='spot'?q.answer:q.type==='sort'?q.items.map(item=>item.group):q.type==='choice'?q.correct:q.type==='number'?String(q.answer):q.answer

test('a challenge link opens the same guide; the inviter suffix is digits only and never a route',()=>{
 assert.deepEqual(parseGuideStartParam('g_check-answer_r123456789'),{guideId:'check-answer',source:'telegram_guide'})
 assert.deepEqual(parseGuideStartParam('g_check-answer'),{guideId:'check-answer',source:'telegram_guide'})
 for(const input of ['g_check-answer_r','g_check-answer_r0','g_check-answer_rabc','g_check-answer_r12x','g_check-answer_r1_r2','g_check-answer_x1','g_unknown_r5','g__r5','g_check-answer_r'+'9'.repeat(30)])assert.equal(parseGuideStartParam(input),null,input)
 assert.equal(guideStartParam('check-answer'),'g_check-answer')
 // the server reads the inviter from the same parameter with this expression
 assert.equal(/(?:^|_)r(\d+)/.exec('g_check-answer_r123456789')[1],'123456789')
 for(const guide of beginnerGuides)assert.equal(/(?:^|_)r(\d+)/.exec('g_'+guide.id),null,`${guide.id} must not look like an invitation`)
})
test('warm-up has its own entry parameter and public route, apart from the five guides',()=>{
 assert.equal(WARMUP_ID,'warmup');assert.ok(!beginnerGuides.some(guide=>guide.id===WARMUP_ID))
 for(const input of ['g_warmup','g_warmup_r42'])assert.equal(isWarmupStartParam(input),true,input)
 for(const input of ['warmup','g_warmup_','g_warmup_r','g_warmup_rx','g_warmups','x_g_warmup','g_warmup\n',null,{},'g_warmup_r'+'1'.repeat(80)])assert.equal(isWarmupStartParam(input),false,String(input).slice(0,30))
 assert.equal(parseGuideStartParam('g_warmup'),null,'the warm-up never reports guide telemetry')
 assert.equal(publicEntryHash('/courses/start/warmup'),'#/courses/start/warmup')
 assert.deepEqual(navigationFromHash('#/courses/start/warmup'),{tab:'courses',stack:[{type:'learning',path:'/courses/start/warmup'}]})
 const links=outsideEntryLinks(new URL('https://app.test/?sp=g_warmup_r42'))
 assert.deepEqual(links,{telegram:'https://t.me/elazart_bot?start=open_courses_start_warmup',demo:'/?demo#/courses/start/warmup'})
 assert.equal(entryHashFromParam('open_courses_start_warmup'),'#/courses/start/warmup')
 assert.doesNotMatch(JSON.stringify(outsideEntryLinks(new URL('https://app.test/?sp=g_first-request_r42'))),/r42/,'a browser visitor is never relayed with the inviter id')
 assert.equal(outsideEntryLinks(new URL('https://app.test/?sp=g_first-request_r42')).demo,'/?demo#/courses/start/first-request')
})
test('application entry routes both parameters before the generic lesson and course links',async()=>{
 const app=await read('../src/App.tsx')
 assert.match(app,/const warmup = !location\.hash && isWarmupStartParam\(startParam\)/)
 assert.match(app,/else if \(warmup\) \{useStore\.getState\(\)\.setTab\('courses'\);useStore\.getState\(\)\.push\(\{type:'learning',path:'\/courses\/start\/'\+WARMUP_ID\}\)\}/)
 assert.match(app,/!freeGuide && !warmup\) \{/,'an invitation suffix must not be mistaken for a lesson or course id')
})

async function links(state,isDemo){
 const bundle=await rolldown({input:fileURLToPath(new URL('../src/lib/links.ts',import.meta.url)),external:(_id,parent)=>!!parent})
 let code
 try{code=(await bundle.generate({format:'cjs'})).output[0].code}finally{await bundle.close()}
 const module={exports:{}}
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name.endsWith('/store')?{useStore:{getState:()=>state}}:name.endsWith('/api')?{isDemo}:{}})
 return module.exports
}
test('challenge links carry the inviter only for a real account and only to known targets',async()=>{
 const live={meta:{bot:{username:'og_bot',main_app:true}},me:{id:777}}
 let {freeStartLink,appLink}=await links(live,false)
 assert.equal(freeStartLink('check-answer'),'https://t.me/og_bot?startapp=g_check-answer_r777')
 assert.equal(freeStartLink(WARMUP_ID),'https://t.me/og_bot?startapp=g_warmup_r777')
 assert.deepEqual(parseGuideStartParam(new URL(freeStartLink('check-answer')).searchParams.get('startapp')),{guideId:'check-answer',source:'telegram_guide'})
 assert.equal(isWarmupStartParam(new URL(freeStartLink(WARMUP_ID)).searchParams.get('startapp')),true)
 for(const target of ['','../x','a_r5','A','x?y=1','a'.repeat(41)])assert.equal(freeStartLink(target),null,target)
 assert.equal(appLink(12),'https://t.me/og_bot?startapp=l12_r777','the existing lesson link is unchanged')
 ;({freeStartLink}=await links({meta:{bot:{username:'og_bot',main_app:false}},me:{id:1}},true))
 assert.equal(freeStartLink('check-answer'),'https://t.me/og_bot?start=g_check-answer','the demo has no account to credit')
 ;({freeStartLink}=await links({meta:{bot:{username:null,main_app:false}},me:{id:5}},false))
 assert.equal(freeStartLink('check-answer'),null)
 for(const guide of beginnerGuides)assert.ok(`g_${guide.id}_r${'9'.repeat(20)}`.length<=64,'the parameter fits the bot transport')
})

test('guide and warm-up cards state facts only: a self-reported attempt, never XP or a verified skill',()=>{
 const guide=beginnerGuides[3],full=guideCard(guide,{correct:3,total:3},'https://t.me/og_bot?start=g_image-brief_r7')
 assert.equal(full.kind,'guide');assert.equal(full.title,guide.title);assert.equal(full.big,'3 из 3');assert.equal(full.link,'https://t.me/og_bot?start=g_image-brief_r7')
 const partial=guideCard(guide,{correct:1,total:3},null)
 assert.equal(partial.big,undefined,'an unfinished training shows no score');assert.equal(partial.link,undefined);assert.equal(partial.sub,'Попробовал на своей задаче')
 const warm=warmupCard(4,5,null)
 assert.equal(warm.kind,'warmup');assert.equal(warm.big,'4 из 5');assert.match(warm.sub,/с первой попытки/)
 for(const card of [full,partial,warm]){
  assert.doesNotMatch(JSON.stringify(card),/\bXP\b|уровень|сертификат|подтвержд|[—–]/)
  assert.ok(card.caption.length>30&&card.caption.includes('OG CRE8R²'))
 }
 assert.deepEqual(['level','lesson','streak','achievement','guide','warmup'].map(isServerShareKind),[true,true,true,true,false,false])
 assert.deepEqual(['streak','guide','warmup'].map(shareUploadKind),['streak','level','level'],'unknown kinds use the slot the server would pick itself')
})
test('share sheet never asks the server for a bot message it cannot build',async()=>{
 const sheet=await read('../src/screens/ShareSheet.tsx')
 assert.match(sheet,/canShareMessage && !isDemo && isServerShareKind\(card\.kind\) && \(/)
 assert.match(sheet,/if \(!isServerShareKind\(card\.kind\) \|\| !\(await hostedUrl\(\)\)\) return/)
 assert.match(sheet,/api\.shareUpload\(await blobToBase64\(blob\), shareUploadKind\(card\.kind\)\)/)
 assert.match(sheet,/const link = card\.link \?\? appLink\(card\.lessonId\)/,'the card link wins, so a friend lands on the same guide')
})
test('card title shrinks until it fits whole above the footer; cards that fitted before are unchanged',()=>{
 const chars=title=>size=>Math.ceil(title.length*size*.62/900)
 assert.deepEqual(fitTitle(()=>1,0,524),{size:88,line:102},'short titles keep the original size')
 assert.deepEqual(fitTitle(()=>1,312+22+86,524),{size:88,line:102},'the streak card layout is unchanged')
 const long=fitTitle(chars('Обложка: сначала идея, потом генерация'),154+22+86,524)
 assert.ok(long.size<88&&chars('Обложка: сначала идея, потом генерация')(long.size)<=3)
 assert.ok(chars('Обложка: сначала идея, потом генерация')(long.size)*long.line+262<=524)
 assert.deepEqual(fitTitle(()=>9,0,10),{size:50,line:58},'an impossible title falls back to the smallest size and is clipped by the renderer')
})

test('warm-up: five original tasks, one per free guide, each with a single right answer',()=>{
 assert.equal(warmupTasks.length,5);assert.equal(WARMUP_TOTAL,5)
 assert.deepEqual(warmupTasks.map(task=>task.guide),beginnerGuides.map(guide=>guide.id))
 assert.equal(new Set(warmupTasks.map(task=>task.question.type)).size,5,'the warm-up shows five different task formats')
 for(const {question,topic} of warmupTasks){
  assert.ok(topic.length>3&&question.prompt.length>30)
  assert.equal(guideAnswerPresent(question,initialGuideAnswer(question)),question.type==='order')
  assert.equal(evaluateGuideAnswer(question,right(question)).correct,true,question.prompt)
  assert.ok(warmupSolution(question).length>1)
 }
 assert.doesNotMatch(JSON.stringify(warmupTasks),/[—–]/)
 // the expected answers, pinned by meaning so an index slip cannot pass unnoticed
 assert.equal(warmupSolution(warmupTasks[0].question),'Убрать ссылку и отметить, что её пока нет')
 assert.equal(warmupSolution(warmupTasks[1].question),'5%');assert.equal(45/900*100,5)
 assert.equal(warmupSolution(warmupTasks[2].question),'Помощник: черновик письма клиенту, план встречи на 30 минут, пересказ своей заметки. Поиск: действующая редакция правила, цена тарифа на сегодня')
 assert.equal(warmupSolution(warmupTasks[3].question),'Где будет стоять: Карточка в ленте телефона, вертикальный формат; Главная идея: Человек превращает три строки задания в черновик; Ограничения: Без букв, логотипов и мелких деталей')
 assert.equal(warmupSolution(warmupTasks[4].question),'«Клиент: Айдар С., телефон +7 700 000 00 00.» «Договор 4471-К, долг 380 000 тенге.»')
})
test('free guide hands-on answers are pinned by meaning as well',async()=>{
 const {guideInteractions}=await import('../src/lib/guide-interactions.ts')
 assert.equal(warmupSolution(guideInteractions['first-request'][1]),'Для кого: Для новичков, которые ещё не пробовали ИИ; Что известно: Суббота, 18:00 по Алматы, онлайн, 30 минут, 10 мест, бесплатно; Какой результат нужен: Анонс до 500 знаков без ссылок и обещаний')
 assert.equal(warmupSolution(guideInteractions['check-answer'][0]),'«Она пройдёт 14 марта в 19:00 по Алматы.» «По данным исследования, 73% новичков бросают ИИ за первую неделю.» «Записаться можно по ссылке example.org/start.»')
 assert.equal(warmupSolution(guideInteractions['choose-tool'][1]),'Сервис: загрузка файлов и экспорт ответа, лимит сообщений на тарифе, история чатов и папки проектов. Модель: насколько связно получается текст, как справляется с длинным рассуждением')
 assert.equal(warmupSolution(guideInteractions['image-brief'][0]),'«Покажи сразу три идеи: чат, робота и графики.» «По краям добавь много мелких значков и подписей.»')
 assert.equal(warmupSolution(guideInteractions['safe-workflow'][0]),'Оставить: тема и формат встречи, нужный объём текста. Заменить: телефон клиента, фамилия и диагноз пациента, номер договора')
})
test('warm-up result counts first attempts and points to the first missed topic, without a grade',()=>{
 assert.deepEqual(warmupSummary([true,true,true,true,true]),{score:5,total:5,next:null,title:'Все пять с первой попытки',text:'Основа есть. Разборы пригодятся как практика на своей задаче: в каждом ты собираешь собственный результат.'})
 const mixed=warmupSummary([true,false,true,false,true])
 assert.equal(mixed.score,3);assert.equal(mixed.next,'check-answer');assert.equal(mixed.title,'Хорошая база');assert.match(mixed.text,/«Как проверить ответ ИИ»: это 6 минут/)
 const low=warmupSummary([false,false,false,false,true])
 assert.equal(low.score,1);assert.equal(low.next,'first-request');assert.equal(low.title,'Отличный момент начать')
 assert.equal(warmupSummary([]).score,0);assert.equal(warmupSummary([1,'yes',null,{},true]).score,1,'only real true marks count')
 for(const marks of [[true,true,true,true,true],[false,false,false,false,false]])assert.doesNotMatch(JSON.stringify(warmupSummary(marks)),/уровень|оценка|навык подтверждён|XP/)
})
test('last warm-up result is local, per account and mode, and survives corrupt or blocked storage',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>{map.set(key,String(value))}}
 assert.equal(readWarmup('live:1',storage),null)
 assert.equal(saveWarmup('live:1',[true,false,true,true,false],storage),true)
 assert.deepEqual(readWarmup('live:1',storage),{score:3,total:5,marks:[true,false,true,true,false]})
 assert.equal(readWarmup('demo:1',storage),null);assert.equal(readWarmup('live:2',storage),null)
 assert.deepEqual(Object.keys(JSON.parse(map.get('og:warmup:v1:live:1'))).sort(),['marks','score','total'],'no answers, text or timestamps are stored')
 for(const raw of ['broken','[]',JSON.stringify({score:5,total:5,marks:[true]}),JSON.stringify({score:5,total:4,marks:[true,true,true,true]}),JSON.stringify({total:5,marks:[1,1,1,1,1]}),'x'.repeat(500)]){map.set('og:warmup:v1:live:3',raw);assert.equal(readWarmup('live:3',storage),null,raw.slice(0,30))}
 map.set('og:warmup:v1:live:4',JSON.stringify({score:99,total:5,marks:[true,false,false,false,false]}))
 assert.equal(readWarmup('live:4',storage).score,1,'the score is recounted from the marks')
 const blocked={getItem(){throw Error('SecurityError')},setItem(){throw Error('QuotaExceeded')}}
 assert.equal(saveWarmup('live:5',[true,true,false,false,false],blocked),false)
 assert.equal(readWarmup('live:5',blocked).score,2,'the session still shows the result it just produced')
})

/** Actual Warmup with a tiny hook runtime: local modules come from the harness, packages from disk. */
async function warmupHarness(){
 const {transformWithOxc}=await import('vite')
 const load=async path=>{
  const file=new URL(path,import.meta.url)
  let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
  code=code.replace(/import ["'][^"']+\.css["'];?/g,'')
  code=code.replace(/import\s*\{([^}]*)\}\s*from\s*["'](?:react|\.{1,2}\/[^"']+)["'];?/g,(_match,names)=>`const {${names}}=globalThis.__warmup;`)
  for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
  return import(`data:text/javascript;base64,${Buffer.from(code+'\n//'+Math.random()).toString('base64')}`)
 }
 const interactions=await import('../src/lib/guide-interactions.ts'),sparks=await import('../src/lib/practice-sparks.ts'),warm=await import('../src/lib/warmup.ts'),cards=await import('../src/lib/shareCard.ts')
 let index=0,states=[]
 const log=[],shared=[],scroller={scrollTo:options=>log.push(['scroll',options.top])}
 const useStore={setState:patch=>shared.push(patch.share)}
 globalThis.__warmup={...interactions,...sparks,...warm,...cards,beginnerGuides,WARMUP_ID,useStore,Tap(){},freeStartLink:target=>`https://t.me/og_bot?start=g_${target}_r7`,
  useSparks:scope=>sparks.readSparks(scope),answerEffect:(correct,combo)=>log.push(['answer',correct,combo]),finishEffect:()=>log.push(['finish']),
  useId:()=>':warmup:',useRef:()=>({current:{focus(){},closest:()=>scroller}}),
  useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}}
 globalThis.__warmup.GuideTaskInput=(await load('../src/screens/home/GuideTask.tsx')).GuideTaskInput
 const {Warmup}=await load('../src/screens/home/Warmup.tsx')
 const {GuideTaskInput}=globalThis.__warmup
 const nodes=t=>{if(t&&typeof t==='object'&&t.type===GuideTaskInput)t=t.type(t.props);return !t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]}
 const label=n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string'||typeof x==='number').join('')
 const text=tree=>nodes(tree).map(n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string'||typeof x==='number').join('')).join(' ').replace(/\s+/g,' ')
 const task=tree=>[nodes(tree).find(n=>n.type==='fieldset'&&n.props.className==='guide-journey-question').props.children].flat(Infinity).find(n=>n?.props?.question)
 return {Warmup,nodes,label,text,task,log,shared,sparks,warm,reset(){states=[]},render(props){index=0;const element=Warmup(props);return element.type(element.props)}}
}
test('actual warm-up: one attempt per task, the answer locks, the result is saved and can be shared',async()=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn()
 try{
  const h=await warmupHarness(),opened=[],went=[]
  const props={scope:'live:warm',go:path=>went.push(path),openGuide:id=>opened.push(id)}
  const press=(tree,name)=>h.nodes(tree).find(n=>h.label(n)===name).props.onClick()
  let tree=h.render(props)
  assert.match(h.text(tree),/Без регистрации, таймера и оценок/);assert.match(h.text(tree),/Это не XP и не подтверждение навыка/)
  press(tree,'Начать разминку')
  const marks=[true,false,true,true,false]
  for(let i=0;i<5;i++){
   const question=h.warm.warmupTasks[i].question
   tree=h.render(props)
   assert.match(h.text(tree),new RegExp(`Задание ${i+1} из 5`))
   assert.equal(h.nodes(tree).find(n=>h.label(n)==='Проверить ответ').props.disabled,true,'an untouched task cannot be checked')
   assert.equal(h.task(tree).props.locked,false)
   h.task(tree).props.onChange(marks[i]?right(question):question.type==='number'?'20':question.type==='spot'?[0]:initialGuideAnswer(question))
   tree=h.render(props)
   press(tree,'Проверить ответ');tree=h.render(props)
   assert.ok(h.nodes(tree).some(n=>h.label(n)===(marks[i]?'Верно':'Не сошлось')))
   assert.equal(h.text(tree).includes('Верный ответ: '),!marks[i],'the expected answer appears only after a missed attempt')
   assert.equal(h.task(tree).props.locked,true,'the single attempt is spent')
   assert.ok(h.nodes(tree).filter(n=>n.type==='input').every(n=>n.props.disabled===true))
   assert.ok(!h.nodes(tree).some(n=>h.label(n)==='Попробовать ещё'||h.label(n)==='Проверить ответ'))
   press(tree,i===4?'К результату':'Дальше')
  }
  tree=h.render(props)
  assert.match(h.text(tree),/Хорошая база/);assert.match(h.text(tree),/Начни с разбора «Как проверить ответ ИИ»/)
  assert.deepEqual(h.warm.readWarmup('live:warm'),{score:3,total:5,marks})
  assert.equal(h.sparks.readSparks('live:warm').total,30,'three first-try answers, no finish bonus for an incomplete run')
  assert.match(h.text(tree),/\+30 искр за эту разминку/);assert.match(h.text(tree),/Это разминка, не аттестация/)
  assert.deepEqual(h.log.filter(row=>row[0]==='answer').map(row=>row[1]),marks);assert.equal(h.log.filter(row=>row[0]==='finish').length,1)
  press(tree,'Поделиться результатом')
  assert.equal(h.shared.length,1);assert.equal(h.shared[0].kind,'warmup');assert.equal(h.shared[0].big,'3 из 5');assert.equal(h.shared[0].link,'https://t.me/og_bot?start=g_warmup_r7')
  h.nodes(tree).find(n=>n.props?.className==='free-start-finale-next').props.onClick();assert.deepEqual(opened,['check-answer'])
  // a repeat is allowed, pays nothing for solved tasks and a returning visitor sees the stored result first
  h.reset();tree=h.render(props)
  assert.match(h.text(tree),/Хорошая база/);assert.doesNotMatch(h.text(tree),/за эту разминку/,'a stored result claims no fresh points')
  press(tree,'Пройти ещё раз');tree=h.render(props);assert.match(h.text(tree),/Задание 1 из 5/)
  h.task(tree).props.onChange(right(h.warm.warmupTasks[0].question));tree=h.render(props);press(tree,'Проверить ответ')
  assert.equal(h.sparks.readSparks('live:warm').total,30)
  tree=h.render(props);press(tree,'Выйти');tree=h.render(props)
  assert.match(h.text(tree),/Хорошая база/,'leaving a run keeps the last finished result');assert.equal(h.warm.readWarmup('live:warm').score,3)
 }finally{delete globalThis.__warmup;globalThis.requestAnimationFrame=previous}
})
