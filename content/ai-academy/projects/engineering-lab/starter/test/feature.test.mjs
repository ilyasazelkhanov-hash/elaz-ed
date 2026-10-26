import test from 'node:test'
import assert from 'node:assert/strict'
import {subtotal,withFee} from '../src/price.mjs'
test('new fixed fee is added without changing subtotal',()=>{assert.equal(withFee([100,200],50),350);assert.equal(subtotal([100,200]),300)})
test('zero fee preserves old result',()=>assert.equal(withFee([100,200],0),300))
test('invalid fee is rejected',()=>assert.throws(()=>withFee([100],-1),TypeError))
test('overflow after fee is rejected',()=>assert.throws(()=>withFee([Number.MAX_SAFE_INTEGER],1),RangeError))
