import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePracticeLesson} from '../src/lib/og-course-access.ts'
import {readFile} from 'node:fs/promises'
import {ogPracticeCourses,readPracticeProgress,writePracticeProgress,practiceProgressStorageKey,practiceProjectLesson,getPracticeResume,practicePath,practiceMatches,practiceTopics,practiceSections,visiblePracticeCourses} from '../src/lib/og-practice.ts'

test('OG directory describes every lesson without eagerly loading the books',async()=>{
 const books=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url),'utf8'))
 assert.deepEqual(ogPracticeCourses.filter(c=>c.key!=='gamedev-starter').map(c=>({key:c.key,lessons:c.lessons.map(l=>l.key)})),books.courses.map(c=>({key:c.key,lessons:c.lessons.map(l=>l.key)})))
 assert.equal(JSON.stringify(ogPracticeCourses).includes('body'),false)
 assert.ok(JSON.stringify(ogPracticeCourses).length<20000)
 const offer={id:42,title:'AI GameDev Starter'}
 assert.equal(visiblePracticeCourses([],false).length,5)
 assert.equal(visiblePracticeCourses([offer],true).length,5)
 assert.equal(visiblePracticeCourses([offer],false).at(-1).key,'gamedev-starter')
})

const scopedStorage = () => {const data = new Map(); return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)}}
const scope = (userId = 42, mode = 'live') => ({userId, mode})

test('resume is isolated by account and mode, without adopting unowned legacy storage', () => {
 const storage = scopedStorage(), progress = {done: ['block-1'], lastLesson: 'foundations-context'}
 storage.setItem('og-practice-done-v1', JSON.stringify(['block-1']))
 storage.setItem('og-practice-last-v1', 'block-1')
 assert.deepEqual(readPracticeProgress(scope(), storage), {done: [], lastLesson: null})
 assert.equal(writePracticeProgress(scope(), progress, storage), true)
 assert.deepEqual(readPracticeProgress(scope(), storage), {...progress, done: []})
 assert.deepEqual(readPracticeProgress(scope(43), storage), {done: [], lastLesson: null})
 assert.deepEqual(readPracticeProgress(scope(42, 'demo'), storage), {done: [], lastLesson: null})
 assert.equal(writePracticeProgress(scope(42, 'demo'), progress, storage), true)
 assert.deepEqual(readPracticeProgress(scope(42, 'demo'), storage), progress)
 for (const userId of [undefined, 0, '']) {
  const anonymous = {userId, mode: 'live'}
  assert.equal(practiceProgressStorageKey(anonymous), null)
  assert.equal(writePracticeProgress(anonymous, progress, storage), false)
 }
 assert.notEqual(practiceProgressStorageKey(scope('a:b')), practiceProgressStorageKey(scope('a%3Ab')))
})

test('progress validates version, owner, course, and lesson; corrupt or denied storage is safe', () => {
 const storage = scopedStorage(), demo = scope(42, 'demo'), key = practiceProgressStorageKey(demo)
 writePracticeProgress(demo, {done: ['block-1', 'block-1', 'removed'], lastLesson: 'block-1'}, storage)
 const record = JSON.parse(storage.getItem(key))
 assert.equal(record.courseKey, 'foundations'); assert.ok(Number.isFinite(record.updatedAt))
 assert.deepEqual(readPracticeProgress(demo, storage), {done: ['block-1'], lastLesson: 'block-1'})
 for (const patch of [{version: 1}, {catalogVersion: 'stale'}, {userId: '43'}, {mode: 'live'}, {updatedAt: 'bad'}]) {
  storage.setItem(key, JSON.stringify({...record, ...patch}))
  assert.deepEqual(readPracticeProgress(demo, storage), {done: [], lastLesson: null})
 }
 for (const patch of [{lastLesson: 'removed'}, {courseKey: 'text'}]) {
  storage.setItem(key, JSON.stringify({...record, ...patch}))
  assert.equal(readPracticeProgress(demo, storage).lastLesson, null)
 }
 for (const value of ['{invalid', 'null', '42', '[]']) assert.deepEqual(readPracticeProgress(demo, {getItem: () => value}), {done: [], lastLesson: null})
 assert.deepEqual(readPracticeProgress(demo, {getItem: () => {throw Error('denied')}}), {done: [], lastLesson: null})
 assert.equal(writePracticeProgress(demo, {done: [], lastLesson: null}, {setItem: () => {throw Error('quota')}}), false)
})

