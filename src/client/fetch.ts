/**
 * fetch.ts — typed calls to the app server. Every helper returns undefined
 * on any failure: the game must stay fully playable when the API is
 * unreachable (local file preview, playtest hiccups), it just plays the
 * locally-computed daily puzzle without the shared board.
 */

import {
  Endpoint,
  type DailyRsp,
  type LeaderboardRsp,
  type SubmitScoreReq,
  type SubmitScoreRsp,
} from '../shared/api.ts'

async function getJson<T>(url: string): Promise<T | undefined> {
  try {
    const rsp = await fetch(url, {headers: {Accept: 'application/json'}})
    if (!rsp.ok) {
      console.error(`GET ${url} -> ${rsp.status}`)
      return undefined
    }
    return (await rsp.json()) as T
  } catch (err) {
    console.error(`GET ${url} failed: ${err instanceof Error ? err.message : err}`)
    return undefined
  }
}

export function fetchDaily(): Promise<DailyRsp | undefined> {
  return getJson<DailyRsp>(Endpoint.Daily)
}

export function fetchLeaderboard(day?: string): Promise<LeaderboardRsp | undefined> {
  const url = day ? `${Endpoint.Leaderboard}?day=${encodeURIComponent(day)}` : Endpoint.Leaderboard
  return getJson<LeaderboardRsp>(url)
}

export async function submitScore(req: SubmitScoreReq): Promise<SubmitScoreRsp | undefined> {
  try {
    const rsp = await fetch(Endpoint.Score, {
      method: 'POST',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify(req),
    })
    if (!rsp.ok) {
      console.error(`POST ${Endpoint.Score} -> ${rsp.status}`)
      return undefined
    }
    return (await rsp.json()) as SubmitScoreRsp
  } catch (err) {
    console.error(`POST ${Endpoint.Score} failed: ${err instanceof Error ? err.message : err}`)
    return undefined
  }
}
