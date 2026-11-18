/**
 * render.ts — all drawing: the living room, the window sun, the cat, the
 * treats and vacuums, particles, the HUD, and the title / end screens.
 * Reskinned from Rocket Cat's render.js; layout and pacing are unchanged.
 */

import {audio} from './audio.ts'
import {COLORS, H, PLAYER_Y, RUN_SECONDS, START_LIVES, W} from './config.ts'
import type {Item, World} from './world.ts'

export function render(ctx: CanvasRenderingContext2D, w: World): void {
  ctx.save()
  if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake)
  drawRoom(ctx, w)
  drawWindow(ctx, w)
  for (const it of w.items) drawItem(ctx, it)
  if (w.state === 'play' || w.state === 'clear') {
    drawCat(ctx, w.playerX, w.tilt, w.state === 'play' && w.time < w.invulnUntil && Math.floor(w.time * 12) % 2 === 0, w.time)
  }
  drawParticles(ctx, w)
  drawFloaters(ctx, w)
  ctx.restore()

  if (w.flash > 0) {
    ctx.fillStyle = `rgba(255,40,70,${w.flash * 0.28})`
    ctx.fillRect(0, 0, W, H)
  }
  if (w.state === 'play') drawHud(ctx, w)
  if (w.state === 'title') drawTitle(ctx, w)
  if (w.state === 'caught') drawEnd(ctx, w, false)
  if (w.state === 'clear') drawEnd(ctx, w, true)
}

function drawRoom(ctx: CanvasRenderingContext2D, w: World): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, COLORS.wallTop)
  g.addColorStop(1, COLORS.wallBottom)
  ctx.fillStyle = g
  ctx.fillRect(-20, -20, W + 40, H + 40)
  // floating dust motes in the evening light
  for (const m of w.motes) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(m.tw + performance.now() / 900)
    ctx.fillStyle = '#ffe9c4'
    ctx.beginPath()
    ctx.arc(m.x, m.y, m.r, 0, 6.283)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  // wainscot rail + wooden floor
  const floorY = H - 88
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.fillRect(-20, floorY - 6, W + 40, 4)
  ctx.fillStyle = COLORS.floor
  ctx.fillRect(-20, floorY, W + 40, 88 + 20)
  ctx.strokeStyle = COLORS.floorDark
  ctx.lineWidth = 2
  for (let x = -20; x < W + 40; x += 118) {
    ctx.beginPath()
    ctx.moveTo(x, floorY + 4)
    ctx.lineTo(x - 26, H + 20)
    ctx.stroke()
  }
  // a cozy rug on the floor (the good kind)
  ctx.fillStyle = 'rgba(255,126,182,.20)'
  ctx.beginPath()
  ctx.ellipse(W / 2, H - 30, 300, 20, 0, 0, 6.283)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,126,182,.35)'
  ctx.stroke()
}

