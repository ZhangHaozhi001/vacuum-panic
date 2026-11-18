/**
 * world.ts — the simulation: the cat, falling treats and vacuums,
 * particles, collisions, combo scoring, lives, and the 60-second wait for
 * the front door. Ported from Rocket Cat's world.js with two structural
 * changes:
 *
 *   1. The spawn stream has its OWN rng, seeded by the day key. Cosmetic
 *      randomness (dust motes, particles) uses a separate clock-seeded rng,
 *      so every player on every device gets the identical puzzle today —
 *      and retrying a run replays the same puzzle, like a proper daily.
 *   2. Steering is passed into update() instead of reading a global, which
 *      keeps the simulation testable and the input layer swappable.
 */

import {makeRng, seedFromDateKey, todayKey, type DateKey} from '../../shared/daily.ts'
import {audio} from './audio.ts'
import {
  BASE_FALL,
  COMBO_STEP,
  FISH_SCORE,
  H,
  MAX_FALL,
  PLAYER_SPEED,
  PLAYER_Y,
  RUN_SECONDS,
  START_LIVES,
  W,
  YARN_SCORE,
} from './config.ts'

export type ItemKind = 'fish' | 'yarn' | 'vac' | 'bigvac'
export type WorldState = 'title' | 'play' | 'caught' | 'clear'

export type Item = {kind: ItemKind; x: number; y: number; vy: number; size: number; spin: number}
export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}
export type Floater = {x: number; y: number; text: string; life: number; color: string}
export type Mote = {x: number; y: number; r: number; tw: number}

export type World = {
  state: WorldState
  dayKey: DateKey
  seed: number
  spawnRng: () => number
  fxRng: () => number
  time: number
  score: number
  high: number
  combo: number
  multiplier: number
  lives: number
  playerX: number
  tilt: number
  invulnUntil: number
  shake: number
  flash: number
  spawnIn: number
  items: Item[]
  particles: Particle[]
  floaters: Floater[]
  motes: Mote[]
  sunY: number
  endAt: number
}

export type Steer = {axis: number; pointerX: number | null}

const HIGH_KEY = 'vacuum-panic-best'

