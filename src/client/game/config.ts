/**
 * config.ts — every tunable of Vacuum Panic! in one place.
 * Playfield geometry and pacing are inherited 1:1 from Rocket Cat so the
 * port keeps the original's game feel; only the theme changed.
 */

export const W = 960 // playfield width  (canvas units)
export const H = 540 // playfield height
export const RUN_SECONDS = 60 // survive this long and the door opens
export const START_LIVES = 3 // hits the cat can take before the vacuum wins
export const PLAYER_Y = 452 // the cat dashes along this line (the floor)
export const PLAYER_SPEED = 520 // keyboard steering speed, px per second
export const BASE_FALL = 175 // starting fall speed of items, px per second
export const MAX_FALL = 430 // fall speed at the end of the run
export const FISH_SCORE = 10
export const YARN_SCORE = 25 // yarn balls are worth more than fish treats
export const COMBO_STEP = 5 // every 5 pickups in a row raises the multiplier

export const COLORS = {
  wallTop: '#2c2145',
  wallBottom: '#54355c',
  floor: '#8a5a3b',
  floorDark: '#6e452c',
  fish: '#ffb03a',
  fishEdge: '#e07f1f',
  yarn: '#ff7eb6',
  yarnDark: '#d14e8a',
  vacBody: '#cfd8e3',
  vacDark: '#8496ab',
  bigVac: '#e14b5a',
  bigVacDark: '#a92c3a',
  cat: '#f2a65a',
  catDark: '#c97e35',
  cream: '#fff3d6',
  text: '#fdf6e9',
  dim: '#cdb9dd',
}
