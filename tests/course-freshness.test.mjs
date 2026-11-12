import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {freshnessLabs,storedZip,readLabEntries,writeFreshnessLabs} from '../scripts/academy-freshness-labs.mjs'
import {composeLearningCatalog,loadAuthoredPacks} from '../scripts/academy-content.mjs'
import {courseMaterials} from '../scripts/course-materials.mjs'
import {courseBookFiles} from '../scripts/academy-books.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'))

// Parse the stored ZIP independently of the writer, then compare original bytes.
function unpack(buffer){
 const entries=[];let offset=0
 while(buffer.readUInt32LE(offset)===0x04034b50){
  assert.equal(buffer.readUInt16LE(offset+8),0,'no compression in teaching ZIP')
  const size=buffer.readUInt32LE(offset+18),nameSize=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28)
  const name=buffer.subarray(offset+30,offset+30+nameSize).toString('utf8'),start=offset+30+nameSize+extra
  entries.push({name,data:buffer.subarray(start,start+size)})
  offset=start+size
 }
 assert.equal(buffer.readUInt32LE(offset),0x02014b50,'central directory follows entries')
 const end=buffer.length-22
 assert.equal(buffer.readUInt32LE(end),0x06054b50)
 assert.equal(buffer.readUInt16LE(end+10),entries.length)
 assert.equal(buffer.readUInt32LE(end+16),offset)
 return entries
}

test('both downloadable labs are deterministic complete source copies',async()=>{
 for(const name of freshnessLabs){
  const source=await readLabEntries(path.join(root,'content/ai-academy/projects',name)),archive=await readFile(path.join(root,'public/learning/academy',name+'.zip'))
  assert.ok(archive.equals(storedZip(source)),name+' archive is stale')
  assert.deepEqual(unpack(archive),source)
  assert.ok(source.some(e=>e.name.endsWith('.test.mjs')))
  const documentation=source.filter(e=>e.name.endsWith('.md')).map(e=>e.data.toString('utf8')).join('\n')
  assert.match(documentation,/2026-11-12|12 ноября 2026/)
  assert.match(documentation,/https:\/\/github\.com\//)
  assert.doesNotMatch(source.map(e=>e.name).join('\n'),/node_modules|\.env|\.sqlite/)
 }
})

test('archive writer rejects path traversal and unexpected files, stays repeatable',async t=>{
 const base=await mkdtemp(path.join(tmpdir(),'course-freshness-'));t.after(()=>rm(base,{recursive:true,force:true}))
 const folder=path.join(base,'lab');await mkdir(folder)
 await writeFile(path.join(folder,'README.md'),'Original teaching notes')
 await writeFile(path.join(folder,'SOURCES.md'),'Official public links')
 const entries=await readLabEntries(folder)
 assert.ok(storedZip(entries).equals(storedZip(entries)))
 assert.throws(()=>storedZip([{name:'../secret',data:'no'}]),/Unsafe/)
 await writeFile(path.join(folder,'.env'),'FICTIONAL')
 await assert.rejects(readLabEntries(folder),/Unexpected/)
 await rm(path.join(folder,'.env'))
 if(process.platform!=='win32'){
  await symlink(path.join(folder,'README.md'),path.join(folder,'alias.md'))
  await assert.rejects(readLabEntries(folder),/symlinks/)
 }
})

test('authoring integrates extensions without replacing the sixteen-lesson routes',async()=>{
 const packs=await loadAuthoredPacks(),base=await read('content/ai-academy/catalog.normalized.json'),catalog=composeLearningCatalog(base,packs)
 for(const [code,lessonCodes,archive]of [
  ['ENG-201',['ENG-201-M2-L4'],'mcp-authorization-lab'],
  ['AG-301',['AG-301-M2-L2','AG-301-M3-L2'],'voice-confirmation-lab']
 ]){
  const pack=packs.find(p=>p.course_code===code)
  assert.equal(pack.lessons.length,16)
  for(const lessonCode of lessonCodes){
   const lesson=pack.lessons.find(l=>l.code===lessonCode),body=JSON.stringify(lesson.data.content_blocks)
   assert.match(body,new RegExp('/learning/academy/'+archive+'\\.zip'))
   assert.ok(lesson.data.content_blocks.some(b=>b.learning_role==='lesson_practice'))
   assert.ok(pack.sources.some(s=>s.checked_at==='2026-11-12'&&s.targets.includes(lessonCode)))
   assert.ok(catalog.entities.find(n=>n.code===lessonCode+'-CHECK'),'existing assessment preserved')
  }
 }
 const eng=packs.find(p=>p.course_code==='ENG-201').lessons.find(l=>l.code==='ENG-201-M2-L4')
 const engText=JSON.stringify(eng.data.content_blocks)
 for(const term of ['issuer','audience','scope','CIMD','DCR','2.0.2','2026-07-28','2025-03-26','не JWT-валидатор'])assert.ok(engText.includes(term),term)
 assert.equal(new Set(eng.assessment.questions.map(q=>q.id)).size,eng.assessment.questions.length)
 const voice=packs.find(p=>p.course_code==='AG-301').lessons.find(l=>l.code==='AG-301-M2-L2')
 assert.match(JSON.stringify(voice.data.content_blocks),/Молчание.*не согласие/)
 assert.match(JSON.stringify(voice.data.content_blocks),/синтетические/)
})

test('published reading files and course books contain the extensions and no answer keys',async()=>{
 const base=await read('content/ai-academy/catalog.normalized.json'),packs=await loadAuthoredPacks(),catalog=composeLearningCatalog(base,packs),books=courseMaterials(catalog),pages=courseBookFiles(base,packs,[],await read('content/ai-academy/lesson-visuals.json'))
 for(const code of ['ENG-201','AG-301']){
  const book=books.find(b=>b.course.code===code)
  assert.deepEqual(await read('public/learning/courses/materials/'+code+'.json'),book,'generated reader must be current')
  assert.doesNotMatch(JSON.stringify(book),/"assessment"|"answer"|"questions"/)
  assert.ok(book.sources.some(s=>s.checked_at==='2026-11-12'))
  const page=await readFile(path.join(root,'docs/ai-academy/courses',code,'M2.md'),'utf8')
  assert.equal(page,pages.get('courses/'+code+'/M2.md'))
  assert.match(page,/authorization-lab|confirmation-lab/)
 }
})
