/**
 * local.ts — run the API on a plain workstation, no Reddit account needed.
 *
 *   npm run dev:local    ->  http://localhost:5173/api/daily
 *
 * Uses a MemoryStore and a fixed dev player (override with VP_PLAYER_ID /
 * VP_PLAYER_NAME). Production never touches this file; index.ts is the
 * Devvit entry.
 */
import {serve} from '@hono/node-server'
import {createApp} from './app.ts'
import {MemoryStore} from './store.ts'

const player = {
  id: process.env.VP_PLAYER_ID ?? 't2_devplayer',
  username: process.env.VP_PLAYER_NAME ?? 'dev_player',
}

const app = createApp({
  store: new MemoryStore(),
  resolvePlayer: async () => player,
  createPost: async () => {
    console.log('[local] createPost called (no-op outside Reddit)')
  },
})

const port = Number(process.env.PORT ?? 5173)
serve({fetch: app.fetch, port}, info => {
  console.log(`Vacuum Panic! local API on http://localhost:${info.port} as u/${player.username}`)
})
