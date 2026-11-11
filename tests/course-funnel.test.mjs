import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {rolldown} from 'rolldown'
import {fileURLToPath} from 'node:url'
import * as learningDrafts from '../src/lib/learning-drafts.ts'
import {discoveryEvent} from '../src/lib/discovery-events.ts'
import {ogPracticeCourses, practiceMatches, practiceTopics, practiceProgressStorageKey, practiceProjectLesson} from '../src/lib/og-practice.ts'

const compiledScreens={}
for(const file of ['screens/Course.tsx','screens/home/OGPractice.tsx','screens/home/CoursePayment.tsx','screens/Lesson.tsx','lib/og-course-access.ts','lib/course-checkout.ts','lib/course-payment-state.ts']){
 const bundle=await rolldown({input:fileURLToPath(new URL('../src/'+file,import.meta.url)),external:(_id,parent)=>!!parent,transform:{jsx:{runtime:'automatic'}}})
 try{compiledScreens[file]=(await bundle.generate({format:'cjs'})).output[0].code}finally{await bundle.close()}
}

// Execute the actual screen handlers and effects with controlled API/Telegram boundaries.
// No browser or payment network is involved.
function setup() {
 let frame
 const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => Object.is(v,b[i]))
 const react = {
  Fragment:'fragment',
  useRef(initial) {const i=frame.index++; return frame.hooks[i] ??= {current:initial}},
  useState(initial) {const target=frame,i=target.index++; if (!(i in target.hooks)) target.hooks[i]=typeof initial==='function'?initial():initial; return [target.hooks[i], value=>{target.hooks[i]=typeof value==='function'?value(target.hooks[i]):value}]},
  useMemo(fn,deps) {const i=frame.index++,old=frame.hooks[i]; if (!old || !same(old.deps,deps)) frame.hooks[i]={deps,value:fn()}; return frame.hooks[i].value},
  useEffect(fn,deps) {const i=frame.index++,old=frame.hooks[i]; if (!old || !same(old.deps,deps)) {frame.hooks[i]={deps,fn,cleanup:old?.cleanup}; frame.effects.push(i)}},
  useSyncExternalStore(_subscribe,snapshot) {return snapshot()},
 }
 const jsx=(type,props,key)=>({type,props:props??{},key})
 const events=[],toasts=[],guarded=[],calls={invoice:0,open:0,boot:0,celebrate:0,lesson:0,complete:0,reward:0,patch:0,setMe:0}
 const course={id:40,title:'Основы ИИ',practice_key:'foundations',price_stars:250,invite_unlock:0,lessons:1,done:0,gradient:'ocean',access:false,request:null}
 const card={id:90,kind:'lesson',course_id:40,title:'Первый урок',category:'',position:1,published:true,free_preview:true,completed:false,minutes:5,quiz:[],body:'Server lesson',gradient:'ocean'}
 course.practice_lessons=[{...card,key:'one'}]
 const state={phase:'ok',courses:[course],feed:[card],me:{id:7,invited:0,xp:0},pop(){},push(){},toast(value){toasts.push(value)},guard(error){guarded.push(error)},async boot(){calls.boot++;return 'ok'},setMe(me){calls.setMe++;state.me=me},patchCard(_id,patch){calls.patch++;Object.assign(card,patch);Object.assign(course.practice_lessons[0],patch)},setReward(){calls.reward++}}
 const useStore=selector=>selector(state);useStore.getState=()=>state;useStore.subscribe=()=>()=>{}
 const window=new EventTarget(),document=new EventTarget(),storage=new Map()
 window.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
 document.visibilityState='visible'
 const behavior={invoice:'invoice-link',status:'cancelled',lesson:card,completion:null,canPay:true,demo:false}
 const api={async complete(){calls.complete++;if(behavior.completion instanceof Error)throw behavior.completion;return behavior.completion ?? {me:{...state.me,xp:10},already:false}},async courseInvoice(){calls.invoice++; if (behavior.invoice instanceof Error) throw behavior.invoice; return behavior.invoice},async lesson(){calls.lesson++; if (behavior.lesson instanceof Error) throw behavior.lesson; return behavior.lesson}}
 const inert=new Proxy({}, {get:(_,key)=>String(key)})
 const ui={...inert,Tap:'Tap',Cta:'Cta',Emoji:'Emoji',Pattern:'Pattern',Bar:'Bar',celebrate(){calls.celebrate++}}
 const modules={
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':inert,'motion/react':{motion:inert,AnimatePresence:'AnimatePresence',useMotionValue:()=>({set(){}})},
  store:{useStore,insetOf:()=>({})},ui,
  api:{api,ApiError:class ApiError extends Error {},errorText:error=>error.message,get isDemo(){return behavior.demo}},
  tg:{get canPayStars(){return behavior.canPay},inTelegram:true,haptic:{success(){},tap(){},error(){}},confirmDialog:async()=>true,async openInvoice(){calls.open++;return behavior.status}},
  track:{track:(name,props,lessonId)=>events.push(discoveryEvent(name,props,lessonId))},
  game:{iconFor:()=> '✨',GRADIENTS:{ocean:{css:'blue',ink:'white'}},lessonsWord:()=> 'уроков',plural:()=> 'друзей'},
  'learning-drafts':learningDrafts,
  links:{appLink:()=>null},sfx:{sfx:{levelUp(){}}},content:{isBlogPost:()=>false},
  'og-practice':{ogPracticeCourses:[{...ogPracticeCourses[0],key:'foundations',title:course.title,lessons:[{...ogPracticeCourses[0].lessons[0],key:'one',title:card.title,minutes:5}]}],practiceMatches,practiceTopics,practiceProgressStorageKey,practiceProjectLesson,readPracticeProgress:()=>({done:[]}),subscribePracticeProgress:()=>()=>{},getPracticeResume:()=>null,practicePath:(...parts)=>'/og-practice/'+parts.join('/'),writePracticeProgress(){}},
 }
 const cache={}
 function load(file) {
  if (cache[file]) return cache[file]
  const compiled=compiledScreens[file]
  const module={exports:{}}
  vm.runInNewContext(compiled,{exports:module.exports,module,require(specifier){
   if (specifier==='../Course') return load('screens/Course.tsx')
   if (specifier==='./CoursePayment') return load('screens/home/CoursePayment.tsx')
   if (specifier.endsWith('/course-checkout')) return load('lib/course-checkout.ts')
   if (/\/course-payment-state(?:\.ts)?$/.test(specifier)) return load('lib/course-payment-state.ts')
   if (specifier.endsWith('/og-course-access')) return load('lib/og-course-access.ts')
   return modules[specifier]??modules[specifier.split('/').at(-1)]??inert
  },setTimeout:fn=>queueMicrotask(fn),clearTimeout(){},window,document,Map,Set,console},{filename:file})
  cache[file]=module.exports;return module.exports
 }
 function mount(fn,props={}) {
  const target={hooks:[],effects:[],index:0}
  return {render(){frame=target;target.index=0;const tree=fn(props);for(const i of target.effects.splice(0)){const hook=target.hooks[i];hook.cleanup?.();hook.cleanup=hook.fn()}return tree},unmount(){for(const hook of target.hooks)hook?.cleanup?.()}}
 }
 function screen() {const instance=mount(load('screens/Course.tsx').CourseScreen,{id:40});const tree=instance.render();return {...instance,buy:find(tree,node=>node.type==='Cta' && node.props.busy===false).props.onClick}}
 function practice(path) {
  const root=mount(load('screens/home/OGPractice.tsx').OGPractice,{path,go(){}})
  let child,childKey,childType
  return {render(){const element=root.render();if(!child||childKey!==element.key||childType!==element.type){child?.unmount();child=mount(element.type,element.props);childKey=element.key;childType=element.type}return child.render()},unmount(){child?.unmount();root.unmount()}}
 }
 function lessonScreen() {
  const root=mount(load('screens/Lesson.tsx').LessonScreen,{id:90})
  let child,childKey,childType
  return {render(){const element=root.render();if(!child||childKey!==element.key||childType!==element.type){child?.unmount();child=mount(element.type,element.props);childKey=element.key;childType=element.type}return child.render()},unmount(){child?.unmount();root.unmount()}}
 }
 return {events,toasts,guarded,calls,state,behavior,card,course,screen,practice,lessonScreen,mount,load}
}
function find(tree,predicate) {
 if (!tree || typeof tree!=='object') return
 if (predicate(tree)) return tree
 const children=tree.props?.children
 for (const child of (Array.isArray(children)?children.flat(Infinity):[children])) {const value=find(child,predicate);if(value)return value}
}
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}

