import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, encodeCsv, CSV_LIMITS } from '../src/platform/csv.ts'

test('reads BOM, quoted commas/newlines, doubled quotes, Cyrillic and CRLF', () => {
  const input = '\uFEFFid,title,body,data\r\n1,"Привет, мир","Первая строка\nВторая ""цитата""","{""theme"":""Клуб""}"\r\n'
  const rows = parseCsv(input)
  assert.deepEqual(rows, [{ id: '1', title: 'Привет, мир', body: 'Первая строка\nВторая "цитата"', data: '{"theme":"Клуб"}' }])
  assert.deepEqual(JSON.parse(rows[0].data), { theme: 'Клуб' })
  assert.deepEqual(parseCsv('id,name\r1,Аня\r2,Борис'), [{ id: '1', name: 'Аня' }, { id: '2', name: 'Борис' }])
  assert.deepEqual(parseCsv(''), [])
  assert.deepEqual(parseCsv('\uFEFF\r\n'), [])
  assert.deepEqual(parseCsv('id\n""\n'), [{ id: '' }])
})

test('entity/member export round-trips transport strings and explicit JSON data', () => {
  const csv = encodeCsv([{ id: 'lesson-1', kind: 'lesson', title: 'Урок, первый', body: 'a\r\nb', data: { courseId: 'course-1', tags: ['a', 'b'] }, published: false }, { id: 'lesson-2', title: 'Урок "второй"', capacity: 15 }])
  assert.ok(csv.startsWith('\uFEFF'))
  const parsed = parseCsv(csv)
  assert.equal(parsed[0].title, 'Урок, первый')
  assert.equal(parsed[0].body, 'a\r\nb')
  assert.equal(parsed[0].published, 'false')
  assert.deepEqual(JSON.parse(parsed[0].data), { courseId: 'course-1', tags: ['a', 'b'] })
  assert.equal(parsed[1].capacity, '15')
  assert.equal(parsed[1].kind, '')
  assert.equal(encodeCsv([]), '')
  assert.deepEqual(parseCsv(encodeCsv([{ id: 'telegram-123', name: 'Анна', role: 'member', approved: true }])), [{ id: 'telegram-123', name: 'Анна', role: 'member', approved: 'true' }])
})

test('export neutralizes spreadsheet formulas including leading whitespace and header cells', () => {
  for (const value of ['=HYPERLINK("https://example.invalid")', '+CMD', '-1+2', '@SUM(A1)', '  =1+1', '\ttext', '\rtext', '\ntext']) {
    assert.equal(parseCsv(encodeCsv([{ value }]))[0].value, "'" + value)
  }
  assert.equal(parseCsv(encodeCsv([{ '=header': 'safe' }]))[0]["'=header"], 'safe')
  assert.equal(parseCsv(encodeCsv([{ value: 'normal text' }]))[0].value, 'normal text')
})

test('invalid quotes, headers, row shape and null bytes fail before import', () => {
  for (const csv of ['id,id\n1,2', 'id, id\n1,2', ',name\n1,a', '__proto__,name\n1,a', 'constructor\na', 'id,name\n1', 'id\n1,2', 'id\n"unterminated', 'id\n"closed"junk', 'id\nnot"quoted', 'id\na\0b']) assert.throws(() => parseCsv(csv), /CSV:/, csv)
  assert.throws(() => encodeCsv([JSON.parse('{"__proto__":"unsafe"}')]), /CSV:/)
  assert.throws(() => encodeCsv([{}]), /column/)
  const circular = {}; circular.self = circular
  assert.throws(() => encodeCsv([{ data: circular }]), /serializable/)
})

test('limits bound input bytes, cells, rows and columns', () => {
  assert.throws(() => parseCsv('id\n' + 'x'.repeat(CSV_LIMITS.bytes)), /byte limit/)
  assert.throws(() => parseCsv('id\n' + 'я'.repeat(CSV_LIMITS.bytes / 2)), /byte limit/)
  assert.throws(() => parseCsv('id\n' + 'x'.repeat(CSV_LIMITS.cellCharacters + 1)), /cell/)
  assert.throws(() => parseCsv('id\n' + 'a\n'.repeat(CSV_LIMITS.rows + 1)), /rows/)
  assert.throws(() => parseCsv(Array.from({ length: CSV_LIMITS.columns + 1 }, (_, i) => 'c' + i).join(',')), /columns/)
  assert.throws(() => encodeCsv(Array.from({ length: CSV_LIMITS.rows + 1 }, () => ({ id: 'a' }))), /rows/)
  assert.throws(() => encodeCsv([{ text: 'x'.repeat(CSV_LIMITS.cellCharacters + 1) }]), /cell/)
})
