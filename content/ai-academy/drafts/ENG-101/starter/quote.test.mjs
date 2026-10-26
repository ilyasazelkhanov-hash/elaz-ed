import test from 'node:test'
import assert from 'node:assert/strict'
import { quote } from './quote.mjs'

test('скидка применяется только к работе', () => assert.equal(quote(8000, 4000), 11200))
test('ниже порога скидки нет', () => assert.equal(quote(6000, 3999), 9999))
test('ровно на пороге скидка действует', () => assert.equal(quote(6000, 4000), 9400))
test('нулевая стоимость допустима', () => assert.equal(quote(0, 0), 0))
test('детали не получают скидку', () => assert.equal(quote(0, 12000), 12000))
test('дробные результаты округляются', () => assert.equal(quote(6001, 4000), 9401))
test('недопустимый ввод отклоняется', () => {
  for (const value of [-1, 1.5, '8000', NaN, Infinity, null, undefined]) {
    assert.throws(() => quote(value, 0), TypeError)
    assert.throws(() => quote(0, value), TypeError)
  }
})
test('переполнение общей суммы отклоняется', () => assert.throws(() => quote(Number.MAX_SAFE_INTEGER, 1), RangeError))
