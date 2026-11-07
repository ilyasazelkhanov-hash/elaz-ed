// Read-only offline regression against the exact main checkout. No real API, browser,
// credentials, Telegram, payments, or authored lesson bodies are loaded.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {rolldown} from 'rolldown'
import {create} from 'zustand'
import {fileURLToPath} from 'node:url'

const REPO = fileURLToPath(new URL('../', import.meta.url))
const compiled = {}
for (const file of ['store.ts', 'screens/home/OGPractice.tsx', 'screens/Lesson.tsx', 'screens/Reward.tsx', 'lib/og-course-access.ts']) {
 const build = await rolldown({input: `${REPO}/src/${file}`, external: (_id,parent) => !!parent,
  plugins: [{name:'environment-only',transform(code,id){if(id.endsWith('/store.ts')) return code.replace('import.meta.env.DEV','false')}}],
  transform:{jsx:{runtime:'automatic'}}})
 try {compiled[file]=(await build.generate({format:'cjs'})).output[0].code} finally {await build.close()}
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
const children=node=>[node?.props?.children].flat(Infinity)
function find(tree,predicate){if(!tree||typeof tree!=='object')return;if(predicate(tree))return tree;for(const child of children(tree)){const item=find(child,predicate);if(item)return item}}
function text(tree){if(tree==null||typeof tree==='boolean')return '';if(typeof tree!=='object')return String(tree);return children(tree).map(text).join('')}
const click=(tree,label)=>{const node=find(tree,n=>n.type==='button'&&text(n).includes(label));assert.ok(node,`button ${label}`);return node.props.onClick()}

function setup({quiz=false, feedPresent=true, access=false}={}){
 let frame,serverCompleted=false
 const calls={lesson:0,complete:0,boot:0,quizStart:0,quizAnswer:0},toasts=[]
 const behavior={completionFails:false,completeWait:null,bootWait:null,already:false}
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]))
 const react={
  useRef(initial){const i=frame.index++;return frame.hooks[i]??={current:initial}},
  useState(initial){const target=frame,i=target.index++;if(!(i in target.hooks))target.hooks[i]=typeof initial==='function'?initial():initial;return[target.hooks[i],value=>{target.hooks[i]=typeof value==='function'?value(target.hooks[i]):value}]},
  useMemo(fn,deps){const i=frame.index++,old=frame.hooks[i];if(!old||!same(old.deps,deps))frame.hooks[i]={deps,value:fn()};return frame.hooks[i].value},
  useEffect(fn,deps){const i=frame.index++,old=frame.hooks[i];if(!old||!same(old.deps,deps)){frame.hooks[i]={deps,fn,cleanup:old?.cleanup};frame.effects.push(i)}},
 }
 const jsx=(type,props)=>({type,props:props??{}})
 const question={q:'Synthetic question?',options:['A','B']}
 const card={id:90,kind:'lesson',course_id:40,title:'Synthetic free preview',subtitle:'Synthetic fixture',category:'',position:1,published:true,free_preview:true,completed:false,minutes:5,xp:20,quiz:quiz?[question]:[],body:'Synthetic open lesson. No authored content.',gradient:'ocean',likes:0,views:0}
 const outline={key:'foundations',title:'Synthetic program',goal:'Synthetic goal',project:'Synthetic project',lessons:[{key:'one',title:card.title,minutes:5}]}
 const course={id:40,title:outline.title,practice_key:'foundations',price_stars:250,access,request:null,lessons:1,done:0,practice_lessons:[{key:'one',id:90,title:card.title,minutes:5,free_preview:true,completed:false}]}
 const attempt={attemptId:'synthetic-attempt',questions:[question],answers:[],feedback:[],done:false,score:0,bonus:0,combo:0,practice:false}
 let progress={lastLesson:null,done:[]}
 let store
 const response=()=>({already:behavior.already,me:{id:7,is_admin:false,xp:20},gained:20,base:20,bonus:0,total:quiz?1:0,score:quiz?1:0,new_achievements:[]})
 const api={
  async lesson(){calls.lesson++;return {...card,completed:serverCompleted}},
  async complete(id,answers,attemptId){calls.complete++;assert.equal(id,90);if(quiz){assert.deepEqual(Array.from(answers),[0]);assert.equal(attemptId,'synthetic-attempt')}if(behavior.completeWait)await behavior.completeWait;if(behavior.completionFails)throw new Error('offline');serverCompleted=true;return response()},
  async boot(){calls.boot++;if(behavior.bootWait)await behavior.bootWait;return {status:'ok',me:response().me,feed:feedPresent?[{...card,completed:serverCompleted}]:[],courses:[{...course,done:serverCompleted?1:0,practice_lessons:course.practice_lessons.map(l=>({...l,completed:serverCompleted}))}],channel:{},bot:{}}},
  async quizStart(){calls.quizStart++;return attempt},
  async quizAnswer(id,index,answer){calls.quizAnswer++;assert.equal(id,attempt.attemptId);assert.equal(index,0);assert.equal(answer,0);return {answer:0,correct:true,done:true,score:1,bonus:0,combo:1,gained:0,correctIndex:0,explain:'Synthetic explanation'}},
 }
 const inert=new Proxy({}, {get:(_,key)=>String(key)})
 const useStore=selector=>selector(store.getState());useStore.getState=()=>store.getState();useStore.setState=(...args)=>store.setState(...args)
 const level={index:1,title:'Fixture level',emoji:'✨',progress:0,next:null}
 const modules={
  'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},zustand:{create},'lucide-react':inert,
  'motion/react':{motion:inert,AnimatePresence:'presence',useMotionValue:()=>({set(){}})},
  store:{useStore},ui:{Tap:'button',Cta:'button',Pattern:'pattern',Emoji:'emoji',Bar:'bar',Counter:'counter',celebrate(){}},
  api:{api,isDemo:false,ApiError:class extends Error{},errorText:error=>error.message},
  game:{GRADIENTS:{ocean:{css:'blue',ink:'white'},aurora:{css:'blue',ink:'white'}},iconFor:()=> '✨',achievement:()=>null,levelOf:()=>level},
  experience:{demoPlatformXp:()=>0},journey:{projectProgress:me=>me},
  tg:{inTelegram:false,canPayStars:false,haptic:{success(){},error(){}},copyText:async()=>true,shareLink(){}},
  sfx:{sfx:{good(){},bad(){},win(){}}},links:{appLink:()=>null},track:{track(){}},
  content:{isBlogPost:()=>false},Post:{PostScreen:'post'},Markdown:{Markdown:'markdown'},Video:{Video:'video'},news:{newsShareText:()=>''},shareCard:{},
  Course:{useCourseViewTelemetry(){}},PracticeArtwork:{PracticeArtwork:'artwork'},PracticeReader:{PracticeReader:'reader'},CoursePathway:{CoursePathway:'pathway'},
  'course-checkout':{openCourseAccess(){throw new Error('Payments must not be used')}},
  'og-practice':{ogPracticeCourses:[outline],practiceMatches:()=>true,practiceTopics:['Все'],practicePath:(...parts)=>'/og-practice/'+parts.join('/'),readPracticeProgress:()=>progress,writePracticeProgress:next=>{progress=next},subscribePracticeProgress:()=>()=>{},getPracticeResume:()=>null},
 }
 const cache={}
 function load(file){if(cache[file])return cache[file];const module={exports:{}};vm.runInNewContext(compiled[file],{module,exports:module.exports,require(id){
  if(id.endsWith('/og-course-access'))return load('lib/og-course-access.ts')
  const key=id.split('/').at(-1)
  assert.ok(Object.hasOwn(modules,id)||Object.hasOwn(modules,key),`unexpected import ${id}`)
  return modules[id]??modules[key]
 },setTimeout:()=>0,console,Map,Set,localStorage:{getItem:()=>null}}, {filename:file});return cache[file]=module.exports}
 store=load('store.ts').useStore
 store.setState({phase:'ok',me:{id:7,is_admin:false,xp:0},feed:feedPresent?[card]:[],courses:[course],stack:[{type:'learning',path:'/og-practice/foundations/one'}],toast:value=>toasts.push(value)})
 function mount(fn,props={}){const target={hooks:[],effects:[],index:0};return {render(){frame=target;target.index=0;const tree=fn(props);for(const i of target.effects.splice(0)){const h=target.hooks[i];h.cleanup?.();h.cleanup=h.fn()}return tree},unmount(){for(const h of target.hooks)h?.cleanup?.()}}}
 function practice(path){const root=mount(load('screens/home/OGPractice.tsx').OGPractice,{path,go(){}}),child=root.render();return mount(child.type,child.props)}
 return {calls,behavior,toasts,card,course,outline,store,load,mount,practice,get progress(){return progress},get serverCompleted(){return serverCompleted}}
}

