import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {beginnerGuides,beginnerGlossary} from '../src/lib/beginner-content.ts'

test('free start has five standalone usable exercises, without copying a paid course body',async()=>{
 assert.equal(beginnerGuides.length,5)
 assert.equal(new Set(beginnerGuides.map(guide=>guide.id)).size,5)
 const paid=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url),'utf8'))
 for(const guide of beginnerGuides){
  assert.match(guide.id,/^[a-z-]+$/)
  assert.ok(guide.minutes>=3&&guide.minutes<=10)
  assert.equal(guide.steps.length,3)
  assert.equal(guide.checks.length,3)
  for(const value of [guide.intro,guide.result,guide.prompt,guide.example,guide.task])assert.ok(value.length>40,guide.id)
  for(const lesson of paid.courses.flatMap(course=>course.lessons))assert.ok(!lesson.body.includes(guide.prompt),guide.id)
 }
 assert.match(beginnerGuides.find(guide=>guide.id==='check-answer').example,/6%/)
 assert.ok(beginnerGlossary.every(([term,definition])=>term.length>3&&definition.length>30))
})

const rgb=hex=>hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255)
const luminance=hex=>rgb(hex).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05)}
test('main action and success text color pairs remain readable in both themes',async()=>{
 const css=await readFile(new URL('../src/index.css',import.meta.url),'utf8')
 const light=css.slice(css.indexOf(":root[data-theme='light']"))
 const dark=css.slice(0,css.indexOf(":root[data-theme='light']"))
 const color=(source,name)=>new RegExp('--color-'+name+':\\s*(#[a-f0-9]{6})','i').exec(source)?.[1]
 for(const source of [dark,light]){
  assert.ok(contrast(color(source,'violet'),color(source,'on-violet'))>=4.5)
  assert.ok(contrast(color(source,'success'),color(source,'card'))>=4.5)
  assert.ok(contrast(color(source,'success'),color(source,'bg'))>=4.5)
 }
})
