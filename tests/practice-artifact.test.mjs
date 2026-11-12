import test from 'node:test'
import assert from 'node:assert/strict'
import {artifactKey,emptyArtifact,artifactStatus,readArtifact,saveArtifact,artifactFeedback,exportArtifact,PRACTICE_LIMIT,removeArtifact,artifactRecovery,artifactRecoveryKey,readArtifactSession,createArtifactRecovery,ARTIFACT_RECOVERY_LIMIT} from '../src/lib/practice-artifact.ts'
const criteria=['Факты проверены','Условия соблюдены'], rubric=JSON.stringify(criteria)
test('artifact keys are account/mode and lesson scoped, anonymous is memory only',()=>{
 assert.equal(artifactKey(undefined,'a','b'),null)
 assert.notEqual(artifactKey('live:1','a','b'),artifactKey('demo:1','a','b'))
 assert.notEqual(artifactKey('live:1','a','b'),artifactKey('live:2','a','b'))
 assert.notEqual(artifactKey('live:1','a','b'),artifactKey('live:1','a','c'))
})
test('artifact status never claims an independently verified skill',()=>{
 assert.equal(artifactStatus(emptyArtifact(2)),'empty')
 const value={result:'Работа',evidence:'Сравнил с исходником',revision:'Убрал выдуманную дату',checks:[true,true]}
 assert.equal(artifactStatus(value),'self_checked')
 assert.equal(artifactStatus({...value,evidence:' '}),'draft')
 assert.equal(artifactStatus({...value,checks:[] }),'draft')
 assert.deepEqual(artifactFeedback(value,criteria),[])
 assert.equal(artifactFeedback(emptyArtifact(2),criteria).length,5)
 assert.match(exportArtifact('Урок','Задача',value,criteria),/не подтверждение навыка/)
})
test('explicit local save round trips, blocked storage is not claimed as saved',()=>{
 let saved=null
 const value={result:'Работа',evidence:'Тест',revision:'Исправил',checks:[true,false]}
 assert.equal(saveArtifact('key',value,rubric,{setItem:(_,v)=>{saved=v}}),true)
 assert.deepEqual(readArtifact('key',2,rubric,{getItem:()=>saved}),value)
 assert.equal(saveArtifact(null,value,rubric,{setItem(){throw Error('must not run')}}),false)
 assert.equal(saveArtifact('key',value,rubric,{setItem(){throw Error('quota')}}),false)
 assert.deepEqual(readArtifact('key',2,'changed rubric',{getItem:()=>saved}).checks,[false,false])
})
test('corrupt or maliciously oversized storage cannot break a lesson',()=>{
 for(const raw of ['null','[]','{broken','{"version":1,"value":null}','{"version":2,"value":{}}'])assert.deepEqual(readArtifact('key',2,rubric,{getItem:()=>raw}),emptyArtifact(2))
 assert.deepEqual(readArtifact('key',2,rubric,{getItem(){throw Error('denied')}}),emptyArtifact(2))
 const raw=JSON.stringify({version:1,rubric,value:{result:'x'.repeat(PRACTICE_LIMIT+100),checks:['true',true]}})
 const read=readArtifact('key',2,rubric,{getItem:()=>raw})
 assert.equal(read.result.length,PRACTICE_LIMIT)
 assert.deepEqual(read.checks,[false,true])
})
test('actual artifact UI states local privacy and assessment limitations',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/PracticeArtifact.tsx',import.meta.url)
 let source=await readFile(file,'utf8')
 let code=(await transformWithOxc(source,file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/practice-artifact["'];?/g,'const {artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact,artifactRecovery,artifactRecoveryKey,readArtifactSession}=globalThis.__artifact;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__artifact;')
 code=code.replace(/import ["']\.\/practice-artifact\.css["'];?/g,'')
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 globalThis.__artifact={artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact,artifactRecovery,artifactRecoveryKey,readArtifactSession,Tap:({children,...props})=>createElement('button',props,children)}
 try{
  const {PracticeArtifact}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const html=renderToStaticMarkup(createElement(PracticeArtifact,{course:'free',lesson:'a',title:'Урок',task:'Сделай пример',criteria}))
  assert.match(html,/не подтверждённый навык/)
  assert.match(html,/не отправляется ИИ или преподавателю/)
  assert.match(html,/без синхронизации/)
  assert.match(html,/Скачать .txt/)
  assert.equal((html.match(/<textarea/g)||[]).length,3)
  assert.equal((html.match(/type="checkbox"/g)||[]).length,2)
  assert.match(source,/checks:criteria\.map\(\(\)=>false\)/)
  assert.doesNotMatch(source,/fetch\(|track\(/)
 }finally{delete globalThis.__artifact}
})

test('removing local artifact never claims success on failed storage',()=>{
 let removed=null
 assert.equal(removeArtifact('key',{removeItem:k=>{removed=k}}),true)
 assert.equal(removed,'key')
 assert.equal(removeArtifact('key',{removeItem(){throw Error('blocked')}}),false)
 assert.equal(removeArtifact(null,{removeItem(){throw Error('must not run')}}),true)
})

test('recovery is bounded, isolated, clone-safe and resets checks for new rubrics',()=>{
 const memory=createArtifactRecovery(),value={result:'x'.repeat(PRACTICE_LIMIT+9),evidence:'e',revision:'r',checks:Array(100).fill(true)}
 const key=artifactRecoveryKey('live:1','course','lesson')
 memory.put(key,rubric,{value,dirty:false})
 const got=memory.get(key,rubric,100)
 assert.equal(got.value.result.length,PRACTICE_LIMIT)
 assert.equal(got.value.checks.length,64)
 got.value.result='changed';got.value.checks[0]=false
 assert.notEqual(memory.get(key,rubric,2).value.result,'changed')
 assert.equal(memory.get(key,rubric,2).value.checks[0],true)
 assert.equal(memory.get(key,'new rubric',2).dirty,true)
 assert.deepEqual(memory.get(key,'new rubric',2).value.checks,[false,false])
 for(const other of [artifactRecoveryKey('demo:1','course','lesson'),artifactRecoveryKey('live:2','course','lesson'),artifactRecoveryKey(undefined,'course','lesson'),artifactRecoveryKey('live:1','course','other')])assert.equal(memory.get(other,rubric,2),null)
 for(let i=0;i<ARTIFACT_RECOVERY_LIMIT;i++)memory.put('new'+i,rubric,{value:emptyArtifact(2),dirty:true})
 assert.equal(memory.get(key,rubric,2),null)
 assert.ok(memory.get('new0',rubric,2))
 memory.put('last',rubric,{value:emptyArtifact(2),dirty:true})
 assert.ok(memory.get('new0',rubric,2))
 assert.equal(memory.get('new1',rubric,2),null)
 memory.remove('last');assert.equal(memory.get('last',rubric,2),null)
 memory.put('x'.repeat(1025),rubric,{value,dirty:true})
 assert.equal(memory.get('x'.repeat(1025),rubric,2),null)
 assert.equal(createArtifactRecovery().get(key,rubric,2),null,'fresh page memory is empty')
})

test('real field/save/delete handlers recover unsaved work across SPA unmount without persistent autosave',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite')
 const file=new URL('../src/screens/home/PracticeArtifact.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']react["'];?/g,'const {useEffect,useId,useState}=globalThis.__artifactHandlers;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/practice-artifact["'];?/g,'const {artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact,artifactRecovery,artifactRecoveryKey,readArtifactSession}=globalThis.__artifactHandlers;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__artifactHandlers;')
 code=code.replace(/import ["']\.\/practice-artifact\.css["'];?/g,'')
 for(const name of ['react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 let states=[],index=0,writes=0
 const storage=new Map(),previous=globalThis.localStorage
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>{writes++;storage.set(k,v)},removeItem:k=>storage.delete(k)}
 globalThis.__artifactHandlers={artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact,artifactRecovery,artifactRecoveryKey,readArtifactSession,Tap(){},useId:()=>':artifact:',useEffect(){},useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]}}
 const props={scope:'live:handler-test',course:'free',lesson:'one',title:'Урок',task:'Практика',criteria}
 const nodes=tree=>{if(!tree||typeof tree!=='object')return[];return[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]}
 const label=node=>[node?.props?.children].flat(Infinity).filter(x=>typeof x==='string').join('')
 try{
  const {PracticeArtifact}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const render=(p=props)=>{index=0;const root=PracticeArtifact(p);return root.type(root.props)}
  let tree=render()
  nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Мой результат'}})
  tree=render();nodes(tree).find(n=>n.type==='input').props.onChange({target:{checked:true}})
  assert.equal(writes,0)
  states=[];tree=render() // SPA unmount / Back remount, no beforeunload involved.
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Мой результат')
  assert.equal(nodes(tree).find(n=>n.type==='input').props.checked,true)
  assert.ok(nodes(tree).some(n=>label(n).includes('Есть несохранённые изменения')))
  nodes(tree).find(n=>label(n)==='Сохранить').props.onClick()
  assert.equal(writes,1)
  assert.equal(artifactRecovery.get(artifactRecoveryKey(props.scope,props.course,props.lesson),rubric,2),null,'explicit save clears transient snapshot')
  states=[];tree=render()
  assert.ok(!nodes(tree).some(n=>label(n).includes('Есть несохранённые изменения')))
  nodes(tree).find(n=>n.type==='textarea').props.onChange({target:{value:'Вторая версия'}})
  states=[];tree=render()
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Вторая версия')
  assert.equal(nodes(tree).find(n=>n.type==='input').props.checked,false)
  nodes(tree).find(n=>label(n)==='Удалить эту работу').props.onClick()
  tree=render();nodes(tree).find(n=>label(n)==='Да, удалить').props.onClick()
  states=[];tree=render()
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'')
  assert.equal(storage.size,0)
  assert.equal(artifactRecovery.get(artifactRecoveryKey(props.scope,props.course,props.lesson),rubric,2),null)
 }finally{globalThis.localStorage=previous;delete globalThis.__artifactHandlers}
})

test('session read without recovery respects latest persistent deletion',()=>{
 const old=globalThis.localStorage,key=artifactKey('live:cross-tab','c','l'),recoveryKey=artifactRecoveryKey('live:cross-tab','c','l')
 const saved=JSON.stringify({version:1,rubric,value:{result:'Сохранено',evidence:'e',revision:'r',checks:[true,true]}})
 try{
  globalThis.localStorage={getItem:()=>saved}
  assert.equal(readArtifactSession(recoveryKey,key,2,rubric).value.result,'Сохранено')
  globalThis.localStorage={getItem:()=>null}
  assert.equal(readArtifactSession(recoveryKey,key,2,rubric).value.result,'')
 }finally{globalThis.localStorage=old}
})
