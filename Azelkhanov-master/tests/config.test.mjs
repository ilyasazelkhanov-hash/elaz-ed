import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveModules, validateConfig, presets, defaultBrand } from '../src/platform/config.ts'

test('learning includes content and progress dependencies', () => {
  assert.deepEqual(resolveModules(['learning']).sort(), ['content', 'learning', 'progress'])
})
test('an unknown module cannot become a client capability', () => {
  assert.throws(() => resolveModules(['injected']), /Unknown module/)
})
test('invalid navigation and missing brand values fail before deployment', () => {
  assert.throws(
    () =>
      validateConfig({ ...presets.club, navigation: ['home', 'home', 'home', 'home', 'home', 'home'] }, defaultBrand),
    /navigation/i,
  )
  assert.throws(
    () => validateConfig(presets.club, { ...defaultBrand, colors: { ...defaultBrand.colors, primary: 'garbage' } }),
    /color/i,
  )
})
