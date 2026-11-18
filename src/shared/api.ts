/**
 * api.ts — the wire contract between the webview client and the Hono server.
 * Client calls are relative paths under /api (Devvit routes them to the
 * app server); /internal paths are Devvit menu/trigger endpoints.
 */

import type {ScoreEntry} from './leaderboard.ts'
import type {StreakState} from './streak.ts'

/** Generic error detail for all responses. */
export type ErrorRsp = {error: string; status: number}

/** A player's standing on one day's board. */
export type PlayerStanding = {
  entry: ScoreEntry
  /** 1-based rank on the day's board. */
  rank: number
}

/** GET api/daily — everything the client needs to start today's run. */
export type DailyRsp = {
  /** UTC day key, e.g. "2026-12-09". The single source of truth for "today". */
  dateKey: string
  /** Seed for today's puzzle; identical for every player. */
  seed: number
  /** Top entries for today (server-capped). */
  leaderboard: ScoreEntry[]
  /** How many players have a score today. */
  players: number
  /** The caller's standing today, or null if they have not scored yet. */
  you: PlayerStanding | null
  /** The caller's streak, or null when signed out / unknown. */
  streak: StreakState | null
}

/** POST api/score — submit a finished run. */
export type SubmitScoreReq = {
  score: number
  won: boolean
}
export type SubmitScoreRsp = {
  dateKey: string
  /** The caller's best entry for today after this submission. */
  entry: ScoreEntry
  /** The caller's rank after this submission. */
  rank: number
  /** How many players have a score today. */
  players: number
  streak: StreakState
  /** Top entries for today (server-capped). */
  leaderboard: ScoreEntry[]
}

/** GET api/leaderboard?day=YYYY-MM-DD — a day's board (defaults to today). */
export type LeaderboardRsp = {
  dateKey: string
  leaderboard: ScoreEntry[]
  players: number
  you: PlayerStanding | null
}

export type Endpoint = (typeof Endpoint)[keyof typeof Endpoint]
export const Endpoint = {
  Daily: 'api/daily',
  Leaderboard: 'api/leaderboard',
  Score: 'api/score',
  OnAppInstall: 'internal/triggers/on-app-install',
  OnMenuNewPost: 'internal/menu/post-create',
} as const
