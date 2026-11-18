#!/usr/bin/env -S node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * index.ts — production wiring (the Devvit hookup point).
 *
 * Everything platform-specific lives in this one file:
 *   - the real Redis client from @devvit/web/server -> RedisStore
 *   - the calling user from the Devvit context -> resolvePlayer
 *   - demo-post creation via the Reddit API -> createPost
 * app.ts / store.ts stay platform-free and are what the tests exercise.
 */
import {serve} from '@hono/node-server'
import {context, createServer, getServerPort, reddit, redis} from '@devvit/web/server'
import {createApp, type Player} from './app.ts'
import {RedisStore, type RedisLike} from './store.ts'

const store = new RedisStore(redis as unknown as RedisLike)

async function resolvePlayer(): Promise<Player | null> {
  try {
    const id = context.userId
    if (!id) return null
    const username =
      context.username ?? (await reddit.getCurrentUsername()) ?? 'anonymous'
    return {id, username}
  } catch {
    return null
  }
}

async function createPost(): Promise<{url: string}> {
  const post = await reddit.submitCustomPost({
    title: 'Vacuum Panic! — today’s 60-second cat dash',
  })
  return {url: post.url}
}

const app = createApp({store, resolvePlayer, createPost})

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
})
