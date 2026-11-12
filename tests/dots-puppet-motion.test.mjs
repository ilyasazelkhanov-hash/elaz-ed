import test from 'node:test'
import assert from 'node:assert/strict'
import { createPuppetRig, stepPuppetRig, startPuppetLoop } from '../src/screens/home/dots/puppet-motion.ts'

test('pose is continuous numeric rig, stable object and finite with extreme inputs', () => {
 const rig=createPuppetRig(),pose=rig.pose
 for(const dt of [0,Infinity,NaN,-100,1e9,.033]) {
  assert.equal(stepPuppetRig(rig,dt,{gaze:{x:Infinity,y:NaN}}),pose)
  assert.ok(Object.values(pose).every(Number.isFinite))
 }
 assert.equal('frame' in pose,false)
 assert.ok(rig.elapsed<=.1)
})
test('tap compresses core then drives continuous edge wave and settles, without limbs or hop',()=>{
 const rig=createPuppetRig(),samples=[]
 for(let i=0;i<80;i++) samples.push({...stepPuppetRig(rig,.025,{reaction:1})})
 assert.ok(samples.some(p=>p.bodyScaleX<.99&&p.bodyScaleY<.99))
 assert.ok(samples.some(p=>p.ripple>1.5));assert.ok(samples.some(p=>Math.abs(p.coreTwist)>.025))
 assert.ok(samples.every(p=>Math.abs(p.bodyY)<1.1&&p.ripple<=2))
 assert.ok(samples.at(-1).ripple<.4)
 for(const field of ['armLeft','armRight','footLeft','footRight','frame'])assert.equal(field in rig.pose,false)
 assert.equal(rig.reactionAge>1.3,true)
})
test('priority protects important action, consumes rejected event, and same-priority tap restarts',()=>{
 const rig=createPuppetRig()
 stepPuppetRig(rig,.03,{reaction:1,priority:3})
 stepPuppetRig(rig,.03,{reaction:2,priority:1});assert.equal(rig.reactionAge,.03)
 for(let i=0;i<60;i++)stepPuppetRig(rig,.03,{reaction:2,priority:1})
 assert.ok(rig.reactionAge>1.3)
 stepPuppetRig(rig,.03,{reaction:3,priority:1});assert.equal(rig.reactionAge,0)
 stepPuppetRig(rig,.03,{reaction:4,priority:1});assert.equal(rig.reactionAge,0)
})
test('expressions morph gradually and eyes, head, accessory have different lag',()=>{
 const rig=createPuppetRig()
 const p={...stepPuppetRig(rig,.033,{mood:'surprised',gaze:{x:1,y:.5}})}
 assert.ok(p.open>0&&p.open<.88);assert.ok(p.gazeX>p.headX/1.8)
 for(let i=0;i<50;i++)stepPuppetRig(rig,.033,{mood:'wink'})
 assert.ok(rig.pose.eyeLeft<.15);assert.ok(rig.pose.eyeRight>.9)
 assert.ok(Math.abs(rig.pose.accessoryRotation)>0)
})
function clock(){let id=0;const jobs=new Map();return{jobs,requestAnimationFrame(fn){jobs.set(++id,fn);return id},cancelAnimationFrame(n){jobs.delete(n)},tick(t){const pending=[...jobs.values()];jobs.clear();pending.forEach(fn=>fn(t))}}}
test('scheduler caps render rate, clamps gap, and stop forbids stale callback wake',()=>{
 const c=clock(),frames=[];const stop=startPuppetLoop(dt=>frames.push(dt),c)
 for(let t=0;t<=1000;t+=10)c.tick(t)
 assert.ok(frames.length<=31);c.tick(100000);assert.equal(frames.at(-1),.05)
 const stale=[...c.jobs.values()][0];stop();assert.equal(c.jobs.size,0);const count=frames.length
 stale(100100);assert.equal(frames.length,count);assert.equal(c.jobs.size,0)
})
test('stop inside render does not schedule another frame',()=>{
 const c=clock();let stop;stop=startPuppetLoop(()=>stop(),c);c.tick(0);assert.equal(c.jobs.size,0)
})
test('unchanged reaction cannot retrigger; automatic blink stays continuous and sparse',()=>{
 const rig=createPuppetRig({reaction:9});let closed=0,maxDelta=0,last=1
 for(let i=0;i<360;i++){
  const p=stepPuppetRig(rig,1/30,{reaction:9})
  if(p.eyeLeft<.55)closed++
  maxDelta=Math.max(maxDelta,Math.abs(p.eyeLeft-last));last=p.eyeLeft
 }
 assert.ok(rig.reactionAge>10);assert.ok(closed>0&&closed<20)
 assert.ok(maxDelta<.8)
})