test('program and its payment overlay emit one account/course view, without rerender duplicates',()=>{
 const h=setup(),program=h.practice('/og-practice/foundations');program.render();program.render()
 const payment=h.screen();payment.render()
 assert.deepEqual(h.events,[{name:'course_view',props:{source:'course',course_id:40}}])
 payment.unmount();program.unmount()
 const later=h.screen();later.unmount()
 assert.equal(h.events.length,2)
})

test('unpublished catalog metadata never emits a course view or promises an available preview',()=>{
 const h=setup();h.state.courses=[]
 const program=h.practice('/og-practice/foundations'),tree=program.render()
 assert.deepEqual(h.events,[])
 const text=JSON.stringify(tree)
 assert.ok(text.includes('Материалы появятся после публикации курса.'))
 assert.ok(!text.includes('Пробный урок открыт бесплатно.'))
 program.unmount()
})

for(const status of ['paid','cancelled','failed','pending'])test(`checkout preserves ${status} and never grants client-side access`,async()=>{
 const h=setup();h.behavior.status=status;const screen=h.screen()
 await screen.buy()
 assert.deepEqual(h.events.filter(e=>e.name.startsWith('checkout')),[{name:'checkout_start',props:{source:'course',course_id:40}},{name:'checkout_result',props:{source:'course',course_id:40,status}}])
 assert.equal(h.course.access,false);assert.equal(h.calls.celebrate,0)
 assert.equal(h.calls.boot,status==='paid'?8:0)
 if(status==='paid')assert.ok(h.toasts.some(value=>value.includes('Курс откроется')))
 screen.unmount()
})

