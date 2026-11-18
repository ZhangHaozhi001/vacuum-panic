import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  rankOf,
  sortLeaderboard,
  topEntries,
  upsertEntry,
  type ScoreEntry,
} from './leaderboard.ts'

const entry = (
  userId: string,
  score: number,
  achievedAt: number,
  won = false,
): ScoreEntry => ({userId, username: `u/${userId}`, score, won, achievedAt})

test('sorts by score descending', () => {
  const board = sortLeaderboard([entry('a', 100, 1), entry('b', 300, 2), entry('c', 200, 3)])
  assert.deepEqual(board.map(e => e.userId), ['b', 'c', 'a'])
})

test('ties go to the earlier achievement, then userId for determinism', () => {
  const board = sortLeaderboard([
    entry('late', 200, 5000),
    entry('early', 200, 1000),
    entry('alsoearly', 200, 1000),
  ])
  assert.deepEqual(board.map(e => e.userId), ['alsoearly', 'early', 'late'])
})

test('upsert keeps only the best entry per player', () => {
  let board = upsertEntry([], entry('a', 100, 1000))
  board = upsertEntry(board, entry('a', 150, 2000))
  assert.equal(board.length, 1)
  assert.equal(board[0]?.score, 150)
  // a worse replay does not displace the best
  board = upsertEntry(board, entry('a', 120, 3000))
  assert.equal(board[0]?.score, 150)
  assert.equal(board[0]?.achievedAt, 2000)
  // an equal score achieved later does not move the timestamp either
  board = upsertEntry(board, entry('a', 150, 4000))
  assert.equal(board[0]?.achievedAt, 2000)
  // a second player joins normally
  board = upsertEntry(board, entry('b', 90, 5000))
  assert.equal(board.length, 2)
})

test('rankOf is 1-based and null for strangers', () => {
  const board = [entry('a', 100, 1), entry('b', 300, 2), entry('c', 200, 3)]
  assert.equal(rankOf(board, 'b'), 1)
  assert.equal(rankOf(board, 'c'), 2)
  assert.equal(rankOf(board, 'a'), 3)
  assert.equal(rankOf(board, 'nobody'), null)
})

test('topEntries caps the list after sorting', () => {
  const board = [entry('a', 100, 1), entry('b', 300, 2), entry('c', 200, 3)]
  assert.deepEqual(topEntries(board, 2).map(e => e.userId), ['b', 'c'])
  assert.deepEqual(topEntries(board, 0), [])
})
