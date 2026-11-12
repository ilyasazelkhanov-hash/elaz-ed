import test from 'node:test'
import assert from 'node:assert/strict'
import {artifactKey,emptyArtifact,artifactStatus,readArtifact,saveArtifact,artifactFeedback,exportArtifact,PRACTICE_LIMIT,removeArtifact} from '../src/lib/practice-artifact.ts'
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
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/lib\/practice-artifact["'];?/g,'const {artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact}=globalThis.__artifact;')
 code=code.replace(/import[^;\n]*from ["']\.\.\/\.\.\/ui["'];?/g,'const {Tap}=globalThis.__artifact;')
 code=code.replace(/import ["']\.\/practice-artifact\.css["'];?/g,'')
 for(const name of ['react','react/jsx-runtime','lucide-react'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 globalThis.__artifact={artifactFeedback,artifactKey,artifactStatus,exportArtifact,PRACTICE_LIMIT,readArtifact,saveArtifact,emptyArtifact,removeArtifact,Tap:({children,...props})=>createElement('button',props,children)}
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
