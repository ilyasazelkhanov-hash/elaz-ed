import test from 'node:test'
import assert from 'node:assert/strict'
import { bindSculptureMotion } from '../src/platform-kit/src/components/sculpture-motion.ts'
function emitter(extra) { const listeners=new Map();return {...extra,listeners,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name)},fire(name){listeners.get(name)?.()}} }
test('live reduced-motion toggles static scene, visibility stops loop, disposal removes listeners',()=>{
 const media=emitter({matches:false}), page=emitter({hidden:false}), animate=()=>{}
 let loop,frames=0
 const motion=bindSculptureMotion(media,page,false,fn=>loop=fn,animate,()=>frames++)
 assert.equal(loop,animate)
 media.matches=true;media.fire('change');assert.equal(loop,null);assert.equal(frames,1)
 media.matches=false;media.fire('change');assert.equal(loop,animate)
 page.hidden=true;page.fire('visibilitychange');assert.equal(loop,null)
 page.hidden=false;page.fire('visibilitychange');assert.equal(loop,animate)
 motion.setVisible(false);assert.equal(loop,null)
 motion.setVisible(true);assert.equal(loop,animate)
 motion.dispose();assert.equal(loop,null);assert.equal(media.listeners.size,0);assert.equal(page.listeners.size,0)
 media.fire('change');assert.equal(loop,null)
})
test('brand-forced reduced motion remains static when system preference changes',()=>{
 const media=emitter({matches:false}),page=emitter({hidden:false});let loop,frames=0
 const motion=bindSculptureMotion(media,page,true,fn=>loop=fn,()=>{},()=>frames++)
 assert.equal(loop,null);assert.equal(frames,1)
 media.matches=true;media.fire('change');media.matches=false;media.fire('change')
 assert.equal(loop,null);assert.equal(frames,3);motion.dispose()
})
