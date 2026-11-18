/**
 * journeys.ts — Devvit Journeys telemetry, hookup seam.
 *
 * devvit.json already declares `"permissions": {"journeys": true}`, which
 * enables journey telemetry for the app. The platform's client-side event
 * surface gets bound here at upload/playtest time (it needs the live app
 * context to verify against); until then track() buffers events in memory
 * and logs them in dev builds, so every call site below is already final:
 *
 *   game_boot        — webview loaded, with the day key
 *   run_start        — a run begins
 *   run_end          — a run finishes (score, won)
 *   score_submitted  — server accepted a score (rank)
 *   streak_day       — a play extended/started a streak (current)
 *   leaderboard_view — the daily panel rendered a board
 *
 * TODO(upload): bind `sink` to the Journeys client API and drop the buffer.
 */

export type JourneyEvent =
  | 'game_boot'
  | 'run_start'
  | 'run_end'
  | 'score_submitted'
  | 'streak_day'
  | 'leaderboard_view'

type JourneyRecord = {event: JourneyEvent; props: Record<string, unknown>; at: number}

const buffer: JourneyRecord[] = []
const MAX_BUFFER = 200

let sink: ((rec: JourneyRecord) => void) | null = null

const DEBUG = ((): boolean => {
  try {
    return localStorage.getItem('vp-debug') === '1'
  } catch {
    return false
  }
})()

/** Bind the real Journeys transport. Called once from the entry at boot. */
export function setJourneySink(fn: ((rec: JourneyRecord) => void) | null): void {
  sink = fn
}

export function track(event: JourneyEvent, props: Record<string, unknown> = {}): void {
  const rec: JourneyRecord = {event, props, at: Date.now()}
  if (sink) {
    sink(rec)
    return
  }
  buffer.push(rec)
  if (buffer.length > MAX_BUFFER) buffer.shift()
  if (DEBUG) console.debug('[journey]', rec.event, rec.props)
}

/** Buffered events, for tests and for flushing into the sink once bound. */
export function bufferedJourneys(): readonly JourneyRecord[] {
  return buffer
}
