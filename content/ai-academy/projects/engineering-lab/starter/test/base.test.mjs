import test from 'node:test'
import assert from 'node:assert/strict'
import {subtotal} from '../src/price.mjs'
test('subtotal preserves integer prices',()=>assert.equal(subtotal([100,200]),300))
test('empty basket is zero',()=>assert.equal(subtotal([]),0))
test('invalid price is rejected',()=>assert.throws(()=>subtotal([-1]),TypeError))
