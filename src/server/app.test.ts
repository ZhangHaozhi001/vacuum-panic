import assert from 'node:assert/strict'
import {test} from 'node:test'
import type {DailyRsp, LeaderboardRsp, SubmitScoreRsp} from '../shared/api.ts'
import {createApp, type Player} from './app.ts'
import {MemoryStore} from './store.ts'

const alice: Player = {id: 't2_alice', username: 'alice'}
const bob: Player = {id: 't2_bob', username: 'bob'}

// Fixed clock: midday UTC on 2026-12-09, so "today" is deterministic.
const FIXED = new Date('2026-12-09T12:00:00.000Z')

function makeApp(player: Player | null) {
  return createApp({
    store: new MemoryStore(),
    resolvePlayer: async () => player,
    now: () => FIXED,
  })
}

const post = (app: ReturnType<typeof makeApp>, body: unknown) =>
  app.request('/api/score', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  })

test('GET /api/daily returns today’s key, seed and an empty board', async () => {
  const rsp = await makeApp(alice).request('/api/daily')
  assert.equal(rsp.status, 200)
  const body = (await rsp.json()) as DailyRsp
  assert.equal(body.dateKey, '2026-12-09')
  assert.ok(body.seed > 0)
  assert.deepEqual(body.leaderboard, [])
  assert.equal(body.players, 0)
  assert.equal(body.you, null)
})

test('POST /api/score records the run, the rank and the streak', async () => {
  const app = makeApp(alice)
  const rsp = await post(app, {score: 320, won: true})
  assert.equal(rsp.status, 200)
  const body = (await rsp.json()) as SubmitScoreRsp
  assert.equal(body.dateKey, '2026-12-09')
  assert.equal(body.rank, 1)
  assert.equal(body.entry.score, 320)
  assert.equal(body.entry.won, true)
  assert.equal(body.streak.current, 1)

  // a second, worse run the same day keeps the best and does not restreak
  const rsp2 = await post(app, {score: 100, won: false})
  const body2 = (await rsp2.json()) as SubmitScoreRsp
  assert.equal(body2.entry.score, 320)
  assert.equal(body2.streak.current, 1)
  assert.equal(body2.streak.totalDays, 1)
})

test('two players share one board with correct ranks', async () => {
  const store = new MemoryStore()
  let current: Player | null = alice
  const app = createApp({
    store,
    resolvePlayer: async () => current,
    now: () => FIXED,
  })
  await post(app, {score: 100, won: false})
  current = bob
  const rsp = await post(app, {score: 450, won: true})
  const body = (await rsp.json()) as SubmitScoreRsp
  assert.equal(body.rank, 1)
  assert.equal(body.players, 2)

  const lb = (await (await app.request('/api/leaderboard')).json()) as LeaderboardRsp
  assert.deepEqual(lb.leaderboard.map(e => e.username), ['bob', 'alice'])
  assert.equal(lb.you?.rank, 1)

  const daily = (await (await app.request('/api/daily')).json()) as DailyRsp
  assert.equal(daily.you?.entry.username, 'bob')
})

test('POST /api/score rejects signed-out callers and junk scores', async () => {
  const anon = makeApp(null)
  assert.equal((await post(anon, {score: 10, won: false})).status, 401)

  const app = makeApp(alice)
  for (const bad of [-1, 1.5, Number.NaN, 10_000_000, 'lots']) {
    const rsp = await post(app, {score: bad, won: false})
    assert.equal(rsp.status, 400, `score ${String(bad)} should be rejected`)
  }
  const notJson = await app.request('/api/score', {method: 'POST', body: 'nope'})
  assert.equal(notJson.status, 400)
})

test('unknown routes 404 as JSON', async () => {
  const rsp = await makeApp(alice).request('/api/nope')
  assert.equal(rsp.status, 404)
  assert.deepEqual(await rsp.json(), {error: 'not found', status: 404})
})

test('internal trigger and menu endpoints respond', async () => {
  let posts = 0
  const app = createApp({
    store: new MemoryStore(),
    resolvePlayer: async () => alice,
    createPost: async () => {
      posts++
      return {url: 'https://reddit.com/r/test/comments/abc'}
    },
    now: () => FIXED,
  })
  const trig = await app.request('/internal/triggers/on-app-install', {method: 'POST'})
  assert.equal(trig.status, 200)
  const menu = await app.request('/internal/menu/post-create', {method: 'POST'})
  assert.equal(menu.status, 200)
  const menuBody = (await menu.json()) as {navigateTo?: string}
  assert.equal(menuBody.navigateTo, 'https://reddit.com/r/test/comments/abc')
  assert.equal(posts, 2)
})
