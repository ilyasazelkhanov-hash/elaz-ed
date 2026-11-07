import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {resolvePracticeCourse,resolvePracticeLesson,canOpenPracticeLesson,practiceOffer} from '../src/lib/og-course-access.ts'
import {demoPracticeContent,addDemoPractice} from '../src/lib/mockOgPractice.ts'

const outline={key:'foundations',title:'Основы ИИ и инструменты'}
const offer={id:40,title:outline.title,access:false,price_stars:250}
const lesson={key:'block-1',title:'1. Первый урок'}
test('course identity uses one server receipt and never guesses numeric IDs or fuzzy titles',()=>{
 assert.equal(resolvePracticeCourse(outline,[{...offer,practice_key:'foundations'}]).id,40)
 assert.equal(resolvePracticeCourse(outline,[{...offer,title:'Другая программа'}]),null)
 assert.equal(resolvePracticeCourse(outline,[offer,{...offer,id:41}]),null)
 assert.equal(resolvePracticeCourse(outline,[{...offer,practice_key:'text'}]),null)
 assert.equal(resolvePracticeCourse(outline,[offer]).id,40)
})
test('published free previews and actual access are distinct from metadata, progress and checkout prices',()=>{
 const course={...offer,practice_key:'foundations',practice_lessons:[{key:'block-1',id:90,title:lesson.title,minutes:10,free_preview:true,completed:false},{key:'second',id:91,title:'Second',free_preview:false,completed:true}]}
 const preview=resolvePracticeLesson(course,lesson,[])
 assert.equal(canOpenPracticeLesson(course,preview),true)
 const locked=resolvePracticeLesson(course,{key:'second',title:'Second'},[])
 assert.equal(canOpenPracticeLesson(course,locked),false)
 assert.equal(canOpenPracticeLesson({...course,access:true},locked),true)
 assert.equal(canOpenPracticeLesson(null,preview),false)
 assert.equal(practiceOffer(null).available,false)
 assert.match(practiceOffer(course).label,/250/)
 assert.equal(resolvePracticeLesson({...course,practice_lessons:[]},lesson,[{...preview,kind:'lesson',published:true,course_id:40}]),null)
})
test('demo offers are isolated synthetic samples and can upgrade a saved demo without resetting progress',()=>{
 const demo=demoPracticeContent(1000000000000)
 assert.equal(demo.courses.length,5);assert.equal(demo.lessons.length,33)
 assert.equal(demo.lessons.filter(lesson=>lesson.free_preview).length,5)
 assert.ok(demo.lessons.every(lesson=>lesson.body.includes('Демонстрационный урок')))
 const state={courses:[],lessons:[],nextId:1,xp:123,done:{42:20},access:[8]}
 const upgraded=addDemoPractice(state),repeat=addDemoPractice(upgraded)
 assert.equal(upgraded.xp,123);assert.deepEqual(upgraded.done,{42:20});assert.deepEqual(upgraded.access,[8])
 assert.equal(repeat.courses.length,5);assert.equal(repeat.lessons.length,33)
})
test('production practice reader imports metadata and the authenticated API, never authored paid bodies',async()=>{
 const ui=await readFile(new URL('../src/screens/home/OGPractice.tsx',import.meta.url),'utf8')
 assert.doesNotMatch(ui,/paths\.json|import\([^)]*paths|training\.json/)
 assert.match(ui,/api\.lesson\(id\)/)
 const helper=await readFile(new URL('../src/lib/og-practice.ts',import.meta.url),'utf8')
 assert.doesNotMatch(helper,/paths\.json|training\.json/)
})
