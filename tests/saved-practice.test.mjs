import test from 'node:test'
import assert from 'node:assert/strict'
import { savedFreePractice, deleteSavedFreePractice } from '../src/lib/saved-practice.ts'
import { beginnerGuides } from '../src/lib/beginner-content.ts'
import { artifactKey, saveArtifact, artifactRecovery, artifactRecoveryKey } from '../src/lib/practice-artifact.ts'
const guide=beginnerGuides[0],value={result:'Мой текст',evidence:'Проверка',revision:'Правки',checks:guide.checks.map(()=>true)}
function memory(){const entries=new Map();return {entries,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)}}
function seed(storage,scope='live:1',rubric=JSON.stringify(guide.checks)){saveArtifact(artifactKey(scope,'free-start',guide.id),value,rubric,storage)}
test('shelf reads only current account/mode and the free guide allowlist',()=>{
 const store=memory();seed(store);seed(store,'demo:1');seed(store,'live:2')
 store.setItem(artifactKey('live:1','academy','fake'),JSON.stringify({version:1,value}))
 store.setItem(artifactKey('live:1','free-start','fake'),JSON.stringify({version:1,value}))
 const requested=[],read={getItem:key=>{requested.push(key);return store.getItem(key)}}
 const result=savedFreePractice('live:1',read)
 assert.equal(result.unavailable,false);assert.equal(result.items.length,1)
 assert.deepEqual(result.items[0],{id:guide.id,title:guide.title,path:`/start/${guide.id}/work`,status:'self_checked'})
 assert.deepEqual(requested,beginnerGuides.map(g=>artifactKey('live:1','free-start',g.id)))
 assert.deepEqual(savedFreePractice(undefined,{getItem(){throw Error('must not read')}}),{items:[],unavailable:false})
})
test('only persisted nonempty supported records appear, not unsaved recovery or corrupt data',()=>{
 const store=memory()
 for(const raw of ['null','{broken','{"version":2,"value":{}}','{"version":1,"value":{}}']){
  store.setItem(artifactKey('live:1','free-start',guide.id),raw)
  assert.equal(savedFreePractice('live:1',store).items.length,0)
 }
 artifactRecovery.put(artifactRecoveryKey('live:1','free-start',guide.id),'rubric',{value,dirty:true})
 assert.equal(savedFreePractice('live:1',store).items.length,0)
 artifactRecovery.remove(artifactRecoveryKey('live:1','free-start',guide.id))
 seed(store,'live:1','old rubric')
 assert.equal(savedFreePractice('live:1',store).items[0].status,'draft')
})
test('blocked storage is not presented as an empty shelf',()=>{
 assert.deepEqual(savedFreePractice('live:1',{getItem(){throw Error('blocked')}}),{items:[],unavailable:true})
})
test('delete is exact, allowlisted, clears matching recovery only and reports failures',()=>{
 const store=memory();seed(store);seed(store,'demo:1');seed(store,'live:2')
 const recovery=artifactRecoveryKey('live:1','free-start',guide.id)
 artifactRecovery.put(recovery,'rubric',{value,dirty:true})
 assert.equal(deleteSavedFreePractice('live:1',guide.id,{removeItem(){throw Error('blocked')}}),false)
 assert.ok(artifactRecovery.get(recovery,'rubric',3));assert.equal(savedFreePractice('live:1',store).items.length,1)
 assert.equal(deleteSavedFreePractice('live:1','../../bad',store),false)
 assert.equal(deleteSavedFreePractice(undefined,guide.id,store),false)
 assert.equal(deleteSavedFreePractice('live:1',guide.id,store),true)
 assert.equal(artifactRecovery.get(recovery,'rubric',3),null)
 assert.equal(savedFreePractice('live:1',store).items.length,0)
 assert.equal(savedFreePractice('demo:1',store).items.length,1)
 assert.equal(savedFreePractice('live:2',store).items.length,1)
})
test('actual shelf renders bounded copy, honest status and an explicit accessible delete action',async()=>{
 const {readFile}=await import('node:fs/promises'),{transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/profile/SavedPracticeShelf.tsx',import.meta.url),source=await readFile(file,'utf8')
 let code=(await transformWithOxc(source,file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/saved-practice["'];?/g,'const {savedFreePractice,deleteSavedFreePractice}=globalThis.__shelf;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/store["'];?/g,'const {useStore}=globalThis.__shelf;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__shelf;')
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const store=memory();seed(store)
 globalThis.__shelf={savedFreePractice:scope=>savedFreePractice(scope,store),deleteSavedFreePractice,useStore:fn=>fn({stack:[],push(){}}),Tap:({children,...props})=>createElement('button',props,children)}
 try{
  const {SavedPracticeShelf}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const html=renderToStaticMarkup(createElement(SavedPracticeShelf,{scope:'live:1'}))
  assert.match(html,/Мои бесплатные работы/);assert.match(html,/Без синхронизации/);assert.match(html,/не подтверждённые навыки/)
  assert.match(html,/Самопроверка выполнена/);assert.match(html,/aria-label="Удалить работу/)
  assert.doesNotMatch(html,/Мой текст/)
  assert.match(source,/pending===item.id/);assert.match(source,/Да, удалить/);assert.match(source,/Отмена/)
  assert.match(source,/\[scope,depth\]/);assert.doesNotMatch(source,/fetch\(|track\(/)
 }finally{delete globalThis.__shelf}
})
