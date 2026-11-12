import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import { dotsPose, easePose, safeMood, DOTS_DPR_LIMIT, DOTS_FPS } from '../src/screens/home/dots/rig.ts'

test('pose math stays finite and bounded after hidden tabs and invalid pointers',()=>{
 for(const t of [0,1,4.8,600,1e9,NaN,Infinity])for(const mood of ['calm','happy','wink','curious']){
  const pose=dotsPose(t,mood,.25,{x:Infinity,y:-99},true)
  assert.ok(Object.values(pose).every(Number.isFinite))
  assert.ok(Math.abs(pose.yaw)<.5 && Math.abs(pose.pitch)<.2 && Math.abs(pose.squash)<.1)
  assert.ok(pose.leftEye>=.06 && pose.leftEye<=1.01)
 }
 assert.equal(safeMood('pretend-ai'),'calm')
 assert.equal(DOTS_FPS,30);assert.ok(DOTS_DPR_LIMIT<=1.5)
})
test('reduced motion freezes the pose, but keeps readable distinct expressions',()=>{
 for(const mood of ['calm','happy','wink','curious'])assert.deepEqual(dotsPose(0,mood,.1,{x:0,y:0},false),dotsPose(360,mood,.9,{x:99,y:88},false))
 const calm=dotsPose(1,'calm',-1,{x:0,y:0},false),wink=dotsPose(1,'wink',-1,{x:0,y:0},false),happy=dotsPose(1,'happy',-1,{x:0,y:0},false)
 assert.equal(calm.rightEye,1);assert.equal(wink.rightEye,.08);assert.ok(happy.mouth>calm.mouth)
})
test('touch reaction settles and gaze easing cannot overshoot after long pauses',()=>{
 const calm=dotsPose(1,'calm',-1,{x:0,y:0},true),settled=dotsPose(1,'calm',10,{x:0,y:0},true)
 assert.deepEqual(calm,settled)
 assert.ok(easePose(0,1,20)>0 && easePose(0,1,20)<1)
 assert.equal(easePose(0,1,-10),0)
 assert.notEqual(dotsPose(1,'calm',.2,{x:0,y:0},true).squash,0)
 assert.equal(dotsPose(1,'happy',5,{x:0,y:0},true).rightArm,.2)
})
test('optional renderer is lazy, disposes on failure/unmount, and stops frames when invisible',async()=>{
 const wrapper=await readFile(new URL('../src/screens/home/dots/DotsCharacter.tsx',import.meta.url),'utf8')
 const renderer=await readFile(new URL('../src/screens/home/dots/renderer.ts',import.meta.url),'utf8')
 assert.match(wrapper,/import\('\.\/renderer'\)/);assert.doesNotMatch(wrapper,/import .* from ['"]three/)
 assert.match(wrapper,/!activated \|\| !motion \|\| failed/);assert.match(wrapper,/cancelled \|\| !canvas.current/)
 assert.match(wrapper,/scene\?\.dispose\(\)/);assert.match(wrapper,/<DotsPoster look=\{look\} mood=\{mood\}/)
 assert.match(renderer,/!state.active \|\| !state.motion/);assert.match(renderer,/cancelAnimationFrame\(frame\)/)
 assert.match(renderer,/observer.disconnect\(\)/);assert.match(renderer,/renderer.dispose\(\)/);assert.match(renderer,/webglcontextlost/)
 assert.match(renderer,/catch \(error\) \{ dispose\(\); throw error \}/)
 assert.doesNotMatch(renderer,/fetch\(|TextureLoader|GLTFLoader|setInterval|shadowMap.enabled|EffectComposer|transmission:/)
})
test('poster is original vector, unique per instance and each palette/shape/accessory renders without scripts',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/dots/DotsPoster.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 for(const name of ['react','react/jsx-runtime'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const {DotsPoster}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
 for(const color of ['violet','mint','peach','sky'])for(const shape of ['soft','round','spark'])for(const accessory of ['none','glasses','sprout','headphones']){
  const html=renderToStaticMarkup(createElement(DotsPoster,{look:{name:'Dots',color,shape,accessory},mood:'happy'}))
  assert.match(html,/viewBox="0 0 160 160"/);assert.doesNotMatch(html,/<image|<script|href="http|filter=/)
 }
 const html=renderToStaticMarkup(createElement('div',null,...[1,2].map(key=>createElement(DotsPoster,{key,look:{name:'Dots',color:'violet',shape:'soft',accessory:'none'},mood:'calm'}))))
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size)
})
test('speech bubbles never truncate titles or rely on one-line text at narrow sizes',async()=>{
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/text-overflow:\s*ellipsis|white-space:\s*nowrap|line-clamp|max-height:\s*\d+px/)
 assert.match(css,/white-space: normal/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/og-dots-speech::before/)
 assert.match(css,/grid-template-columns: 76px minmax\(0, 1fr\)/)
})
