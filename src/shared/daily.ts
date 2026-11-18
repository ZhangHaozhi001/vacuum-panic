/**
 * daily.ts — the "same puzzle for everyone, every day" core.
 *
 * The day key is the UTC calendar date (YYYY-MM-DD). UTC is deliberate:
 * the server owns the leaderboard, so one global day boundary keeps every
 * player on the same puzzle and the same board. The seed is an FNV-1a hash
 * of the day key, and makeRng is the same LCG the original Rocket Cat used
 * (constants unchanged), so a day key fully determines a run's spawn stream.
 */

export type DateKey = string

const DAY_MS = 86_400_000

/** Format a Date as its UTC day key, e.g. "2026-12-09". */
export function dateKeyFromDate(d: Date): DateKey {
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${d.getUTCDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** The current UTC day key. */
export function todayKey(now: Date = new Date()): DateKey {
  return dateKeyFromDate(now)
}

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = Date.parse(`${s}T00:00:00.000Z`)
  return !Number.isNaN(t) && dateKeyFromDate(new Date(t)) === s
}

/** Milliseconds since epoch of a day key's UTC midnight. */
export function dateKeyToMs(key: DateKey): number {
  return Date.parse(`${key}T00:00:00.000Z`)
}

/** Shift a day key by n days (n may be negative). */
export function addDaysKey(key: DateKey, n: number): DateKey {
  return dateKeyFromDate(new Date(dateKeyToMs(key) + n * DAY_MS))
}

/** Whole days from a to b (b - a); negative if b is before a. */
export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((dateKeyToMs(b) - dateKeyToMs(a)) / DAY_MS)
}

/** FNV-1a 32-bit hash of a string. Deterministic across platforms. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** The run seed for a day key. Never 0 (the LCG degenerates at 0). */
export function seedFromDateKey(key: DateKey): number {
  const seed = hashString(`vacuum-panic:${key}`)
  return seed === 0 ? 1 : seed
}

/**
 * The seeded RNG, ported 1:1 from Rocket Cat's random.js (LCG, Numerical
 * Recipes constants). Same seed -> same stream, everywhere, forever.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
