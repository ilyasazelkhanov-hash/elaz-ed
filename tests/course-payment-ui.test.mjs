import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {transformWithOxc} from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const effects=[]
const data=new Map()
const win=new EventTarget(), doc=new EventTarget()
win.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}
doc.visibilityState='visible'
globalThis.window=win;globalThis.document=doc
globalThis.__paymentEffects=effects
const fixtureUrl=moduleUrl(`
export const fixture={invoices:0,reads:0,callbacks:[],events:[],notes:[],boot:async()=> 'ok',openInvoice:async()=> 'pending'};
const listeners=new Set();
export const state={phase:'ok',me:{id:1},courses:[],refreshErrorCode:null,errorCode:null,
 boot:async()=>{fixture.reads++;return fixture.boot()},toast:(text)=>fixture.notes.push(text),guard:()=>{}};
export const emit=()=>listeners.forEach(fn=>fn());
export const useStore=selector=>selector(state);useStore.getState=()=>state;useStore.subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
export class ApiError extends Error {constructor(code,status){super(code);this.code=code;this.status=status}}
export const errorText=error=>error.message;export const isDemo=false;
export const api={courseInvoice:async()=>{fixture.invoices++;return 'https://t.me/$fixture'},courseRequest:async()=>{throw Error('unexpected write')}};
export const canPayStars=true,confirmDialog=async()=>true,openInvoice=link=>fixture.openInvoice(link),haptic={success(){}};
export const telegram={onEvent:(name,fn)=>fixture.callbacks.push([name,fn]),offEvent:(name,fn)=>{fixture.callbacks=fixture.callbacks.filter(item=>item[1]!==fn)}};
export const sfx={levelUp(){}},track=(...args)=>fixture.events.push(args),celebrate=()=>{},Tap='button';
`)
const fake=await import(fixtureUrl)
const reactUrl=moduleUrl(`export const useEffect=fn=>globalThis.__paymentEffects.push(fn);export const useSyncExternalStore=(_,snapshot)=>snapshot();`)
const path=new URL('../src/screens/home/CoursePayment.tsx',import.meta.url)
let {code}=await transformWithOxc(await readFile(path,'utf8'),path.pathname,{lang:'tsx'})
const imports={react:reactUrl,'../../lib/api':fixtureUrl,'../../store':fixtureUrl,'../../lib/tg':fixtureUrl,'../../lib/sfx':fixtureUrl,'../../lib/track':fixtureUrl,'../../ui':fixtureUrl}
code=code.replace(/from (["'])([^"']+)\1/g,(_,quote,name)=>`from ${JSON.stringify(imports[name]??(name.startsWith('.')?new URL(name+'.ts',path).href:import.meta.resolve(name)))}`)
const {CoursePaymentAction,useCoursePaymentRecovery}=await import(moduleUrl(code))
const flush=()=>new Promise(resolve=>setImmediate(resolve))
const nodes=value=>!value?[]:Array.isArray(value)?value.flatMap(nodes):typeof value==='object'?[value,...nodes(value.props?.children)]:[]
const labels=node=>nodes(node).filter(item=>item.type==='button').map(item=>[item, nodesText(item.props.children)])
const nodesText=value=>Array.isArray(value)?value.map(nodesText).join(''):typeof value==='object'&&value?nodesText(value.props?.children):typeof value==='string'?value:''
const course={id:7,price_stars:250,access:false,request:null}
let user=100
function setup(){
 fake.state.me={id:++user};fake.state.courses=[{...course}];fake.state.phase='ok';fake.state.refreshErrorCode=null
 fake.fixture.invoices=0;fake.fixture.reads=0;fake.fixture.events=[];fake.fixture.notes=[]
 fake.fixture.boot=async()=> 'ok';fake.fixture.openInvoice=async()=> 'pending'
 return ()=>CoursePaymentAction({course:fake.state.courses[0]})
}

test('pending state replaces every purchase CTA, repeated check only reads, and navigation retains it',async()=>{
 const render=setup()
 const buy=labels(render()).find(([,text])=>/Открыть курс/.test(text))[0]
 buy.props.onClick();await flush()
 assert.equal(fake.fixture.invoices,1)
 assert.equal(render().props['data-course-payment'],'pending')
 assert.deepEqual(labels(render()).map(([,text])=>text),['Проверить доступ'])
 const retry=labels(render())[0][0]
 retry.props.onClick();retry.props.onClick();await flush()
 assert.equal(fake.fixture.reads,1);assert.equal(fake.fixture.invoices,1)
 assert.equal(render().props['data-course-payment'],'pending')
 fake.fixture.boot=async()=>{throw Error('offline')}
 labels(render())[0][0].props.onClick();await flush()
 assert.match(nodesText(render()),/Не удалось проверить доступ/)
 assert.equal(render().props['data-course-payment'],'pending')
})

test('paid callback plus failed access read retains a visible waiting state without purchase',async()=>{
 const render=setup()
 fake.fixture.openInvoice=async()=> 'paid';fake.fixture.boot=async()=>{throw Error('offline')}
 labels(render())[0][0].props.onClick();await flush()
 assert.equal(render().props['data-course-payment'],'waiting')
 assert.match(nodesText(render()),/Оплата прошла, ожидаем доступ/)
 assert.doesNotMatch(labels(render()).map(([,text])=>text).join(''),/Открыть курс/)
 assert.equal(fake.fixture.invoices,1)
})

test('return recovery binds and removes browser/Telegram events, refreshes access without invoicing',async()=>{
 const render=setup()
 labels(render())[0][0].props.onClick();await flush()
 fake.fixture.boot=async()=>{fake.state.courses=[{...course,access:true}];fake.emit();return 'ok'}
 useCoursePaymentRecovery();const cleanup=effects.pop()();await flush()
 assert.equal(fake.fixture.invoices,1);assert.equal(fake.fixture.reads,1)
 assert.equal(render(),null)
 assert.equal(fake.fixture.callbacks.at(-1)[0],'activated')
 cleanup();assert.equal(fake.fixture.callbacks.length,0)
 win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));await flush()
 assert.equal(fake.fixture.reads,1)
})

test('missing callback times out into an unknown state and cannot start another invoice',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const render=setup();fake.fixture.openInvoice=()=>new Promise(()=>{})
 labels(render())[0][0].props.onClick();await flush()
 assert.equal(render().props['data-course-payment'],'opening')
 t.mock.timers.tick(60_000);await flush()
 assert.equal(render().props['data-course-payment'],'unknown')
 assert.deepEqual(labels(render()).map(([,text])=>text),['Проверить доступ'])
 labels(render())[0][0].props.onClick();await flush()
 assert.equal(fake.fixture.invoices,1)
})

