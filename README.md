# Roseify

A Blitz-style stats app for **Valorant** and **League of Legends**, built on Riot's official API.
There are no npm dependencies. You only need Node.js 18 or newer.

## Features

**Valorant**
- Your match history: result, score, K/D/A, ACS, ADR, HS%, first kills
- Expand any match to see the full scoreboard, with every player's rank, ACS, ADR and HS%
- Accuracy panel with head, body and leg hit percentages
- Agent and map breakdowns over the matches you've loaded
- Look up any player by Riot ID. Clicking a name in a scoreboard opens that player's profile.
- **Agent stats** for the current act: pick rate, win rate, K/D, ACS, ADR, HS% and FK/round. You can filter by map, rank and role.

**League of Legends**
- Profile: level, Solo and Flex rank with LP and win rate, top mastery
- Match history for every mode, with items, spells, runes, KP and CS/min. Arena games show placement and augments.
- Expand any match to see the full scoreboard. Arena games are grouped by duo.
- Look up any player by Riot ID
- **Builds and tier list for every game mode**: Ranked Solo/Duo, Flex, Normal Draft, Quickplay, Swiftplay, ARAM, ARAM: Mayhem, Arena, URF/ARURF, One for All, Nexus Blitz, Ultimate Spellbook, Brawl, plus any rotating mode that's live. Each build shows:
  - runes (most popular page plus alternatives), summoner spells, starting items
  - core build path in purchase order, boots, other popular items
  - skill max order and a level 1–15 grid
  - augments with win/top-4 rates (Arena and Mayhem), and average placement (Arena)
  - per-role builds on Summoner's Rift

## Quick start

```bash
cd gglens
npm run demo          # works right away with generated sample data
# open http://localhost:3000
```

For real data:

1. Get a key at https://developer.riotgames.com
2. Copy `.env.example` to `.env` and paste the key into `RIOT_API_KEY`. Set `LOL_PLATFORM` (Turkey is `tr1`) and `VAL_SHARD` (`eu`).
3. Run `npm start`
4. Open **Settings** in the app and enter your Riot IDs.

## Stats crawlers (builds, tier list, agent pick rates)

Riot's API has **no endpoint for pick rates or builds**. Blitz, U.GG and similar sites calculate them by sampling large numbers of matches. The two crawlers do the same thing on a smaller scale:

```bash
npm run crawl:lol                            # every mode, about 150 matches each
npm run crawl:lol -- --per-queue 500         # bigger and more accurate sample
npm run crawl:lol -- --queues 450,1750,2400  # only ARAM, Arena and Mayhem
npm run crawl:lol -- --no-timeline           # half the requests, but no item order or skill order

npm run crawl:val                            # 500 competitive matches, current act
npm run crawl:val -- --matches 2000 --shard eu
```

- The LoL crawler starts from Challenger, Grandmaster and Master players, then expands to the players it meets in their matches. It keeps only the current patch and resets automatically when a new patch comes out. Modes that aren't live get skipped.
- Progress is saved as it goes. You can press Ctrl+C at any time and run the crawler again to continue.
- The server reloads the output files automatically, so you don't need to restart it.
- A dev or personal key allows 100 requests every 2 minutes, which works out to roughly 25 matches per minute with timelines. Leave the crawler running, or apply for a production key for higher limits.

### Rebuilding stats without crawling again
Every match the crawler downloads is saved in `cache/`. After an update to the stats code, for example when new matchup data is added, recalculate everything from the saved matches. This makes no API calls and needs no key:
```bash
npm run rebuild:lol -- --platform euw1
```

## ⚠️ Riot API key limitations

| Feature | Dev / personal key | Production key |
|---|---|---|
| LoL profiles, match history, builds | ✅ | ✅ |
| Valorant account lookup | ✅ | ✅ |
| **Valorant match history and agent stats** | ❌ | ✅ (needs Valorant access approval) |

Riot only gives `VAL-MATCH-V1` access to **approved production applications**. Until you have one, the Valorant pages show a clear "Forbidden" message, and demo mode shows what they'll look like. You can apply on the developer portal by registering a product with a working prototype. This app can serve as that prototype.

Dev keys also **expire every 24 hours**, so you'll need to paste a fresh one into `.env` each day.

A note on accuracy: Riot's data includes *where* each shot hit (head, body, legs) but not how many shots were fired. So "accuracy" here means hit distribution, the same thing Blitz and tracker.gg show.

## Project layout

```
server/
  index.js     HTTP server and API routes
  riot.js      Riot client: rate limiter, 429 retry, cache (matches are cached permanently on disk)
  lol.js       LoL profile and match history
  val.js       Valorant profile, match history, hit locations, first kills
  lolagg.js    build aggregation (runes, items, skills, augments) for every queue
  valagg.js    agent stat aggregation (overall, per map, per rank)
  static.js    Data Dragon, CommunityDragon and valorant-api.com data (names and images)
  demo.js      fake Riot-shaped data that runs through the real code paths
crawler/
  lol-builds.js, val-agents.js
public/        the web app (vanilla JS)
data/          crawler output
cache/         API cache (safe to delete)
```

## Ideas for next steps
- Wrap it in **Electron** to make a desktop app like Blitz, and use the League client's local LCU API for live champ select and auto-importing runes
- Add a database (SQLite) and a scheduled crawler for bigger samples
- Add rank filters for League builds (Emerald+, Diamond+ and so on), using `league-v4` entries
