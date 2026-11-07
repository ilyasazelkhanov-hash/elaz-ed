import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {academyPathway, defaultPathwayChoice, matchesCourseLevel, orderedPathwayCourses, practiceGoals, practicePathway, readPathwayChoice, writePathwayChoice} from '../src/lib/course-pathways.ts'
import {ogPracticeCourses} from '../src/lib/og-practice.ts'
import {learningPath, learningUrl} from '../src/lib/learning-entry.ts'

const catalog = JSON.parse(await readFile(new URL('../content/ai-academy/catalog.public.json', import.meta.url)))
const courses = catalog.entities.filter(item => item.kind === 'course')
const choice = (goal = '', audience = 'beginner', entry = 'practice') => ({goal, audience, entry})

test('beginner OG routes start free, include foundations once, and then the chosen project only', () => {
 assert.deepEqual(practicePathway(choice()).map(step => step.id), ['free-start', 'foundations'])
 for (const goal of practiceGoals) {
  const route = practicePathway(choice(goal.id))
  assert.deepEqual(route.map(step => step.id), [...new Set(['free-start', 'foundations', goal.id])])
  assert.equal(route[0].path, '/start')
  assert.equal(new Set(route.map(step => step.path)).size, route.length)
  for (const step of route.slice(1)) {
   const course = ogPracticeCourses.find(course => course.key === step.id)
   assert.equal(step.title, course.title)
   assert.equal(step.note, course.project)
   assert.equal(step.requirements, undefined)
  }
 }
})

test('experienced OG routes do not force foundations, free start, or unrelated programs', () => {
 assert.deepEqual(practicePathway(choice('', 'experienced')), [])
 for (const course of ogPracticeCourses) assert.deepEqual(practicePathway(choice(course.key, 'experienced')).map(step => step.id), [course.key])
 assert.deepEqual(practicePathway(choice('not-a-course', 'experienced')), [])
 assert.deepEqual(practicePathway(choice('javascript:alert(1)', 'beginner')).map(step => step.id), ['free-start', 'foundations'])
})

test('Academy beginner routes preserve declared level order and exact entry conditions in every direction', () => {
 for (const direction of catalog.entities.filter(item => item.kind === 'direction')) {
  const route = academyPathway([...courses].reverse(), choice(direction.code))
  assert.deepEqual(route.map(step => step.id), ['CORE-000', `${direction.code}-101`, `${direction.code}-201`, `${direction.code}-301`])
  for (const step of route) {
   const course = courses.find(course => course.code === step.id)
   assert.equal(step.title, course.title)
   assert.equal(step.requirements, course.data.prerequisites)
   assert.equal(step.note, course.data.outcome)
  }
 }
})

test('Academy experienced routes let readers compare Middle or Senior without inventing eligibility', () => {
 for (const direction of catalog.entities.filter(item => item.kind === 'direction')) {
  assert.deepEqual(academyPathway(courses, choice(direction.code, 'experienced')).map(step => step.id), [`${direction.code}-201`, `${direction.code}-301`])
  assert.deepEqual(academyPathway(courses, choice(direction.code, 'experienced', 'deep')).map(step => step.id), [`${direction.code}-301`])
 }
 assert.deepEqual(academyPathway(courses, choice('', 'experienced')), [])
 assert.deepEqual(academyPathway(courses, choice('unknown', 'experienced')), [])
 assert.deepEqual(academyPathway([], choice('VC')), [])
})

