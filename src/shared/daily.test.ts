import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  addDaysKey,
  dateKeyFromDate,
  daysBetween,
  isDateKey,
  makeRng,
  seedFromDateKey,
  todayKey,
} from './daily.ts'

test('dateKeyFromDate uses the UTC calendar date', () => {
  assert.equal(dateKeyFromDate(new Date('2026-12-09T23:59:59Z')), '2026-12-09')
  assert.equal(dateKeyFromDate(new Date('2026-12-09T00:00:00Z')), '2026-12-09')
  assert.equal(dateKeyFromDate(new Date('2027-01-01T00:00:01Z')), '2027-01-01')
})

test('isDateKey validates real calendar dates', () => {
  assert.equal(isDateKey('2026-12-09'), true)
  assert.equal(isDateKey('2026-02-30'), false)
  assert.equal(isDateKey('2026-13-01'), false)
  assert.equal(isDateKey('09-12-2026'), false)
  assert.equal(isDateKey(''), false)
})

test('addDaysKey and daysBetween round-trip across month/year edges', () => {
  assert.equal(addDaysKey('2026-12-09', 1), '2026-12-10')
  assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysKey('2027-01-01', -1), '2026-12-31')
  assert.equal(addDaysKey('2028-02-28', 1), '2028-02-29')
  assert.equal(daysBetween('2026-12-09', '2026-12-10'), 1)
  assert.equal(daysBetween('2026-12-10', '2026-12-09'), -1)
  assert.equal(daysBetween('2026-12-09', '2026-12-09'), 0)
})

test('same day key -> same seed -> identical rng stream (same puzzle)', () => {
  const key = '2026-12-09'
  const a = makeRng(seedFromDateKey(key))
  const b = makeRng(seedFromDateKey(key))
  const seqA = Array.from({length: 64}, () => a())
  const seqB = Array.from({length: 64}, () => b())
  assert.deepEqual(seqA, seqB)
})

test('different day keys -> different seeds and streams (new puzzle)', () => {
  const s1 = seedFromDateKey('2026-12-09')
  const s2 = seedFromDateKey('2026-12-10')
  assert.notEqual(s1, s2)
  const a = makeRng(s1)
  const b = makeRng(s2)
  const seqA = Array.from({length: 16}, () => a())
  const seqB = Array.from({length: 16}, () => b())
  assert.notDeepEqual(seqA, seqB)
})

test('seed is stable across calls and never zero', () => {
  for (const key of ['2026-01-01', '2026-12-09', '2027-06-30', todayKey()]) {
    assert.equal(seedFromDateKey(key), seedFromDateKey(key))
    assert.notEqual(seedFromDateKey(key), 0)
  }
})

test('rng values stay in [0, 1)', () => {
  const rng = makeRng(seedFromDateKey('2026-12-09'))
  for (let i = 0; i < 1000; i++) {
    const v = rng()
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`)
  }
})

test('simulated spawn stream: two runs on one day spawn identically', () => {
  // Mirrors world.ts: the spawn stream is a dedicated rng seeded by the day,
  // so identical days reproduce identical spawn decisions end to end.
  const spawnDecisions = (key: string): string[] => {
    const rng = makeRng(seedFromDateKey(key))
    const out: string[] = []
    for (let i = 0; i < 40; i++) {
      const roll = rng()
      const kind = roll > 0.9 ? 'bigvac' : roll > 0.74 ? 'vac' : roll > 0.62 ? 'yarn' : 'fish'
      const x = Math.round(30 + rng() * 900)
      out.push(`${kind}@${x}`)
    }
    return out
  }
  assert.deepEqual(spawnDecisions('2026-12-09'), spawnDecisions('2026-12-09'))
  assert.notDeepEqual(spawnDecisions('2026-12-09'), spawnDecisions('2026-12-25'))
})
