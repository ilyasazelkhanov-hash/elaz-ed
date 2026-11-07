import test from 'node:test'
import assert from 'node:assert/strict'
import {assertNoCourseOverlap, courseOverlapReport, normalizedNewsText} from '../supabase/functions/_shared/news-policy.ts'

const words = Array.from({length: 220}, (_,i)=>`слово${i}`).join(' ')
test('course copies, exact short bodies and substantial contiguous excerpts are blocked',()=>{
 assert.throws(()=>assertNoCourseOverlap(words,[{id:12,body:words}]),/course_overlap/)
 assert.throws(()=>assertNoCourseOverlap('Короткий **УРОК**.',[{id:13,body:'короткий урок'}]),/course_overlap/)
 const excerpt=words.split(' ').slice(40,85).join(' ')
 assert.throws(()=>assertNoCourseOverlap(excerpt,[{id:14,body:words}]),/course_overlap/)
 const report=courseOverlapReport(words,[{id:12,body:words}])[0]
 assert.equal(report.containment,1)
 assert.equal(report.shared_shingles,216)
 assert.equal(report.id,12)
 assert.equal(JSON.stringify(report).includes('слово'),false,'reports never expose paid text')
})
test('topical vocabulary and repeated boilerplate do not count as unique course copies',()=>{
 const intro='OpenAI обновила модель для работы с текстом и кодом. '
 assert.doesNotThrow(()=>assertNoCourseOverlap(intro+'Сегодня компания представила новые возможности.',[{id:1,body:intro+'Теперь выполни задание урока.'}]))
 const small='общий шаблон из пяти слов '.repeat(50)
 const report=courseOverlapReport(small+'новая самостоятельная новость',[{id:1,body:small+'задание курса'}])[0]
 assert.ok(report.shared_shingles<100)
 assert.equal(report.blocked,false)
 assert.equal(normalizedNewsText('  ЁЖ <b>и</b> **ИИ**! '),'еж и ии')
})
test('noncontiguous substantial reuse crosses the containment threshold',()=>{
 const candidate=words.split(' ').slice(0,165).join(' ')+' собственный новый вывод в завершении'
 assert.throws(()=>assertNoCourseOverlap(candidate,[{id:'archive:1',body:words}]),/course_overlap/)
})
