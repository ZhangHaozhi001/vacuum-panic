/**
 * leaderboard.ts — one entry per player per day; ranking rules as pure
 * functions shared by the in-memory store, the Redis store and the tests.
 *
 * Ranking: higher score first; ties go to whoever reached the score
 * earlier (achievedAt ascending); userId is the final deterministic
 * tiebreak so every reader sorts identically.
 */

export type ScoreEntry = {
  userId: string
  username: string
  score: number
  /** True when the run survived the full 60 seconds. */
  won: boolean
  /** Epoch ms when this score was achieved. */
  achievedAt: number
}

export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.achievedAt !== b.achievedAt) return a.achievedAt - b.achievedAt
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
}

export function sortLeaderboard(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort(compareEntries)
}

/**
 * Is `next` a better entry than `prev` for the same player? A higher score
 * always wins; an equal score only replaces when achieved earlier (a
 * replayed run that merely matches the best must not move the timestamp).
 */
export function isBetterEntry(next: ScoreEntry, prev: ScoreEntry): boolean {
  if (next.score !== prev.score) return next.score > prev.score
  return next.achievedAt < prev.achievedAt
}

/** Insert or replace a player's entry, keeping their best. Returns a new array. */
export function upsertEntry(
  entries: readonly ScoreEntry[],
  entry: ScoreEntry,
): ScoreEntry[] {
  const idx = entries.findIndex(e => e.userId === entry.userId)
  if (idx === -1) return [...entries, entry]
  const prev = entries[idx]
  if (!prev || !isBetterEntry(entry, prev)) return [...entries]
  const copy = [...entries]
  copy[idx] = entry
  return copy
}

/** 1-based rank of a player in an entry list, or null if absent. */
export function rankOf(entries: readonly ScoreEntry[], userId: string): number | null {
  const sorted = sortLeaderboard(entries)
  const idx = sorted.findIndex(e => e.userId === userId)
  return idx === -1 ? null : idx + 1
}

export function topEntries(entries: readonly ScoreEntry[], n: number): ScoreEntry[] {
  return sortLeaderboard(entries).slice(0, n)
}