async function finishLessonScreen(h,{quiz=false}={}){
 const lesson=h.mount(h.load('screens/Lesson.tsx').LessonScreen,{id:90});lesson.render();await settle();let tree=lesson.render()
 if(quiz){
  const child=find(tree,n=>typeof n.type==='function'&&n.type.name==='Quiz');assert.ok(child,'actual quiz must be rendered by LessonScreen')
  const q=h.mount(child.type,child.props);q.render();await settle()
  await click(q.render(),'A');await settle();click(q.render(),'Готово');lesson.render();q.unmount()
 }
 await click(lesson.render(),'Забрать');await settle();return lesson
}
function completionExpectation(actual,label){assert.equal(actual,true,`completed ${label} must update immediately without a new boot`)}

for(const access of [false,true]) for(const feedPresent of [true,false]) test(`direct free preview completion updates OG program without reboot (feed ${feedPresent?'present':'absent'}, access ${access})`,async()=>{
 const h=setup({feedPresent,access}),screen=await finishLessonScreen(h)
 assert.equal(h.serverCompleted,true);assert.equal(h.calls.complete,1);assert.equal(h.store.getState().me.xp,20)
 if(feedPresent)assert.equal(h.store.getState().feed[0].completed,true)
 const program=h.practice('/og-practice/foundations'),row=find(program.render(),n=>n.props?.['data-practice-lesson']==='one')
 completionExpectation(text(row).includes('пройдено'),'program row')
 if(access){
  const tree=program.render(),bar=find(tree,n=>n.props?.['aria-label']==='Прогресс курса')
  assert.equal(bar.props['aria-valuenow'],1,'program count must reflect the completed lesson')
  assert.equal(text(tree).includes('Начать курс'),false,'completed course must not restart at its completed lesson')
 }
 assert.equal(h.calls.boot,0);screen.unmount();program.unmount()
})

