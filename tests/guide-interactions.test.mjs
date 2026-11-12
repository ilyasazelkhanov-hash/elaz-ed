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
 assert.equal(evaluateGuideAnswer(q,'6,0').correct,true)
 assert.match(evaluateGuideAnswer(q,'12').explanation,/18 \/ 300/)
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
 for(let i=0;i<20;i++)saveGuideJourney('evict'+i,{step:1,answers:[],checked:[]})
 assert.equal(readGuideJourney(key,q).step,0)
})
test('actual player explains errors, permits retry, preserves answer and supports accessible full view',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite')
 const file=new URL('../src/screens/home/GuideJourney.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/g,'const {useId,useRef,useState}=globalThis.__guide;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/guide-interactions["'];?/g,'const {evaluateGuideAnswer,guideAnswerPresent,guideInteractions,guideJourneyKey,moveGuideItem,readGuideJourney,saveGuideJourney}=globalThis.__guide;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__guide;')
 code=code.replace(/import ["']\.\/guide-journey\.css["'];?/g,'')
 for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let index=0,states=[];const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn()
 globalThis.__guide={...model,Tap(){},useRef:()=>({current:null}),useId:()=>':guide:',useState(init){const i=index++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}}
 const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)],label=n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string').join('')
 try{
  const {GuideJourney}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const props={scope:'test:handler',guide:beginnerGuides[0],children:'Практическая работа'}
  const render=()=>{index=0;const element=GuideJourney(props);return element.type(element.props)}
  let tree=render();assert.equal(nodes(tree).find(n=>label(n)==='Дальше').props.disabled,true)
  nodes(tree).find(n=>n.type==='input').props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.ok(nodes(tree).some(n=>label(n)==='Разберём и попробуем ещё раз'))
  assert.equal(nodes(tree).find(n=>label(n)==='Дальше').props.disabled,true)
  nodes(tree).filter(n=>n.type==='input')[1].props.onChange()
  tree=render();assert.ok(!nodes(tree).some(n=>n.props?.role==='status'))
  nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.equal(nodes(tree).find(n=>label(n)==='Дальше').props.disabled,false)
  nodes(tree).find(n=>label(n)==='Дальше').props.onClick()
  states=[];tree=render();assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Передай факты'))
  nodes(tree).find(n=>label(n)==='Весь материал').props.onClick()
  tree=render();assert.equal(nodes(tree).find(n=>n.type==='div'&&n.props.children==='Практическая работа').props.hidden,false)
  assert.ok(nodes(tree).some(n=>label(n)==='Вернуться к шагам'))
 }finally{delete globalThis.__guide;globalThis.requestAnimationFrame=previous}
})
