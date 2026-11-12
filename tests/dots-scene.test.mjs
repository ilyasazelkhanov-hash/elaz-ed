import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DOTS_ART, currentAtlasEvent, dotsArt, framePosition } from '../src/screens/home/dots/raster.ts'
import { PUPPET_ASSETS, PUPPET_CROPS, PUPPET_LAYOUT, createPuppetPainter, skinPoint, skinArm, tintPuppetPixels } from '../src/screens/home/dots/puppet-renderer.ts'
import { createPuppetRig, stepPuppetRig } from '../src/screens/home/dots/puppet-motion.ts'

test('static fallback remains a bounded local image, with stale-source event protection', () => {
 assert.equal(dotsArt('invalid'), DOTS_ART.soft)
 for (const bad of [-1,6,NaN,Infinity,.2,'5']) assert.deepEqual(framePosition(bad),{left:'0%',top:'0%'})
 assert.equal(currentAtlasEvent(DOTS_ART.soft,DOTS_ART.round,DOTS_ART.soft),false)
 assert.equal(currentAtlasEvent(DOTS_ART.round,DOTS_ART.round,DOTS_ART.soft),false)
 assert.equal(currentAtlasEvent(DOTS_ART.round,DOTS_ART.round,DOTS_ART.round),true)
})
test('new rig textures have genuine alpha and bounded transfer size, not external dependencies',async()=>{
 for (const url of Object.values(PUPPET_ASSETS)) {
  assert.match(url,/^\/companion\//)
  const data=await readFile(new URL(`../public${url}`,import.meta.url))
  assert.ok(data.length>10000&&data.length<300000)
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');assert.equal(data.toString('ascii',12,16),'VP8X')
  assert.ok(data[20]&0x10,'alpha flag');assert.equal(data.readUIntLE(24,3)+1,1536);assert.equal(data.readUIntLE(27,3)+1,1024)
 }
 for (const crop of Object.values(PUPPET_CROPS)) {
  assert.ok(crop.x>=0&&crop.y>=0&&crop.w>0&&crop.h>0);assert.ok(crop.x+crop.w<=1536&&crop.y+crop.h<=1024)
 }
})
test('head skin bends independently while lower body is grounded; elbows curve, not detached sprite rotations',()=>{
 const pose=createPuppetRig().pose;pose.headX=2;pose.headRotation=.1
 const top=skinPoint(50,40,pose,{x:0,y:0}),bottom=skinPoint(50,100,pose,{x:0,y:0})
 assert.ok(top.x>52);assert.deepEqual(bottom,{x:50,y:100})
 const origin={x:75,y:64},paw=skinArm(0,25,1.2,origin,{x:0,y:0})
 assert.ok(paw.x>75&&paw.x<100);assert.ok(paw.y<70)
})
function mockContext() {
 const calls=[]; const noop=(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n))}
 const ctx={setTransform:noop,clearRect:noop,save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,closePath:noop,clip:noop,transform:noop,fillRect:noop,rect:noop,stroke:noop,fill:noop,
  drawImage(...args){noop(...args);calls.push(args)},createRadialGradient(...args){noop(...args);return{addColorStop:noop}}}
 return {ctx,calls}
}
test('renderer uses finite independent bone transforms across all 48 looks, and disposal prevents paints',()=>{
 const {ctx,calls}=mockContext(),renderer=createPuppetPainter(ctx,{fur:{},props:{}},224)
 assert.equal(renderer.triangles,168)
 const rig=createPuppetRig()
 for(const color of ['violet','mint','peach','sky'])for(const shape of ['soft','round','spark'])for(const accessory of ['none','glasses','sprout','headphones']){
  const pose=stepPuppetRig(rig,1/30,{reaction:1,mood:'happy',gaze:{x:1,y:-1}})
  renderer.paint(pose,{color,shape,accessory,name:'Dots'},true)
 }
 assert.ok(calls.length>48*168);const before=calls.length;renderer.dispose();renderer.paint(rig.pose,{shape:'soft',accessory:'none'},true);assert.equal(calls.length,before)
})
test('waving paw and hanging lantern remain inside padded camera throughout extreme look/tap sequences',()=>{
 for (const shape of ['soft','round','spark']) {
  const rig=createPuppetRig(),layout=PUPPET_LAYOUT[shape],joint={x:0,y:0},hand={x:0,y:0}
  for(let i=0;i<300;i++){
   const p=stepPuppetRig(rig,1/30,{reaction:i<20?0:i<120?1:2,mood:'happy',gaze:{x:i<150?1:-1,y:1}})
   skinPoint(50+layout.shoulder,64,p,joint);skinArm(0,23,p.armRight,joint,hand)
   // Apply actual root transform and the prop's visible half-width, with camera overscan -4..104.
   for(const lx of [-5.5,5.5])for(const ly of [0,19.5]){
    const angle=p.accessoryRotation*.3,x=hand.x-4+lx*Math.cos(angle)-ly*Math.sin(angle),y=hand.y+lx*Math.sin(angle)+ly*Math.cos(angle)
    const dx=(x-50)*p.bodyScaleX,dy=(y-104)*p.bodyScaleY
    const rx=50+p.bodyX+dx*Math.cos(p.bodyRotation)-dy*Math.sin(p.bodyRotation)
    const ry=104+p.bodyY+dx*Math.sin(p.bodyRotation)+dy*Math.cos(p.bodyRotation)
    assert.ok(rx>=-4&&rx<=104,`${shape} lantern x=${rx}`);assert.ok(ry>=-4&&ry<=125.6)
   }
  }
 }
})
test('component guards canvas errors, late image work and real pause/reduced/visibility, with no React state in tick',async()=>{
 const wrapper=await readFile(new URL('../src/screens/home/dots/DotsCharacter.tsx',import.meta.url),'utf8')
 assert.match(wrapper,/getContext\('2d'/);assert.match(wrapper,/catch \{ return \}/)
 assert.match(wrapper,/active && visible && documentVisible/);assert.match(wrapper,/activeNow && motion && !reduce/)
 assert.match(wrapper,/startPuppetLoop\(safeDraw\)/);assert.match(wrapper,/return \(\) => stop\?\.\(\)/)
 assert.match(wrapper,/if \(!alive \|\| contextLost\) return/);assert.match(wrapper,/ownDriver\?\.dispose\(\)/)
 assert.match(wrapper,/currentAtlasEvent\(posterSource, currentPoster.current/)
 assert.match(wrapper,/if \(!failed\) stop = startPuppetLoop/)
 assert.doesNotMatch(wrapper,/dotsFrame\(|startDotsBlink|previousFrame|og-dots-props|requestPermission|\.fetch\(/)
 const tick=wrapper.slice(wrapper.indexOf('tick(dt)'),wrapper.indexOf('still() {'))
 assert.doesNotMatch(tick,/setState|setReady|setBlink|\.animate\(/)
 assert.match(wrapper,/contextlost/);assert.match(wrapper,/contextrestored/)
})
test('SSR provides a real local poster and decorative canvas for every look, independent of WebGL',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/dots/DotsCharacter.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{[^}]+\} from ["'][^"']+\/visibility["'];?/,'const useElementVisible = () => true, useDocumentVisible = () => true, usePrefersReducedMotion = () => false;')
 for(const local of ['raster','puppet-motion','puppet-renderer'])code=code.replaceAll(`from "./${local}"`,`from ${JSON.stringify(new URL(`../src/screens/home/dots/${local}.ts`,import.meta.url).href)}`)
 for(const name of ['react','react/jsx-runtime'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const {DotsCharacter}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
 for(const color of ['violet','mint','peach','sky'])for(const shape of ['soft','round','spark'])for(const accessory of ['none','glasses','sprout','headphones']){
  const html=renderToStaticMarkup(createElement(DotsCharacter,{look:{name:'Dots',color,shape,accessory},mood:'happy',active:true,motion:false,lantern:true}))
  assert.match(html,new RegExp(`src="/companion/plush-${shape}-v1.webp"`));assert.match(html,/data-motion="false"/);assert.match(html,/<canvas/);assert.match(html,/data-renderer="poster"/)
  assert.doesNotMatch(html,/<script|src="http|<svg/)
 }
})
test('speech still has full wrapping and scene has reduced-motion and static fallbacks',async()=>{
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/text-overflow:\s*ellipsis|white-space:\s*nowrap|line-clamp|max-height:\s*\d+px/)
 assert.match(css,/white-space: normal/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/og-dots-speech::before/)
 assert.match(css,/grid-template-columns: 76px minmax\(0, 1fr\)/)
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/transform: none !important/)
 assert.doesNotMatch(css,/og-dots-raster-enter|og-dots-props|og-dots-plush-breathe/)
})

test('palette baking keeps alpha and transparent pixels, without depending on optional canvas filters',()=>{
 for(const color of ['violet','mint','peach','sky']){
  const pixels=new Uint8ClampedArray([178,146,202,254,1,2,3,0]);tintPuppetPixels(pixels,color)
  assert.equal(pixels[3],254);assert.deepEqual([...pixels.slice(4)],[1,2,3,0])
  if(color==='violet')assert.deepEqual([...pixels.slice(0,3)],[178,146,202]);else assert.notDeepEqual([...pixels.slice(0,3)],[178,146,202])
 }
})
