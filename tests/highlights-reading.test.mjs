import test from 'node:test'
import assert from 'node:assert/strict'
import {activeStories,storySlideDuration} from '../src/lib/highlights.ts'
import {readingMinutes,readingWords} from '../supabase/functions/_shared/reading-time.ts'
const today = new Date('2026-11-12T12:00:00Z')
const card={id:1,kind:'story',published:true,course_id:null,category:'Практика'}
test('highlights never expose drafts or course content',()=>{
 assert.equal(activeStories([card,{...card,id:2,published:false},{...card,id:3,course_id:3}],today).length,1)
})
test('offers need sources and a future recheck date',()=>{
 const offer={...card,category:'Выгода',editorial:{kind:'update',checked_on:'2026-11-12',review_due:'2026-11-19',sources:[{title:'Official',url:'https://example.com'}]}}
 assert.equal(activeStories([offer],today).length,1)
 for(const editorial of [null,{...offer.editorial,review_due:'2026-11-12'},{...offer.editorial,checked_on:'2026-11-13'},{...offer.editorial,sources:[]},{...offer.editorial,outdated_note:'Ended'}])assert.equal(activeStories([{...offer,editorial}],today).length,0)
})
test('reading time reflects real length, not a two minute template',()=>{
 assert.equal(readingMinutes('слово '.repeat(80)),1)
 assert.equal(readingMinutes('слово '.repeat(300)),2)
 assert.equal(readingMinutes('слово '.repeat(700)),4)
 assert.equal(readingWords('[Текст ссылки](https://example.com/very-long/path) ![alt words](image.png) <!-- private note -->'),2)
})
test('story timing scales with content and stays bounded',()=>{
 assert.equal(storySlideDuration('Привет'),6000)
 assert.equal(storySlideDuration('слово '.repeat(60)),20000)
 assert.equal(storySlideDuration('слово '.repeat(200)),30000)
})

test('curated highlights contain verified offers, not fabricated universal discounts',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {normalizeEditorial}=await import('../supabase/functions/_shared/editorial.ts')
 const payload=JSON.parse(await readFile(new URL('../content/highlights/2026-11-12.json',import.meta.url),'utf8'))
 assert.equal(payload.items.length,4)
 for(const item of payload.items){
  assert.equal(item.kind,'story');assert.equal(item.xp,0);assert.equal(item.news_eligible,false)
  assert.ok(item.body.split(/\n\s*---+\s*\n/).length>=2)
  assert.ok(!item.body.includes('—'))
  normalizeEditorial(item.editorial,{requireUpdateReview:true,today:'2026-11-12'})
 }
 assert.equal(activeStories(payload.items,today).length,4)
 assert.equal(activeStories(payload.items,new Date('2026-11-19T00:00:00Z')).length,1)
})


test('story links retain contrast across all gradients and wrap with visible keyboard focus',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {GRADIENTS}=await import('../src/lib/game.ts')
 const css=await readFile(new URL('../src/index.css',import.meta.url),'utf8')
 const rule=css.match(/\.prose-story a \{([^}]+)\}/)?.[1]??''
 const hex=rule.match(/color:\s*(#[0-9a-f]{6})/i)?.[1]
 const surface=rule.match(/background:\s*rgba\(([^)]+)\)/)?.[1].split(',').map(Number)
 assert.ok(hex&&surface?.length===4,'story links need an explicit independent ink and surface')
 assert.match(rule,/overflow-wrap: anywhere/);assert.match(rule,/box-decoration-break: clone/)
 assert.match(rule,/text-decoration: underline/);assert.match(css,/\.prose-story a:focus-visible \{[^}]*outline: 2px solid currentColor/)
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))
 const blend=(top,bottom,alpha)=>top.map((v,i)=>v*alpha+bottom[i]*(1-alpha))
 const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
 const contrast=(a,b)=>{const [lo,hi]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return(hi+.05)/(lo+.05)}
 const opacity=Number(css.match(/\.prose-story p \{[^}]*opacity:\s*([\d.]+)/)?.[1]??1)
 const ink=rgb(hex)
 for(const [name,gradient] of Object.entries(GRADIENTS)){
  for(let i=1;i<gradient.stops.length;i++)for(let step=0;step<=100;step++){
   const background=blend(rgb(gradient.stops[i][0]),rgb(gradient.stops[i-1][0]),step/100)
   const surfacePixel=blend(surface.slice(0,3),background,surface[3])
   const renderedSurface=blend(surfacePixel,background,opacity)
   const renderedInk=blend(ink,background,opacity)
   assert.ok(contrast(renderedInk,renderedSurface)>=7,`${name} step ${step} must remain AAA even inside the faded story paragraph`)
  }
 }
})
