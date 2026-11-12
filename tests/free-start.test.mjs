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

test('free guides expose tool access conditions before practice and a safe concrete action',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const {guideEvent,parseGuideStartParam}=await import('../src/lib/discovery-events.ts')
 const file=new URL('../src/screens/home/FreeStart.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 for(const [path,names]of Object.entries({'./PracticeArtifact':'PracticeArtifact','../../lib/learning-next':'saveLastFreeGuide','../../lib/beginner-content':'beginnerGlossary, beginnerGuides','../../lib/discovery-events':'guideEvent, parseGuideStartParam','../../lib/track':'track','../../lib/tg':'copyText, startParam','../../store':'useStore','../../lib/api':'isDemo','../../ui':'Tap'}))code=code.replace(new RegExp(`import[^;\\n]*from ["']${path.replaceAll('.','\\.')}["'];?`,'g'),`const { ${names} } = globalThis.__freeStartHarness;`)
 code=code.replace(/import ["']\.\/free-start\.css["'];?/g,'')
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const useStore=selector=>selector({me:{id:42}});useStore.getState=()=>({navigateTab(){}})
 globalThis.__freeStartHarness={PracticeArtifact:()=>null,saveLastFreeGuide(){},beginnerGlossary,beginnerGuides,guideEvent,parseGuideStartParam,track(){},copyText:async()=>true,startParam:'',useStore,isDemo:false,Tap:({children,...props})=>createElement('button',props,children)}
 try{
  const {FreeStart}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  for(const guide of beginnerGuides){
   const html=renderToStaticMarkup(createElement(FreeStart,{path:'/start/'+guide.id,go(){}}))
   assert.ok(html.includes(guide.editorial.access_note),guide.id)
   assert.ok(html.indexOf(guide.editorial.access_note)<html.indexOf('free-start-steps'))
   assert.match(html,/href="https:\/\/chatgpt.com\/" target="_blank" rel="noopener noreferrer"/)
   assert.match(html,/покупать подписку для этого разбора не требуется/)
   assert.match(html,/вымышленные или обезличенные данные/)
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
 assert.match(source,/navigateTab\('blog'\)/)
 assert.doesNotMatch(source,/store\.pop\(\);store\.setTab/)
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
