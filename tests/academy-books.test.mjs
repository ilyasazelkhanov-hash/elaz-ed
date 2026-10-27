import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {courseBookFiles} from '../scripts/academy-books.mjs'
import {loadAuthoredPacks} from '../scripts/academy-content.mjs'
const base=JSON.parse(await readFile(new URL('../content/ai-academy/catalog.normalized.json',import.meta.url),'utf8')),packs=await loadAuthoredPacks()
test('readable module pages expose teaching text and working file links, never grading configuration',()=>{const changed=structuredClone(packs);changed[0].lessons[0].assessment={kind:'quiz',questions:[{answer:'PRIVATE_GRADE_KEY'}]};changed[0].lessons[0].data.internal_notes='PRIVATE_INTERNAL_NOTE';const files=courseBookFiles(base,changed);const page=files.get('courses/CORE-000/M1.md');assert.ok(page.length>1000);assert.doesNotMatch([...files.values()].join('\n'),/PRIVATE_GRADE_KEY|PRIVATE_INTERNAL_NOTE/);assert.equal([...files.keys()].filter(k=>/\/M[1-4]\.md$/.test(k)).length,packs.length*4);assert.match(files.get('README.md'),new RegExp(`${packs.length*16}/448`))})
test('a completed draft module is visible in progress without falsely publishing an incomplete course',()=>{const lessons=base.entities.filter(n=>n.kind==='lesson'&&n.parent_code==='BI-101-M1').map(n=>({code:n.code,title:n.title,data:{artifact:'Own checked result',acceptance:['Evidence exists'],content_blocks:[{type:'markdown',text:'Public teaching content '.repeat(80)}]}})),draft={course_code:'BI-101',module_code:'BI-101-M1',state:'review_ready',lessons};const incompletePacks=packs.filter(p=>p.course_code!=='BI-101');const files=courseBookFiles(base,incompletePacks,[draft]);assert.ok(files.has('courses/BI-101/M1.md'));assert.match(files.get('courses/BI-101/README.md'),/4\/16/);assert.equal(courseBookFiles(base,incompletePacks,[{...draft,lessons:lessons.slice(0,3)}]).has('courses/BI-101/M1.md'),false)})

test('course route uses canonical positions, stable lesson anchors and the correct cross-module transition',()=>{
 const shuffled=structuredClone(base);shuffled.entities.reverse()
 const changed=structuredClone(packs);for(const pack of changed)pack.lessons.reverse()
 const core=changed.find(p=>p.course_code==='CORE-000');core.lessons.find(l=>l.code==='CORE-000-M2-L1').title='Новое понятное название'
 const files=courseBookFiles(shuffled,changed),index=files.get('courses/CORE-000/README.md'),first=files.get('courses/CORE-000/M1.md'),second=files.get('courses/CORE-000/M2.md'),last=files.get('courses/CORE-000/M4.md')
 assert.match(index,/Начать с урока 1:[^\n]+\]\(M1\.md#lesson-core-000-m1-l1\)/)
 const route=[...index.matchAll(/^\| (\d+) \| (\d\.\d) \|/gm)].map(m=>[Number(m[1]),m[2]])
 assert.deepEqual(route,Array.from({length:16},(_,i)=>[i+1,`${Math.floor(i/4)+1}.${i%4+1}`]))
 assert.match(first,/<a id="lesson-core-000-m1-l4"><\/a>/)
 assert.match(first,/Следующий урок →: Урок 5 · 2\.1 · Новое понятное название\]\(M2\.md#lesson-core-000-m2-l1\)/)
 assert.match(second,/← Предыдущий урок: Урок 4 · 1\.4[^\n]+\]\(M1\.md#lesson-core-000-m1-l4\)/)
 assert.match(last,/Это последний урок курса/)
 assert.doesNotMatch(last,/Следующий урок →: Урок 17/)
 for(const [location,body]of files){
  const folder=location.slice(0,location.lastIndexOf('/')+1)
  for(const match of body.matchAll(/\]\((M[1-4]\.md)#(lesson-[a-z0-9-]+)\)/g)){
   const target=files.get(folder+match[1]);assert.ok(target,`${location}: missing ${match[1]}`)
   assert.ok(target.includes(`<a id="${match[2]}"></a>`),`${location}: missing anchor ${match[2]}`)
  }
 }
})

test('module maps and matching screenshots show teaching examples while unknown asset paths and grading fields stay private',()=>{
 const lessonCode='CORE-000-M1-L1',visuals={lessons:{[lessonCode]:[
  {src:'/learning/academy/screenshots/core-start.png',alt:'Локальный пример: начало урока',caption:'Скриншот локального учебного примера.',answer:'PRIVATE_SCREENSHOT_KEY'},
  {src:'https://untrusted.example/private.png',alt:'PRIVATE_INVALID_VISUAL'},
  {src:'/learning/academy/../secret.png',alt:'PRIVATE_TRAVERSAL_VISUAL'}
 ]}}
 const files=courseBookFiles(base,packs,[],visuals),first=files.get('courses/CORE-000/M1.md'),second=files.get('courses/CORE-000/M2.md')
 assert.match(first,/learning\/academy\/steps\/CORE-000-M1\.svg/)
 assert.match(first,/learning\/academy\/screenshots\/core-start\.png/)
 assert.match(first,/Скриншот локального учебного примера/)
 assert.doesNotMatch(second,/screenshots\/core-start/)
 assert.doesNotMatch([...files.values()].join('\n'),/PRIVATE_SCREENSHOT_KEY|PRIVATE_INVALID_VISUAL|PRIVATE_TRAVERSAL_VISUAL/)
})