test('actual nested quiz completion updates mounted reader and program, not only feed',async()=>{
 const h=setup({quiz:true}),reader=h.practice('/og-practice/foundations/one');reader.render();await settle()
 click(reader.render(),'Пройти проверку и завершить')
 assert.equal(h.store.getState().stack.at(-1).type,'lesson')
 const lesson=await finishLessonScreen(h,{quiz:true})
 assert.equal(h.calls.quizStart,1);assert.equal(h.calls.quizAnswer,1);assert.equal(h.serverCompleted,true)
 const reward=h.mount(h.load('screens/Reward.tsx').RewardModal,{reward:h.store.getState().reward});click(reward.render(),'Дальше')
 assert.equal(h.store.getState().reward,null);assert.equal(h.store.getState().stack.length,1)
 completionExpectation(text(reader.render()).includes('Урок пройден'),'mounted OG reader')
 const program=h.practice('/og-practice/foundations');completionExpectation(text(find(program.render(),n=>n.props?.['data-practice-lesson']==='one')).includes('пройдено'),'OG program')
 assert.equal(h.calls.boot,0);reader.unmount();lesson.unmount();reward.unmount();program.unmount()
})

test('control: failed server completion never marks local success',async()=>{
 const h=setup();h.behavior.completionFails=true;const lesson=await finishLessonScreen(h)
 assert.equal(h.serverCompleted,false);assert.equal(h.store.getState().feed[0].completed,false);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,false);assert.equal(h.store.getState().reward,null);assert.equal(h.toasts.length,1);lesson.unmount()
})

test('control: native no-quiz reader refreshes the same program metadata after successful completion',async()=>{
 const h=setup(),reader=h.practice('/og-practice/foundations/one');reader.render();await settle();await click(reader.render(),'Завершить урок')
 assert.equal(h.serverCompleted,true);assert.equal(h.calls.boot,1);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,true)
 const program=h.practice('/og-practice/foundations');assert.ok(text(find(program.render(),n=>n.props?.['data-practice-lesson']==='one')).includes('пройдено'));reader.unmount();program.unmount()
})

