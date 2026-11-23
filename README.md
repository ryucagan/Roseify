# 🌹 Roseify

A fan-made stats app for **League of Legends**, built on Riot's official API. **Valorant** support is coming soon.
It has no npm dependencies. You only need Node.js 18 or newer.

> Roseify isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

## Features

### League of Legends
- **Player profiles:** look up anyone by Riot ID to see their level, Solo and Flex rank with LP and win rate, and top champion mastery
- **Match history for every mode,** with items, spells, runes, KP and CS/min. Expand a match to see the full scoreboard. Arena games show placement, augments and duos.
- **Live game:** both teams' champions, spells, runes, ranks and each player's most-played champions. Profiles show an "In game" badge when the player is in a match.
- **Builds and tier list for every game mode:** Ranked Solo/Duo, Flex, Normal Draft, Swiftplay, ARAM, Arena and rotating modes when they're live
  - Filter the tier list by lane (Top, Jungle, Mid, Bot, Support)
  - Full rune trees, with the most popular rune pages you can switch between. **The item build changes with the rune page you pick.**
  - A recommended 6-item build, long builds actually seen in games, core items, boots, support items and 4th–6th item options
  - Skill max order and a level 1–15 grid, plus summoner spells and starting items
  - **Matchups and synergy:** counters, good matchups and best teammates (best duo partners in Arena)
  - Augments with top-4 rates and average placement for Arena

### Valorant (coming soon)
Match history with ACS, ADR, K/D and hit locations (head, body, legs), player lookup, and agent pick and win rates per act, map and rank. The code is already in the project. It needs a Riot production key with Valorant access, and players will sign in with their Riot account (RSO) to share their matches. Until then, `npm run demo` shows what it will look like.

## Quick start

```bash
cd roseify
npm run demo          # works right away with generated sample data
# open http://localhost:3000
```

For real data:

1. Get a key at https://developer.riotgames.com
2. Copy `.env.example` to `.env` and paste the key into `RIOT_API_KEY`. Set `LOL_PLATFORM` to your server (for example `euw1`, `na1`, `tr1`).
3. Run `npm start`
4. Open **Settings** in the app and enter your Riot ID.

## Stats crawler (builds and tier list)

Riot's API has **no endpoint for pick rates or builds**. Stats sites calculate them by sampling large numbers of matches. Roseify's crawler does the same on a smaller scale:

```bash
npm run crawl:lol -- --platform euw1                        # every live mode, about 150 matches each
npm run crawl:lol -- --platform euw1 --per-queue 1000       # bigger, more accurate sample
npm run crawl:lol -- --platform euw1 --queues 420,440       # only Ranked Solo and Flex
npm run crawl:lol -- --platform euw1 --queues 450,1750      # only ARAM and Arena
npm run crawl:lol -- --no-timeline                          # about 2x faster, but no buy order or skill order
```

- The crawler starts from Challenger, Grandmaster and Master players, then expands to the players it meets in their matches. It keeps only the current patch and starts fresh stats when a new patch comes out. Modes that aren't live are skipped.
- Progress is saved as it goes. Press Ctrl+C at any time and run it again to continue.
- The app reloads the stats automatically, so you don't need to restart it.
- With a dev or personal key (100 requests every 2 minutes), expect roughly 10–20 matches per minute with timelines.

### Rebuilding stats without crawling again
Every downloaded match is saved in `cache/`. After the stats code changes, recalculate everything from the saved matches. This makes no API calls and needs no key:
```bash
npm run rebuild:lol -- --platform euw1
```

### A note on sample size
Win rates need a lot of games to be reliable: with about 30 games, a win rate can be off by ±18% just by chance. Popular champions' items and runes become clear quickly, but rare champions, counters and 2nd–4th rune pages need far bigger samples. The app shows game counts everywhere, so check them before trusting a number.

## Riot API keys

- **Dev keys** expire every 24 hours. Paste a fresh one into `.env` and restart.
- **Personal keys** don't expire, but they're only for personal and small-group use.
- **Production keys** are needed for a public website and for Valorant match data.

## Project layout

```
server/
  index.js     HTTP server and API routes
  riot.js      Riot client: rate limiter, 429 retry, cache (matches are cached permanently on disk)
  lol.js       LoL profiles, match history and live games
  lolagg.js    build aggregation: runes, items per rune page, skills, augments, matchups
  val.js       Valorant profile, match history, hit locations, first kills
  valagg.js    agent stat aggregation (overall, per map, per rank)
  static.js    Data Dragon, CommunityDragon and valorant-api.com data (names and images)
  demo.js      fake Riot-shaped data that runs through the real code paths
crawler/
  lol-builds.js   League match crawler
  rebuild.js      recalculate stats from cached matches
  val-agents.js   Valorant agent stats crawler
public/        the web app (vanilla JS, no framework)
data/          generated stats (not in the repo)
cache/         downloaded matches (not in the repo)
```

## Roadmap
- Desktop app (Electron) with a champ select helper, rune and item import into the League client, and custom games in your match history
- Sample-size warnings in the tier list
- A faster crawler for casual modes
- Valorant support with Riot Sign On
