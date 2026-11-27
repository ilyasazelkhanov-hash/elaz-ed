import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {SPARK_RULES,configureSparks,readSparks,scoreAnswer,scoreFinish,sparkCombo,sparkKey,sparksEnabled,sparksWord,subscribeSparks} from '../src/lib/practice-sparks.ts'

const store=()=>{const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>{map.set(key,String(value))}}}
test('a task is earned once: first try, smaller award after a mistake, nothing for a repeat',()=>{
 const storage=store(),scope='live:1',revision=['steps','questions']
 const first=sparkKey('guide',revision,0),second=sparkKey('guide',revision,1)
 assert.deepEqual(scoreAnswer(scope,first,true,storage),{gained:SPARK_RULES.first,bonus:0,combo:1,total:10,repeat:false})
 assert.deepEqual(scoreAnswer(scope,first,true,storage),{gained:0,bonus:0,combo:1,total:10,repeat:true},'a repeat neither pays again nor extends the run')
 assert.deepEqual(scoreAnswer(scope,second,false,storage),{gained:0,bonus:0,combo:0,total:10,repeat:false})
 assert.deepEqual(scoreAnswer(scope,second,false,storage),{gained:0,bonus:0,combo:0,total:10,repeat:false})
 assert.deepEqual(scoreAnswer(scope,second,true,storage),{gained:SPARK_RULES.retry,bonus:0,combo:0,total:15,repeat:false})
 assert.deepEqual(scoreAnswer(scope,second,false,storage),{gained:0,bonus:0,combo:0,total:15,repeat:true},'a later mistake does not take earned points away')
 assert.deepEqual(readSparks(scope,storage),{total:15,best:1})
 assert.notEqual(sparkKey('guide',[...revision,'changed'],0),first,'a changed task is a new task')
 assert.notEqual(sparkKey('other',revision,0),first);assert.notEqual(sparkKey('guide',revision,'finish'),first)
})
test('a run of first-try answers adds a bonus from the third and lives only in session memory',()=>{
 const storage=store(),scope='live:2'
 const gains=[0,1,2,3].map(i=>scoreAnswer(scope,sparkKey('g',1,i),true,storage))
 assert.deepEqual(gains.map(row=>[row.gained,row.bonus,row.combo]),[[10,0,1],[10,0,2],[15,5,3],[15,5,4]])
 assert.equal(sparkCombo(scope),4);assert.deepEqual(readSparks(scope,storage),{total:50,best:4})
 scoreAnswer(scope,sparkKey('g',1,9),false,storage)
 assert.equal(sparkCombo(scope),0);assert.equal(readSparks(scope,storage).best,4,'the best run stays')
 assert.ok(![...storage.map.values()].join('').includes('combo'),'the current run is not persisted')
})
test('finish bonus is paid once per exact exercise set',()=>{
 const storage=store(),scope='live:3',key=sparkKey('g',1,'finish')
 assert.deepEqual(scoreFinish(scope,key,storage),{gained:SPARK_RULES.finish,total:20})
 assert.deepEqual(scoreFinish(scope,key,storage),{gained:0,total:20})
})
test('accounts and modes never share a total; corrupt or oversized storage reads as empty',()=>{
 const storage=store()
 scoreAnswer('live:4',sparkKey('g',1,0),true,storage)
 assert.deepEqual(readSparks('demo:4',storage),{total:0,best:0});assert.deepEqual(readSparks('live:5',storage),{total:0,best:0})
 const key='og:practice-sparks:v1:live:40'
 for(const raw of ['broken',JSON.stringify([]),JSON.stringify({version:2,total:5,best:0,awards:{},misses:[]}),JSON.stringify({version:1,total:-5,best:0,awards:{},misses:[]}),JSON.stringify({version:1,total:1.5,best:0,awards:{},misses:[]}),JSON.stringify({version:1,total:5,best:0,awards:[],misses:[]}),'x'.repeat(200000)]){
  storage.map.set(key,raw);assert.deepEqual(readSparks('live:40',storage),{total:0,best:0},raw.slice(0,40))
 }
 storage.map.set(key,JSON.stringify({version:1,total:30,best:2,awards:{ok:10,bad:'10',huge:99999},misses:['m',5]}))
 assert.deepEqual(readSparks('live:40',storage),{total:30,best:2})
 assert.equal(scoreAnswer('live:40','ok',true,storage).repeat,true,'valid earned keys survive the cleanup of invalid ones')
})
test('blocked storage keeps the session usable and never resurrects an older total',()=>{
 const blocked={getItem(){throw Error('SecurityError')},setItem(){throw Error('QuotaExceeded')}}
 assert.equal(scoreAnswer('live:6',sparkKey('g',1,0),true,blocked).total,10)
 assert.equal(scoreAnswer('live:6',sparkKey('g',1,1),true,blocked).total,20)
 assert.deepEqual(readSparks('live:6',blocked),{total:20,best:2})
 const storage=store()
 scoreAnswer('live:7',sparkKey('g',1,0),true,storage)
 const stale=storage.map.get('og:practice-sparks:v1:live:7')
 storage.setItem=()=>{throw Error('QuotaExceeded')}
 scoreAnswer('live:7',sparkKey('g',1,1),true,storage)
 assert.equal(storage.map.get('og:practice-sparks:v1:live:7'),stale)
 assert.equal(readSparks('live:7',storage).total,20,'memory holds the newer total when the write failed')
})
test('stored awards stay bounded while the total is kept',()=>{
 const storage=store(),scope='live:8'
 for(let i=0;i<430;i++)scoreAnswer(scope,sparkKey('bulk',1,i),false,storage),scoreAnswer(scope,sparkKey('bulk',1,i),true,storage)
 const saved=JSON.parse(storage.map.get('og:practice-sparks:v1:live:8'))
 assert.equal(Object.keys(saved.awards).length,400);assert.equal(saved.total,430*SPARK_RULES.retry);assert.ok(saved.misses.length<=120)
})
test('subscribers hear changes of their own scope only',()=>{
 const storage=store(),heard=[]
 const stop=subscribeSparks('live:9',()=>heard.push(readSparks('live:9',storage).total))
 scoreAnswer('live:10',sparkKey('g',1,0),true,storage);assert.deepEqual(heard,[])
 scoreAnswer('live:9',sparkKey('g',1,0),true,storage);assert.deepEqual(heard,[10])
 stop();scoreAnswer('live:9',sparkKey('g',1,1),true,storage);assert.deepEqual(heard,[10])
})
test('one switch turns the layer off: nothing is scored, stored or celebrated',async()=>{
 assert.equal(sparksEnabled(),true,'on by default')
 const storage=store();configureSparks({enabled:false})
 try{
  assert.deepEqual(scoreAnswer('live:off',sparkKey('g',1,0),true,storage),{gained:0,bonus:0,combo:0,total:0,repeat:false})
  assert.deepEqual(scoreAnswer('live:off',sparkKey('g',1,1),false,storage),{gained:0,bonus:0,combo:0,total:0,repeat:false})
  assert.deepEqual(scoreFinish('live:off',sparkKey('g',1,'finish'),storage),{gained:0,total:0})
  assert.equal(storage.map.size,0);assert.equal(sparkCombo('live:off'),0)
 }finally{configureSparks({enabled:true})}
 const source=await readFile(new URL('../src/lib/practice-sparks.ts',import.meta.url),'utf8')
 assert.match(source,/VITE_PRACTICE_SPARKS !== 'off'/)
 const effects=await readFile(new URL('../src/screens/home/practice-effects.ts',import.meta.url),'utf8')
 assert.equal(effects.match(/if \(!sparksEnabled\(\)\)/g)?.length,3,'every effect checks the same switch')
 for(const file of ['GuideJourney.tsx','FreeStart.tsx','Warmup.tsx'])assert.match(await readFile(new URL('../src/screens/home/'+file,import.meta.url),'utf8'),/sparksEnabled\(\)&&</,file)
})
test('sparks are named and described as local practice points, never as XP',async()=>{
 assert.deepEqual([1,2,5,11,21,22,25,101,112].map(sparksWord),['искра','искры','искр','искр','искра','искры','искр','искра','искр'])
 const source=await readFile(new URL('../src/lib/practice-sparks.ts',import.meta.url),'utf8')
 assert.match(source,/never XP/);assert.doesNotMatch(source,/fetch\(|api\.|import /,'pure local module without network or app imports')
 const hook=await readFile(new URL('../src/lib/use-practice-sparks.ts',import.meta.url),'utf8')
 assert.match(hook,/subscribeSparks\(scope, update\)/)
})
