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
test('tap has anticipation, independent wave, hop then settles without queue',()=>{
 const rig=createPuppetRig(),samples=[]
 for(let i=0;i<65;i++) samples.push({...stepPuppetRig(rig,.025,{reaction:1})})
 assert.ok(samples.some(p=>p.bodyY>.05));assert.ok(samples.some(p=>p.bodyY< -2))
 assert.ok(samples.some(p=>p.armRight>1.1 && p.armLeft<0))
 assert.ok(Math.abs(samples.at(-1).bodyY)<.1)
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

test('30FPS blink nearly closes; idle forearms remain independently restrained',()=>{
 const rig=createPuppetRig();let minimum=1
 for(let i=0;i<360;i++){
  const p=stepPuppetRig(rig,1/30)
  minimum=Math.min(minimum,p.eyeLeft)
  assert.ok(Math.abs(p.armLeft)<.13 && Math.abs(p.armRight)<.13)
 }
 assert.ok(minimum<.1)
})