function drawWindow(ctx: CanvasRenderingContext2D, w: World): void {
  const x = W - 218
  const y = 24
  const ww = 168
  const wh = 118
  // frame
  ctx.fillStyle = '#1d1430'
  ctx.beginPath()
  ctx.roundRect(x - 6, y - 6, ww + 12, wh + 12, 10)
  ctx.fill()
  ctx.fillStyle = '#8fb7d9'
  ctx.beginPath()
  ctx.roundRect(x, y, ww, wh, 6)
  ctx.fill()
  // the sun slides into the window during the last seconds of the run
  const sunIn = w.state === 'clear' ? 1 : Math.max(0, Math.min(1, (w.sunY + 140) / 204))
  if (sunIn > 0) {
    const sx = x + ww - 42
    const sy = y + 16 + (1 - sunIn) * -60 + sunIn * 22
    ctx.fillStyle = '#ffd94d'
    ctx.beginPath()
    ctx.arc(sx, sy, 24, 0, 6.283)
    ctx.fill()
    ctx.fillStyle = '#f7ead1'
    ctx.beginPath()
    ctx.arc(sx - 7, sy - 5, 5, 0, 6.283)
    ctx.fill()
  }
  // mullions
  ctx.strokeStyle = '#1d1430'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(x + ww / 2, y)
  ctx.lineTo(x + ww / 2, y + wh)
  ctx.moveTo(x, y + wh / 2)
  ctx.lineTo(x + ww, y + wh / 2)
  ctx.stroke()
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item): void {
  ctx.save()
  ctx.translate(it.x, it.y)
  if (it.kind === 'fish') {
    ctx.rotate(Math.sin(it.spin) * 0.25)
    ctx.fillStyle = COLORS.fish
    ctx.strokeStyle = COLORS.fishEdge
    ctx.lineWidth = 2
    ctx.beginPath() // tail
    ctx.moveTo(-10, 0)
    ctx.lineTo(-19, -8)
    ctx.lineTo(-19, 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.beginPath() // body
    ctx.ellipse(1, 0, 13, 8, 0, 0, 6.283)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#7a3c00' // eye
    ctx.beginPath()
    ctx.arc(7, -2, 1.8, 0, 6.283)
    ctx.fill()
  } else if (it.kind === 'yarn') {
    ctx.fillStyle = COLORS.yarn
    ctx.strokeStyle = COLORS.yarnDark
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 12, 0, 6.283)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath() // wrap lines
    ctx.arc(-3, -2, 9, 0.6, 2.4)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(3, 3, 9, 3.4, 5.2)
    ctx.stroke()
    ctx.beginPath() // loose string trailing off
    ctx.moveTo(-8, 9)
    ctx.quadraticCurveTo(-16, 16, -9 + Math.sin(it.spin) * 3, 21)
    ctx.stroke()
  } else if (it.kind === 'vac') {
    // robot vacuum: a smug little disc
    ctx.fillStyle = COLORS.vacBody
    ctx.strokeStyle = COLORS.vacDark
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 2, 18, 11, 0, 0, 6.283)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = COLORS.vacDark // top button housing
    ctx.beginPath()
    ctx.ellipse(0, -3, 8, 5, 0, 0, 6.283)
    ctx.fill()
    ctx.fillStyle = '#ff3b30' // the eye
    ctx.beginPath()
    ctx.arc(0, -3, 2.4, 0, 6.283)
    ctx.fill()
    ctx.strokeStyle = COLORS.vacDark // spinning side brushes
    for (let i = 0; i < 3; i++) {
      const a = it.spin * 2 + (i * 6.283) / 3
      ctx.beginPath()
      ctx.moveTo(-14, 9)
      ctx.lineTo(-14 + Math.cos(a) * 6, 9 + Math.sin(a) * 3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(14, 9)
      ctx.lineTo(14 + Math.cos(a) * 6, 9 + Math.sin(a) * 3)
      ctx.stroke()
    }
  } else {
    // bigvac: the upright boss vacuum
    ctx.rotate(Math.sin(it.spin) * 0.1)
    ctx.fillStyle = COLORS.bigVac
    ctx.strokeStyle = COLORS.bigVacDark
    ctx.lineWidth = 2
    ctx.beginPath() // body
    ctx.roundRect(-11, -14, 22, 34, 9)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath() // handle
    ctx.moveTo(-7, -14)
    ctx.lineTo(-12, -30)
    ctx.moveTo(7, -14)
    ctx.lineTo(12, -30)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-12, -30)
    ctx.lineTo(12, -30)
    ctx.stroke()
    ctx.fillStyle = '#ffd94d' // headlight eyes
    ctx.beginPath()
    ctx.arc(-5, -6, 2.2, 0, 6.283)
    ctx.arc(5, -6, 2.2, 0, 6.283)
    ctx.fill()
    ctx.fillStyle = COLORS.bigVacDark // wheels
    ctx.beginPath()
    ctx.arc(-9, 22, 4, 0, 6.283)
    ctx.arc(9, 22, 4, 0, 6.283)
    ctx.fill()
    ctx.strokeStyle = COLORS.bigVacDark // hose
    ctx.beginPath()
    ctx.moveTo(11, -8)
    ctx.quadraticCurveTo(20, 2, 13, 14)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCat(
  ctx: CanvasRenderingContext2D,
  x: number,
  tilt: number,
  blink: boolean,
  time: number,
): void {
  const y = PLAYER_Y
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt * 0.5)
  if (blink) ctx.globalAlpha = 0.35
  const runPhase = Math.sin(time * 16) * 4
  ctx.fillStyle = COLORS.cat
  ctx.strokeStyle = COLORS.catDark
  ctx.lineWidth = 2
  // tail, wagging up behind
  ctx.beginPath()
  ctx.moveTo(-24, 0)
  ctx.quadraticCurveTo(-36, -8 + Math.sin(time * 6) * 3, -33, -20)
  ctx.stroke()
  // legs
  for (const [lx, ph] of [[-14, 0], [-5, 3.14], [10, 3.14], [19, 0]] as const) {
    ctx.beginPath()
    ctx.ellipse(lx, 17 + Math.sin(time * 16 + ph) * 1.5 + (ph === 0 ? runPhase * 0.2 : -runPhase * 0.2), 4.5, 6, 0, 0, 6.283)
    ctx.fill()
    ctx.stroke()
  }
  // body
  ctx.beginPath()
  ctx.ellipse(0, 2, 27, 15, 0, 0, 6.283)
  ctx.fill()
  ctx.stroke()
  // stripes
  ctx.strokeStyle = COLORS.catDark
  for (const sx of [-12, -2, 8]) {
    ctx.beginPath()
    ctx.moveTo(sx, -11)
    ctx.quadraticCurveTo(sx + 2, -4, sx, 2)
    ctx.stroke()
  }
  // head
  ctx.fillStyle = COLORS.cat
  ctx.beginPath()
  ctx.arc(25, -8, 12.5, 0, 6.283)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath() // ears
  ctx.moveTo(16, -16)
  ctx.lineTo(17, -25)
  ctx.lineTo(23, -18)
  ctx.closePath()
  ctx.moveTo(28, -19)
  ctx.lineTo(33, -26)
  ctx.lineTo(35, -16)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#26304d' // eye
  ctx.beginPath()
  ctx.arc(29, -9, 1.9, 0, 6.283)
  ctx.fill()
  ctx.strokeStyle = 'rgba(38,48,77,.7)' // whiskers
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(34, -5)
  ctx.lineTo(43, -7)
  ctx.moveTo(34, -3)
  ctx.lineTo(43, -2)
  ctx.stroke()
  ctx.restore()
}

