// Offline diagnostic only. Never fetches, imports, overwrites or publishes a lesson.
import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {reviewedLessonHashes} from '../src/lib/og-lesson-interactions.ts'

export async function interactionCoverage(input) {
 if(!input||!Array.isArray(input.lessons))throw Error('Expected {lessons:[{courseKey,lessonKey,body,published}]}')
 const seen=new Set(),rows=[]
 for(const row of input.lessons){
  if(!row||typeof row.courseKey!=='string'||typeof row.lessonKey!=='string'||typeof row.body!=='string'||typeof row.published!=='boolean')throw Error('Every lesson needs string courseKey, lessonKey, body and boolean published')
  const key=row.courseKey+'/'+row.lessonKey
  if(seen.has(key))throw Error('Duplicate course/lesson key: '+key)
  seen.add(key)
  const compatible=createHash('sha256').update(row.body,'utf8').digest('hex')===reviewedLessonHashes[key]
  rows.push({key,status:!row.published?'unpublished':!reviewedLessonHashes[key]?'not_authored':compatible?'compatible':'body_mismatch',published:row.published})
 }
 return {scope:'supplied-content-export',live_verified:false,warning:'This checks supplied bytes, not their origin, access rights, import receipt or deployed API.',rows,missing_authored_keys:Object.keys(reviewedLessonHashes).filter(key=>!seen.has(key))}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]
 if(!file){console.error('Usage: node --experimental-strip-types scripts/og-interaction-coverage.mjs content-export.json');process.exitCode=1}
 else try{console.log(JSON.stringify(await interactionCoverage(JSON.parse(await readFile(file,'utf8'))),null,2))}catch(error){console.error(error.message);process.exitCode=1}
}
