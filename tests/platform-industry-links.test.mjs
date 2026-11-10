import test from 'node:test'
import assert from 'node:assert/strict'
import { industries, resolveIndustryKey } from '../src/platform-kit/src/platform/industries.ts'

test('embedded industry rejects inherited and malformed query keys', () => {
  for (const id of Object.keys(industries)) assert.equal(resolveIndustryKey(id),id)
  for (const query of ['industry=__proto__','industry=constructor','industry=toString','industry=hasOwnProperty','industry=','industry=missing']) {
    const key=resolveIndustryKey(new URLSearchParams(query).get('industry'))
    assert.equal(key,'coffee');assert.equal(industries[key].length,3)
  }
})