test('changing account does not show or recover another user’s payment state',async()=>{
 const render=setup();labels(render())[0][0].props.onClick();await flush()
 fake.state.me={id:++user}
 assert.equal(render().props['data-course-payment'],'idle')
 useCoursePaymentRecovery();const cleanup=effects.pop()();await flush()
 assert.equal(fake.fixture.reads,0);assert.equal(fake.fixture.invoices,1)
 cleanup()
})

for (const status of ['cancelled','failed']) test(`late ${status} callback after timeout restores retry without creating another invoice`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const render=setup();let finish
 fake.fixture.openInvoice=()=>new Promise(resolve=>{finish=resolve})
 labels(render())[0][0].props.onClick();await flush()
 t.mock.timers.tick(60_000);await flush()
 assert.equal(render().props['data-course-payment'],'unknown')
 finish(status);await flush()
 assert.equal(render().props['data-course-payment'],status)
 assert.match(labels(render()).map(([,text])=>text).join(''),/Открыть курс/)
 assert.equal(fake.fixture.invoices,1);assert.equal(fake.fixture.reads,0)
})

for (const status of ['paid','pending']) test(`late ${status} callback after timeout checks server access without a second invoice`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const render=setup();let finish
 fake.fixture.openInvoice=()=>new Promise(resolve=>{finish=resolve})
 labels(render())[0][0].props.onClick();await flush()
 t.mock.timers.tick(60_000);await flush()
 finish(status);await flush()
 assert.equal(render().props['data-course-payment'],status === 'paid' ? 'waiting' : 'pending')
 assert.equal(fake.fixture.reads,1);assert.equal(fake.fixture.invoices,1)
 assert.equal(fake.state.courses[0].access,false)
 assert.deepEqual(labels(render()).map(([,text])=>text),['Проверить доступ'])
})

test('late callback stays with its original account and cannot read another account',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const render=setup();const originalUser=fake.state.me.id;let finish
 fake.fixture.openInvoice=()=>new Promise(resolve=>{finish=resolve})
 labels(render())[0][0].props.onClick();await flush()
 t.mock.timers.tick(60_000);await flush()
 fake.state.me={id:++user};finish('paid');await flush()
 assert.equal(render().props['data-course-payment'],'idle')
 assert.equal(fake.fixture.reads,0);assert.equal(fake.fixture.invoices,1)
 fake.state.me={id:originalUser}
 assert.equal(render().props['data-course-payment'],'waiting')
})

test('late callback cannot restore a payment hint after server-confirmed access',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const render=setup();let finish
 fake.fixture.openInvoice=()=>new Promise(resolve=>{finish=resolve})
 labels(render())[0][0].props.onClick();await flush()
 t.mock.timers.tick(60_000);await flush()
 fake.fixture.boot=async()=>{fake.state.courses=[{...course,access:true}];fake.emit();return 'ok'}
 labels(render())[0][0].props.onClick();await flush()
 finish('paid');await flush()
 assert.equal(render(),null)
 assert.equal(fake.fixture.reads,1);assert.equal(fake.fixture.invoices,1)
 fake.state.courses=[{...course}]
 assert.equal(render().props['data-course-payment'],'idle')
})
