import test from 'node:test'
import assert from 'node:assert/strict'
import {practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck} from '../src/lib/practice-reader.ts'

test('a self-check hides the real answer while preserving every source character', () => {
 const source = '## Проверь себя\n\nПочему?\n\n```md\n## Разбор ответа\nЭто пример разметки.\n```\n\n## Разбор ответа\n\nЭто ответ.\n'
 const {question, answer} = splitPracticeCheck(source)
 assert.equal(question + answer, source)
 assert.ok(question.includes('Это пример разметки.'))
 assert.equal(question.includes('Это ответ.'), false)
 assert.ok(answer.startsWith('## Разбор ответа\n'))
 assert.equal(splitPracticeCheck('## Проверь себя\n\nВопрос без разбора.').answer, '')
})

test('answer headings inside tilde fences cannot disclose the answer early', () => {
 const source = '~~~text\n## Разбор ответа\nучебный текст\n~~~~\n\n## Разбор ответа\nответ'
 assert.equal(splitPracticeCheck(source).answer, '## Разбор ответа\nответ')
})

test('reader drafts are isolated by account, course and lesson without anonymous persistence', () => {
 const first = practiceReaderStorageKey(42, 'text', 'one')
 assert.notEqual(first, practiceReaderStorageKey(43, 'text', 'one'))
 assert.notEqual(first, practiceReaderStorageKey(42, 'text', 'two'))
 assert.notEqual(practiceReaderStorageKey('42:text', 'one', 'two'), practiceReaderStorageKey(42, 'text:one', 'two'))
 assert.equal(practiceReaderStorageKey(undefined, 'text', 'one'), null)
 assert.deepEqual(readPracticeReaderDraft(first, {getItem: () => '{"view":"check","answer":"Мой вывод"}'}), {view:'check',answer:'Мой вывод'})
})

test('unavailable and corrupt browser storage never prevents a lesson from opening', () => {
 const key = practiceReaderStorageKey(42, 'text', 'one'), fallback = {view:'reading',answer:''}
 for (const value of ['{broken', 'null', '42', '{"view":"unknown","answer":false}']) {
  assert.deepEqual(readPracticeReaderDraft(key, {getItem: () => value}), fallback)
 }
 assert.deepEqual(readPracticeReaderDraft(key, {getItem: () => {throw new Error('denied')}}), fallback)
 assert.deepEqual(readPracticeReaderDraft(null, {getItem: () => {throw new Error('must not read')}}), fallback)
})

// Render the reader itself so a navigation regression cannot hide sections behind
// an unlabeled horizontal scroller again. This is not a browser layout test.
test('reader exposes primary sections and an explicit menu for other sections', async () => {
 const {readFile} = await import('node:fs/promises')
 const {transformWithOxc} = await import('vite')
 const {createElement} = await import('react')
 const {renderToStaticMarkup} = await import('react-dom/server')
 const file = new URL('../src/screens/home/PracticeReader.tsx', import.meta.url)
 let code = (await transformWithOxc(await readFile(file, 'utf8'), file.pathname, {lang:'tsx', jsx:{runtime:'automatic'}})).code
 for (const [path, names] of Object.entries({'../../Markdown':'Markdown', '../../lib/og-practice':'practiceSections', '../../lib/practice-reader':'practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck', '../../ui':'Tap'})) {
  code = code.replace(new RegExp(`import[^;\\n]*from ["']${path.replaceAll('.', '\\.')}["'];?`, 'g'), `const { ${names} } = globalThis.__readerHarness;`)
 }
 code = code.replace(/import ["']\.\/practice\.css["'];?/g, '')
 for (const name of ['react', 'react/jsx-runtime', 'lucide-react']) code = code.replaceAll(`from "${name}"`, `from ${JSON.stringify(import.meta.resolve(name))}`)
 const {practiceSections} = await import('../src/lib/og-practice.ts')
 globalThis.__readerHarness = {
  practiceSections, practiceReaderStorageKey, readPracticeReaderDraft, splitPracticeCheck,
  Markdown: ({text}) => createElement('div', null, text),
  Tap: ({children, ...props}) => createElement('button', props, children),
 }
 try {
  const {PracticeReader} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const body = '## Объяснение\nТекст\n## Самостоятельная работа\nЗадание\n## Проверь себя\nВопрос\n## Ссылки\nРесурс'
  const html = renderToStaticMarkup(createElement(PracticeReader, {course:{key:'text',title:'Текст'}, lesson:{key:'one',title:'Урок',minutes:5,body}, index:0,total:1,onBack(){}}))
  assert.match(html, /aria-label="Разделы урока"/)
  for (const label of ['Читать: Объяснение', 'Практика', 'Проверить: Самопроверка']) assert.match(html, new RegExp(`aria-label="${label}"`))
  assert.match(html, /<details class="og-reader-more"/)
  assert.match(html, /Ещё разделы/)
  assert.match(html, /Инструменты и файлы/)
  assert.match(html, /Весь урок/)
  assert.match(html, /aria-controls=/)
  assert.match(html, /tabindex="-1" class="og-reader-content"/)
 } finally { delete globalThis.__readerHarness }
})
