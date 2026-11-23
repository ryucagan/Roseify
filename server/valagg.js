// Aggregates Valorant matches into per-act agent stats (pick rate, win rate, K/D,
// ACS, ADR, HS%) overall, per map and per rank group.
const RANK_GROUPS = ['Unranked', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
const rankGroup = tier => (tier < 3 ? 0 : Math.min(9, Math.floor(tier / 3)));

function newRaw(act, queue) {
  return { act, queue, matches: 0, seen: [], maps: {}, rankSlots: {}, agents: {} };
}

/** m = summarized match (from val.js summarizeMatch) */
function addMatch(raw, m) {
  if (m.players.length < 2) return false;
  raw.matches++;
  raw.maps[m.map] = (raw.maps[m.map] || 0) + 1;
  const wonBy = Object.fromEntries(m.teams.map(t => [t.id, t.won]));
  for (const p of m.players) {
    const g = rankGroup(p.tier);
    raw.rankSlots[g] = (raw.rankSlots[g] || 0) + 1;
    const A = raw.agents[p.agent] || (raw.agents[p.agent] = { p: 0, w: 0, r: 0, k: 0, d: 0, a: 0, s: 0, dmg: 0, hs: 0, bs: 0, ls: 0, fk: 0, maps: {}, ranks: {} });
    const win = !!wonBy[p.team];
    A.p++; if (win) A.w++;
    A.r += p.rounds; A.k += p.k; A.d += p.d; A.a += p.a; A.s += p.score;
    A.dmg += p.dmg; A.hs += p.hs; A.bs += p.bs; A.ls += p.ls; A.fk += p.fk;
    const M = A.maps[m.map] || (A.maps[m.map] = [0, 0]); M[0]++; if (win) M[1]++;
    const R = A.ranks[g] || (A.ranks[g] = [0, 0]); R[0]++; if (win) R[1]++;
  }
  return true;
}

function finalize(raw, extra = {}) {
  const teams = raw.matches * 2 || 1;
  const agents = Object.entries(raw.agents).map(([id, A]) => {
    const shots = A.hs + A.bs + A.ls || 1;
    const maps = {};
    for (const [mid, [p, w]] of Object.entries(A.maps)) maps[mid] = { picks: p, pickRate: p / ((raw.maps[mid] || 1) * 2), winRate: w / p };
    const ranks = {};
    for (const [g, [p, w]] of Object.entries(A.ranks)) ranks[g] = { picks: p, pickRate: p / ((raw.rankSlots[g] || 1) / 5), winRate: w / p };
    return {
      id, picks: A.p, pickRate: A.p / teams, winRate: A.w / A.p,
      kd: A.k / Math.max(1, A.d), kda: (A.k + A.a) / Math.max(1, A.d),
      acs: A.s / Math.max(1, A.r), adr: A.dmg / Math.max(1, A.r), kpr: A.k / Math.max(1, A.r),
      fkpr: A.fk / Math.max(1, A.r), hs: A.hs / shots, bs: A.bs / shots, ls: A.ls / shots, maps, ranks,
    };
  }).sort((a, b) => b.pickRate - a.pickRate);
  return {
    act: raw.act, queue: raw.queue, matches: raw.matches, generatedAt: Date.now(),
    maps: Object.entries(raw.maps).map(([id, n]) => ({ id, matches: n })).sort((a, b) => b.matches - a.matches),
    rankGroups: RANK_GROUPS, agents, ...extra,
  };
}

module.exports = { newRaw, addMatch, finalize, RANK_GROUPS, rankGroup };
