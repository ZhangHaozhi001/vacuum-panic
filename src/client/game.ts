/**
 * game.ts — webview entry: boot, the frame loop, screen transitions,
 * canvas scaling for the Reddit webview, and the daily loop glue
 * (fetch today's puzzle -> play -> submit score -> show board + streak).
 */

import {seedFromDateKey, todayKey} from '../shared/daily.ts'
import type {DailyRsp, SubmitScoreRsp} from '../shared/api.ts'
import type {ScoreEntry} from '../shared/leaderboard.ts'
import type {StreakState} from '../shared/streak.ts'
import {fetchDaily, submitScore} from './fetch.ts'
import {audio} from './game/audio.ts'
import {H, W} from './game/config.ts'
import {input} from './game/input.ts'
import {render} from './game/render.ts'
import {newWorld, startRun, update, type World} from './game/world.ts'
import {track} from './journeys.ts'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

function fit(): void {
  const availW = window.innerWidth
  const availH = window.innerHeight - panelHeight()
  const scale = Math.min(availW / W, availH / H) * 0.98
  canvas.style.width = `${Math.floor(W * scale)}px`
  canvas.style.height = `${Math.floor(H * scale)}px`
}

function panelHeight(): number {
  return document.getElementById('daily-panel')?.offsetHeight ?? 0
}

window.addEventListener('resize', fit)

input.attach(canvas)

/* ---------------- daily panel (leaderboard + streak) ---------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  return node
}

function renderPanel(opts: {
  dateKey: string
  leaderboard: ScoreEntry[]
  youRank: number | null
  streak: StreakState | null
  note?: string
}): void {
  const panel = document.getElementById('daily-panel')
  if (!panel) return
  panel.replaceChildren()

  const head = el('div')
  head.className = 'panel-head'
  const title = el('span', `Today's board · ${opts.dateKey}`)
  head.append(title)
  if (opts.streak && opts.streak.current > 0) {
    const flame = el('span', `🔥 ${opts.streak.current}-day streak`)
    flame.className = 'streak'
    head.append(flame)
  }
  panel.append(head)

  if (opts.note) {
    const note = el('div', opts.note)
    note.className = 'panel-note'
    panel.append(note)
  }

  const list = el('ol')
  list.className = 'panel-rows'
  opts.leaderboard.slice(0, 5).forEach((entry, i) => {
    const row = el('li')
    const name = el('span', `${i + 1}. u/${entry.username}`)
    const score = el('span', `${entry.score}${entry.won ? ' 🏠' : ''}`)
    row.append(name, score)
    list.append(row)
  })
  if (opts.leaderboard.length === 0) {
    const empty = el('li', 'No scores yet today — set the first one!')
    list.append(empty)
  }
  panel.append(list)

  if (opts.youRank !== null) {
    const you = el('div', `Your rank today: #${opts.youRank}`)
    you.className = 'panel-you'
    panel.append(you)
  }
  track('leaderboard_view', {dateKey: opts.dateKey, rows: opts.leaderboard.length})
  fit()
}

function panelFromDaily(daily: DailyRsp): void {
  renderPanel({
    dateKey: daily.dateKey,
    leaderboard: daily.leaderboard,
    youRank: daily.you?.rank ?? null,
    streak: daily.streak,
  })
}

function panelFromSubmit(rsp: SubmitScoreRsp): void {
  renderPanel({
    dateKey: rsp.dateKey,
    leaderboard: rsp.leaderboard,
    youRank: rsp.rank,
    streak: rsp.streak,
    note: `Score submitted — rank #${rsp.rank} of ${rsp.players} today.`,
  })
}

/* ---------------- boot + main loop ---------------- */

let world: World = newWorld()
let endStamp = 0
let submitted = false

async function boot(): Promise<void> {
  fit()
  track('game_boot', {dateKey: world.dayKey})
  const daily = await fetchDaily()
  if (daily) {
    // The server's day is the source of truth; rebuild the world on it so
    // the puzzle, the board and the streak all agree on "today".
    world = newWorld(daily.dateKey, daily.seed)
    panelFromDaily(daily)
  } else {
    const key = todayKey()
    world = newWorld(key, seedFromDateKey(key))
    renderPanel({
      dateKey: key,
      leaderboard: [],
      youRank: null,
      streak: null,
      note: 'Offline mode — playing today’s puzzle without the shared board.',
    })
  }
  fit()
  requestAnimationFrame(frame)
}

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  if (input.takePress()) {
    audio.unlock()
    if (world.state === 'title') {
      startRun(world)
      submitted = false
      track('run_start', {dateKey: world.dayKey, seed: world.seed})
    } else if ((world.state === 'caught' || world.state === 'clear') && now - endStamp > 600) {
      startRun(world)
      submitted = false
      track('run_start', {dateKey: world.dayKey, seed: world.seed})
    }
  }
  if ((world.state === 'caught' || world.state === 'clear') && !endStamp) endStamp = now
  if (world.state === 'play') endStamp = 0

  const wasPlaying = world.state === 'play'
  update(world, dt, {axis: input.axis(), pointerX: input.pointerX()})
  render(ctx, world)

  if (wasPlaying && world.state !== 'play' && !submitted) {
    submitted = true
    const won = world.state === 'clear'
    track('run_end', {score: world.score, won, dayKey: world.dayKey})
    void submitScore({score: world.score, won}).then(rsp => {
      if (rsp) {
        track('score_submitted', {rank: rsp.rank, score: rsp.entry.score})
        track('streak_day', {current: rsp.streak.current})
        panelFromSubmit(rsp)
      }
    })
  }

  requestAnimationFrame(frame)
}

void boot()
