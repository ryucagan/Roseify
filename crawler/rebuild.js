#!/usr/bin/env node
// Rebuilds all League build stats from the matches already saved in cache/ —
// no Riot API calls, no key needed. Use it after the stats code changes
// (e.g. new matchup data) instead of crawling again.
//
//   npm run rebuild:lol                    # matches from your LOL_PLATFORM, latest patch
//   npm run rebuild:lol -- --platform euw1
const fs = require('fs');
const path = require('path');
const cfg = require('../server/config');
const { lolStatic } = require('../server/static');
const agg = require('../server/lolagg');
const parseArgs = require('./args');

const args = parseArgs();
const platform = (args.platform || cfg.lolPlatform).toUpperCase();
const dir = path.join(cfg.cacheDir, 'riot');

function* files(d) {
  let entries = [];
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) yield* files(f); else if (e.name.endsWith('.json')) yield f;
  }
}
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

async function main() {
  const stat = await lolStatic();
  console.log(`Scanning cached matches for ${platform}...`);
  // pass 1: find matches + timelines and the newest patch (light: only keeps file paths)
  const matchFiles = new Map(), timelineFiles = new Map();
  let newest = '';
  let scanned = 0;
  for (const f of files(dir)) {
    const d = read(f); scanned++;
    const id = d?.metadata?.matchId;
    if (!id || !id.startsWith(platform + '_')) continue;
    if (d.info?.frames) { timelineFiles.set(id, f); continue; }
    if (!d.info?.participants) continue;
    matchFiles.set(id, f);
    const p = agg.patchOf(d.info.gameVersion);
    if (!newest || agg.cmpPatch(p, newest) > 0) newest = p;
    if (scanned % 2000 === 0) process.stdout.write(`  scanned ${scanned} files\r`);
  }
  if (!matchFiles.size) { console.log(`No cached ${platform} matches found in ${dir}.`); return; }
  const patch = args.patch || newest;
  console.log(`Found ${matchFiles.size} matches (${timelineFiles.size} timelines). Using patch ${patch}.`);

  // pass 2: aggregate
  const raw = { ...agg.newRaw(), patch };
  let used = 0;
  for (const [id, f] of matchFiles) {
    const m = read(f);
    if (!m || agg.patchOf(m.info.gameVersion) !== patch) continue;
    const tl = timelineFiles.has(id) ? read(timelineFiles.get(id)) : null;
    if (agg.addMatch(raw, m, tl, stat)) used++;
    raw.seen.push(id);
    if (used % 200 === 0) process.stdout.write(`  processed ${used}\r`);
  }
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  fs.writeFileSync(path.join(cfg.dataDir, 'lol-raw.json'), JSON.stringify(raw));
  const { index, details } = agg.finalize(raw, stat);
  index.platform = platform.toLowerCase();
  fs.writeFileSync(path.join(cfg.dataDir, 'lol-builds-details.json'), JSON.stringify(details));
  fs.writeFileSync(path.join(cfg.dataDir, 'lol-builds.json'), JSON.stringify(index));
  console.log(`Done. Rebuilt stats from ${used} matches: ` + index.queues.map(q => `${q.name} ${q.matches}`).join(' | '));
}

main().catch(e => { console.error(e); process.exit(1); });
