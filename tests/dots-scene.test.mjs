import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { DOTS_ART, currentAtlasEvent, dotsArt, framePosition, posterCell } from '../src/screens/home/dots/raster.ts'
import { PUPPET_ASSETS, PUPPET_CROPS, PUPPET_LAYOUT, PUPPET_VIEWBOX, createPuppetPainter, skinPoint, surfaceBasis, tintPuppetPixels } from '../src/screens/home/dots/puppet-renderer.ts'
import { createPuppetRig, stepPuppetRig } from '../src/screens/home/dots/puppet-motion.ts'

test('static fallback remains a bounded local image, with stale-source event protection', () => {
 assert.equal(dotsArt('invalid'), DOTS_ART.soft); assert.equal(posterCell('soft'),3); assert.equal(posterCell('round'),4); assert.equal(posterCell('spark'),5)
 for (const bad of [-1,6,NaN,Infinity,.2,'5']) assert.deepEqual(framePosition(bad),{left:'0%',top:'0%'})
 assert.equal(currentAtlasEvent('/old','/new','/old'),false)
 assert.equal(currentAtlasEvent('/new','/new','/old'),false)
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
test('abstract volume deforms internally, face tangents remain attached, and no limb geometry remains',()=>{
 const pose=createPuppetRig().pose;pose.headX=2;pose.headRotation=.1;pose.ripple=1.5;pose.flowPhase=1;pose.coreTwist=.06
 const top=skinPoint(50,30,pose,{x:0,y:0}),edge=skinPoint(90,60,pose,{x:0,y:0})
 assert.ok(top.x>50);assert.ok(Math.abs(edge.y-60)>0)
 const b=surfaceBasis(50,58,pose),p=skinPoint(50,58,pose,{x:0,y:0})
 assert.equal(b.x,p.x);assert.equal(b.y,p.y);assert.ok(b.a*b.d-b.b*b.c>.5)
 for(const key of ['arm','foot','hand','leg'])assert.equal(key in PUPPET_CROPS,false)
})
function mockContext() {
 const calls=[]; const noop=(...args)=>{for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n))}
 const ctx={setTransform:noop,clearRect:noop,save:noop,restore:noop,translate:noop,scale:noop,rotate:noop,beginPath:noop,moveTo:noop,lineTo:noop,quadraticCurveTo:noop,closePath:noop,clip:noop,transform:noop,fillRect:noop,rect:noop,stroke:noop,fill:noop,
  drawImage(...args){noop(...args);calls.push(args)},createRadialGradient(...args){noop(...args);return{addColorStop:noop}}}
 return {ctx,calls}
}
test('renderer uses finite continuous volume transforms across all 48 looks, and disposal prevents paints',()=>{
 const {ctx,calls}=mockContext(),renderer=createPuppetPainter(ctx,{fur:{},props:{}},224)
 assert.equal(renderer.triangles,96)
 const rig=createPuppetRig()
 for(const color of ['violet','mint','peach','sky'])for(const shape of ['soft','round','spark'])for(const accessory of ['none','glasses','sprout','headphones']){
  const pose=stepPuppetRig(rig,1/30,{reaction:1,mood:'happy',gaze:{x:1,y:-1}})
  renderer.paint(pose,{color,shape,accessory,name:'Dots'},true)
 }
 assert.ok(calls.length>48*96);const before=calls.length;renderer.dispose();renderer.paint(rig.pose,{shape:'soft',accessory:'none'},true);assert.equal(calls.length,before)
})
test('all deformed surfaces stay in the padded camera and face attachment never flips during reactions',()=>{
 for (const shape of ['soft','round','spark']) {
  const rig=createPuppetRig(),layout=PUPPET_LAYOUT[shape],v={x:0,y:0}
  for(let i=0;i<300;i++){
   const p=stepPuppetRig(rig,1/30,{reaction:i<20?0:i<120?1:2,mood:'happy',gaze:{x:i<150?1:-1,y:1}})
   const b=surfaceBasis(layout.faceX,layout.eyeY,p);assert.ok(b.a*b.d-b.b*b.c>.5)
   for(let row=0;row<=8;row++)for(let col=0;col<=6;col++){
    skinPoint(50-layout.width/2+col*layout.width/6,layout.top+row*layout.height/8,p,v)
    const dx=(v.x-50)*p.bodyScaleX,dy=(v.y-60)*p.bodyScaleY
    const rx=50+p.bodyX+dx*Math.cos(p.bodyRotation)-dy*Math.sin(p.bodyRotation)
    const ry=60+p.bodyY+dx*Math.sin(p.bodyRotation)+dy*Math.cos(p.bodyRotation)
    assert.ok(rx>=PUPPET_VIEWBOX.minX&&rx<=PUPPET_VIEWBOX.maxX,`${shape} surface x=${rx}`);assert.ok(ry>=PUPPET_VIEWBOX.minY&&ry<=PUPPET_VIEWBOX.maxY)
   }
  }
 }
})
test('sprout remains inside the camera through extreme gaze, curious tilt and repeated reactions',()=>{
 for(const shape of ['soft','round','spark'])for(const mood of ['calm','curious','happy'])for(const gaze of [{x:-1,y:-1},{x:1,y:-1},{x:1,y:1}]){
  const rig=createPuppetRig(),l=PUPPET_LAYOUT[shape]
  for(let i=0;i<300;i++){
   const p=stepPuppetRig(rig,1/30,{mood,gaze,reaction:Math.floor(i/80)})
   const b=surfaceBasis(l.crownX,l.crown,p)
   for(const x of [-9,9])for(const y of [-14,1]){
    const r=p.accessoryRotation, u=x*Math.cos(r)-y*Math.sin(r),v=1+x*Math.sin(r)+y*Math.cos(r)
    const a=r*.6,ux=u*Math.cos(a)-v*Math.sin(a),uy=u*Math.sin(a)+v*Math.cos(a)
    const sx=b.x+b.a*ux+b.c*uy,sy=b.y+b.b*ux+b.d*uy
    const dx=(sx-50)*p.bodyScaleX,dy=(sy-60)*p.bodyScaleY
    const wx=50+p.bodyX+dx*Math.cos(p.bodyRotation)-dy*Math.sin(p.bodyRotation)
    const wy=60+p.bodyY+dx*Math.sin(p.bodyRotation)+dy*Math.cos(p.bodyRotation)
    assert.ok(wx>=PUPPET_VIEWBOX.minX&&wx<=PUPPET_VIEWBOX.maxX,`${shape} sprout x=${wx}`)
    assert.ok(wy>=PUPPET_VIEWBOX.minY&&wy<=PUPPET_VIEWBOX.maxY,`${shape} sprout y=${wy}`)
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
  assert.match(html,/src="\/companion\/abstract-forms-v3.webp"/);assert.match(html,/data-motion="false"/);assert.match(html,/<canvas/);assert.match(html,/data-renderer="poster"/)
  assert.doesNotMatch(html,/<script|src="http|<svg|plush-.*-v1|puppet-fur-v2/)
 }
})
test('speech still has full wrapping and scene has reduced-motion and static fallbacks',async()=>{
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/text-overflow:\s*ellipsis|white-space:\s*nowrap|line-clamp|max-height:\s*\d+px/)
 assert.match(css,/white-space: normal/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/og-dots-cloud-surface/);assert.match(css,/og-dots-cloud-breathe/);assert.doesNotMatch(css,/clip-path|rotate\(45deg\)/)
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
