# Vacuum Panic! — The Daily Cat Dash

A 60-second daily arcade game for Reddit, built on **Devvit Web**.

The robot vacuums have broken loose and the house is raining snacks. You are
the cat. Catch **fish treats** (10 pts) and **yarn balls** (25 pts), dodge the
**robot vacuums** and the big upright **boss vacuum**, and survive 60 seconds
until the front door opens and your human comes home. Three hits and the
vacuums win.

**Every day is one shared puzzle:** the run is generated from a seed derived
from the UTC date, so every player everywhere plays the identical run all day
— and retries replay the same puzzle. Come back tomorrow for a new one, keep
your streak alive, and climb the daily leaderboard.

## How to play

- **Steer:** arrow keys / A,D · mouse · touch-drag (the cat chases your finger)
- **Score:** fish treat 10 pts, yarn ball 25 pts; every 5 pickups in a row
  raises your combo multiplier (×2, ×3, …). Getting hit resets the combo.
- **Lives:** 3. Vacuum hits also grant a brief invulnerability blink.
- **Win:** survive the full 60 seconds. Your best score of the day goes on
  the daily leaderboard; playing on consecutive days builds your streak.

## Daily loop

- `GET /api/daily` hands the client today's date key + seed, the current
  top-50 board, and the caller's standing and streak.
- Finishing a run `POST`s the score; the server keeps each player's best,
  ranks ties by earliest achievement, and records the play for the streak.
- The webview shows today's top 5, your rank, and your streak under the game.

## Tech

- **Client:** vanilla TypeScript + Canvas 2D in the Devvit webview
  (`src/client/`), bundled with esbuild into `public/`. The game engine is a
  port of our own *Rocket Cat: Moon or Rug* (same mechanics and pacing,
  reskinned; the seeded RNG now drives a dedicated spawn stream so the daily
  puzzle is exact). See "Port note" below.
- **Server:** Hono on `@devvit/web/server` (`src/server/`). Routes are built
  by a factory (`createApp`) so tests inject fakes; `index.ts` is the single
  platform hookup point (real Redis client, Devvit context user, post
  creation).
- **Storage:** a `Store` interface with two implementations — `MemoryStore`
  (local dev/tests) and `RedisStore` (production, over the Devvit Redis
  client; sorted set per day + JSON entries + streak records).
- **Shared:** day-key/seed math, streak rules and leaderboard ranking are
  pure functions in `src/shared/`, used identically by client, server and
  tests.
- **Journeys:** `permissions.journeys` is enabled in `devvit.json` and all
  event call sites (`game_boot`, `run_start`, `run_end`, `score_submitted`,
  `streak_day`, `leaderboard_view`) are wired through `src/client/journeys.ts`;
  binding the platform transport is the one marked TODO at upload time.

## Develop

```sh
npm install
npm test            # typecheck + unit tests + production build
npm run dev:local   # API on http://localhost:5173 with a fake dev player
npm run build       # client -> public/, server -> dist/server/
```

Open `public/game.html` directly to play offline (it falls back to the
locally computed daily puzzle when the API is unreachable).

## Going live (account-day checklist)

1. `devvit login` (one browser OAuth round-trip).
2. Confirm the app name **`vacuum-panic`** is still free at first
   `devvit upload` — the slug is permanent once uploaded. (Fallbacks:
   `vacuum-panic-game`, `daily-vacuum-panic`.)
3. `npm run upload` — runs the full test suite, then uploads. Do **not**
   publish; the contest wants the app unlisted with a playtest post.
4. The install trigger / subreddit menu item creates the demo post; make the
   auto-created playtest subreddit public (or install dr-admin-approve) so
   judges can open the demo post.
5. Bind the Journeys transport in `src/client/journeys.ts` and verify the
   events land.
6. Submit on Devpost with the app listing link + demo post link before
   **2026-12-09 10:00 CST** (internal deadline 2026-12-06).

## Port note

Vacuum Panic! is a port of **Rocket Cat: Moon or Rug**, our own earlier game
(built for make.fun's best-game-01, Nov 2026), re-themed from crypto candles
to a living-room cat dash and substantially extended for this contest: a
date-seeded daily puzzle with a dedicated spawn stream, a server-side daily
leaderboard, play streaks, and Devvit Journeys instrumentation.
