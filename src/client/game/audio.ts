/**
 * audio.ts — WebAudio bleeps, no audio files. Ported from Rocket Cat's
 * audio.js with the fanfares renamed to the new theme; created lazily on
 * the first user gesture (autoplay policies require one).
 */

let ctx: AudioContext | null = null
let muted = false

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null // headless (tests): stay silent
  if (!ctx) {
    const AC = window.AudioContext ??
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
    if (AC) ctx = new AC()
  }
  if (ctx && ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
): void {
  if (muted || !ensure() || !ctx) return
  const t0 = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  gain.gain.setValueAtTime(vol, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const audio = {
  unlock: ensure,
  toggleMute(): boolean {
    muted = !muted
    return muted
  },
  isMuted(): boolean {
    return muted
  },
  treat(combo: number): void {
    tone(880 + Math.min(combo, 10) * 40, 0, 0.09, 'square', 0.06)
    tone(1318, 0.05, 0.1, 'square', 0.05)
  },
  yarn(): void {
    tone(523, 0, 0.08, 'triangle', 0.09)
    tone(659, 0.06, 0.08, 'triangle', 0.09)
    tone(784, 0.12, 0.12, 'triangle', 0.09)
  },
  hit(): void {
    tone(220, 0, 0.22, 'sawtooth', 0.1, 55)
    tone(110, 0.02, 0.25, 'square', 0.07, 40)
  },
  launch(): void {
    tone(392, 0, 0.1, 'triangle', 0.08)
    tone(523, 0.08, 0.1, 'triangle', 0.08)
    tone(659, 0.16, 0.16, 'triangle', 0.08)
  },
  home(): void {
    ;[523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.16, 'triangle', 0.09))
  },
  caught(): void {
    tone(440, 0, 0.5, 'sawtooth', 0.08, 82)
    tone(415, 0.1, 0.5, 'sawtooth', 0.06, 73)
  },
}