test('resume skips revoked or missing lessons and uses reconciled server completion', () => {
 const [first, second] = ogPracticeCourses
 const local = {done: [], lastLesson: first.lessons[0].key}
 const completed = [first.lessons[0].key, second.lessons[0].key]
 const result = getPracticeResume({...local, done: completed}, course => course.key === second.key)
 assert.equal(result.course.key, second.key)
 assert.equal(result.lesson.key, second.lessons[1].key)
 assert.equal(getPracticeResume(local, () => false), null)
 assert.equal(getPracticeResume({...local, done: first.lessons.map(l => l.key)}), null)
})

test('project links resolve explicit capstones even when extra lessons follow them', () => {
 for (const course of ogPracticeCourses) assert.ok(course.lessons.includes(practiceProjectLesson(course)))
 const text = ogPracticeCourses.find(course => course.key === 'text'), automation = ogPracticeCourses.find(course => course.key === 'automation')
 assert.equal(practiceProjectLesson(text).key, 'text-project')
 assert.equal(practiceProjectLesson(automation).key, 'automation-project')
 assert.notEqual(practiceProjectLesson(text), text.lessons.at(-1))
 assert.notEqual(practiceProjectLesson(automation), automation.lessons.at(-1))
})

test('resume follows the viewed lesson, advances completed lessons, and never restarts a finished course',()=>{
 const [first,second]=ogPracticeCourses
 assert.equal(getPracticeResume({done:[],lastLesson:null}),null)
 assert.equal(getPracticeResume({done:[],lastLesson:second.lessons[2].key}).lesson.key,second.lessons[2].key)
 assert.equal(getPracticeResume({done:[first.lessons[0].key],lastLesson:first.lessons[0].key}).lesson.key,first.lessons[1].key)
 const done=first.lessons.map(l=>l.key)
 assert.equal(getPracticeResume({done,lastLesson:first.lessons.at(-1).key}),null)
 assert.equal(getPracticeResume({done:[...done,second.lessons[0].key],lastLesson:first.lessons.at(-1).key}).course.key,second.key)
 assert.equal(practicePath(first.key,first.lessons[1].key),'/og-practice/foundations/foundations-context')
})

test('topic filters use actual course subjects and search includes lesson titles',()=>{
 assert.ok(ogPracticeCourses.some(c=>practiceMatches(c,'Дизайн','карусель')))
 assert.equal(ogPracticeCourses.filter(c=>practiceMatches(c,'Код','')).map(c=>c.key).join(','),'coding,gamedev-starter')
 assert.ok(practiceMatches(ogPracticeCourses.find(c=>c.key==='gamedev-starter'),'Код','godot чат агента'))
 assert.ok(practiceMatches(ogPracticeCourses[1],'Все','gemini notebook'))
 assert.ok(practiceMatches(ogPracticeCourses.find(c=>c.key==='media'),'Все','Suno'))
 assert.ok(practiceMatches(ogPracticeCourses.find(c=>c.key==='foundations'),'Все','Perplexity'))
 assert.equal(practiceMatches(ogPracticeCourses[1],'Все','несуществующий урок'),false)
 for(const topic of practiceTopics)assert.ok(ogPracticeCourses.some(c=>practiceMatches(c,topic,'')),topic)
})

test('GameDev lessons resolve during the title rollout without guessing between duplicates',()=>{
 const course = {id:8}
 const outline = ogPracticeCourses.find(item=>item.key==='gamedev-starter').lessons[5]
 const oldCard = {id:221,kind:'lesson',published:true,course_id:8,title:outline.previousTitle}
 const newCard = {...oldCard,title:outline.title}
 assert.equal(resolvePracticeLesson(course,outline,[oldCard]).id,221)
 assert.equal(resolvePracticeLesson(course,outline,[newCard]).id,221)
 assert.equal(resolvePracticeLesson(course,outline,[oldCard,{...newCard,id:999}]),null)
})

test('reader sections preserve Markdown fences and separate practice from the explanation',()=>{
 const source='Введение\n\n## Теория\n\nПример.\n\n```md\n## Самостоятельная работа\nвнутри кода\n```\n\n## Самостоятельная работа\n\nСделай файл.\n\n## Критерии готовности\n\nОткрой файл.\n\n## Проверь себя\n\nПочему?\n\n## Разбор ответа\n\nПотому что.\n\n## Ссылки для практики\n\n[Файл](/file.md)'
 const sections=practiceSections(source)
 assert.ok(sections.reading.includes('внутри кода'))
 assert.ok(sections.practice.includes('Сделай файл.'))
 assert.ok(sections.practice.includes('Критерии готовности'))
 assert.ok(sections.check.includes('Почему?'))
 assert.ok(sections.check.includes('Разбор ответа'))
 assert.ok(sections.resources.includes('[Файл]'))
 assert.equal(sections.reading.includes('Сделай файл.'),false)
})
