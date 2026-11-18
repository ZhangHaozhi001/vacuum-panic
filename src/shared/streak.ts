/**
 * streak.ts — daily-play streaks, as pure functions so the exact same rules
 * run in the server store and in unit tests.
 *
 * Rules: playing today when you already played today changes nothing;
 * playing the day after your last play extends the streak by one; any
 * longer gap restarts the streak at one.
 */

import {daysBetween, type DateKey} from './daily.ts'

export type StreakState = {
  /** Consecutive days played, counting the most recent play day. */
  current: number
  /** Longest streak ever. */
  best: number
  /** Day key of the most recent play, or null if never played. */
  lastPlayKey: DateKey | null
  /** Distinct days played, all time. */
  totalDays: number
}

export const emptyStreak: StreakState = {
  current: 0,
  best: 0,
  lastPlayKey: null,
  totalDays: 0,
}

/** Record a play on `todayKey` and return the new streak state. */
export function applyPlay(state: StreakState, today: DateKey): StreakState {
  if (state.lastPlayKey === today) return state
  const gap = state.lastPlayKey === null ? null : daysBetween(state.lastPlayKey, today)
  const current = gap === 1 ? state.current + 1 : 1
  return {
    current,
    best: Math.max(state.best, current),
    lastPlayKey: today,
    totalDays: state.totalDays + 1,
  }
}

/**
 * The streak as it stands *today*: a streak whose last play was before
 * yesterday has already lapsed, even before the next play is recorded.
 */
export function currentStreak(state: StreakState, today: DateKey): number {
  if (state.lastPlayKey === null) return 0
  const gap = daysBetween(state.lastPlayKey, today)
  return gap <= 1 ? state.current : 0
}
