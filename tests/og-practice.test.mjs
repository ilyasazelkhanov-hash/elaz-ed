import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {ogPracticeCourses,readPracticeProgress,getPracticeResume,practicePath,practiceMatches,practiceTopics,practiceSections} from '../src/lib/og-practice.ts'

test('OG directory describes every lesson without eagerly loading the books',async()=>{
 const books=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/paths.json',import.meta.url),'utf8'))
 assert.deepEqual(ogPracticeCourses.map(c=>({key:c.key,lessons:c.lessons.map(l=>l.key)})),books.courses.map(c=>({key:c.key,lessons:c.lessons.map(l=>l.key)})))
 assert.equal(JSON.stringify(ogPracticeCourses).includes('body'),false)
 assert.ok(JSON.stringify(ogPracticeCourses).length<20000)
})

test('progress tolerates corrupt storage, removes duplicate and unknown lesson IDs',()=>{
 const storage={getItem:key=>key==='og-practice-done-v1'?'["block-1","block-1","removed",null]':'removed'}
 assert.deepEqual(readPracticeProgress(storage),{done:['block-1'],lastLesson:null})
 assert.deepEqual(readPracticeProgress({getItem:()=>{throw Error('denied')}}),{done:[],lastLesson:null})
 assert.deepEqual(readPracticeProgress({getItem:()=>'{invalid'}),{done:[],lastLesson:null})
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
 assert.equal(ogPracticeCourses.filter(c=>practiceMatches(c,'Код','')).map(c=>c.key).join(','),'coding')
 assert.ok(practiceMatches(ogPracticeCourses[1],'Все','gemini notebook'))
 assert.ok(practiceMatches(ogPracticeCourses.find(c=>c.key==='media'),'Все','Suno'))
 assert.ok(practiceMatches(ogPracticeCourses.find(c=>c.key==='foundations'),'Все','Perplexity'))
 assert.equal(practiceMatches(ogPracticeCourses[1],'Все','несуществующий урок'),false)
 for(const topic of practiceTopics)assert.ok(ogPracticeCourses.some(c=>practiceMatches(c,topic,'')),topic)
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
