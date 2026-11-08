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

test('all presets and dependency closure remain valid', () => {
  for (const preset of Object.values(presets)) assert.doesNotThrow(() => validateConfig(preset, defaultBrand))
  const { config } = validateConfig({ ...presets.academy, modules: ['learning'], navigation: ['home', 'learning', 'profile'] }, defaultBrand)
  assert.deepEqual(config.modules.sort(), ['content', 'learning', 'progress'])
  assert.doesNotThrow(() => validateConfig({ ...presets.academy, modules: ['learning'], navigation: ['home', 'content', 'progress', 'profile'] }, defaultBrand))
})
test('malformed runtime config fails early with descriptive errors', () => {
  for (const [patch, message] of [
    [{ preset: 'toString' }, /preset/i],
    [{ preset: '__proto__' }, /preset/i],
    [{ homeBlocks: null }, /home blocks/i],
    [{ homeBlocks: 'hero' }, /home blocks/i],
    [{ homeBlocks: ['unknown'] }, /home blocks/i],
    [{ access: 'open' }, /access/i],
    [{ name: 42 }, /name/i],
    [{ name: ' ' }, /name/i],
    [{ currency: 'bogus' }, /currency/i],
    [{ currency: null }, /currency/i],
    [{ navigation: null }, /navigation/i],
    [{ modules: null }, /modules/i],
    [{ timezone: null }, /timezone/i],
    [{ locale: 42 }, /locale/i],
    [{ progression: { xpPerLevel: 300, stampsPerReward: 6, levels: null } }, /progression/i],
  ]) {
    assert.throws(() => validateConfig({ ...presets.club, ...patch }, defaultBrand), (error) => {
      assert.ok(!(error instanceof TypeError))
      assert.match(error.message, message)
      return true
    })
  }
  assert.throws(() => validateConfig(null, defaultBrand), /app config/i)
  assert.throws(() => validateConfig(presets.club, null), /brand/i)
  assert.throws(() => validateConfig(presets.club, { ...defaultBrand, colors: null }), /color/i)
  for (const fonts of [null, undefined, {}, { body: 42, display: 'Onest' }, { body: ' ', display: 'Onest' }]) {
    assert.throws(() => validateConfig(presets.club, { ...defaultBrand, fonts }), /fonts/i)
  }
  assert.throws(() => validateConfig(presets.club, { ...defaultBrand, motion: 'unknown' }), /motion/i)
})
