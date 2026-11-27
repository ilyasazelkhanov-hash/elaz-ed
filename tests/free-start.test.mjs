import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {beginnerGuides,beginnerGlossary} from '../src/lib/beginner-content.ts'

test('free start has five standalone usable exercises, without copying a paid course body',async()=>{
 assert.equal(beginnerGuides.length,5)
 assert.equal(new Set(beginnerGuides.map(guide=>guide.id)).size,5)
 const paid=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url),'utf8'))
 for(const guide of beginnerGuides){
  assert.match(guide.id,/^[a-z-]+$/)
  assert.ok(guide.minutes>=3&&guide.minutes<=10)
  assert.equal(guide.steps.length,3)
  assert.equal(guide.checks.length,3)
  for(const value of [guide.intro,guide.result,guide.prompt,guide.example,guide.task])assert.ok(value.length>40,guide.id)
  for(const lesson of paid.courses.flatMap(course=>course.lessons))assert.ok(!lesson.body.includes(guide.prompt),guide.id)
 }
 assert.match(beginnerGuides.find(guide=>guide.id==='check-answer').example,/6%/)
 assert.ok(beginnerGlossary.every(([term,definition])=>term.length>3&&definition.length>30))
})

test('targeted worked examples teach correction without pretending to grade the learner',()=>{
 const examples=beginnerGuides.filter(guide=>guide.workedExample)
 assert.deepEqual(examples.map(guide=>guide.id),['first-request','check-answer'])
 for(const guide of examples){
  const example=guide.workedExample
  for(const field of ['question','weak','issue','improved','explanation'])assert.ok(example[field].length>30,`${guide.id}:${field}`)
  assert.equal(example.hints.length,3)
  assert.ok(example.hints.every(hint=>hint.length>60))
  assert.doesNotMatch(JSON.stringify(example),/[—–]/)
  assert.notEqual(example.improved,guide.prompt,'worked comparison is not another copy of the prompt')
 }
 const check=examples.find(guide=>guide.id==='check-answer').workedExample
 assert.match(check.improved,/12 \/ 200 × 100 = 6%/)
 assert.match(check.improved,/нельзя определить окупаемость/)
 assert.match(examples[0].workedExample.explanation,/не гарантирует/)
})

const rgb=hex=>hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255)
const luminance=hex=>rgb(hex).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05)}
test('main action and success text color pairs remain readable in both themes',async()=>{
 const css=await readFile(new URL('../src/index.css',import.meta.url),'utf8')
 const light=css.slice(css.indexOf(":root[data-theme='light']"))
 const dark=css.slice(0,css.indexOf(":root[data-theme='light']"))
 const color=(source,name)=>new RegExp('--color-'+name+':\\s*(#[a-f0-9]{6})','i').exec(source)?.[1]
 for(const source of [dark,light]){
  assert.ok(contrast(color(source,'violet'),color(source,'on-violet'))>=4.5)
  assert.ok(contrast(color(source,'success'),color(source,'card'))>=4.5)
  assert.ok(contrast(color(source,'success'),color(source,'bg'))>=4.5)
 }
})

