import test from 'node:test'
import assert from 'node:assert/strict'
import {estimateCost} from './cost.mjs'
test('per-million units and fixed costs are kept separate',()=>{const result=estimateCost({inputTokens:1_000_000,outputTokens:1_000_000,inputPerMillion:2,outputPerMillion:4,fixedCost:1});assert.equal(result.total,7);assert.equal(result.inputCost,2);assert.equal(result.outputCost,4)})
test('zero traffic keeps only fixed cost and invalid counters fail',()=>{assert.equal(estimateCost({inputTokens:0,outputTokens:0,inputPerMillion:2,outputPerMillion:4,fixedCost:1}).total,1);for(const inputTokens of [-1,1.5,NaN,'100'])assert.throws(()=>estimateCost({inputTokens,outputTokens:0,inputPerMillion:2,outputPerMillion:4}),TypeError)})
