import test from 'node:test'
import assert from 'node:assert/strict'
import * as model from '../src/lib/guide-interactions.ts'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
const {guideInteractions,evaluateGuideAnswer,guideAnswerPresent,initialGuideAnswer,moveGuideItem,guideJourneyKey,readGuideJourney,saveGuideJourney}=model
test('all five free guides have exactly one authored interaction per short concept',()=>{
 assert.deepEqual(Object.keys(guideInteractions).sort(),beginnerGuides.map(g=>g.id).sort())
 const types=new Set()
 for(const guide of beginnerGuides){
  const questions=guideInteractions[guide.id];assert.equal(questions.length,guide.steps.length)
  for(const q of questions){
   types.add(q.type);assert.ok(q.prompt.length>20)
   if(q.type==='choice'){assert.ok(q.options.length>=2);for(let i=0;i<q.options.length;i++){assert.ok(q.options[i].why.length>30);assert.equal(evaluateGuideAnswer(q,i).correct,i===q.correct)}}
   if(q.type==='number'){assert.equal(evaluateGuideAnswer(q,String(q.answer)).correct,true);assert.equal(evaluateGuideAnswer(q,String(q.answer+1)).correct,false)}
   if(q.type==='order'){assert.equal(new Set(q.answer).size,q.items.length);assert.equal(evaluateGuideAnswer(q,q.answer).correct,true);assert.equal(evaluateGuideAnswer(q,initialGuideAnswer(q)).correct,false)}
  }
 }
 assert.deepEqual([...types].sort(),['choice','number','order'])
})
test('malformed answers cannot count as correct, numeric feedback explains independent calculation',()=>{
 const q=guideInteractions['check-answer'][2]
 for(const answer of ['',null,[],NaN,'6%','Infinity','0x6','6e0','6 garbage'])assert.equal(evaluateGuideAnswer(q,answer).correct,false)
 assert.equal(evaluateGuideAnswer(q,'7,0').correct,true)
 assert.match(evaluateGuideAnswer(q,'12').explanation,/21 \/ 300/)
 assert.equal(evaluateGuideAnswer(q,'6').correct,false,'new task must not reuse the worked example answer')
 assert.equal(q.answer,21 * 100 / 300)
 for(const answer of [null,99,-1,0.5,'1'])assert.equal(guideAnswerPresent(guideInteractions['first-request'][0],answer),false)
 const order=guideInteractions['first-request'][2]
 for(const answer of [[1,1,0],[0,1],[1,2,3],null,'1,2,0'])assert.equal(evaluateGuideAnswer(order,answer).correct,false)
})
test('keyboard ordering never mutates source and guards edges',()=>{
 const items=[0,1,2]
 assert.deepEqual(moveGuideItem(items,0,-1),items)
 assert.deepEqual(moveGuideItem(items,2,1),items)
 assert.deepEqual(moveGuideItem(items,1,-1),[1,0,2])
 assert.deepEqual(items,[0,1,2])
})
test('session journey is isolated and bounded without persistent storage',()=>{
 const q=guideInteractions['first-request'],key=guideJourneyKey('live:21','first-request')
 const state={step:2,answers:q.map(initialGuideAnswer),checked:[true,false,false]}
 saveGuideJourney(key,state);state.step=9
 assert.equal(readGuideJourney(key,q).step,2)
 assert.equal(readGuideJourney(guideJourneyKey('demo:21','first-request'),q).step,0)
 assert.equal(readGuideJourney(guideJourneyKey('live:22','first-request'),q).step,0)
 for(let i=0;i<40;i++)saveGuideJourney('evict'+i,{step:1,answers:[],checked:[]})
 assert.equal(readGuideJourney(key,q).step,0)
})
test('actual player explains errors, permits retry, preserves answer and supports accessible full view',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite')
 const file=new URL('../src/screens/home/GuideJourney.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/g,'const {useId,useRef,useState}=globalThis.__guide;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/guide-interactions["'];?/g,'const {emptyJourney,evaluateGuideAnswer,guideAnswerPresent,guideInteractions,guideJourneyKey,moveGuideItem,readGuideJourney,saveGuideJourney}=globalThis.__guide;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__guide;')
 code=code.replace(/import ["']\.\/guide-journey\.css["'];?/g,'')
 for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let index=0,states=[];const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn()
 const focusCalls=[],scrollCalls=[]
 const scroller={scrollTop:1800,getBoundingClientRect:()=>({top:76}),scrollTo:options=>scrollCalls.push(options)}
 const heading={focus:options=>focusCalls.push(options),closest:selector=>{assert.equal(selector,'.scroll');return scroller},getBoundingClientRect:()=>({top:460}),scrollIntoView(){assert.fail('step navigation must not scroll outer app/body ancestors')}}
 globalThis.__guide={...model,Tap(){},useRef:()=>({current:heading}),useId:()=>':guide:',useState(init){const i=index++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}}
 const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)],label=n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string').join('')
 try{
  const {GuideJourney,GuideStepEvidence}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const visual={caption:'Учебный журнал',columns:['Вход','Результат'],rows:[['A','B'],['C','D']]}
  const evidence=GuideStepEvidence({visual})
  assert.equal(nodes(evidence).find(n=>n.type==='caption').props.children,'Учебный журнал')
  assert.equal(nodes(evidence).filter(n=>n.type==='th'&&n.props.scope==='col').length,2)
  assert.equal(nodes(evidence).filter(n=>n.type==='td').length,4)
  assert.equal(GuideStepEvidence({}),null)
  const props={scope:'test:handler',guide:beginnerGuides[0],children:'Практическая работа'}
  const render=()=>{index=0;const element=GuideJourney(props);return element.type(element.props)}
  let tree=render()
  assert.ok(nodes(tree).some(n=>label(n)==='К вопросу'))
  assert.ok(!nodes(tree).some(n=>n.type==='input'),'concept and question are separate short screens')
  nodes(tree).find(n=>label(n)==='К вопросу').props.onClick()
  states=[];tree=render();assert.ok(nodes(tree).some(n=>n.type==='input'),'question phase restores before the first answer')
  tree=render();assert.equal(nodes(tree).find(n=>label(n)==='Проверить ответ').props.disabled,true)
  nodes(tree).find(n=>n.type==='input').props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.ok(nodes(tree).some(n=>label(n)==='Разберём и попробуем ещё раз'))
  assert.ok(!nodes(tree).some(n=>label(n)==='Дальше'))
  nodes(tree).find(n=>label(n)==='Попробовать ещё').props.onClick()
  tree=render();assert.equal(nodes(tree).filter(n=>n.type==='input')[0].props.checked,true,'retry keeps the learner answer')
  assert.ok(!nodes(tree).some(n=>n.props?.role==='status'))
  nodes(tree).filter(n=>n.type==='input')[1].props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.ok(nodes(tree).some(n=>label(n)==='Дальше'))
  assert.equal(nodes(tree).filter(n=>n.props?.className==='guide-journey-primary').length,1,'one primary action at a time')
  nodes(tree).filter(n=>n.type==='input')[0].props.onChange()
  tree=render();assert.ok(!nodes(tree).some(n=>label(n)==='Дальше'),'editing a correct answer removes continuation until rechecked')
  nodes(tree).filter(n=>n.type==='input')[1].props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();nodes(tree).find(n=>label(n)==='Дальше').props.onClick()
  assert.ok(focusCalls.every(options=>options.preventScroll===true));assert.deepEqual(scrollCalls.at(-1),{top:2172,behavior:'instant'})
  states=[];tree=render();assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Передай факты'))
  nodes(tree).find(n=>label(n)==='Весь материал').props.onClick()
  tree=render();assert.equal(nodes(tree).find(n=>n.type==='div'&&n.props.children==='Практическая работа').props.hidden,false)
  assert.ok(nodes(tree).some(n=>label(n)==='Вернуться к шагам'))
  const remembered=readGuideJourney(guideJourneyKey(props.scope,props.guide.id,[props.guide.steps,guideInteractions[props.guide.id]]),guideInteractions[props.guide.id])
  states=[];props.initialPractice=true;tree=render()
  assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Теперь создай свою работу'))
  assert.equal(nodes(tree).find(n=>n.type==='div'&&n.props.children==='Практическая работа').props.hidden,false)
  assert.deepEqual(states[0].answers,remembered.answers,'explicit work view retains answers')
  assert.deepEqual(readGuideJourney(guideJourneyKey(props.scope,props.guide.id,[props.guide.steps,guideInteractions[props.guide.id]]),guideInteractions[props.guide.id]),remembered,'opening work does not mark learning progress')
  states=[];props.initialPractice=false;tree=render()
  assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Передай факты'),'ordinary route resumes remembered step')
  nodes(tree).find(n=>label(n)==='Попробовать заново без подсказок').props.onClick()
  states=[];tree=render()
  assert.equal(states[0].step,0)
  assert.deepEqual(states[0].answers,guideInteractions[props.guide.id].map(initialGuideAnswer))
  assert.ok(states[0].checked.every(v=>v===false))
  assert.ok(!nodes(tree).some(n=>n.props?.className==='guide-journey-feedback'))
  assert.equal(nodes(tree).find(n=>n.type==='div'&&n.props.children==='Практическая работа').props.children,'Практическая работа')
  props.scope='test:empty-work';props.initialPractice=true;states=[];tree=render()
  assert.equal(states[0].step,3,'work route opens practice even after reload clears journey memory')
  props.initialPractice=false;states=[];tree=render()
  assert.equal(states[0].step,0,'ordinary fresh route still starts at step zero')
  props.scrollInset=76;tree=render();nodes(tree).find(n=>label(n)==='К вопросу').props.onClick()
  assert.deepEqual(scrollCalls.at(-1),{top:2108,behavior:'instant'},'embedded OG flow keeps the focused heading below Reader sticky navigation')

 }finally{delete globalThis.__guide;globalThis.requestAnimationFrame=previous}
})

 test('ordering examples require outputs before dependent decisions or corrections',()=>{
 const compare=guideInteractions['choose-tool'][2],image=guideInteractions['image-brief'][2]
 assert.match(compare.items[1],/получить ответы/);assert.match(compare.items[0],/полученные ответы/);assert.match(compare.items[2],/результатам сравнения/)
 assert.match(image.items[1],/найти ошибку/);assert.match(image.items[0],/найденную/);assert.match(image.items[2],/исправленный/)
 for(const q of [compare,image]){
  assert.equal(evaluateGuideAnswer(q,[1,0,2]).correct,true)
  for(const invalid of [[0,1,2],[0,2,1],[1,2,0],[2,0,1],[2,1,0]])assert.equal(evaluateGuideAnswer(q,invalid).correct,false)
 }
})


test('compact player retains accessible targets, non-color feedback and reduced-motion fallback',async()=>{
 const {readFile}=await import('node:fs/promises')
 const css=await readFile(new URL('../src/screens/home/guide-journey.css',import.meta.url),'utf8')
 const source=await readFile(new URL('../src/screens/home/GuideJourney.tsx',import.meta.url),'utf8')
 assert.match(css,/min-height:44px/);assert.match(css,/prefers-reduced-motion:reduce/)
 assert.match(css,/guide-journey-stage\{animation:none\}/)
 assert.match(css,/focus-visible/);assert.match(css,/min-width:0/)
 assert.match(source,/role="status" aria-live="polite"/)
 assert.match(source,/summary tabIndex=\{0\}/)
 assert.match(source,/Место в уроке, не оценка навыка/)
 assert.match(source,/Ответы в тренировке не подтверждают освоение навыка/)
 assert.doesNotMatch(source,/api\.|fetch\(|localStorage\.|confetti\(/)
})

test('durable journeys survive fresh modules and isolate exact revision, account and mode',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=new Map()
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}})
 try{
  const q=guideInteractions['first-request'],revision=[beginnerGuides[0].steps,q],key=guideJourneyKey('live:77','lesson',revision)
  const state={step:1,answers:q.map(initialGuideAnswer),checked:[false,false,false],phase:'question'}
  assert.equal(saveGuideJourney(key,state,q),true)
  const fresh=await import('../src/lib/guide-interactions.ts?reload=durable')
  assert.deepEqual(fresh.readGuideJourney(key,q),state)
  for(const k of [guideJourneyKey('demo:77','lesson',revision),guideJourneyKey('live:78','lesson',revision),guideJourneyKey('live:77','other',revision),guideJourneyKey('live:77','lesson',[...revision,'changed'])])assert.equal(fresh.readGuideJourney(k,q).step,0)
  const storeKey=[...storage.keys()][0]
  storage.set(storeKey,'broken json')
  assert.equal(fresh.readGuideJourney(key,q).step,0)
  assert.equal(fresh.saveGuideJourney(key,state,q),true,'corruption can be repaired by the next attempt')
  storage.set(storeKey,JSON.stringify([[key,{...state,step:999}]]))
  const clean=await import('../src/lib/guide-interactions.ts?reload=invalid')
  assert.equal(clean.readGuideJourney(key,q).step,0)
  storage.set(storeKey,JSON.stringify([[key,{...state,answers:[-1,99,[0,0,0]],checked:[true,true,true]}]]))
  assert.deepEqual(clean.readGuideJourney(key,q).checked,[false,false,false],'malformed answers never retain checked flags')
  const number=guideInteractions['check-answer'][2]
  clean.saveGuideJourney('numeric',{step:0,answers:['private text'],checked:[true]},[number])
  assert.ok(![...storage.values()].join('').includes('private text'),'only numeric challenge input persists')
  for(let i=0;i<45;i++)clean.saveGuideJourney('entry'+i,{step:0,answers:[],checked:[]},[])
  assert.equal(JSON.parse(storage.get(storeKey)).length,40)
  globalThis.localStorage.setItem=()=>{throw Error('QuotaExceeded')}
  assert.equal(clean.saveGuideJourney('quota',state,q),false)
  assert.equal(clean.readGuideJourney('quota',q).step,1,'memory fallback remains useful')
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('SecurityError')}})
  assert.equal(clean.saveGuideJourney('denied',state,q),false);assert.equal(clean.readGuideJourney('denied',q).step,1)
  const staleKey='existing';storage.set(storeKey,JSON.stringify([[staleKey,{...state,step:0}]]));clean.saveGuideJourney(staleKey,state,q);assert.equal(clean.readGuideJourney(staleKey,q).step,1,'failed write cannot resurrect older durable state')
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage}
})