export function loadHigh(): number {
  try {
    return parseInt(localStorage.getItem(HIGH_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

export function saveHigh(v: number): void {
  try {
    localStorage.setItem(HIGH_KEY, String(v))
  } catch {
    /* private mode */
  }
}

export function newWorld(dayKey: DateKey = todayKey(), seed: number = seedFromDateKey(dayKey)): World {
  const fxRng = makeRng((Date.now() % 2147483647) + 1)
  const motes: Mote[] = []
  for (let i = 0; i < 90; i++) {
    motes.push({x: fxRng() * W, y: fxRng() * H, r: 0.8 + fxRng() * 1.8, tw: fxRng() * 6.28})
  }
  return {
    state: 'title',
    dayKey,
    seed,
    spawnRng: makeRng(seed),
    fxRng,
    time: 0,
    score: 0,
    high: loadHigh(),
    combo: 0,
    multiplier: 1,
    lives: START_LIVES,
    playerX: W / 2,
    tilt: 0,
    invulnUntil: -1,
    shake: 0,
    flash: 0,
    spawnIn: 0.4,
    items: [],
    particles: [],
    floaters: [],
    motes,
    sunY: -140,
    endAt: 0,
  }
}

export function fallSpeed(w: World): number {
  const t = Math.min(w.time / RUN_SECONDS, 1)
  return BASE_FALL + (MAX_FALL - BASE_FALL) * t
}

export function spawnItem(w: World): void {
  const rng = w.spawnRng
  const roll = rng()
  let kind: ItemKind = 'fish'
  if (roll > 0.9) kind = 'bigvac'
  else if (roll > 0.74) kind = 'vac'
  else if (roll > 0.62) kind = 'yarn'
  const size = kind === 'bigvac' ? 46 : kind === 'fish' ? 30 : kind === 'vac' ? 34 : 26
  w.items.push({
    kind,
    x: 30 + rng() * (W - 60),
    y: -40,
    vy: fallSpeed(w) * (0.9 + rng() * 0.3),
    size,
    spin: rng() * 6.28,
  })
  // spawns get denser as the run speeds up
  w.spawnIn = Math.max(0.24, 0.62 - w.time * 0.006) * (0.6 + rng() * 0.7)
}

export function burst(w: World, x: number, y: number, color: string, n: number, speed: number): void {
  for (let i = 0; i < n; i++) {
    const a = w.fxRng() * 6.283
    const v = (0.3 + w.fxRng() * 0.7) * speed
    w.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      life: 0,
      maxLife: 0.45 + w.fxRng() * 0.4,
      color,
      size: 2 + w.fxRng() * 3,
    })
  }
}

export function floater(w: World, x: number, y: number, text: string, color: string): void {
  w.floaters.push({x, y, text, life: 0, color})
}

export function endRun(w: World, won: boolean): void {
  w.state = won ? 'clear' : 'caught'
  w.endAt = w.time
  if (w.score > w.high) {
    w.high = w.score
    saveHigh(w.high)
  }
  if (won) {
    audio.home()
    burst(w, w.playerX, PLAYER_Y - 30, '#ffb03a', 42, 260)
  } else {
    audio.caught()
    w.shake = 14
    burst(w, w.playerX, PLAYER_Y, '#e14b5a', 36, 240)
  }
}

export function hitPlayer(w: World, item: Item): void {
  w.lives -= 1
  w.combo = 0
  w.multiplier = 1
  w.shake = 11
  w.flash = 1
  w.invulnUntil = w.time + 1.1
  audio.hit()
  burst(w, w.playerX, PLAYER_Y, item.kind === 'bigvac' ? '#e14b5a' : '#8496ab', 22, 210)
  floater(w, w.playerX, PLAYER_Y - 56, item.kind === 'bigvac' ? 'CRASH!' : 'BONK!', '#ff8296')
  if (w.lives <= 0) endRun(w, false)
}

export function collect(w: World, item: Item): void {
  w.combo += 1
  w.multiplier = 1 + Math.floor(w.combo / COMBO_STEP)
  const base = item.kind === 'yarn' ? YARN_SCORE : FISH_SCORE
  const gained = base * w.multiplier
  w.score += gained
  if (item.kind === 'yarn') {
    audio.yarn()
    burst(w, item.x, item.y, '#ff7eb6', 14, 170)
  } else {
    audio.treat(w.combo)
    burst(w, item.x, item.y, '#ffb03a', 10, 150)
  }
  floater(w, item.x, item.y - 14, `+${gained}`, item.kind === 'yarn' ? '#ff7eb6' : '#ffb03a')
}

export function startRun(w: World): void {
  const high = w.high
  const motes = w.motes
  const dayKey = w.dayKey
  const seed = w.seed
  const fresh = newWorld(dayKey, seed)
  Object.assign(w, fresh)
  w.high = high
  w.motes = motes
  w.state = 'play'
  audio.launch()
}

export function update(w: World, dt: number, steer: Steer): void {
  // dust motes always drift, faster while playing
  const drift = (w.state === 'play' ? fallSpeed(w) * 0.55 : 26) * dt
  for (const m of w.motes) {
    m.y += drift * (0.4 + m.r)
    if (m.y > H + 2) {
      m.y = -2
      m.x = w.fxRng() * W
    }
  }

  for (let i = w.particles.length - 1; i >= 0; i--) {
    const p = w.particles[i]
    if (!p) continue
    p.life += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += 260 * dt
    if (p.life >= p.maxLife) w.particles.splice(i, 1)
  }
  for (let i = w.floaters.length - 1; i >= 0; i--) {
    const f = w.floaters[i]
    if (!f) continue
    f.life += dt
    f.y -= 44 * dt
    if (f.life > 0.9) w.floaters.splice(i, 1)
  }
  w.shake = Math.max(0, w.shake - dt * 26)
  w.flash = Math.max(0, w.flash - dt * 2.4)

  if (w.state !== 'play') return

  w.time += dt
  if (w.time >= RUN_SECONDS) {
    endRun(w, true)
    return
  }
  if (w.time > RUN_SECONDS - 6) w.sunY = Math.min(64, w.sunY + dt * 42)

  // steering: keys give velocity, pointer gives a target to chase
  const axis = steer.axis
  if (axis !== 0) w.playerX += axis * PLAYER_SPEED * dt
  const px = steer.pointerX
  if (px !== null && axis === 0) {
    const dx = px - w.playerX
    w.playerX += Math.max(-PLAYER_SPEED * 1.7 * dt, Math.min(PLAYER_SPEED * 1.7 * dt, dx))
  }
  w.playerX = Math.max(34, Math.min(W - 34, w.playerX))
  w.tilt = Math.max(
    -0.35,
    Math.min(0.35, axis * 0.3 + (px !== null && axis === 0 ? (px - w.playerX) * 0.001 : 0)),
  )

  w.spawnIn -= dt
  if (w.spawnIn <= 0) spawnItem(w)

  for (let i = w.items.length - 1; i >= 0; i--) {
    const it = w.items[i]
    if (!it) continue
    it.y += it.vy * dt
    it.spin += dt * 2
    if (it.y > H + 50) {
      w.items.splice(i, 1)
      continue
    }
    const dx = it.x - w.playerX
    const dy = it.y - PLAYER_Y
    const rr = it.size * 0.62 + 24
    if (dx * dx + dy * dy < rr * rr) {
      w.items.splice(i, 1)
      if (it.kind === 'fish' || it.kind === 'yarn') collect(w, it)
      else if (w.time >= w.invulnUntil) hitPlayer(w, it)
    }
  }
}