test('paid callback celebrates only after server boot confirms access',async()=>{
 const h=setup();h.behavior.status='paid';h.state.boot=async()=>{h.calls.boot++;if(h.calls.boot===2)h.course.access=true}
 const screen=h.screen();await screen.buy()
 assert.equal(h.calls.boot,2);assert.equal(h.calls.celebrate,1);screen.unmount()
})

test('invoice failure reports failed once; unavailable Telegram never starts checkout',async()=>{
 const h=setup();h.behavior.invoice=new Error('invoice failed');const screen=h.screen();await screen.buy()
 assert.deepEqual(h.events.filter(e=>e.name==='checkout_result').map(e=>e.props.status),['failed'])
 assert.equal(h.calls.open,0);assert.equal(h.guarded.length,1);screen.unmount()
 const browser=setup();browser.behavior.canPay=false;const unavailable=browser.screen();await unavailable.buy()
 assert.equal(browser.calls.invoice,0);assert.equal(browser.events.filter(e=>e.name.startsWith('checkout')).length,0);unavailable.unmount()
})

test('rapid double checkout taps create only one invoice',async()=>{
 const h=setup(),screen=h.screen();await Promise.all([screen.buy(),screen.buy()])
 assert.equal(h.calls.invoice,1);assert.equal(h.events.filter(e=>e.name==='checkout_start').length,1);screen.unmount()
})

