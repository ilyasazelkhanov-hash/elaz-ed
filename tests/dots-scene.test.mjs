import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import { DOTS_ART, currentAtlasEvent, dotsArt, dotsFrame, framePosition, startDotsBlink } from '../src/screens/home/dots/raster.ts'

test('all character looks use local rendered atlases and invalid inputs have a safe pose',()=>{
 assert.equal(dotsArt('soft'),DOTS_ART.soft);assert.equal(dotsArt('round'),DOTS_ART.round);assert.equal(dotsArt('spark'),DOTS_ART.spark);assert.equal(dotsArt('invalid'),DOTS_ART.soft)
 assert.equal(dotsFrame('calm'),0);assert.equal(dotsFrame('happy'),2);assert.equal(dotsFrame('wink'),3);assert.equal(dotsFrame('surprised'),4);assert.equal(dotsFrame('curious'),0);assert.equal(dotsFrame('happy',true),5)
 for(const bad of [-1,6,NaN,Infinity,.2,'5'])assert.deepEqual(framePosition(bad),{left:'0%',top:'0%'})
 for(let i=0;i<6;i++)assert.deepEqual(framePosition(i),{left:`-${i%3*100}%`.replace('-0%','0%'),top:`-${Math.floor(i/3)*100}%`.replace('-0%','0%')})
})
test('late atlas load/error events cannot replace readiness or error state of a newer body',()=>{
 assert.equal(currentAtlasEvent(DOTS_ART.soft,DOTS_ART.round,DOTS_ART.soft),false)
 assert.equal(currentAtlasEvent(DOTS_ART.round,DOTS_ART.round,DOTS_ART.soft),false)
 assert.equal(currentAtlasEvent(DOTS_ART.round,DOTS_ART.round,DOTS_ART.round),true)
 assert.equal(currentAtlasEvent('', '', ''),false)
})
test('blink is infrequent, brief, cancellable and never schedules after cleanup',()=>{
 const jobs=new Map(),changes=[];let next=0,now=0
 const clock={setTimeout(fn,ms){const id=++next;jobs.set(id,{fn,at:now+ms});return id},clearTimeout:id=>jobs.delete(id)}
 const step=()=>{const [id,job]=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];jobs.delete(id);now=job.at;job.fn()}
 const stop=startDotsBlink(closed=>changes.push({closed,at:now}),clock)
 assert.equal(jobs.size,1);assert.deepEqual(changes,[]);step();assert.deepEqual(changes,[{closed:true,at:4700}]);step();assert.deepEqual(changes.at(-1),{closed:false,at:4835})
 assert.equal([...jobs.values()][0].at,10935);const stale=[...jobs.values()][0].fn;stop();assert.equal(jobs.size,0);stale();assert.equal(changes.length,2);assert.equal(jobs.size,0)
})
test('three generated assets contain genuine alpha, bounded bytes and six equal square cells',async()=>{
 for(const url of Object.values(DOTS_ART)){
  const data=await readFile(new URL(`../public${url}`,import.meta.url));assert.ok(data.length>10000&&data.length<450000)
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');assert.equal(data.toString('ascii',12,16),'VP8X')
  assert.ok(data[20]&0x10,'alpha flag');const width=data.readUIntLE(24,3)+1,height=data.readUIntLE(27,3)+1
  assert.equal(width,1536);assert.equal(height,1024);assert.equal(width/3,height/2)
 }
})
test('rendering never depends on a canvas, WebGL, an external image or the rejected geometry',async()=>{
 const wrapper=await readFile(new URL('../src/screens/home/dots/DotsCharacter.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(wrapper,/three|createDotsScene|<canvas|DotsPoster|requestAnimationFrame|fetch\(/)
 assert.match(wrapper,/data-renderer="raster"/);assert.match(wrapper,/startDotsBlink\(setBlink\)/);assert.match(wrapper,/active && visible/)
 assert.match(wrapper,/activeNow && motion && ready/);assert.match(wrapper,/animation\?\.cancel\(\)/)
 assert.match(wrapper,/onError=/);assert.match(wrapper,/key=\{source\}/);assert.equal((wrapper.match(/currentAtlasEvent\(source, latestSource.current/g)||[]).length,2);assert.match(wrapper,/errors.includes\(DOTS_ART.soft\)/)
 assert.match(wrapper,/loading="lazy"/);assert.match(wrapper,/aria-hidden="true"/)
})
test('every palette/body/accessory renders genuine artwork plus separate optional decoration',async()=>{
 const {transformWithOxc}=await import('vite'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server')
 const file=new URL('../src/screens/home/dots/DotsCharacter.tsx',import.meta.url)
 let code=(await transformWithOxc(await readFile(file,'utf8'),file.pathname,{lang:'tsx',jsx:{runtime:'automatic'}})).code
 code=code.replace(/import \{ useElementVisible \} from ["'][^"']+["'];?/,'const useElementVisible = () => true;')
 code=code.replace(/from ["']\.\/raster["']/g,`from ${JSON.stringify(new URL('../src/screens/home/dots/raster.ts',import.meta.url).href)}`)
 for(const name of ['react','react/jsx-runtime'])code=code.replaceAll(`from "${name}"`,`from ${JSON.stringify(import.meta.resolve(name))}`)
 const {DotsCharacter}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
 for(const color of ['violet','mint','peach','sky'])for(const shape of ['soft','round','spark'])for(const accessory of ['none','glasses','sprout','headphones']){
  const html=renderToStaticMarkup(createElement(DotsCharacter,{look:{name:'Dots',color,shape,accessory},mood:'happy',active:true,motion:false,lantern:true}))
  assert.match(html,new RegExp(`src="/companion/plush-${shape}-v1.webp"`));assert.match(html,/data-motion="false"/);assert.match(html,/data-renderer="raster"/)
  assert.doesNotMatch(html,/<canvas|<script|src="http/)
 }
})
test('speech stays untruncated and animation honors visibility, pause and reduced motion',async()=>{
 const css=await readFile(new URL('../src/screens/home/companion.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/text-overflow:\s*ellipsis|white-space:\s*nowrap|line-clamp|max-height:\s*\d+px/)
 assert.match(css,/white-space: normal/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/og-dots-speech::before/)
 assert.match(css,/grid-template-columns: 76px minmax\(0, 1fr\)/)
 assert.match(css,/data-active='true'.*data-motion='true'.*data-ready='true'/)
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/transform: none !important/)
 assert.doesNotMatch(css,/og-dots-poster|og-dots-canvas/)
})
