/**
 * app.ts — the Hono application, built by a factory so tests and local dev
 * can inject a MemoryStore and a fake player, while index.ts injects the
 * real RedisStore and the Devvit context player.
 *
 * Route layout (mounted in index.ts style, mirroring the official
 * @devvit/web templates):
 *   /api/*        — webview client calls
 *   /internal/*   — Devvit menu items and triggers from devvit.json
 */

import {Hono} from 'hono'
import type {Context as HonoContext} from 'hono'
import {
  type DailyRsp,
  type ErrorRsp,
  type LeaderboardRsp,
  type SubmitScoreReq,
  type SubmitScoreRsp,
} from '../shared/api.ts'
import {isDateKey, seedFromDateKey, todayKey, type DateKey} from '../shared/daily.ts'
import {rankOf} from '../shared/leaderboard.ts'
import type {Store} from './store.ts'

export type Player = {id: string; username: string}

export type AppDeps = {
  store: Store
  /** Resolve the calling Reddit user, or null when signed out / unknown. */
  resolvePlayer: (c: HonoContext) => Promise<Player | null>
  /** Create the game's demo post (app install + menu action). Optional. */
  createPost?: () => Promise<{url?: string} | void>
  /** Clock override for tests. */
  now?: () => Date
}

const BOARD_LIMIT = 50
/** Rank lookups scan deeper than the displayed board so ranks stay exact. */
const RANK_SCAN_LIMIT = 1000
/** Sanity ceiling: 60s of play cannot plausibly beat this (best combo pace). */
const MAX_SCORE = 100_000

export function createApp(deps: AppDeps): Hono {
  const now = deps.now ?? (() => new Date())
  const app = new Hono()
  const api = new Hono()
  const internal = new Hono()

  api.get('/daily', async c => {
    const dayKey = todayKey(now())
    const player = await deps.resolvePlayer(c)
    const [full, players, you, streak] = await Promise.all([
      deps.store.getLeaderboard(dayKey, RANK_SCAN_LIMIT),
      deps.store.getPlayerCount(dayKey),
      player ? deps.store.getEntry(dayKey, player.id) : Promise.resolve(null),
      player ? deps.store.getStreak(player.id) : Promise.resolve(null),
    ])
    const rsp: DailyRsp = {
      dateKey: dayKey,
      seed: seedFromDateKey(dayKey),
      leaderboard: full.slice(0, BOARD_LIMIT),
      players,
      you: you ? {entry: you, rank: rankOf(full, you.userId) ?? players} : null,
      streak,
    }
    return c.json(rsp)
  })

  api.get('/leaderboard', async c => {
    const dayParam = c.req.query('day')
    const dayKey: DateKey =
      dayParam && isDateKey(dayParam) ? dayParam : todayKey(now())
    const player = await deps.resolvePlayer(c)
    const [full, players, you] = await Promise.all([
      deps.store.getLeaderboard(dayKey, RANK_SCAN_LIMIT),
      deps.store.getPlayerCount(dayKey),
      player ? deps.store.getEntry(dayKey, player.id) : Promise.resolve(null),
    ])
    const rsp: LeaderboardRsp = {
      dateKey: dayKey,
      leaderboard: full.slice(0, BOARD_LIMIT),
      players,
      you: you ? {entry: you, rank: rankOf(full, you.userId) ?? players} : null,
    }
    return c.json(rsp)
  })

  api.post('/score', async c => {
    const player = await deps.resolvePlayer(c)
    if (!player) {
      return c.json<ErrorRsp>({error: 'not signed in', status: 401}, 401)
    }
    let body: SubmitScoreReq
    try {
      body = (await c.req.json()) as SubmitScoreReq
    } catch {
      return c.json<ErrorRsp>({error: 'invalid JSON body', status: 400}, 400)
    }
    const score = body.score
    if (
      typeof score !== 'number' ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > MAX_SCORE ||
      Math.floor(score) !== score
    ) {
      return c.json<ErrorRsp>({error: 'invalid score', status: 400}, 400)
    }
    const dayKey = todayKey(now())
    const streak = await deps.store.recordPlay(player.id, dayKey)
    const result = await deps.store.submitScore(dayKey, {
      userId: player.id,
      username: player.username,
      score,
      won: body.won === true,
      achievedAt: now().getTime(),
    })
    const leaderboard = await deps.store.getLeaderboard(dayKey, BOARD_LIMIT)
    const rsp: SubmitScoreRsp = {
      dateKey: dayKey,
      entry: result.entry,
      rank: result.rank,
      players: result.players,
      streak,
      leaderboard,
    }
    return c.json(rsp)
  })

  internal.post('/triggers/on-app-install', async c => {
    await deps.createPost?.()
    return c.json({})
  })

  internal.post('/menu/post-create', async c => {
    const post = await deps.createPost?.()
    return c.json({
      showToast: {text: 'Vacuum Panic! post created.', appearance: 'success'},
      ...(post?.url ? {navigateTo: post.url} : {}),
    })
  })

  app.route('/api', api)
  app.route('/internal', internal)
  app.notFound(c => c.json<ErrorRsp>({error: 'not found', status: 404}, 404))
  app.onError((err, c) => {
    console.error(`server error; ${err instanceof Error ? err.stack : err}`)
    return c.json<ErrorRsp>({error: 'server error', status: 500}, 500)
  })

  return app
}
