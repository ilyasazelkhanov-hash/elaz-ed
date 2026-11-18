import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { couponDisplayStatus, availableCoupons, stampProgress } from '../src/platform-kit/src/platform/wallet-display.ts'
import { validateConfig, presets, defaultBrand } from '../src/platform-kit/src/platform/config.ts'
const now = Date.parse('2026-11-18T10:00:00Z')
const coupon = (patch = {}) => ({ id: 'one', userId: 'me', status: 'issued', expiresAt: '2026-11-18T11:00:00Z', ...patch })
test('coupon states distinguish redemption from expiry and reject unknown availability', () => {
  assert.equal(couponDisplayStatus(coupon(), now), 'issued')
  for (const status of ['redeemed', 'expired']) {
    assert.equal(couponDisplayStatus(coupon({ status }), now), status)
    assert.equal(couponDisplayStatus(coupon({ status, expiresAt: 'bad' }), now), status)
  }
  for (const delta of [-1, 0, 1]) assert.equal(couponDisplayStatus(coupon({ expiresAt: new Date(now + delta).toISOString() }), now), delta > 0 ? 'issued' : 'expired')
  assert.equal(couponDisplayStatus(coupon({ expiresAt: 'bad' }), now), 'unavailable')
  assert.equal(couponDisplayStatus(coupon({ status: 'unexpected' }), now), 'unavailable')
})
test('profile counts only own usable coupons without changing server snapshot', () => {
  const coupons = [coupon(), coupon({ userId: 'other' }), coupon({ status: 'redeemed' }), coupon({ status: 'expired' }), coupon({ expiresAt: '2020-01-01' }), coupon({ expiresAt: '' })]
  const before = structuredClone(coupons)
  assert.deepEqual(availableCoupons(coupons, 'me', now), [coupons[0]])
  assert.deepEqual(coupons, before)
  assert.deepEqual(availableCoupons(coupons, 'nobody', now), [])
})
test('client stamp cycles keep just-completed cycles visibly full', () => {
  for (const target of [1, 5, 6, 10, 25, 1000]) {
    const config = { progression: { stampsPerReward: target } }
    assert.deepEqual(stampProgress(0, config), { target, total: 0, completed: 0, filled: 0 })
    for (const completed of [1, 2]) assert.deepEqual(stampProgress(target * completed, config), { target, total: target * completed, completed, filled: target })
    if (target > 1) assert.deepEqual(stampProgress(target + 1, config), { target, total: target + 1, completed: 1, filled: 1 })
  }
})
test('legacy and malformed runtime values have safe bounded fallback', () => {
  assert.equal(stampProgress(4, {}).target, 6)
  for (const stampsPerReward of [0, -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5', null]) assert.equal(stampProgress(4, { progression: { stampsPerReward } }).target, 6)
  for (const total of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '3']) assert.deepEqual(stampProgress(total, {}), { target: 6, total: 0, completed: 0, filled: 0 })
})
test('config validates positive safe cycles without excluding large legitimate targets', () => {
  const config = stampsPerReward => ({ ...presets.club, progression: { xpPerLevel: 250, levels: ['Участник'], stampsPerReward } })
  for (const target of [1, 5, 1000]) assert.doesNotThrow(() => validateConfig(config(target), defaultBrand))
  for (const target of [0, -1, 2.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateConfig(config(target), defaultBrand), /progression/i)
})
test('screens use bounded visuals, inactive history and shared availability logic', () => {
  const wallet = readFileSync(new URL('../src/platform-kit/src/screens/Modules.tsx', import.meta.url), 'utf8')
  const profile = readFileSync(new URL('../src/platform-kit/src/screens/Profile.tsx', import.meta.url), 'utf8')
  assert.match(wallet, /stamps\.target <= 24/)
  assert.match(wallet, /<Meter value={stamps\.filled} max={stamps\.target}/)
  assert.match(wallet, /СРОК ИСТЁК/)
  assert.match(wallet, /История \({history\.length}\)/)
  assert.match(wallet, /return active \? \(/)
  assert.match(wallet, /<article className="az-coupon is-used"/)
  assert.match(wallet, /useCouponClock\(s\.coupons\)/)
  assert.match(profile, /availableCoupons\(s\.coupons, s\.me\.id, now\)/)
})
