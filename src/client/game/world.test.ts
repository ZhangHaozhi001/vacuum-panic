import assert from 'node:assert/strict'
import {test} from 'node:test'
import {seedFromDateKey} from '../../shared/daily.ts'
import {newWorld, spawnItem, startRun, update, type World} from './world.ts'

const DAY_A = '2026-12-09'
const DAY_B = '2026-12-10'

function spawnSequence(dayKey: string, n: number): string[] {
  const w = newWorld(dayKey, seedFromDateKey(dayKey))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    spawnItem(w)
    const it = w.items[w.items.length - 1]
    out.push(`${it?.kind}@${Math.round(it?.x ?? -1)}:${Math.round((it?.vy ?? 0) * 10)}`)
    w.items.length = 0
    w.time += 1 // fall speed ramps with time; keep the stream realistic
  }
  return out
}

test('spawn stream: same day, same puzzle', () => {
  assert.deepEqual(spawnSequence(DAY_A, 60), spawnSequence(DAY_A, 60))
})

test('spawn stream: different day, different puzzle', () => {
  assert.notDeepEqual(spawnSequence(DAY_A, 60), spawnSequence(DAY_B, 60))
})

function playRun(dayKey: string): World {
  const w = newWorld(dayKey, seedFromDateKey(dayKey))
  startRun(w)
  // Identical, passive steering for every run: the cat sits mid-field.
  for (let i = 0; i < 1400 && w.state === 'play'; i++) {
    update(w, 0.05, {axis: 0, pointerX: null})
  }
  return w
}

test('full run: two plays of one day are identical, down to the score', () => {
  const a = playRun(DAY_A)
  const b = playRun(DAY_A)
  assert.equal(a.state, b.state)
  assert.equal(a.score, b.score)
  assert.equal(a.lives, b.lives)
})

test('full run: a passive cat still resolves within the run window', () => {
  const w = playRun(DAY_A)
  assert.ok(w.state === 'clear' || w.state === 'caught')
  if (w.state === 'clear') assert.ok(w.time >= 60 - 0.05)
})

test('retrying replays the same puzzle (startRun reseeds from the day)', () => {
  const w = playRun(DAY_A)
  const firstScore = w.score
  startRun(w)
  for (let i = 0; i < 1400 && w.state === 'play'; i++) {
    update(w, 0.05, {axis: 0, pointerX: null})
  }
  assert.equal(w.score, firstScore)
})
