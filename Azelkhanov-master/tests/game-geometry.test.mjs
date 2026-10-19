import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wheelStop, wheelSector, scratchCoverage } from '../src/platform/game-geometry.ts'
test('each wheel outcome stops at its sector centre under the top pointer', () => {
  for (let n = 0; n < 100; n++) {
    const { index, rotation } = wheelStop(`+${n} баллов`)
    assert.equal((index * 45 + rotation) % 360, 0)
    assert.ok(rotation >= 1800 && rotation < 2160)
    assert.deepEqual(wheelStop(`+${n} баллов`), { index, rotation })
  }
})
test('all wheel label centres stay inside their responsive SVG sectors', () => {
  for (let index = 0; index < 8; index++) {
    const { x, y, path } = wheelSector(index)
    assert.ok(Math.abs(Math.hypot(x - 160, y - 160) - 145 * 0.66) < 0.001)
    assert.ok(path.startsWith('M 160 160 L '))
  }
})
test('repeated scratch strokes over one spot do not inflate coverage', () => {
  const cells = new Set()
  const first = scratchCoverage(cells, 0.5, 0.5)
  for (let n = 0; n < 500; n++) assert.equal(scratchCoverage(cells, 0.5, 0.5), first)
  assert.ok(first > 0 && first < 0.05)
})
test('scratching across a ticket counts distinct surface area', () => {
  const cells = new Set()
  for (let y = 0; y <= 1; y += 0.05) for (let x = 0; x <= 1; x += 0.05) scratchCoverage(cells, x, y)
  assert.ok(cells.size / (24 * 24) > 0.95)
  assert.ok(cells.size <= 24 * 24)
})
