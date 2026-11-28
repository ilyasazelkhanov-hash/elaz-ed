import test from 'node:test'
import assert from 'node:assert/strict'
import * as model from '../src/lib/guide-interactions.ts'
import * as sparks from '../src/lib/practice-sparks.ts'
import {beginnerGuides} from '../src/lib/beginner-content.ts'
const {guideInteractions,evaluateGuideAnswer,guideAnswerPresent,guideAnswerShape,guideAnswerStarted,initialGuideAnswer,moveGuideItem,guideJourneyKey,readGuideJourney,saveGuideJourney}=model
/** Loads an actual component: React and local modules come from the named harness, packages from disk. */
async function component(path,harness){
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite')
 const file=new URL(path,import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import ["'][^"']+\.css["'];?/g,'')
 code=code.replace(/import\s*\{([^}]*)\}\s*from\s*["'](?:react|\.{1,2}\/[^"']+)["'];?/g,(_match,names)=>`const {${names}}=globalThis.${harness};`)
 for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 assert.doesNotMatch(code,/from ["']\.{1,2}\//,'every local import is supplied by the harness')
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
const rightAnswer=q=>q.type==='build'?q.slots.map(slot=>slot.card):q.type==='spot'?q.answer:q.type==='sort'?q.items.map(item=>item.group):q.type==='choice'?q.correct:q.type==='number'?String(q.answer):q.answer
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
   if(['build','spot','sort'].includes(q.type)){
    assert.ok(q.explanation.length>60&&q.hint.length>40,`${guide.id}: explanation and hint teach, not just grade`)
    assert.equal(guideAnswerPresent(q,initialGuideAnswer(q)),false,'an untouched task cannot be checked')
    assert.deepEqual(evaluateGuideAnswer(q,rightAnswer(q)),{correct:true,explanation:q.explanation})
   }
   if(q.type==='build'){
    assert.ok(q.bank.length>q.slots.length,'distractor cards make the choice meaningful')
    assert.equal(new Set(q.slots.map(slot=>slot.card)).size,q.slots.length);assert.equal(new Set(q.bank).size,q.bank.length)
    assert.ok(q.slots.every(slot=>Number.isInteger(slot.card)&&slot.card>=0&&slot.card<q.bank.length))
   }
   if(q.type==='spot'){
    assert.ok(q.answer.length>=1&&q.answer.length<q.fragments.length,'some fragments are fine as they are')
    assert.deepEqual(q.answer,[...new Set(q.answer)].sort((a,b)=>a-b));assert.ok(q.answer.every(i=>i>=0&&i<q.fragments.length))
   }
   if(q.type==='sort'){
    assert.ok(q.items.length>=4);assert.notEqual(q.groups[0],q.groups[1])
    for(const group of [0,1])assert.ok(q.items.some(item=>item.group===group),'both groups are used')
   }
  }
  assert.ok(questions.some(q=>['build','spot','sort'].includes(q.type)),`${guide.id}: at least one hands-on task`)
 }
 assert.deepEqual([...types].sort(),['build','choice','number','order','sort','spot'])
 assert.doesNotMatch(JSON.stringify(guideInteractions),/[—–]/)
})
test('hands-on tasks accept unfinished work, mark what to recheck and never leak the answer',()=>{
 const build=guideInteractions['first-request'][1],spot=guideInteractions['check-answer'][0],sort=guideInteractions['choose-tool'][1]
 assert.deepEqual([build.type,spot.type,sort.type],['build','spot','sort'])
 // build: one card per slot, unfinished work is valid but not checkable
 assert.deepEqual(initialGuideAnswer(build),[-1,-1,-1])
 assert.equal(guideAnswerShape(build,[2,-1,-1]),true);assert.equal(guideAnswerPresent(build,[2,-1,-1]),false);assert.equal(guideAnswerStarted(build,[2,-1,-1]),true)
 for(const answer of [[2,2,3],[2,0],[2,0,9],[2,0,1.5],'2,0,3',null])assert.equal(guideAnswerShape(build,answer),false,JSON.stringify(answer))
 const swapped=evaluateGuideAnswer(build,[3,0,2])
 assert.deepEqual(swapped.wrong,[0,2]);assert.equal(swapped.correct,false)
 assert.match(swapped.explanation,/«Для кого», «Какой результат нужен»/);assert.ok(swapped.explanation.endsWith(build.hint))
 for(const slot of build.slots)assert.ok(!swapped.explanation.includes(build.bank[slot.card]),'feedback names the block, never the expected card')
 assert.deepEqual(evaluateGuideAnswer(build,[2,0,4]).wrong,[2],'a distractor in one block marks only that block')
 // spot: any ascending selection is valid, an empty one is not checkable
 assert.deepEqual(initialGuideAnswer(spot),[]);assert.equal(guideAnswerStarted(spot,[]),false)
 for(const answer of [[3,1],[1,1],[0,9],[-1]])assert.equal(guideAnswerShape(spot,answer),false,JSON.stringify(answer))
 const partial=evaluateGuideAnswer(spot,[0,1])
 assert.deepEqual(partial.wrong,[0],'only the wrongly marked fragment is flagged');assert.match(partial.explanation,/Лишних отметок: 1\. Не найдено: 2\./)
 assert.doesNotMatch(evaluateGuideAnswer(spot,[1,3]).explanation,/Лишних/);assert.match(evaluateGuideAnswer(spot,[1,3]).explanation,/Не найдено: 1\./)
 assert.equal(evaluateGuideAnswer(spot,spot.fragments.map((_,i)=>i)).correct,false,'marking everything is not a solution')
 // sort: every item needs a group
 assert.equal(guideAnswerPresent(sort,[0,0,1,0,-1]),false);assert.equal(guideAnswerStarted(sort,[0,-1,-1,-1,-1]),true)
 for(const answer of [[0,0,1,0],[0,0,1,0,2],[0,0,1,0,'1']])assert.equal(guideAnswerShape(sort,answer),false,JSON.stringify(answer))
 const mixed=evaluateGuideAnswer(sort,[0,0,0,0,0])
 assert.deepEqual(mixed.wrong,[2,4]);assert.match(mixed.explanation,/Не на месте: 2 из 5\./)
 // an untouched order still starts with its concept, as before
 assert.equal(guideAnswerStarted(guideInteractions['first-request'][2],[0,1,2]),false)
 assert.equal(guideAnswerStarted(guideInteractions['first-request'][0],1),true);assert.equal(guideAnswerStarted(undefined,1),false)
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
 let index=0,states=[];const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn()
 const focusCalls=[],scrollCalls=[]
 const scroller={scrollTop:1800,getBoundingClientRect:()=>({top:76}),scrollTo:options=>scrollCalls.push(options)}
 const heading={focus:options=>focusCalls.push(options),closest:selector=>{assert.equal(selector,'.scroll');return scroller},getBoundingClientRect:()=>({top:460}),scrollIntoView(){assert.fail('step navigation must not scroll outer app/body ancestors')}}
 const effects=[]
 globalThis.__guide={...model,...sparks,Tap(){},useSparks:scope=>sparks.readSparks(scope),answerEffect:(correct,combo)=>effects.push(['answer',correct,combo]),finishEffect:origin=>effects.push(['finish',origin]),useRef:()=>({current:heading}),useId:()=>':guide:',useState(init){const i=index++;if(!(i in states))states[i]=typeof init==='function'?init():init;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}}
 const label=n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string').join('')
 try{
  // The task input is a pure component: expand it, so the assertions below see the real controls.
  const {GuideTaskInput}=await component('../src/screens/home/GuideTask.tsx','__guide');globalThis.__guide.GuideTaskInput=GuideTaskInput
  const nodes=t=>{if(t&&typeof t==='object'&&t.type===GuideTaskInput)t=t.type(t.props);return !t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)]}
  const {GuideJourney,GuideStepEvidence}=await component('../src/screens/home/GuideJourney.tsx','__guide')
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
  assert.deepEqual(effects,[['answer',false,0]],'a mistake gets feedback, never a celebration')
  assert.equal(sparks.readSparks(props.scope).total,0);assert.ok(!nodes(tree).some(n=>n.props?.className==='guide-journey-gain'))
  nodes(tree).find(n=>label(n)==='Попробовать ещё').props.onClick()
  tree=render();assert.equal(nodes(tree).filter(n=>n.type==='input')[0].props.checked,true,'retry keeps the learner answer')
  assert.ok(!nodes(tree).some(n=>n.props?.role==='status'))
  nodes(tree).filter(n=>n.type==='input')[1].props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.ok(nodes(tree).some(n=>label(n)==='Дальше'))
  assert.equal(nodes(tree).filter(n=>n.props?.className==='guide-journey-primary').length,1,'one primary action at a time')
  assert.deepEqual(effects.at(-1),['answer',true,0]);assert.equal(sparks.readSparks(props.scope).total,sparks.SPARK_RULES.retry,'success after a mistake earns the smaller local award')
  assert.match(label(nodes(tree).find(n=>n.props?.className==='guide-journey-gain')),/^\+5 искр$/)
  assert.equal(nodes(tree).find(n=>n.props?.className==='guide-journey-sparks').props.children.at(-1),sparks.SPARK_RULES.retry,'the counter shows the local total next to the lesson place')
  nodes(tree).filter(n=>n.type==='input')[0].props.onChange()
  tree=render();assert.ok(!nodes(tree).some(n=>label(n)==='Дальше'),'editing a correct answer removes continuation until rechecked')
  assert.ok(!nodes(tree).some(n=>n.props?.className==='guide-journey-gain'),'an edited answer no longer shows the old award')
  nodes(tree).filter(n=>n.type==='input')[1].props.onChange()
  tree=render();nodes(tree).find(n=>label(n)==='Проверить ответ').props.onClick()
  tree=render();assert.equal(sparks.readSparks(props.scope).total,sparks.SPARK_RULES.retry,'rechecking a solved task earns nothing again')
  assert.ok(!nodes(tree).some(n=>n.props?.className==='guide-journey-gain'));assert.ok(!effects.some(effect=>effect[0]==='finish'),'one solved task is not a finished training')
  tree=render();nodes(tree).find(n=>label(n)==='Дальше').props.onClick()
  assert.ok(focusCalls.every(options=>options.preventScroll===true));assert.deepEqual(scrollCalls.at(-1),{top:2172,behavior:'instant'})
  // the same player without the sparks layer: no counter, no award line, the exercise itself is unchanged
  sparks.configureSparks({enabled:false})
  try{const plain=render();assert.ok(!nodes(plain).some(n=>['guide-journey-sparks','guide-journey-gain'].includes(n.props?.className)));assert.ok(nodes(plain).some(n=>label(n)==='К вопросу'));assert.ok(nodes(plain).some(n=>label(n)==='Тренировка без оценки · как сохраняются шаги'))}finally{sparks.configureSparks({enabled:true})}
  states=[];tree=render();assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Передай факты'))
  nodes(tree).find(n=>label(n)==='Попробовать заново без подсказок').props.onClick()
  states=[];tree=render()
  nodes(tree).find(n=>label(n)==='Вернуться к предыдущей попытке').props.onClick()
  tree=render();assert.ok(nodes(tree).some(n=>n.type==='h2'&&label(n)==='Передай факты'))
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
 assert.doesNotMatch(source,/api\.|fetch\(|localStorage\.|confetti\(|setTimeout|setInterval/)
 // N13, 27 November 2026: local sparks and a short celebration replace the earlier "no sound or confetti" rule.
 // They stay behind shared helpers that honour reduced motion and the app sound setting, and never claim XP.
 const effects=await readFile(new URL('../src/screens/home/practice-effects.ts',import.meta.url),'utf8')
 const ui=await readFile(new URL('../src/ui.tsx',import.meta.url),'utf8')
 assert.match(source,/answerEffect\(outcome\.correct,scored\.combo\)/);assert.match(source,/if\(complete\)finishEffect\(/)
 assert.doesNotMatch(effects,/confetti\(|setTimeout|setInterval|sfx\.bad/,'effects use shared helpers, no timers and no buzzer for a mistake')
 assert.match(effects,/import \{ burst, celebrate \} from '\.\.\/\.\.\/ui'/)
 assert.equal(ui.match(/disableForReducedMotion: true/g)?.length,2,'burst and celebrate both skip confetti for reduced motion')
 assert.match(css,/guide-journey-gain\{animation:none\}/)
 assert.match(source,/Это не XP, не уровень и не подтверждение навыка/)
 assert.match(source,/локальные очки этого браузера, не XP/)
 assert.doesNotMatch(source,/setMe\(|\.xp\b|completed:\s*true/,'local points never touch the server profile or completion')
})
test('task inputs are pure controls: every tap produces the next answer through the parent',async()=>{
 const taps=[]
 globalThis.__task={...model,Tap:'button'}
 try{
  const {GuideTaskInput}=await component('../src/screens/home/GuideTask.tsx','__task')
  const nodes=t=>!t||typeof t!=='object'?[]:[t,...[t.props?.children].flat(Infinity).flatMap(nodes)],text=n=>[n.props?.children].flat(Infinity).filter(x=>typeof x==='string').join('')
  const render=(question,answer,extra={})=>nodes(GuideTaskInput({id:'t',question,answer,onChange:value=>taps.push(value),...extra}))
  const build=guideInteractions['first-request'][1],spot=guideInteractions['check-answer'][0],sort=guideInteractions['choose-tool'][1]
  // build: the next card lands in the first free block, a filled block can be freed
  let tree=render(build,[-1,-1,-1])
  const bank=()=>tree.filter(n=>n.type==='button'&&'aria-pressed' in n.props)
  assert.equal(bank().length,build.bank.length);assert.ok(bank().every(n=>!n.props.disabled))
  assert.equal(tree.filter(n=>n.type==='li')[0].props['data-active'],true)
  bank()[2].props.onClick();assert.deepEqual(taps.pop(),[2,-1,-1])
  tree=render(build,[2,-1,0])
  assert.equal(tree.filter(n=>n.type==='li')[1].props['data-active'],true,'the first free block is the target')
  assert.deepEqual(bank().map(n=>n.props.disabled),[true,false,true,false,false],'a used card cannot be placed twice')
  bank()[3].props.onClick();assert.deepEqual(taps.pop(),[2,3,0])
  const filled=tree.filter(n=>n.type==='button'&&/Освободить блок$/.test(n.props['aria-label']??''))
  assert.equal(filled.length,2);filled[0].props.onClick();assert.deepEqual(taps.pop(),[-1,-1,0])
  tree=render(build,[2,0,3]);assert.ok(bank().every(n=>n.props.disabled),'no free block: free one first')
  tree=render(build,[3,0,2],{wrong:[0,2]})
  assert.deepEqual(tree.filter(n=>n.type==='li').map(n=>n.props['data-wrong']),[true,undefined,true])
  assert.equal(tree.filter(n=>n.props?.className==='guide-journey-recheck').length,2,'the mark is text, not colour alone')
  // spot: native checkboxes toggle an ascending selection
  tree=render(spot,[3]);const boxes=()=>tree.filter(n=>n.type==='input'&&n.props.type==='checkbox')
  assert.equal(boxes().length,spot.fragments.length);assert.deepEqual(boxes().map(n=>n.props.checked),[false,false,false,true,false,false])
  boxes()[1].props.onChange();assert.deepEqual(taps.pop(),[1,3]);boxes()[3].props.onChange();assert.deepEqual(taps.pop(),[])
  tree=render(spot,[0,1],{wrong:[0]});assert.equal(text(tree.find(n=>n.props?.className==='guide-journey-recheck')),'лишняя отметка')
  // sort: one native radio group per item
  tree=render(sort,[0,-1,-1,-1,-1]);const radios=()=>tree.filter(n=>n.type==='input'&&n.props.type==='radio')
  assert.equal(radios().length,sort.items.length*2);assert.equal(new Set(radios().map(n=>n.props.name)).size,sort.items.length)
  assert.deepEqual(radios().slice(0,2).map(n=>n.props.checked),[true,false])
  radios()[5].props.onChange();assert.deepEqual(taps.pop(),[0,-1,1,-1,-1])
  assert.equal(tree.filter(n=>n.type==='fieldset').length,sort.items.length);assert.equal(tree.filter(n=>n.type==='legend').length,sort.items.length)
  // a locked task (single-attempt quiz) disables every control
  for(const [question,answer] of [[build,[2,0,3]],[spot,[1]],[sort,[0,0,1,0,1]],[guideInteractions['first-request'][0],1],[guideInteractions['check-answer'][2],'7'],[guideInteractions['first-request'][2],[1,2,0]]]){
   const controls=render(question,answer,{locked:true}).filter(n=>n.type==='input'||n.type==='button')
   assert.ok(controls.length>0&&controls.every(n=>n.props.disabled===true),question.type)
  }
  assert.equal(taps.length,0)
 }finally{delete globalThis.__task}
})

test('unfinished hands-on answers survive a reload; malformed ones reset without a checked flag',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=new Map()
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}})
 try{
  const q=[guideInteractions['first-request'][1],guideInteractions['check-answer'][0],guideInteractions['choose-tool'][1]],key=guideJourneyKey('live:90','hands-on',q)
  const state={step:0,phase:'question',answers:[[2,-1,-1],[1],[0,-1,-1,1,-1]],checked:[false,false,false]}
  assert.equal(saveGuideJourney(key,state,q),true)
  const fresh=await import('../src/lib/guide-interactions.ts?reload=hands-on')
  assert.deepEqual(fresh.readGuideJourney(key,q),state,'a half-built request is still there after a reload')
  const storeKey=[...storage.keys()][0]
  storage.set(storeKey,JSON.stringify([[key,{...state,answers:[[2,2,2],[4,1],[0,0,0,0,7]],checked:[true,true,true]}]]))
  const clean=await import('../src/lib/guide-interactions.ts?reload=hands-on-invalid')
  assert.deepEqual(clean.readGuideJourney(key,q),{step:0,phase:'question',answers:q.map(initialGuideAnswer),checked:[false,false,false]})
  storage.set(storeKey,JSON.stringify([[key,{...state,answers:[[2,0,-1],[1],[0,0,1,0,1]],checked:[true,true,true]}]]))
  const partial=await import('../src/lib/guide-interactions.ts?reload=hands-on-partial')
  assert.deepEqual(partial.readGuideJourney(key,q).checked,[false,true,true],'an unfinished answer cannot stay checked')
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage}
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