/** Real FreeStart and GuideFinale with real React; every other local module comes from the harness. */
async function freeStartHarness(overrides={}){
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react')
 const load=async path=>{
  const file=new URL(path,import.meta.url)
  let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
  code=code.replace(/import ["'][^"']+\.css["'];?/g,'')
  code=code.replace(/import\s*\{([^}]*)\}\s*from\s*["']\.{1,2}\/[^"']+["'];?/g,(_match,names)=>`const {${names}}=globalThis.__freeStartHarness;`)
  for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
  assert.doesNotMatch(code,/from ["']\.{1,2}\//,'every local import is supplied by the harness')
  return import(`data:text/javascript;base64,${Buffer.from(code+'\n//'+Math.random()).toString('base64')}`)
 }
 const events=await import('../src/lib/discovery-events.ts'),interactions=await import('../src/lib/guide-interactions.ts'),artifacts=await import('../src/lib/practice-artifact.ts'),cards=await import('../src/lib/shareCard.ts'),sparks=await import('../src/lib/practice-sparks.ts'),warmup=await import('../src/lib/warmup.ts')
 const calls=[],state={share:null}
 const useStore=selector=>selector({me:{id:42}});useStore.getState=()=>({navigateTab:tab=>calls.push(['tab',tab]),toast(){}});useStore.setState=patch=>Object.assign(state,patch)
 globalThis.__freeStartHarness={...events,...interactions,...artifacts,...cards,sparksWord:sparks.sparksWord,sparksEnabled:sparks.sparksEnabled,readWarmup:()=>null,beginnerGlossary,beginnerGuides,
  GuideJourney:({children})=>createElement('div',{className:'free-start-steps'},children),PracticeArtifact:()=>null,Warmup:()=>createElement('div',{'data-warmup':'stub'}),
  readLastFreeGuide:()=>null,saveLastFreeGuide(){},freeStartLink:target=>`https://t.me/test_bot?start=g_${target}_r42`,useSparks:()=>({total:0,best:0}),
  track(){},copyText:async()=>true,startParam:'',useStore,isDemo:false,guideDoneEffect:()=>calls.push(['celebrate']),Tap:({children,feedback:_feedback,...props})=>createElement('button',props,children),...overrides}
 globalThis.__freeStartHarness.GuideFinale=(await load('../src/screens/home/GuideFinale.tsx')).GuideFinale
 return {...await load('../src/screens/home/FreeStart.tsx'),calls,state,warmup,createElement}
}
test('free guides expose tool access conditions before practice and a safe concrete action',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/FreeStart.tsx',import.meta.url)
 try{
  const {FreeStart,createElement}=await freeStartHarness()
  for(const guide of beginnerGuides){
   const html=renderToStaticMarkup(createElement(FreeStart,{path:'/start/'+guide.id,go(){}}))
   assert.ok(html.includes(guide.editorial.access_note),guide.id)
   assert.ok(html.indexOf(guide.editorial.access_note)<html.indexOf('free-start-steps'))
   assert.match(html,/href="https:\/\/chatgpt.com\/" target="_blank" rel="noopener noreferrer"/)
   assert.match(html,/подписка для этого разбора не нужна/)
   assert.match(html,/Данные бери вымышленные или обезличенные/)
   assert.match(html,/Это не проверка результата, без оценки и XP/)
   if(guide.workedExample){
    assert.match(html,/Найди слабое место/)
    assert.match(html,/<details><summary tabindex="0">Посмотреть разбор и улучшенный вариант<\/summary>/)
    assert.match(html,/<details><summary tabindex="0">Если застрял на своей задаче<\/summary>/)
    assert.ok(!html.includes('<details open'))
    assert.ok(html.includes(guide.workedExample.improved))
    assert.match(html,/не оценка твоей работы/)
    assert.ok(!html.includes(guide.example),'old prose example is replaced, not duplicated')
   }else{
    assert.ok(html.includes(guide.example))
    assert.ok(!html.includes('Найди слабое место'))
   }
  }
 }finally{delete globalThis.__freeStartHarness}
 const source=await readFile(file,'utf8')
 assert.match(source,/initialPractice=\{path\.split\('\/'\)\.filter\(Boolean\)\[2\] === 'work'\}/)
 assert.match(source,/navigateTab\('blog'\)/)
 assert.doesNotMatch(source,/store\.pop\(\);store\.setTab/)
})