test('30FPS blink nearly closes; idle flow stays continuous and root restrained',()=>{
 const rig=createPuppetRig();let minimum=1
 for(let i=0;i<360;i++){
  const p=stepPuppetRig(rig,1/30)
  minimum=Math.min(minimum,p.eyeLeft)
  assert.ok(Math.abs(p.bodyY)<1.1);assert.equal(p.flowPhase,rig.elapsed);assert.ok(p.ripple<=.58)
 }
 assert.ok(minimum<.1)
})

test('long repeated reactions retain finite bounded flow, including pathological dt',()=>{
 const rig=createPuppetRig();let phase=0
 for(let i=0;i<10000;i++){
  const p=stepPuppetRig(rig,i%50===0?1e12:1/30,{reaction:Math.floor(i/4),gaze:{x:1,y:-1},mood:'happy'})
  assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.flowPhase>=phase);phase=p.flowPhase
  assert.ok(p.ripple>=0&&p.ripple<=2&&Math.abs(p.bodyY)<1.1)
 }
})

test('autonomous 60-second life is deterministic, irregular, expressive and multidirectional',()=>{
 const rig=createPuppetRig(),copy=createPuppetRig(),starts=[];let prev=-10,maxSmile=0,minX=0,maxX=0,minY=0,maxY=0,doubles=0
 for(let i=0;i<1800;i++){
  const p=stepPuppetRig(rig,1/30);assert.deepEqual(p,stepPuppetRig(copy,1/30))
  if(rig.idle.blinkStart!==prev){prev=rig.idle.blinkStart;starts.push(prev);if(rig.idle.double)doubles++}
  maxSmile=Math.max(maxSmile,p.smile);minX=Math.min(minX,p.gazeX);maxX=Math.max(maxX,p.gazeX);minY=Math.min(minY,p.gazeY);maxY=Math.max(maxY,p.gazeY)
  assert.ok(Math.abs(p.bodyY)<1.1&&p.ripple<.59)
 }
 const gaps=starts.slice(1).map((t,i)=>Math.round((t-starts[i])*10))
 assert.ok(new Set(gaps).size>3);assert.ok(doubles>0&&doubles<starts.length/2)
 assert.ok(maxSmile>.6&&minX<-.2&&maxX>.2&&minY<-.1&&maxY>.1)
})
test('intentional gaze and real mood take priority over idle expression',()=>{
 const rig=createPuppetRig()
 for(let i=0;i<600;i++)stepPuppetRig(rig,1/30,{mood:'surprised',gaze:{x:1,y:-1}})
 assert.ok(rig.pose.gazeX>.99&&rig.pose.gazeY<-.99);assert.ok(rig.pose.open>.87);assert.ok(rig.pose.smile<.11)
})

test('news and advent curiosity retains autonomous expression without changing its intentional open-mouth cue',()=>{
 const rig=createPuppetRig();let minSmile=1,maxSmile=0
 for(let i=0;i<900;i++){
  const p=stepPuppetRig(rig,1/30,{mood:'curious'})
  if(i>30){minSmile=Math.min(minSmile,p.smile);maxSmile=Math.max(maxSmile,p.smile);assert.ok(Math.abs(p.open-.12)<.005)}
 }
 assert.ok(maxSmile-minSmile>.2)
})
