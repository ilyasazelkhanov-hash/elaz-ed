import test from 'node:test'
import assert from 'node:assert/strict'
import { quoteWithFee } from './fee.mjs'
import { quote } from '../../drafts/ENG-101/starter/quote.mjs'
test('сбор не поднимает сумму до порога скидки',()=>assert.equal(quoteWithFee(6000,3999,100),10099))
test('сбор добавляется после скидки',()=>assert.equal(quoteWithFee(8000,4000,100),11300))
test('нулевой сбор сохраняет исходное поведение',()=>assert.equal(quoteWithFee(8000,4000,0),quote(8000,4000)))
test('неверный сбор отклоняется',()=>{for(const fee of [-1,1.5,'100',null,NaN,Infinity])assert.throws(()=>quoteWithFee(0,0,fee),TypeError)})
test('переполнение после сбора отклоняется',()=>assert.throws(()=>quoteWithFee(0,Number.MAX_SAFE_INTEGER,1),RangeError))
