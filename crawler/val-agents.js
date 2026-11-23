#!/usr/bin/env node
// Samples recent Valorant matches for the current act and builds agent stats
// (pick rate, win rate, K/D, ACS, ADR, HS%) overall, per map and per rank.
// Requires a PRODUCTION key with Valorant access (Riot does not give VAL-MATCH to dev keys).
//
//   npm run crawl:val                          # 500 competitive matches on your default shard
//   npm run crawl:val -- --shard na --matches 2000
//   npm run crawl:val -- --queue unrated
const fs = require('fs');
const path = require('path');
const cfg = require('../server/config');
const { riotGet, sleep } = require('../server/riot');
const val = require('../server/val');
const agg = require('../server/valagg');
const parseArgs = require('./args');

const args = parseArgs();
const shard = args.shard || cfg.valShard;
const queue = args.queue || 'competitive';
const target = Number(args.matches) || 500;
const RAW = path.join(cfg.dataDir, `val-raw-${shard}-${queue}.json`);
const OUT = path.join(cfg.dataDir, 'val-agents.json');

if (!cfg.apiKey) { console.error('Set RIOT_API_KEY in .env first.'); process.exit(1); }

async function main() {
  const act = await val.activeAct(shard);
  if (!act) throw new Error('Could not find the active act from val-content-v1.');
  console.log(`Roseify Valorant crawler | ${shard} | ${queue} | ${act.episode} ${act.name} | target ${target}`);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(RAW, 'utf8')); } catch {}
  if (!raw || raw.act?.id !== act.id || args.reset) raw = agg.newRaw(act, queue);
  const seen = new Set(raw.seen);
  const save = () => {
    raw.seen = [...seen].slice(-50000);
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    fs.writeFileSync(RAW, JSON.stringify(raw));
    fs.writeFileSync(OUT, JSON.stringify(agg.finalize(raw, { shard })));
  };
  process.on('SIGINT', () => { console.log('\nSaving...'); save(); process.exit(0); });

  let added = 0;
  while (raw.matches < target) {
    const recent = await riotGet(shard, `/val/match/v1/recent-matches/by-queue/${queue}`, { ttl: 0 });
    const ids = (recent.matchIds || []).filter(id => !seen.has(id));
    if (!ids.length) { console.log('  waiting for new matches...'); await sleep(60e3); continue; }
    for (const id of ids) {
      if (raw.matches >= target) break;
      seen.add(id);
      let m;
      try { m = await riotGet(shard, `/val/match/v1/matches/${id}`, { permanent: true }); } catch (e) { if (e.status === 403) throw e; continue; }
      if (m.matchInfo?.seasonId && m.matchInfo.seasonId !== act.id) continue;
      if (!m.matchInfo?.isCompleted && m.matchInfo?.isCompleted !== undefined) continue;
      if (agg.addMatch(raw, val.summarizeMatch(m))) added++;
      if (added && added % 20 === 0) { save(); console.log(`  ${raw.matches}/${target} matches`); }
    }
  }
  save();
  console.log(`Done. ${raw.matches} matches in ${act.name}. Output: data/val-agents.json`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
