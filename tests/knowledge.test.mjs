import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {courseGuide,knowledgeTopics,topicForCourse,topicForPost,relatedCourseGuides,curatedGoalCourses} from '../src/lib/knowledge.ts'
const guides=JSON.parse(await readFile(new URL('../content/knowledge/course-guides.json',import.meta.url)))
const courses=JSON.parse(await readFile(new URL('../content/ai-academy/course-directory.json',import.meta.url)))
const codes=new Set(courses.map(course=>course.code))

test('all 28 actual programs have distinct plain-language entry, outcome, and a concrete exercise',()=>{
 assert.equal(guides.length,28);assert.equal(new Set(guides.map(guide=>guide.code)).size,28)
 assert.deepEqual(new Set(guides.map(guide=>guide.code)),codes)
 for(const guide of guides){
  for(const key of ['plainTitle','forWhom','outcome','tryNow'])assert.ok(typeof guide[key]==='string'&&guide[key].length>30,`${guide.code} ${key}`)
  assert.ok(!guide.nextCodes.includes(guide.code));assert.ok(guide.nextCodes.every(code=>codes.has(code)))
  assert.equal(courseGuide(guide.code)?.code,guide.code)
 }
 assert.equal(courseGuide('UNKNOWN'),undefined)
})
test('recommended continuations form a valid acyclic graph and never claim prerequisites',()=>{
 const visited=new Set(),active=new Set()
 const visit=code=>{assert.ok(!active.has(code),`cycle ${code}`);if(visited.has(code))return;active.add(code);for(const next of courseGuide(code).nextCodes)visit(next);active.delete(code);visited.add(code)}
 for(const code of codes)visit(code)
 assert.equal(visited.size,28)
 assert.ok(!JSON.stringify(guides).includes('assessment'))
})
test('topics cover the whole curriculum with descriptions for starting and practising',()=>{
 assert.equal(knowledgeTopics.length,9)
 for(const topic of knowledgeTopics){assert.ok(topic.beginner.length>20);assert.ok(topic.practitioner.length>20);assert.ok(topic.courseCodes.every(code=>codes.has(code)))}
 for(const code of codes)assert.ok(topicForCourse(code).courseCodes.includes(code))
 assert.equal(topicForCourse('UNKNOWN').id,'tools')
})
test('article suggestions follow the actual subject rather than a generic AI label',()=>{
 const post=title=>({title,subtitle:'',category:'Блог'})
 for(const [title,topic]of [['Что нового в ChatGPT и Claude','tools'],['Codex: проверяем pull request','vibecoding'],['SQL в ChatGPT: как проверить метрики','data'],['n8n: обработка вебхука','automation'],['RAG: поиск по базе знаний','agents'],['Figma и проверка прототипа','design'],['Midjourney: серия изображений','creative'],['CRM и сегментация аудитории','marketing'],['Внедрение ИИ в команду','business']])assert.equal(topicForPost(post(title)),topic,title)
 assert.equal(topicForPost({title:'Разбор недели',subtitle:'',category:'Данные'}),'data')
 assert.equal(relatedCourseGuides(post('Codex: проверяем pull request'))[0].code,'ENG-101')
 assert.equal(relatedCourseGuides(post('SQL в ChatGPT: как проверить метрики'))[0].code,'DT-101')
 assert.equal(relatedCourseGuides(post('SQL'),0).length,0)
 assert.equal(relatedCourseGuides(post('SQL'),-1).length,0)
 assert.equal(relatedCourseGuides(post('SQL'),1).length,1)
})
test('personal goals point to real courses without using articles or artificial completion',()=>{
 for(const goal of ['goal:tools','goal:content','goal:apps','goal:services','unknown']){
  const path=curatedGoalCourses(goal);assert.ok(path.length>=2);assert.equal(path[0].code,'CORE-000');assert.ok(path.every(guide=>codes.has(guide.code)))
 }
 assert.deepEqual(curatedGoalCourses('goal:apps').map(guide=>guide.code),['CORE-000','VC-101','ENG-101'])
})
