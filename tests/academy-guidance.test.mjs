import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { courseGuide, lessonGuide, lessonTerms, nextAcademyLesson } from '../src/lib/academy-guidance.ts'
import { createAcademyEngine } from '../src/lib/academy-domain.ts'

const catalog = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.learning.json', import.meta.url)))
const courses = catalog.entities.filter(entity => entity.kind === 'course')

test('all 28 courses have distinct worked examples and local illustrations', async () => {
  assert.equal(courses.length, 28)
  const scenarios = new Set(), examples = new Set()
  for (const course of courses) {
    const guide = courseGuide(course.code)
    assert.ok(guide, `Missing guide for ${course.code}`)
    scenarios.add(guide.scenario); examples.add(guide.example)
    assert.equal(guide.flow.length, 3)
    assert.equal(guide.checks.length, 3)
    const svg = await readFile(new URL(`../public/learning/academy/${course.code.split('-')[0].toLowerCase()}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /viewBox="0 0 720 360"/)
    assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)="https?:/)
  }
  assert.equal(scenarios.size, 28)
  assert.equal(examples.size, 28)
  assert.equal(courseGuide('UNKNOWN-101'), undefined)
})

test('all 448 lessons can be prepared from student-visible course metadata without publishing or exposing bodies', async () => {
  let saved
  const api = createAcademyEngine(catalog, { load: () => saved, save: value => { saved = value } })
  const student = { id: 22, is_admin: false }
  let count = 0, planned = 0
  for (const course of courses) {
    const result = await api(student, 'course', { code: course.code })
    for (const lesson of result.lessons) {
      const guide = lessonGuide(lesson)
      assert.ok(guide.guide, lesson.code)
      assert.ok(guide.goal && guide.prompt.includes(lesson.title))
      assert.equal(guide.hints.length, 2)
      assert.ok(!lesson.data.content_blocks?.length)
      count++
      if (lesson.state === 'outline') planned++
    }
  }
  assert.equal(count, 448)
  assert.equal(planned, 416)
  await assert.rejects(api(student, 'lesson', { code: 'DT-201-M1-L1' }), /not_published/)
  await assert.rejects(api(student, 'complete', { code: 'DT-201-M1-L1' }), /not_published/)
  assert.equal((await api(student, 'my', {})).progress.length, 0)
})

test('published lesson guidance uses its actual deliverable and acceptance criteria', () => {
  const lesson = catalog.entities.find(entity => entity.code === 'CORE-000-M1-L1')
  const guide = lessonGuide(lesson)
  assert.equal(guide.goal, lesson.data.deliverable)
  assert.deepEqual(guide.criteria, lesson.data.acceptance)
})

test('quiz help never includes grading keys or provides the correct option', () => {
  const lesson = { code: 'CORE-000-M1-L4', title: 'Проверка понимания', data: { format: 'knowledge_check', assessment: { questions: [{ correct: 'PRIVATE_GRADING_KEY' }] }, content_blocks: [{ body: 'PRIVATE_BODY' }] } }
  const guide = lessonGuide(lesson)
  assert.doesNotMatch(JSON.stringify(guide), /PRIVATE_GRADING_KEY|PRIVATE_BODY/)
  assert.match(guide.hints[0], /не раскрывает правильный вариант/)
})

test('glossary recognizes complete terms and avoids accidental matches inside words', () => {
  assert.deepEqual(lessonTerms('SQLAlchemy и капилляр', 'UNKNOWN').map(([term]) => term), [])
  assert.deepEqual(lessonTerms('Запрос SQL, API и RAG', 'UNKNOWN').map(([term]) => term), ['API', 'RAG', 'SQL'])
})

test('resume skips completed and unpublished lessons, handles both API progress shapes', () => {
  const lessons = [{ code: 'L1', state: 'published' }, { code: 'L2', state: 'outline' }, { code: 'L3', state: 'published' }, { code: 'L4', state: 'published' }]
  assert.equal(nextAcademyLesson(lessons, [{ lesson_code: 'L1', state: 'completed' }, { lesson_code: 'L3', status: 'completed' }]).code, 'L4')
  assert.equal(nextAcademyLesson(lessons, [{ lesson_code: 'L1', status: 'failed' }]).code, 'L1')
  assert.equal(nextAcademyLesson(lessons, [{ lesson_code: 'L1', completed: true }, { lesson_code: 'L3', state: 'completed' }, { lesson_code: 'L4', state: 'completed' }]), undefined)
})