test('start screen is one route: the main action continues from the next untried guide',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server'),sparks=await import('../src/lib/practice-sparks.ts')
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=new Map()
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))}})
 const text=html=>html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')
 const states=html=>[...html.matchAll(/class="free-start-card" data-state="(\w+)"/g)].map(match=>match[1])
 try{
  let {FreeStart,createElement}=await freeStartHarness()
  let html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
  assert.deepEqual(states(html),['current','idle','idle','idle','idle'],'a newcomer sees five open steps and one suggestion')
  assert.match(text(html),/Сделать первый запрос/);assert.doesNotMatch(html,/Продолжить:/)
  assert.match(text(html),/0 из 5 разборов попробовано/);assert.match(html,/class="free-start-warmup"/)
  assert.doesNotMatch(html,/disabled=""/,'no step is locked')
  // two guides tried: the action names the third one instead of restarting the first
  storage.set('og:free-start:v2:live:42',JSON.stringify(['first-request','check-answer','unknown']))
  ;({FreeStart,createElement}=await freeStartHarness())
  html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
  assert.deepEqual(states(html),['tried','tried','current','idle','idle'])
  assert.match(text(html),/Продолжить: Как выбрать инструмент без путаницы/);assert.doesNotMatch(text(html),/Сделать первый запрос/)
  assert.match(text(html),/2 из 5 разборов попробовано/);assert.equal((html.match(/Попробовано/g)||[]).length,2)
  assert.match(html,/free-start-card-status">Следующий шаг</)
  // the guide opened last wins while it is untried; solved training tasks are shown as a place, not a grade
  const interactions=await import('../src/lib/guide-interactions.ts'),guide=beginnerGuides[3],questions=interactions.guideInteractions[guide.id]
  const answers=questions.map((question,index)=>index===0?question.answer:interactions.initialGuideAnswer(question))
  interactions.saveGuideJourney(interactions.guideJourneyKey('live:42',guide.id,[guide.steps,questions]),{step:1,answers,checked:[true,false,false]},questions)
  ;({FreeStart,createElement}=await freeStartHarness({readLastFreeGuide:()=>'image-brief'}))
  html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
  assert.deepEqual(states(html),['tried','tried','idle','current','idle'])
  assert.match(text(html),/Продолжить: Обложка: сначала идея, потом генерация/);assert.match(html,/free-start-card-status">Тренировка: 1 из 3</)
  // everything tried: no fake sixth step, the action leads to the paid programmes
  storage.set('og:free-start:v2:live:42',JSON.stringify(beginnerGuides.map(item=>item.id)))
  ;({FreeStart,createElement}=await freeStartHarness())
  html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
  assert.deepEqual(states(html),['tried','tried','tried','tried','tried']);assert.match(text(html),/Все пять попробованы\. Посмотреть курсы/)
  // local points are named apart from XP wherever the total is shown
  ;({FreeStart,createElement}=await freeStartHarness({useSparks:()=>({total:42,best:3})}))
  html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
  assert.match(text(html),/42 искры/);assert.match(html,/Это не XP и не уровень/);assert.match(html,/Лучшая серия верных ответов подряд: 3/)
  // the whole layer has one switch: without it the screen shows no local points at all
  sparks.configureSparks({enabled:false})
  try{
   ;({FreeStart,createElement}=await freeStartHarness({useSparks:()=>({total:42,best:3})}))
   html=renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))
   assert.doesNotMatch(html,/искр|free-start-sparks/);assert.match(text(html),/5 из 5 разборов попробовано/)
  }finally{sparks.configureSparks({enabled:true})}
  // another account or the demo never sees these marks
  ;({FreeStart,createElement}=await freeStartHarness({isDemo:true}))
  assert.deepEqual(states(renderToStaticMarkup(createElement(FreeStart,{path:'/start',go(){}}))),['current','idle','idle','idle','idle'])
 }finally{delete globalThis.__freeStartHarness;if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage}
})

