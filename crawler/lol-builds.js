#!/usr/bin/env node
// Collects League matches from high-elo players and aggregates champion builds
// for EVERY game mode (ranked, normals, ARAM, Arena, URF, One for All, Mayhem...).
//
//   npm run crawl:lol                         # all known modes, 150 matches each
//   npm run crawl:lol -- --per-queue 400      # bigger sample
//   npm run crawl:lol -- --queues 450,1750    # only ARAM + Arena
//   npm run crawl:lol -- --platform euw1 --no-timeline
//
// Progress is saved to data/lol-raw.json, so you can stop (Ctrl+C) and resume.
const fs = require('fs');
const path = require('path');
const cfg = require('../server/config');
const { riotGet } = require('../server/riot');
const { regionFor } = require('../server/lol');
const { lolStatic } = require('../server/static');
const agg = require('../server/lolagg');
const parseArgs = require('./args');

const ALL_QUEUES = [420, 440, 400, 490, 480, 450, 1750, 1700, 2400, 900, 1900, 1020, 1300, 1400, 2300];
const args = parseArgs();
const platform = args.platform || cfg.lolPlatform;
const region = regionFor(platform);
const perQueue = Number(args['per-queue']) || 150;
const queues = args.queues && args.queues !== 'all' ? String(args.queues).split(',').map(Number) : ALL_QUEUES;
const useTimeline = !args['no-timeline'];
const days = Number(args.days) || 10;
const RAW = path.join(cfg.dataDir, 'lol-raw.json');

if (!cfg.apiKey) { console.error('Set RIOT_API_KEY in .env first.'); process.exit(1); }

function load() {
  if (args.reset) return agg.newRaw();
  try { return JSON.parse(fs.readFileSync(RAW, 'utf8')); } catch { return agg.newRaw(); }
}
let raw = load();
const seen = new Set(raw.seen);
let stat;

function save() {
  raw.seen = [...seen].slice(-60000);
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  fs.writeFileSync(RAW, JSON.stringify(raw));
  const { index, details } = agg.finalize(raw, stat);
  index.platform = platform;
  fs.writeFileSync(path.join(cfg.dataDir, 'lol-builds-details.json'), JSON.stringify(details));
  fs.writeFileSync(path.join(cfg.dataDir, 'lol-builds.json'), JSON.stringify(index));
}

const count = q => raw.queues[q]?.matches || 0;

async function seedPlayers() {
  const out = [];
  for (const tier of ['challengerleagues', 'grandmasterleagues', 'masterleagues']) {
    try {
      const l = await riotGet(platform, `/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`, { ttl: 0 });
      for (const e of l.entries || []) if (e.puuid) out.push(e.puuid);
      console.log(`  seeded ${tier}: ${l.entries?.length || 0}`);
    } catch (e) { console.warn(`  ${tier}: ${e.message}`); }
    if (out.length > 1500) break;
  }
  return out.sort(() => Math.random() - 0.5);
}

async function main() {
  stat = await lolStatic();
  console.log(`Roseify LoL crawler | ${platform} (${region}) | modes: ${queues.join(',')} | ${perQueue}/mode | timelines: ${useTimeline}`);
  const players = await seedPlayers();
  if (!players.length) throw new Error('Could not load any seed players (check key/platform).');
  const queued = new Set(players);
  const misses = Object.fromEntries(queues.map(q => [q, 0]));
  let active = queues.filter(q => count(q) < perQueue);
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  let added = 0, qi = 0;

  process.on('SIGINT', () => { console.log('\nSaving...'); save(); process.exit(0); });

  while (active.length && players.length) {
    const q = active[qi++ % active.length];
    const puuid = players.shift();
    let ids = [];
    try { ids = await riotGet(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=20&startTime=${since}&queue=${q}`, { ttl: 0 }); }
    catch (e) { console.warn('  ids:', e.message); continue; }
    const fresh = ids.filter(id => !seen.has(id));
    if (!fresh.length) {
      if (++misses[q] >= 40 && count(q) === 0) {
        console.log(`  - ${stat.queues[q] || q}: no recent games found, mode probably not live. Skipping.`);
        active = active.filter(x => x !== q);
      }
      continue;
    }
    misses[q] = 0;
    for (const id of fresh.slice(0, 6)) {
      seen.add(id);
      let m;
      try { m = await riotGet(region, `/lol/match/v5/matches/${id}`, { permanent: true }); } catch { continue; }
      const patch = agg.patchOf(m.info.gameVersion);
      if (!raw.patch || (agg.cmpPatch(patch, raw.patch) > 0 && !args['any-patch'])) {
        if (raw.patch) console.log(`  New patch ${patch} detected — starting fresh stats.`);
        raw = { ...agg.newRaw(), patch }; active = queues.slice();
      } else if (agg.cmpPatch(patch, raw.patch) < 0 && !args['any-patch']) continue;
      const qid = m.info.queueId;
      if (count(qid) >= perQueue * 1.5) continue;
      let tl = null;
      if (useTimeline) { try { tl = await riotGet(region, `/lol/match/v5/matches/${id}/timeline`, { permanent: true }); } catch {} }
      if (!agg.addMatch(raw, m, tl, stat)) continue;
      added++;
      for (const p of m.info.participants) if (!queued.has(p.puuid) && queued.size < 20000) { queued.add(p.puuid); players.push(p.puuid); }
      if (added % 10 === 0) {
        save();
        console.log(`  +${added} | ` + queues.filter(x => count(x)).map(x => `${stat.queues[x] || x}: ${count(x)}`).join(' | '));
      }
    }
    active = active.filter(x => count(x) < perQueue);
  }
  save();
  console.log(`Done. ${added} new matches. Patch ${raw.patch}. Output: data/lol-builds.json`);
}

main().catch(e => { console.error(e.message); try { save(); } catch {} process.exit(1); });
