import test from 'node:test'
import assert from 'node:assert/strict'
import { industries, resolveIndustryKey } from '../src/platform/industries.ts'

test('industry links select only own supported keys, never inherited object properties', () => {
  for (const id of Object.keys(industries)) assert.equal(resolveIndustryKey(id),id)
  for (const id of ['__proto__','constructor','prototype','toString','hasOwnProperty','valueOf','', 'unknown',null,undefined,{},1]) {
    assert.equal(resolveIndustryKey(id),'coffee')
    assert.equal(industries[resolveIndustryKey(id)].length,3)
  }
})
