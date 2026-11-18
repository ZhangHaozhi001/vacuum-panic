import assert from 'node:assert/strict'
import {test} from 'node:test'
import {applyPlay, currentStreak, emptyStreak} from './streak.ts'

test('first ever play starts a streak of 1', () => {
  const s = applyPlay(emptyStreak, '2026-12-09')
  assert.deepEqual(s, {current: 1, best: 1, lastPlayKey: '2026-12-09', totalDays: 1})
})

test('playing twice on the same day changes nothing', () => {
  const once = applyPlay(emptyStreak, '2026-12-09')
  const twice = applyPlay(once, '2026-12-09')
  assert.deepEqual(twice, once)
})

test('consecutive days extend the streak and track the best', () => {
  let s = applyPlay(emptyStreak, '2026-12-09')
  s = applyPlay(s, '2026-12-10')
  s = applyPlay(s, '2026-12-11')
  assert.equal(s.current, 3)
  assert.equal(s.best, 3)
  assert.equal(s.totalDays, 3)
})

test('a skipped day restarts the streak but keeps best and totals', () => {
  let s = applyPlay(emptyStreak, '2026-12-09')
  s = applyPlay(s, '2026-12-10')
  s = applyPlay(s, '2026-12-12')
  assert.equal(s.current, 1)
  assert.equal(s.best, 2)
  assert.equal(s.totalDays, 3)
  assert.equal(s.lastPlayKey, '2026-12-12')
})

test('streak survives month and year boundaries', () => {
  let s = applyPlay(emptyStreak, '2026-12-31')
  s = applyPlay(s, '2027-01-01')
  assert.equal(s.current, 2)
})

test('currentStreak reports a lapsed streak as 0 before the next play', () => {
  const s = applyPlay(emptyStreak, '2026-12-09')
  assert.equal(currentStreak(s, '2026-12-09'), 1)
  assert.equal(currentStreak(s, '2026-12-10'), 1) // still alive: play today to extend
  assert.equal(currentStreak(s, '2026-12-11'), 0) // lapsed
  assert.equal(currentStreak(emptyStreak, '2026-12-09'), 0)
})
