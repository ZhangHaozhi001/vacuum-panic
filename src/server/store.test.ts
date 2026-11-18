import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {ScoreEntry} from '../shared/leaderboard.ts'
import {MemoryStore, RedisStore, type RedisLike, type Store} from './store.ts'

const DAY = '2026-12-09'
const NEXT = '2026-12-10'

const entry = (userId: string, score: number, achievedAt: number): ScoreEntry => ({
  userId,
  username: `u/${userId}`,
  score,
  won: false,
  achievedAt,
})

/** Minimal in-memory stand-in with real sorted-set semantics. */
class FakeRedis implements RedisLike {
  private strings = new Map<string, string>()
  private zsets = new Map<string, Map<string, number>>()

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null
  }
  async set(key: string, value: string): Promise<unknown> {
    this.strings.set(key, value)
    return 'OK'
  }
  async zAdd(
    key: string,
    ...members: {score: number; member: string}[]
  ): Promise<number> {
    const z = this.zsets.get(key) ?? new Map<string, number>()
    let added = 0
    for (const m of members) {
      if (!z.has(m.member)) added++
      z.set(m.member, m.score)
    }
    this.zsets.set(key, z)
    return added
  }
  async zRange(
    key: string,
    start: number,
    stop: number,
  ): Promise<{member: string; score: number}[]> {
    const z = this.zsets.get(key)
    if (!z) return []
    const sorted = [...z.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([member, score]) => ({member, score}))
    return sorted.slice(start, stop + 1)
  }
  async zCard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0
  }
}

const stores: [string, () => Store][] = [
  ['MemoryStore', () => new MemoryStore()],
  ['RedisStore', () => new RedisStore(new FakeRedis())],
]

for (const [name, make] of stores) {
  test(`${name}: submit, rank and leaderboard agree`, async () => {
    const store = make()
    const r1 = await store.submitScore(DAY, entry('alice', 100, 1000))
    assert.equal(r1.rank, 1)
    assert.equal(r1.players, 1)

    const r2 = await store.submitScore(DAY, entry('bob', 250, 2000))
    assert.equal(r2.rank, 1)
    assert.equal(r2.players, 2)

    const board = await store.getLeaderboard(DAY, 10)
    assert.deepEqual(board.map(e => e.userId), ['bob', 'alice'])
    assert.equal(await store.getPlayerCount(DAY), 2)
    assert.equal((await store.getEntry(DAY, 'alice'))?.score, 100)
    assert.equal(await store.getEntry(DAY, 'carol'), null)
  })

  test(`${name}: only a player's best score is kept`, async () => {
    const store = make()
    await store.submitScore(DAY, entry('alice', 100, 1000))
    const better = await store.submitScore(DAY, entry('alice', 180, 2000))
    assert.equal(better.entry.score, 180)
    const worse = await store.submitScore(DAY, entry('alice', 50, 3000))
    assert.equal(worse.entry.score, 180)
    assert.equal(worse.entry.achievedAt, 2000)
    assert.equal(worse.players, 1)
  })

  test(`${name}: boards are per-day and streaks follow the shared rules`, async () => {
    const store = make()
    await store.submitScore(DAY, entry('alice', 100, 1000))
    assert.equal(await store.getPlayerCount(NEXT), 0)
    assert.deepEqual(await store.getLeaderboard(NEXT, 10), [])

    let s = await store.recordPlay('alice', DAY)
    assert.equal(s.current, 1)
    s = await store.recordPlay('alice', DAY) // same day again: no double count
    assert.equal(s.current, 1)
    assert.equal(s.totalDays, 1)
    s = await store.recordPlay('alice', NEXT)
    assert.equal(s.current, 2)
    assert.deepEqual(await store.getStreak('alice'), s)
    assert.equal((await store.getStreak('bob')).current, 0)
  })
}
