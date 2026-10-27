import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {lessonVisuals} from '../src/lib/academy-visuals.ts'

const catalog=JSON.parse(await readFile(new URL('../content/ai-academy/catalog.learning.json',import.meta.url),'utf8'))
const lessons=catalog.entities.filter(item=>item.kind==='lesson')
test('every lesson has a real local module map containing the four actual lessons in order',async()=>{
 const files=new Map()
 for(const lesson of lessons){
  const visuals=lessonVisuals(lesson.code)
  assert.ok(visuals,lesson.code)
  assert.equal(visuals.step,Number(lesson.code.match(/-L(\d+)$/)[1]))
  assert.ok(visuals.diagram.endsWith(lesson.parent_code+'.svg'))
  if(!files.has(visuals.diagram))files.set(visuals.diagram,await readFile(new URL('../public'+visuals.diagram,import.meta.url),'utf8'))
  const svg=files.get(visuals.diagram)
  assert.match(svg,/<svg[^>]+viewBox="0 0 720 \d+"/)
  assert.doesNotMatch(svg,/<script|<foreignObject|(?:href|src)="https?:/)
  assert.ok(svg.includes(lesson.title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')),lesson.code)
 }
 assert.equal(lessons.length,448)
 assert.equal(files.size,112)
 assert.equal(lessonVisuals('../private'),undefined)
})

test('every course has explained screenshots backed by real nonempty PNG assets',async()=>{
 const courses=catalog.entities.filter(item=>item.kind==='course'),assets=new Map()
 for(const course of courses){
  const pictures=lessons.filter(lesson=>lesson.code.startsWith(course.code+'-')).flatMap(lesson=>lessonVisuals(lesson.code).screenshots)
  assert.ok(pictures.length,`No screenshot examples for ${course.code}`)
  for(const picture of pictures){
   assert.ok(picture.alt.length>15&&picture.caption.length>30,`Unexplained image ${picture.src}`)
   if(!assets.has(picture.src))assets.set(picture.src,await readFile(new URL('../public'+picture.src,import.meta.url)))
   const png=assets.get(picture.src)
   assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
   assert.ok(png.readUInt32BE(16)>=320&&png.readUInt32BE(20)>=180,picture.src)
  }
 }
 assert.equal(courses.length,28)
 assert.ok(assets.size>=15,'Screenshots must show multiple actual examples')
})
