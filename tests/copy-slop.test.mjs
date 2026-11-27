import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {scanText, SLOP_MARKERS} from '../scripts/copy-slop.mjs'

const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const kinds = text => scanText(text).hits.map(hit => hit.kind)

test('the checker names the habit and leaves plain wording alone', () => {
 assert.deepEqual(kinds('В современном мире нейросети играют ключевую роль. Важно отметить: это не просто чат, а целая экосистема.'), ['пустое вступление', 'канцелярит', 'канцелярит', 'противопоставление-клише'])
 assert.deepEqual(kinds('Раскрой свой потенциал и выйди на новый уровень: легко и просто.'), ['рекламный штамп', 'рекламный штамп', 'ложная простота'])
 assert.deepEqual(kinds('Подводя итог, давайте разберёмся ещё раз.'), ['объявление вместо дела', 'дежурный вывод'])
 assert.deepEqual(kinds('Попроси модель назвать, чего не хватает в задаче. Проверь дату по первоисточнику.'), [])
 assert.deepEqual(kinds('Не магия, а процедура: один шаг за раз.'), [], 'a plain word in a plain sentence is not a stock phrase')
})

test('a dash between digits is a range, any other long dash is reported', () => {
 assert.deepEqual(kinds('Ролик 10–15 секунд, 2020–2025 годы.'), [])
 assert.deepEqual(kinds('Курс — это практика.'), ['длинное тире'])
 assert.deepEqual(kinds('Курс – это практика.'), ['длинное тире'])
})

test('comments are skipped only when a file is scanned as code, and line numbers survive', () => {
 const source = "// Заметка — для разработчика\nconst url = 'https://t.me/x' // не текст — интерфейса\n/* Блок —\n ещё */\nconst text = 'Курс — это практика'\n"
 assert.equal(scanText(source).hits.length, 4)
 const hits = scanText(source, {code: true}).hits
 assert.equal(hits.length, 1); assert.equal(hits[0].line, 5)
 assert.match(scanText("const link = 'https://example.com/a—b'", {code: true}).hits[0].phrase, /—/)
})

test('every marker has a name and a global unicode pattern', () => {
 for (const [name, pattern] of SLOP_MARKERS) {
  assert.ok(name.length > 3); assert.ok(pattern.global && pattern.unicode, name)
 }
})

// Copy a learner reads in the free start, the catalog and the entry screens, plus documents written for people.
const learnerCode = [
 ...readdirSync(new URL('src/screens/home/', root)).filter(name => /\.tsx?$/.test(name)).map(name => `src/screens/home/${name}`),
 'src/screens/States.tsx', 'src/screens/ShareSheet.tsx', 'src/screens/AdminAccess.tsx',
 'src/lib/beginner-content.ts', 'src/lib/guide-interactions.ts', 'src/lib/warmup.ts', 'src/lib/shareCard.ts',
 'src/lib/og-course-access.ts', 'src/lib/stars-economy.ts', 'src/lib/access-grant.ts', 'src/lib/gamedev-course.json', 'src/lib/seed.json',
]
// The isolated full run copies the app without the root README, so a missing optional file is skipped, never the required ones.
const documents = ['docs/UNIT-ECONOMICS-2026-11.md', 'index.html', ...['README.md'].filter(file => existsSync(new URL(file, root)))]

test('learner-facing copy and the documents for people carry no stock phrases and no long dashes', () => {
 const found = []
 for (const file of learnerCode) for (const hit of scanText(read(file), {code: /\.tsx?$/.test(file)}).hits) found.push(`${file}:${hit.line} [${hit.kind}] ${hit.context}`)
 for (const file of documents) for (const hit of scanText(read(file)).hits) found.push(`${file}:${hit.line} [${hit.kind}] ${hit.context}`)
 assert.deepEqual(found, [])
})
