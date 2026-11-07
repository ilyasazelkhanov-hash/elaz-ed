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
