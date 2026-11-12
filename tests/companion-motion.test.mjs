import test from 'node:test'
import assert from 'node:assert/strict'
import { startCompanionMotion } from '../src/lib/companion-motion.ts'

function environment() {
 let time=0,id=0
 const timers=new Map(),listeners=new Map()
 const env={isSecureContext:true,performance:{now:()=>time},DeviceOrientationEvent:{},DeviceMotionEvent:{},
  setTimeout(fn,delay){timers.set(++id,{fn,at:time+delay});return id},clearTimeout(id){timers.delete(id)},
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},
  removeEventListener(name,fn){listeners.get(name)?.delete(fn)}}
 return {env,timers,listeners,emit(name,event={}){for(const fn of [...(listeners.get(name)||[])])fn(event)},advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn()}},count(){return [...listeners.values()].reduce((n,s)=>n+s.size,0)}}
}
function outputs(){const statuses=[],tilts=[],shakes=[];return{statuses,tilts,shakes,onStatus:s=>statuses.push(s),onTilt:s=>tilts.push(s),onShake:()=>shakes.push(true)}}

test('both permission calls start synchronously inside the initiating gesture',async()=>{
 const e=environment(),o=outputs(),calls=[];let resolve1,resolve2
 e.env.DeviceOrientationEvent.requestPermission=(...args)=>{calls.push(['orientation',args]);return new Promise(r=>resolve1=r)}
 e.env.DeviceMotionEvent.requestPermission=(...args)=>{calls.push(['motion',args]);return new Promise(r=>resolve2=r)}
 const promise=startCompanionMotion({window:e.env,...o})
 assert.deepEqual(calls,[['orientation',[false]],['motion',[]]])
 assert.deepEqual(o.statuses,['requesting']);assert.equal(e.count(),0)
 resolve1('granted');resolve2('granted');const handle=await promise
 assert.equal(e.count(),2);assert.deepEqual(o.statuses,['requesting'])
 e.emit('deviceorientation',{beta:50,gamma:-4});assert.deepEqual(o.statuses,['requesting','active']);assert.deepEqual(o.tilts.at(-1),{x:0,y:0})
 handle.stop();assert.equal(e.count(),0);assert.equal(e.timers.size,0);assert.equal(o.statuses.at(-1),'off')
})
test('no samples is unsupported, never a successful sensor claim',async()=>{
 const e=environment(),o=outputs();await startCompanionMotion({window:e.env,...o})
 e.emit('deviceorientation',{beta:NaN,gamma:0});e.emit('devicemotion',{acceleration:{x:null,y:0,z:0}})
 e.advance(2300);assert.equal(o.statuses.at(-1),'unsupported');assert.equal(e.count(),0);assert.equal(e.timers.size,0)
})
test('orientation is calibrated, clamped, throttled and requires two finite values',async()=>{
 const e=environment(),o=outputs();await startCompanionMotion({window:e.env,...o})
 e.emit('deviceorientation',{beta:70,gamma:10});e.advance(100);e.emit('deviceorientation',{beta:85,gamma:22.5})
 assert.deepEqual(o.tilts.at(-1),{x:.5,y:.5});const n=o.tilts.length
 e.advance(20);e.emit('deviceorientation',{beta:100,gamma:35});assert.equal(o.tilts.length,n)
 e.advance(100);e.emit('deviceorientation',{beta:500,gamma:500});assert.ok(Math.abs(o.tilts.at(-1).x)<=1&&Math.abs(o.tilts.at(-1).y)<=1)
})
test('constant gravity and single peaks do not shake; repeated peaks have a cooldown',async()=>{
 const e=environment(),o=outputs();await startCompanionMotion({window:e.env,...o})
 const sample=(x=0)=>e.emit('devicemotion',{accelerationIncludingGravity:{x,y:0,z:9.81}})
 sample();for(let i=0;i<5;i++){e.advance(100);sample()};assert.equal(o.shakes.length,0)
 e.advance(100);sample(14);assert.equal(o.shakes.length,0)
 e.advance(150);sample(-14);assert.equal(o.shakes.length,1)
 for(let i=0;i<10;i++){e.advance(100);sample(i%2?14:-14)};assert.equal(o.shakes.length,1)
 e.advance(4000);sample(100);assert.equal(o.shakes.length,1,'a long suspended gap recalibrates')
})
test('abort while permission is pending never attaches later listeners',async()=>{
 const e=environment(),o=outputs(),abort=new AbortController();let allow
 e.env.DeviceOrientationEvent.requestPermission=()=>new Promise(r=>allow=r);delete e.env.DeviceMotionEvent
 const promise=startCompanionMotion({window:e.env,signal:abort.signal,...o});abort.abort();assert.equal(o.statuses.at(-1),'off')
 allow('granted');const handle=await promise;assert.equal(e.count(),0);assert.equal(e.timers.size,0);handle.stop();assert.equal(o.statuses.filter(s=>s==='off').length,1)
})
test('partial permission keeps the available capability; denied and insecure paths are honest',async()=>{
 const e=environment(),o=outputs();e.env.DeviceOrientationEvent.requestPermission=async()=> 'denied';e.env.DeviceMotionEvent.requestPermission=async()=> 'granted'
 const handle=await startCompanionMotion({window:e.env,...o});assert.equal(e.count(),1);e.emit('devicemotion',{acceleration:{x:0,y:0,z:0}});assert.equal(o.statuses.at(-1),'active');handle.stop()
 const denied=environment(),d=outputs();denied.env.DeviceOrientationEvent.requestPermission=async()=> 'denied';denied.env.DeviceMotionEvent.requestPermission=async()=> 'denied';await startCompanionMotion({window:denied.env,...d});assert.equal(d.statuses.at(-1),'denied');assert.equal(denied.count(),0)
 const insecure=environment(),n=outputs();insecure.env.isSecureContext=false;insecure.env.DeviceOrientationEvent.requestPermission=()=>assert.fail('must not prompt on insecure origin');await startCompanionMotion({window:insecure.env,...n});assert.equal(n.statuses.at(-1),'unsupported')
})
function nativeFixture(){
 const events=new Map(),calls=[],callbacks={}
 const sensor=name=>({beta:0,gamma:0,x:0,y:0,z:9.81,start(params,callback){calls.push(['start',name,params]);callbacks[name]=callback},stop(){calls.push(['stop',name])}})
 const telegram={DeviceOrientation:sensor('tilt'),Accelerometer:sensor('shake'),onEvent(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn)},offEvent(name,fn){events.get(name)?.delete(fn)}}
 return{telegram,events,calls,callbacks,emit(name,payload){for(const fn of [...(events.get(name)||[])])fn(payload)},count(){return [...events.values()].reduce((n,s)=>n+s.size,0)}}
}
test('Telegram uses radian orientation, reads sensor object, and started callback is not a reading',async()=>{
 const e=environment(),o=outputs(),n=nativeFixture()
 e.env.DeviceOrientationEvent.requestPermission=()=>assert.fail('native flow must not also ask Web permission')
 const handle=await startCompanionMotion({window:e.env,telegram:n.telegram,...o})
 n.callbacks.tilt(true);n.callbacks.shake(true);assert.deepEqual(o.statuses,['requesting'])
 assert.deepEqual(n.calls[0],['start','tilt',{refresh_rate:100,need_absolute:false}])
 n.emit('deviceOrientationChanged',{beta:999,gamma:999});assert.deepEqual(o.tilts.at(-1),{x:0,y:0})
 e.advance(100);n.telegram.DeviceOrientation.beta=Math.PI/6;n.telegram.DeviceOrientation.gamma=Math.PI/8;n.emit('deviceOrientationChanged')
 assert.ok(Math.abs(o.tilts.at(-1).x-.9)<1e-10);assert.ok(Math.abs(o.tilts.at(-1).y-1)<1e-10)
 handle.stop();assert.equal(n.count(),0);assert.ok(n.calls.some(c=>c[0]==='stop'&&c[1]==='tilt'));assert.equal(e.timers.size,0)
})
test('native failed channel does not disable another genuinely reading capability',async()=>{
 const e=environment(),o=outputs(),n=nativeFixture();const handle=await startCompanionMotion({window:e.env,telegram:n.telegram,...o})
 n.emit('accelerometerChanged');n.emit('deviceOrientationFailed',{error:'UNSUPPORTED'});assert.equal(o.statuses.at(-1),'active')
 n.emit('accelerometerFailed',{error:'UNSUPPORTED'});assert.equal(o.statuses.at(-1),'unsupported');assert.equal(n.count(),0);handle.stop()
})
test('late native start callbacks are stopped after abort without stopping a newer owner',async()=>{
 const e=environment(),o=outputs(),n=nativeFixture(),a=new AbortController()
 await startCompanionMotion({window:e.env,telegram:n.telegram,signal:a.signal,...o});const old=n.callbacks.tilt;a.abort();const stopped=n.calls.filter(c=>c[0]==='stop').length
 old(true);assert.equal(n.calls.filter(c=>c[0]==='stop').length,stopped+1)
 const newer=await startCompanionMotion({window:e.env,telegram:n.telegram,...outputs()});const count=n.calls.length;old(true);assert.equal(n.calls.length,count);newer.stop()
})

test('a browser policy blocking listeners is unsupported and cleans partial setup',async()=>{
 const e=environment(),o=outputs();e.env.addEventListener=()=>{throw new Error('blocked')}
 const handle=await startCompanionMotion({window:e.env,...o});assert.equal(o.statuses.at(-1),'unsupported');assert.equal(e.count(),0);assert.equal(e.timers.size,0);handle.stop()
})
test('below Telegram 8.0 does not start unsupported native methods',async()=>{
 const e=environment(),o=outputs(),n=nativeFixture();n.telegram.isVersionAtLeast=()=>false
 const handle=await startCompanionMotion({window:e.env,telegram:n.telegram,...o});assert.equal(n.calls.length,0);assert.equal(e.count(),2);handle.stop()
})
