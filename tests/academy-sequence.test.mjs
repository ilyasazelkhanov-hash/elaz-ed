import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { orderedAcademyLessons, orderedAcademyModules, academyLessonPosition, completedAcademyLessonCodes } from '../src/lib/academy-sequence.ts'

test('course order follows module and lesson positions rather than API array order', () => {
  const modules = [{ code: 'X-M2', position: 1 }, { code: 'X-M1', position: 2 }]
  const lessons = [{ code: 'X-M1-L1', parent_code: 'X-M1', position: 1 }, { code: 'X-M2-L1', parent_code: 'X-M2', position: 2 }, { code: 'X-M2-L2', parent_code: 'X-M2', position: 1 }]
  assert.deepEqual(orderedAcademyLessons(lessons, modules).map(l => l.code), ['X-M2-L2', 'X-M2-L1', 'X-M1-L1'])
  assert.deepEqual(lessons.map(l => l.code), ['X-M1-L1', 'X-M2-L1', 'X-M2-L2'])
  assert.deepEqual(orderedAcademyModules([{ code: 'X-M10' }, { code: 'X-M2' }]).map(m => m.code), ['X-M2', 'X-M10'])
  assert.deepEqual(orderedAcademyLessons([{ code: 'X-M2-L10' }, { code: 'X-M2-L2' }, { code: 'X-M10-L1' }]).map(l => l.code), ['X-M2-L2', 'X-M2-L10', 'X-M10-L1'])
})

test('all course boundaries retain the previous and next lesson across modules without claiming completion', async () => {
  const catalog = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.public.json', import.meta.url)))
  for (const course of catalog.entities.filter(n => n.kind === 'course')) {
    const modules = catalog.entities.filter(n => n.kind === 'module' && n.parent_code === course.code).reverse()
    const lessons = catalog.entities.filter(n => n.kind === 'lesson' && n.code.startsWith(course.code + '-')).reverse()
    const first = academyLessonPosition(`${course.code}-M1-L1`, lessons, modules), boundary = academyLessonPosition(`${course.code}-M1-L4`, lessons, modules), last = academyLessonPosition(`${course.code}-M4-L4`, lessons, modules)
    assert.equal(first.number, 1); assert.equal(first.previous, undefined)
    assert.equal(boundary.number, 4); assert.equal(boundary.next.code, `${course.code}-M2-L1`)
    assert.equal(academyLessonPosition(boundary.next.code, lessons, modules).label, '2.1')
    assert.equal(last.number, 16); assert.equal(last.total, 16); assert.equal(last.next, undefined)
    assert.equal(last.moduleNumber, 4); assert.equal(last.localNumber, 4)
    assert.equal(academyLessonPosition('missing', lessons, modules), undefined)
  }
})

test('only explicit completed progress counts, while review or merely reading does not', () => {
  assert.deepEqual([...completedAcademyLessonCodes([{ lesson_code: 'L1', state: 'completed' }, { lesson_code: 'L2', status: 'completed' }, { lesson_code: 'L3', completed: true }, { lesson_code: 'L4', state: 'submitted' }, { lesson_code: 'L5', state: 'passed' }])], ['L1', 'L2', 'L3'])
})

test('persisted SQL completion timestamps count as progress without inventing completion for other states',()=>{
 assert.deepEqual([...completedAcademyLessonCodes([
  {lesson_code:'SQL',completed_at:'2026-10-28T12:00:00Z'},
  {lesson_code:'BAD',completed_at:'not a date'},
  {lesson_code:'DRAFT',state:'submitted',completed_at:'2026-10-28T12:00:00Z'},
  {lesson_code:'READ'},
 ])],['SQL'])
})
