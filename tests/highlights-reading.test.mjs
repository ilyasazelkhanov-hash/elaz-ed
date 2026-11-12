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