function drawParticles(ctx: CanvasRenderingContext2D, w: World): void {
  for (const p of w.particles) {
    ctx.globalAlpha = 1 - p.life / p.maxLife
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

function drawFloaters(ctx: CanvasRenderingContext2D, w: World): void {
  ctx.textAlign = 'center'
  ctx.font = 'bold 17px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  for (const f of w.floaters) {
    ctx.globalAlpha = 1 - f.life / 0.9
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.globalAlpha = 1
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, pw: number, ph: number): void {
  ctx.fillStyle = 'rgba(16,10,30,.85)'
  ctx.strokeStyle = '#6b4a7a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(x, y, pw, ph, 14)
  ctx.fill()
  ctx.stroke()
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(0.85, 0.85)
  ctx.fillStyle = filled ? '#ff5b7f' : 'rgba(200,180,220,.30)'
  ctx.beginPath()
  ctx.moveTo(0, 6)
  ctx.bezierCurveTo(-11, -3, -6, -13, 0, -7)
  ctx.bezierCurveTo(6, -13, 11, -3, 0, 6)
  ctx.fill()
  ctx.restore()
}

function drawHud(ctx: CanvasRenderingContext2D, w: World): void {
  ctx.fillStyle = COLORS.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = 'bold 22px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText(`SCORE ${w.score}`, 18, 34)
  ctx.font = 'bold 14px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillStyle = COLORS.dim
  ctx.fillText(`BEST ${Math.max(w.high, w.score)}`, 18, 56)
  if (w.multiplier > 1) {
    ctx.fillStyle = '#ffb03a'
    ctx.fillText(`COMBO ×${w.multiplier}`, 18, 78)
  }
  // lives
  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 14px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('LIVES', W - 18, 24)
  for (let i = 0; i < START_LIVES; i++) {
    heart(ctx, W - 30 - i * 26, 40, i < w.lives)
  }
  // countdown to the door
  const p = Math.min(w.time / RUN_SECONDS, 1)
  ctx.fillStyle = 'rgba(200,180,220,.3)'
  ctx.fillRect(W / 2 - 130, 16, 260, 10)
  ctx.fillStyle = '#ffb03a'
  ctx.fillRect(W / 2 - 130, 16, 260 * p, 10)
  ctx.font = 'bold 15px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillStyle = COLORS.text
  ctx.textAlign = 'center'
  ctx.fillText(`DOOR OPENS IN ${Math.max(0, Math.ceil(RUN_SECONDS - w.time))}s`, W / 2, 44)
  if (audio.isMuted()) {
    ctx.fillStyle = COLORS.dim
    ctx.textAlign = 'right'
    ctx.font = '12px Trebuchet MS, Segoe UI, Verdana, sans-serif'
    ctx.fillText('MUTED (M)', W - 18, H - 12)
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, w: World): void {
  drawCat(ctx, W / 2, 0, false, performance.now() / 1000)
  panel(ctx, W / 2 - 310, 52, 620, 210)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffb03a'
  ctx.font = 'bold 46px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('VACUUM PANIC!', W / 2, 114)
  ctx.fillStyle = COLORS.yarn
  ctx.font = 'bold 24px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('THE DAILY CAT DASH', W / 2, 148)
  ctx.fillStyle = COLORS.dim
  ctx.font = '16px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('Catch fish treats (10 pts) and yarn balls (25 pts).', W / 2, 182)
  ctx.fillText('Dodge the robot vacuums — three hits and they win.', W / 2, 206)
  ctx.fillText('Survive 60 seconds until the front door opens.', W / 2, 230)
  ctx.fillStyle = '#2fe08a'
  ctx.font = 'bold 19px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('TAP OR PRESS ANY KEY TO PLAY', W / 2, 252 + Math.sin(performance.now() / 300) * 2)
  ctx.fillStyle = COLORS.dim
  ctx.font = '13px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText(`TODAY'S PUZZLE: ${w.dayKey} — the same run for everyone, all day`, W / 2, H - 40)
  ctx.fillText('Steer: ← → keys · mouse · touch        Sound: M', W / 2, H - 16)
  if (w.high > 0) {
    ctx.fillStyle = '#ffb03a'
    ctx.font = 'bold 15px Trebuchet MS, Segoe UI, Verdana, sans-serif'
    ctx.fillText(`BEST ${w.high}`, W / 2, 288)
  }
}

function drawEnd(ctx: CanvasRenderingContext2D, w: World, won: boolean): void {
  panel(ctx, W / 2 - 290, 126, 580, 258)
  ctx.textAlign = 'center'
  ctx.fillStyle = won ? '#ffb03a' : '#ff8296'
  ctx.font = 'bold 42px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText(won ? 'THE DOOR OPENS!' : 'VACUUMED!', W / 2, 192)
  ctx.fillStyle = COLORS.text
  ctx.font = '17px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText(
    won
      ? 'Your human is home — the vacuums power down. Nap earned.'
      : `The vacuums got you at ${Math.floor(w.endAt)} seconds. The cat has seen things.`,
    W / 2,
    228,
  )
  ctx.font = 'bold 26px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillStyle = '#ffb03a'
  ctx.fillText(`SCORE ${w.score}`, W / 2, 272)
  ctx.font = '15px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillStyle = COLORS.dim
  ctx.fillText(w.score >= w.high && w.score > 0 ? '★ NEW BEST! ★' : `BEST ${w.high}`, W / 2, 298)
  ctx.fillStyle = '#2fe08a'
  ctx.font = 'bold 18px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText('TAP OR PRESS ANY KEY TO PLAY AGAIN', W / 2, 340)
  ctx.fillStyle = COLORS.dim
  ctx.font = '13px Trebuchet MS, Segoe UI, Verdana, sans-serif'
  ctx.fillText("Today's puzzle stays the same all day — retries replay the same run.", W / 2, 364)
}