test('declared levels win over misleading code suffixes, API order, or missing records', () => {
 const fixture = [
  {code: 'CUSTOM-301', title: 'Start', parent_code: 'CUSTOM', position: 99, data: {level: 'Junior'}},
  {code: 'CUSTOM-101', title: 'Practice', parent_code: 'CUSTOM', position: 0, data: {level: 'Middle'}},
  {code: 'CUSTOM-201', title: 'Unknown level', parent_code: 'CUSTOM', position: 1, data: {}},
 ]
 const before = structuredClone(fixture)
 assert.deepEqual(orderedPathwayCourses(fixture).map(c => c.title), ['Start', 'Practice', 'Unknown level'])
 assert.deepEqual(fixture, before)
 assert.deepEqual(academyPathway(fixture, choice('CUSTOM')).map(c => c.title), ['Start', 'Practice'])
 assert.equal(academyPathway(fixture, choice('CUSTOM'))[0].requirements, 'Условия входа не указаны в каталоге.')
 assert.equal(matchesCourseLevel(fixture[0], 'start'), true)
 assert.equal(matchesCourseLevel(fixture[0], 'deep'), false)
 assert.equal(matchesCourseLevel(fixture[1], 'practice'), true)
 assert.equal(matchesCourseLevel(fixture[2], 'practice'), false)
 assert.equal(matchesCourseLevel(fixture[2], 'all'), true)
})

test('every recommended link resolves to an existing program or the free start and round-trips', () => {
 const routes = [practicePathway(choice('coding')), academyPathway(courses, choice('ENG'))].flat()
 for (const step of routes) {
  assert.equal(learningPath(learningUrl(step.path, false), false), step.path)
  assert.ok(step.path === '/start' || /^\/og-practice\/[^/]+$/.test(step.path) || /^\/courses\/[A-Z]+-\d+$/.test(step.path))
 }
})

test('session choice survives remounts, remains scoped to the account/catalog, and handles malformed storage', () => {
 const data = new Map(), storage = {getItem: key => data.get(key), setItem: (key, value) => data.set(key, value)}
 const selected = choice('coding', 'experienced')
 writePathwayChoice('practice:user-a', selected, storage)
 assert.deepEqual(readPathwayChoice('practice:user-a', storage), selected)
 assert.deepEqual(readPathwayChoice('practice:user-b', storage), defaultPathwayChoice)
 assert.deepEqual(readPathwayChoice('academy:user-a', storage), defaultPathwayChoice)
 assert.deepEqual(readPathwayChoice('corrupt', {getItem: () => '{'}), defaultPathwayChoice)
 assert.deepEqual(readPathwayChoice('invalid', {getItem: () => JSON.stringify({audience: 'expert', goal: 42, entry: 'admin'})}), defaultPathwayChoice)
 const copy = readPathwayChoice('practice:user-a', storage); copy.goal = 'media'
 assert.equal(readPathwayChoice('practice:user-a', storage).goal, 'coding')
})

test('blocked session storage keeps the new choice in memory instead of reverting to stale saved data', () => {
 const storage = {getItem: () => JSON.stringify(defaultPathwayChoice), setItem: () => {throw Error('Storage blocked')}}
 writePathwayChoice('blocked', choice('automation', 'experienced'), storage)
 assert.deepEqual(readPathwayChoice('blocked', storage), choice('automation', 'experienced'))
 assert.deepEqual(readPathwayChoice('read-blocked', {getItem: () => {throw Error('Storage blocked')}}), defaultPathwayChoice)
})

test('recommendations stay separate from paid lessons, completion, and enrollment', async () => {
 const model = await readFile(new URL('../src/lib/course-pathways.ts', import.meta.url), 'utf8')
 const view = await readFile(new URL('../src/screens/courses/CoursePathway.tsx', import.meta.url), 'utf8')
 assert.doesNotMatch(model + view, /paths\.json|catalog\.learning|\.enroll\(|\.complete\(|\.lesson\(|courseInvoice|writePracticeProgress/)
 assert.match(view, /Это рекомендация, а не обязательная цепочка/)
 assert.match(view, /Условия в программе/)
 assert.match(view, /aria-pressed/)
 assert.match(view, /<fieldset/)
 assert.match(view, /<ol/)
 const main = await readFile(new URL('../src/screens/home/OGPractice.tsx', import.meta.url), 'utf8')
 assert.match(main, /scope=\{`practice:\$\{user\}`\}/)
 const academy = await readFile(new URL('../src/screens/courses/Catalog.tsx', import.meta.url), 'utf8')
 assert.match(academy, /setQ\(''\);setTopic\('Все'\);setLevel\('all'\)/)
 assert.doesNotMatch(academy, /code\.endsWith\(/)
 assert.match(academy, /onClick=\{\(\)=>go\(`/)
})