test('guide finale states what was done, keeps the mark a self-report and offers one next step',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server'),{createElement}=await import('react')
 globalThis.__freeStartHarness={Tap:({children,feedback:_feedback,...props})=>createElement('button',props,children)}
 try{
  const {transformWithOxc}=await import('vite'),file=new URL('../src/screens/home/GuideFinale.tsx',import.meta.url)
  let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
  code=code.replace(/import\s*\{([^}]*)\}\s*from\s*["']\.{1,2}\/[^"']+["'];?/g,(_match,names)=>`const {${names}}=globalThis.__freeStartHarness;`)
  for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
  const {GuideFinale}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const base={done:false,trained:{correct:1,total:3},work:'empty',demo:false,next:{title:'Как проверить ответ ИИ',minutes:6},telegramLink:'https://t.me/test_bot?start=g_check-answer',onMark(){},onShare(){},onNext(){}}
  const render=props=>renderToStaticMarkup(createElement(GuideFinale,{...base,...props}))
  let html=render({})
  assert.match(html,/Заверши разбор/);assert.match(html,/Тренировка: 1 из 3 заданий/);assert.match(html,/Своя работа: пока не сохранена/)
  assert.equal((html.match(/ещё не сделано/g)||[]).length,2,'state is text for screen readers, not colour alone')
  assert.match(html,/aria-pressed="false"[^>]*>.*Я попробовал/);assert.match(html,/Это не проверка результата, без оценки и XP/)
  assert.doesNotMatch(html,/Поделиться|Следующий бесплатный шаг|t\.me/,'sharing and the next step appear after the learner marks the attempt')
  html=render({done:true,trained:{correct:3,total:3},work:'self_checked'})
  assert.match(html,/Разбор пройден/);assert.match(html,/Своя работа: сохранена, самопроверка выполнена/);assert.equal((html.match(/ - сделано/g)||[]).length,2)
  assert.match(html,/aria-pressed="true"[^>]*>.*Попробовал · отменить отметку/);assert.match(html,/Поделиться и позвать друга/)
  assert.match(html,/Следующий бесплатный шаг · 6 мин<\/small>Как проверить ответ ИИ/)
  assert.doesNotMatch(html,/t\.me/,'the Telegram prompt is for the browser demo only')
  html=render({done:true,demo:true})
  assert.match(html,/href="https:\/\/t\.me\/test_bot\?start=g_check-answer" target="_blank" rel="noopener noreferrer"/);assert.match(html,/Демо не переносит отметки в Telegram/)
  assert.doesNotMatch(render({done:true,next:undefined}),/Следующий бесплатный шаг/)
  assert.doesNotMatch(await readFile(file,'utf8'),/сертификат выдан|навык подтверждён|\+\d+ XP/,'the finale never claims a credential or server points')
 }finally{delete globalThis.__freeStartHarness}
})

test('worked example disclosures remain reachable through the real FocusLayer Tab handler',async()=>{
 const {transformWithOxc}=await import('vite')
 const file=new URL('../src/FocusLayer.tsx',import.meta.url)
 const source=await readFile(new URL('../src/screens/home/FreeStart.tsx',import.meta.url),'utf8')
 assert.match(source,/<summary tabIndex=\{0\}>Посмотреть/)
 assert.match(source,/<summary tabIndex=\{0\}>Если застрял/)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{([^}]+)\} from ["'](?:react|motion\/react)["'];?/g,(_m,names)=>`const {${names}} = globalThis.__freeFocusHarness;`)
 code=code.replaceAll('from "react/jsx-runtime"',`from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`)
 const handlers=new Map();let ref=0,open=false
 class Element {
  constructor(name,inside=false){this.name=name;this.tabIndex=0;this.inside=inside}
  closest(){return null} matches(){return false}
  getClientRects(){return this.inside&&!open?[]:[{}]}
  focus(){globalThis.document.activeElement=this}
 }
 const first=new Element('close'),solution=new Element('solution-summary'),inside=new Element('inside',true),hints=new Element('hints-summary'),last=new Element('practice')
 const items=[first,solution,inside,hints,last]
 const root={querySelectorAll(selector){assert.match(selector,/\[tabindex\]/);return items},contains:element=>items.includes(element),focus(){}}
 const previous={document:globalThis.document,HTMLElement:globalThis.HTMLElement}
 globalThis.HTMLElement=Element
 globalThis.document={activeElement:solution,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)}
 globalThis.__freeFocusHarness={useRef:value=>({current:ref++===0?root:value}),useLayoutEffect:fn=>fn(),useIsPresent:()=>true,motion:{div:'div'},AnimatePresence:'div'}
 try{
  const {FocusLayer}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  FocusLayer({active:true,label:'Free start',children:null})
  for(const expanded of [false,true]){
   open=expanded
   for(const summary of [solution,hints])for(const shiftKey of [false,true]){
    document.activeElement=summary;let prevented=false
    handlers.get('keydown')({key:'Tab',shiftKey,preventDefault(){prevented=true}})
    assert.equal(prevented,false,`${summary.name}: native Tab/Shift+Tab must proceed when details is ${expanded?'open':'closed'}`)
    assert.equal(document.activeElement,summary,'trap must not reset focus to the first control')
   }
   document.activeElement=last
   handlers.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){}})
   assert.equal(document.activeElement,first)
   handlers.get('keydown')({key:'Tab',shiftKey:true,preventDefault(){}})
   assert.equal(document.activeElement,last)
  }
 }finally{
  delete globalThis.__freeFocusHarness
  for(const key of ['document','HTMLElement'])if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key]
 }
})
