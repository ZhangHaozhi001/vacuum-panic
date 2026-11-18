/**
 * store.ts — persistence behind an interface, in three layers:
 *
 *   Store          — what the HTTP routes use (leaderboards + streaks).
 *   MemoryStore    — in-process implementation; local dev and unit tests.
 *   RedisStore     — production implementation over a minimal RedisLike
 *                    client. index.ts injects the real `redis` object from
 *                    @devvit/web/server; tests inject a fake with the same
 *                    shape. This is the one and only Redis hookup point.
 *
 * All ranking/streak rules live in ../shared as pure functions, so both
 * implementations behave identically by construction.
 */

import {
  isBetterEntry,
  rankOf,
  sortLeaderboard,
  topEntries,
  type ScoreEntry,
} from '../shared/leaderboard.ts'
import {applyPlay, emptyStreak, type StreakState} from '../shared/streak.ts'
import type {DateKey} from '../shared/daily.ts'

export type SubmitResult = {
  /** The player's best entry for the day after this submission. */
  entry: ScoreEntry
  rank: number
  players: number
}

export interface Store {
  submitScore(dayKey: DateKey, entry: ScoreEntry): Promise<SubmitResult>
  getLeaderboard(dayKey: DateKey, limit: number): Promise<ScoreEntry[]>
  getEntry(dayKey: DateKey, userId: string): Promise<ScoreEntry | null>
  getPlayerCount(dayKey: DateKey): Promise<number>
  /** Record a play day for the streak and return the new state. */
  recordPlay(userId: string, dayKey: DateKey): Promise<StreakState>
  getStreak(userId: string): Promise<StreakState>
}

/* ------------------------------------------------------------------ */
/* In-memory implementation                                            */
/* ------------------------------------------------------------------ */

export class MemoryStore implements Store {
  private boards = new Map<DateKey, ScoreEntry[]>()
  private streaks = new Map<string, StreakState>()

  async submitScore(dayKey: DateKey, entry: ScoreEntry): Promise<SubmitResult> {
    const board = this.boards.get(dayKey) ?? []
    const prev = board.find(e => e.userId === entry.userId)
    const kept = prev && !isBetterEntry(entry, prev) ? prev : entry
    const next = prev
      ? board.map(e => (e.userId === entry.userId ? kept : e))
      : [...board, entry]
    this.boards.set(dayKey, next)
    return {
      entry: kept,
      rank: rankOf(next, entry.userId) ?? next.length,
      players: next.length,
    }
  }

  async getLeaderboard(dayKey: DateKey, limit: number): Promise<ScoreEntry[]> {
    return topEntries(this.boards.get(dayKey) ?? [], limit)
  }

  async getEntry(dayKey: DateKey, userId: string): Promise<ScoreEntry | null> {
    return this.boards.get(dayKey)?.find(e => e.userId === userId) ?? null
  }

  async getPlayerCount(dayKey: DateKey): Promise<number> {
    return this.boards.get(dayKey)?.length ?? 0
  }

  async recordPlay(userId: string, dayKey: DateKey): Promise<StreakState> {
    const next = applyPlay(this.streaks.get(userId) ?? emptyStreak, dayKey)
    this.streaks.set(userId, next)
    return next
  }

  async getStreak(userId: string): Promise<StreakState> {
    return this.streaks.get(userId) ?? emptyStreak
  }
}

/* ------------------------------------------------------------------ */
/* Redis implementation                                                */
/* ------------------------------------------------------------------ */

/**
 * The slice of the Devvit Redis client this app uses. The real client from
 * @devvit/web/server satisfies this shape (get/set/zAdd/zRange/zCard are
 * its standard surface); index.ts performs the cast at the hookup point.
 */
export interface RedisLike {
  get(key: string): Promise<string | null | undefined>
  set(key: string, value: string): Promise<unknown>
  zAdd(key: string, ...members: {score: number; member: string}[]): Promise<number>
  /** Matches the real client: zRange returns {member, score} pairs, score-ascending. */
  zRange(
    key: string,
    start: number,
    stop: number,
  ): Promise<{member: string; score: number}[]>
  zCard(key: string): Promise<number>
}

const BOARD_SCAN_CAP = 1000 // a daily board never needs more than this scanned

const boardKey = (dayKey: DateKey): string => `vp:lb:${dayKey}`
const entryKey = (dayKey: DateKey, userId: string): string => `vp:lb:${dayKey}:entry:${userId}`
const streakKey = (userId: string): string => `vp:streak:${userId}`

export class RedisStore implements Store {
  private readonly redis: RedisLike

  constructor(redis: RedisLike) {
    this.redis = redis
  }

  async submitScore(dayKey: DateKey, entry: ScoreEntry): Promise<SubmitResult> {
    const prev = await this.getEntry(dayKey, entry.userId)
    const kept = prev && !isBetterEntry(entry, prev) ? prev : entry
    if (kept === entry) {
      await this.redis.zAdd(boardKey(dayKey), {score: entry.score, member: entry.userId})
      await this.redis.set(entryKey(dayKey, entry.userId), JSON.stringify(entry))
    }
    const board = await this.scanBoard(dayKey)
    return {
      entry: kept,
      rank: rankOf(board, entry.userId) ?? board.length,
      players: board.length,
    }
  }

  async getLeaderboard(dayKey: DateKey, limit: number): Promise<ScoreEntry[]> {
    return topEntries(await this.scanBoard(dayKey), limit)
  }

  async getEntry(dayKey: DateKey, userId: string): Promise<ScoreEntry | null> {
    const raw = await this.redis.get(entryKey(dayKey, userId))
    return raw ? (JSON.parse(raw) as ScoreEntry) : null
  }

  async getPlayerCount(dayKey: DateKey): Promise<number> {
    return this.redis.zCard(boardKey(dayKey))
  }

  async recordPlay(userId: string, dayKey: DateKey): Promise<StreakState> {
    // Read-modify-write; applyPlay is idempotent within a day, so a raced
    // double-submit cannot inflate the streak.
    const next = applyPlay(await this.getStreak(userId), dayKey)
    await this.redis.set(streakKey(userId), JSON.stringify(next))
    return next
  }

  async getStreak(userId: string): Promise<StreakState> {
    const raw = await this.redis.get(streakKey(userId))
    return raw ? (JSON.parse(raw) as StreakState) : emptyStreak
  }

  /**
   * Load a whole day's board (capped) and sort it with the shared rules.
   * Deliberately avoids depending on sorted-set range ordering options so
   * the client surface stays minimal; at daily-game scale this is cheap.
   */
  private async scanBoard(dayKey: DateKey): Promise<ScoreEntry[]> {
    const pairs = await this.redis.zRange(boardKey(dayKey), 0, BOARD_SCAN_CAP - 1)
    const entries: ScoreEntry[] = []
    for (const {member} of pairs) {
      const e = await this.getEntry(dayKey, member)
      if (e) entries.push(e)
    }
    return sortLeaderboard(entries)
  }
}