for(const variant of ['free','private','failed','wrong-course','unpublished','buyer'])test(`practice preview tracks only a successfully loaded free lesson: ${variant}`,async()=>{
 const h=setup()
 if(variant==='private')h.behavior.lesson={...h.card,free_preview:false}
 if(variant==='failed')h.behavior.lesson=new Error('offline')
 if(variant==='wrong-course')h.behavior.lesson={...h.card,course_id:41}
 if(variant==='unpublished')h.behavior.lesson={...h.card,published:false}
 if(variant==='buyer')h.course.access=true
 const lesson=h.practice('/og-practice/foundations/one');lesson.render()
 assert.deepEqual(h.events,[]);await settle();lesson.render();lesson.render()
 assert.deepEqual(h.events,variant==='free'?[{name:'course_preview',lesson_id:90,props:{source:'course',course_id:40}}]:[])
 lesson.unmount()
})

test('legacy lesson screen previews use server bodies and dedupe progress rerenders',async()=>{
 const h=setup(),lesson=h.lessonScreen()
 lesson.render();assert.deepEqual(h.events,[]);await settle();lesson.render();lesson.render()
 assert.deepEqual(h.events,[{name:'course_preview',lesson_id:90,props:{source:'course',course_id:40}}]);lesson.unmount()
})

test('legacy lesson keyed session reloads on account change',async()=>{
 const h=setup(),lesson=h.lessonScreen()
 lesson.render();await settle();lesson.render()
 assert.equal(h.calls.lesson,1)
 h.state.me={...h.state.me,id:8}
 lesson.render();await settle();lesson.render()
 assert.equal(h.calls.lesson,2)
 assert.equal(h.events.filter(event=>event.name==='course_preview').length,2)
 lesson.unmount()
})


