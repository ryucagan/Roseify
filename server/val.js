// Valorant: account lookup, shard detection, match history with accuracy stats.
// NOTE: Riot only serves VAL-MATCH-V1 to approved production keys.
const { riotGet, getAccountByRiotId } = require('./riot');
const cfg = require('./config');

const SHARDS = ['eu', 'na', 'ap', 'kr', 'br', 'latam'];
const SHARD_ACCOUNT_REGION = { eu: 'europe', na: 'americas', br: 'americas', latam: 'americas', ap: 'asia', kr: 'asia' };

async function profile(riotId, shardHint) {
  const hint = SHARDS.includes(shardHint) ? shardHint : cfg.valShard;
  const region = SHARD_ACCOUNT_REGION[hint] || 'europe';
  const account = await getAccountByRiotId(riotId, region);
  let shard = hint;
  try {
    const s = await riotGet(region, `/riot/account/v1/active-shards/by-game/val/by-puuid/${account.puuid}`, { ttl: 3600e3 });
    if (s?.activeShard) shard = s.activeShard;
  } catch {}
  return { account: { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine }, shard };
}

function summarizeMatch(m) {
  const info = m.matchInfo;
  const per = {};
  for (const p of m.players) per[p.puuid] = { dmg: 0, hs: 0, bs: 0, ls: 0, fk: 0, fd: 0, plants: 0, defuses: 0 };
  for (const r of m.roundResults || []) {
    let first = null;
    if (r.bombPlanter && per[r.bombPlanter]) per[r.bombPlanter].plants++;
    if (r.bombDefuser && per[r.bombDefuser]) per[r.bombDefuser].defuses++;
    for (const ps of r.playerStats || []) {
      const s = per[ps.puuid]; if (!s) continue;
      for (const d of ps.damage || []) {
        if (d.receiver === ps.puuid) continue;
        s.dmg += d.damage || 0; s.hs += d.headshots || 0; s.bs += d.bodyshots || 0; s.ls += d.legshots || 0;
      }
      for (const k of ps.kills || []) {
        if (!first || k.timeSinceRoundStartMillis < first.timeSinceRoundStartMillis) first = k;
      }
    }
    if (first) { if (per[first.killer]) per[first.killer].fk++; if (per[first.victim]) per[first.victim].fd++; }
  }
  const players = m.players.filter(p => p.teamId !== 'Neutral' && p.characterId).map(p => ({
    puuid: p.puuid, name: p.gameName, tag: p.tagLine, team: p.teamId, party: p.partyId,
    agent: String(p.characterId).toLowerCase(), tier: p.competitiveTier || 0,
    k: p.stats?.kills || 0, d: p.stats?.deaths || 0, a: p.stats?.assists || 0,
    score: p.stats?.score || 0, rounds: p.stats?.roundsPlayed || (m.roundResults || []).length || 1,
    ...per[p.puuid],
  }));
  return {
    id: info.matchId, map: info.mapId, queue: info.queueId || '', ranked: !!info.isRanked,
    start: info.gameStartMillis, duration: Math.round((info.gameLengthMillis || 0) / 1000), season: info.seasonId,
    rounds: (m.roundResults || []).length,
    teams: (m.teams || []).map(t => ({ id: t.teamId, won: !!t.won, rounds: t.roundsWon || 0, points: t.numPoints || 0 })),
    players,
  };
}

async function matches(puuid, shard, start = 0, count = 10, queue = '') {
  const list = await riotGet(shard, `/val/match/v1/matchlists/by-puuid/${encodeURIComponent(puuid)}`, { ttl: 60e3 });
  let hist = (list.history || []).sort((a, b) => b.gameStartTimeMillis - a.gameStartTimeMillis);
  if (queue) hist = hist.filter(h => h.queueId === queue);
  const slice = hist.slice(Number(start), Number(start) + Math.min(Number(count) || 10, 20));
  const out = await Promise.all(slice.map(h =>
    riotGet(shard, `/val/match/v1/matches/${h.matchId}`, { permanent: true })
      .then(m => (m.players || []).some(p => p.puuid === puuid) ? m : riotGet(shard, `/val/match/v1/matches/${h.matchId}`, { permanent: true, fresh: true }))
      .then(summarizeMatch).catch(() => null)));
  return { matches: out.filter(Boolean), hasMore: Number(start) + slice.length < hist.length };
}

async function activeAct(shard) {
  const c = await riotGet(shard, '/val/content/v1/contents?locale=en-US', { ttl: 3600e3 });
  const acts = c.acts || [];
  const act = acts.find(a => a.isActive && String(a.type).toLowerCase() === 'act') || acts.find(a => a.isActive && !a.isEpisode);
  const ep = act && acts.find(a => a.id === act.parentId);
  return act ? { id: act.id, name: act.name, episode: ep?.name || '' } : null;
}

module.exports = { profile, matches, summarizeMatch, activeAct, SHARDS };