for(const readerRoute of [false,true])test(`${readerRoute?'OG reader':'LessonScreen'} ignores repeated pending completion taps and waits for server confirmation`,async()=>{
 const h=setup(),pending=Promise.withResolvers();h.behavior.completeWait=pending.promise
 const screen=readerRoute?h.practice('/og-practice/foundations/one'):h.mount(h.load('screens/Lesson.tsx').LessonScreen,{id:90})
 screen.render();await settle();const tree=screen.render(),label=readerRoute?'Завершить урок':'Забрать'
 const first=click(tree,label),second=click(tree,label)
 assert.equal(h.calls.complete,1);assert.equal(h.store.getState().feed[0].completed,false);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,false)
 assert.equal(h.store.getState().reward,null);pending.resolve();await Promise.all([first,second])
 assert.equal(h.store.getState().feed[0].completed,true);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,true);assert.equal(h.store.getState().courses[0].done,1)
 assert.equal(h.store.getState().courses[0].access,false);assert.equal(h.calls.complete,1);screen.unmount()
})

test('confirmed no-quiz completion is visible before the existing boot refresh finishes',async()=>{
 const h=setup(),pending=Promise.withResolvers();h.behavior.bootWait=pending.promise
 const screen=h.practice('/og-practice/foundations/one');screen.render();await settle()
 const finish=click(screen.render(),'Завершить урок');await settle()
 assert.equal(h.calls.boot,1);assert.equal(h.store.getState().feed[0].completed,true);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,true)
 assert.ok(text(screen.render()).includes('Урок пройден'));pending.resolve();await finish;screen.unmount()
})

test('an already-completed server response repairs stale metadata without another reward',async()=>{
 const h=setup();h.behavior.already=true;const lesson=await finishLessonScreen(h)
 assert.equal(h.store.getState().feed[0].completed,true);assert.equal(h.store.getState().courses[0].practice_lessons[0].completed,true);assert.equal(h.store.getState().courses[0].done,1)
 assert.equal(h.store.getState().reward,null);assert.equal(h.calls.complete,1);assert.equal(h.calls.boot,0);lesson.unmount()
})

test('failure can be retried explicitly; repeated confirmed updates never inflate counts or change access',async()=>{
 const h=setup();h.behavior.completionFails=true;const lesson=await finishLessonScreen(h)
 assert.equal(h.calls.complete,1);assert.equal(h.store.getState().courses[0].done,0)
 h.behavior.completionFails=false;await click(lesson.render(),'Забрать')
 assert.equal(h.calls.complete,2);assert.equal(h.store.getState().courses[0].done,1)
 const original=h.store.getState().courses[0]
 const unrelated={...original,id:41,practice_key:'text',practice_lessons:[{...original.practice_lessons[0],id:91,completed:false}],done:0}
 h.store.setState({courses:[original,unrelated]})
 h.store.getState().markLessonCompleted(90);h.store.getState().markLessonCompleted(90);h.store.getState().markLessonCompleted(999)
 const courses=h.store.getState().courses
 assert.equal(courses[0],original);assert.equal(courses[1],unrelated);assert.equal(courses[0].done,1);assert.equal(courses[1].done,0)
 assert.equal(courses[0].access,false);assert.equal(courses[1].access,false);assert.equal(courses[0].practice_lessons[0].free_preview,true)
 assert.equal(courses[1].practice_lessons[0].completed,false);assert.equal(h.calls.complete,2);assert.equal(h.calls.boot,0);lesson.unmount()
})

test('legacy course without practice metadata updates its existing feed and count once',()=>{
 const h=setup();delete h.course.practice_lessons
 h.store.getState().markLessonCompleted(90);h.store.getState().markLessonCompleted(90)
 assert.equal(h.store.getState().feed[0].completed,true);assert.equal(h.store.getState().courses[0].done,1)
 assert.equal(h.store.getState().courses[0].practice_lessons,undefined);assert.equal(h.store.getState().courses[0].access,false)
 assert.equal(h.calls.complete,0);assert.equal(h.calls.boot,0)
})