test('ordinary OG completion is explicitly reading, not a verified project, and double taps coalesce', async () => {
 const h=setup(), lesson=h.practice('/og-practice/foundations/one')
 lesson.render(); await settle(); const tree=lesson.render(), text=JSON.stringify(tree)
 assert.ok(text.includes('Отметить ознакомление'))
 assert.ok(text.includes('без проверки работы'))
 assert.ok(!text.includes('Готово на практике?'))
 assert.equal(tree.props.userId,'live:7')
 const finish=find(tree,node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 await Promise.all([finish(),finish()])
 assert.equal(h.calls.complete,1);assert.equal(h.calls.reward,0);assert.equal(h.calls.patch,1)
 assert.ok(h.toasts.some(text=>text.includes('Ознакомление отмечено')))
 assert.ok(JSON.stringify(lesson.render()).includes('Ознакомление отмечено'))
 lesson.unmount()
})

test('a quiz remains a separate check and does not call the reading-completion endpoint', async () => {
 const h=setup(); h.card.quiz=[{question:'Почему?',options:['A','B']}]
 const lesson=h.practice('/og-practice/foundations/one');lesson.render();await settle()
 const text=JSON.stringify(lesson.render())
 assert.ok(text.includes('Проверка понимания'));assert.ok(text.includes('не проверяет твою практическую работу'))
 assert.ok(!text.includes('Я ознакомился'));assert.equal(h.calls.complete,0)
 lesson.unmount()
})

test('practice reader remounts for another account before exposing the previous lesson body', async () => {
 const h=setup(), lesson=h.practice('/og-practice/foundations/one')
 lesson.render();await settle();assert.equal(lesson.render().props.userId,'live:7')
 h.state.me={...h.state.me,id:8}
 const loading=lesson.render()
 assert.ok(JSON.stringify(loading).includes('Открываем урок'))
 assert.ok(!JSON.stringify(loading).includes('Server lesson'))
 await settle();assert.equal(lesson.render().props.userId,'live:8');assert.equal(h.calls.lesson,2)
 lesson.unmount()
})

test('late completion from a previous account cannot replace the current account or award progress', async () => {
 const h=setup();let resolve
 h.behavior.completion=new Promise(done=>{resolve=done})
 const lesson=h.practice('/og-practice/foundations/one');lesson.render();await settle()
 const tree=lesson.render(), finish=find(tree,node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 const completing=finish();h.state.me={...h.state.me,id:8}
 resolve({me:{id:7,xp:10},already:false});await completing
 assert.equal(h.state.me.id,8);assert.equal(h.calls.setMe,0);assert.equal(h.calls.patch,0);assert.equal(h.calls.reward,0);assert.equal(h.calls.boot,0)
 lesson.unmount()
})


test('failed reading completion leaves progress unchanged and allows an explicit retry', async () => {
 const h=setup();h.behavior.completion=new Error('offline')
 const lesson=h.practice('/og-practice/foundations/one');lesson.render();await settle()
 let tree=lesson.render(),finish=find(tree,node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 await finish();assert.equal(h.calls.patch,0);assert.equal(h.calls.setMe,0);assert.equal(h.calls.reward,0)
 assert.ok(h.toasts.includes('offline'));assert.equal(h.card.completed,false)
 h.behavior.completion=null;tree=lesson.render();finish=find(tree,node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 await finish();assert.equal(h.calls.complete,2);assert.equal(h.card.completed,true)
 lesson.unmount()
})

test('owner-tagged practice results hide old content even without the parent remount', async () => {
 const h=setup(), root=h.mount(h.load('screens/home/OGPractice.tsx').OGPractice,{path:'/og-practice/foundations/one',go(){}})
 const element=root.render(), child=h.mount(element.type,element.props)
 child.render();await settle();assert.equal(child.render().props.userId,'live:7')
 h.state.me={...h.state.me,id:8}
 const loading=child.render()
 assert.ok(JSON.stringify(loading).includes('Открываем урок'))
 assert.ok(!JSON.stringify(loading).includes('Server lesson'))
 assert.ok(!find(loading,node=>node.type==='Tap' && node.props.disabled===false))
 await settle();assert.equal(child.render().props.userId,'live:8')
 child.unmount();root.unmount()
})

for (const outcome of ['success','failure']) test(`completion ${outcome} after leaving the lesson cannot mutate or refresh the new screen`, async () => {
 const h=setup();let resolve,reject
 h.behavior.completion=new Promise((yes,no)=>{resolve=yes;reject=no})
 const lesson=h.practice('/og-practice/foundations/one');lesson.render();await settle()
 const finish=find(lesson.render(),node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 const pending=finish();lesson.unmount()
 if(outcome==='success')resolve({me:{id:7,xp:10},already:false});else reject(new Error('late failure'))
 await pending
 assert.equal(h.calls.setMe,0);assert.equal(h.calls.patch,0);assert.equal(h.calls.boot,0)
 assert.deepEqual(h.toasts,[]);assert.deepEqual(h.guarded,[])
})

test('a replaced server lesson mapping cannot be overwritten by an old completion', async () => {
 const h=setup();let resolve
 h.behavior.completion=new Promise(done=>{resolve=done})
 const lesson=h.practice('/og-practice/foundations/one');lesson.render();await settle()
 const finish=find(lesson.render(),node=>node.type==='Tap' && node.props.disabled===false).props.onClick
 const pending=finish()
 h.course.practice_lessons[0]={...h.course.practice_lessons[0],id:91}
 h.behavior.lesson={...h.card,id:91,body:'Replacement lesson'}
 assert.ok(JSON.stringify(lesson.render()).includes('Открываем урок'));await settle()
 assert.equal(lesson.render().props.lesson.body,'Replacement lesson')
 resolve({me:{id:7,xp:10},already:false});await pending
 assert.equal(lesson.render().props.lesson.body,'Replacement lesson')
 assert.equal(h.calls.setMe,0);assert.equal(h.calls.patch,0);assert.equal(h.calls.boot,0)
 lesson.unmount()
})
