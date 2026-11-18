/**
 * input.ts — keyboard, mouse and touch steering, ported from Rocket Cat.
 * The pointer steers by target x; keys steer by velocity. Touch uses
 * pointer capture on the canvas so drags keep tracking inside the Reddit
 * webview even when the finger drifts off the cat.
 */

import {audio} from './audio.ts'

const keys: Record<string, boolean> = {}
let pointerX: number | null = null // canvas-space x the pointer wants the cat at
let pressed = false // set on any fresh press; the entry consumes it

function toCanvasX(canvas: HTMLCanvasElement, clientX: number): number {
  const r = canvas.getBoundingClientRect()
  return (clientX - r.left) * (canvas.width / r.width)
}

export const input = {
  attach(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault()
      }
      if (!e.repeat) pressed = true
      keys[e.key.toLowerCase()] = true
      if (e.key.toLowerCase() === 'm') audio.toggleMute()
    })
    window.addEventListener('keyup', e => {
      keys[e.key.toLowerCase()] = false
    })

    canvas.addEventListener('mousemove', e => {
      pointerX = toCanvasX(canvas, e.clientX)
    })
    canvas.addEventListener('mousedown', e => {
      pressed = true
      pointerX = toCanvasX(canvas, e.clientX)
      audio.unlock()
    })
    canvas.addEventListener(
      'touchstart',
      e => {
        e.preventDefault()
        pressed = true
        const t = e.touches[0]
        if (t) pointerX = toCanvasX(canvas, t.clientX)
        audio.unlock()
      },
      {passive: false},
    )
    canvas.addEventListener(
      'touchmove',
      e => {
        e.preventDefault()
        const t = e.touches[0]
        if (t) pointerX = toCanvasX(canvas, t.clientX)
      },
      {passive: false},
    )
    canvas.addEventListener('click', () => audio.unlock())
  },

  axis(): number {
    let a = 0
    if (keys['arrowleft'] || keys['a']) a -= 1
    if (keys['arrowright'] || keys['d']) a += 1
    return a
  },

  pointerX(): number | null {
    return pointerX
  },

  takePress(): boolean {
    const p = pressed
    pressed = false
    return p
  },
}
