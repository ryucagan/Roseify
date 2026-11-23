// Demo mode: generates realistic fake Riot API payloads (same shape as match-v5,
// match timelines and val-match-v1), then runs them through the REAL summarize and
// aggregation code. So the UI, the summaries and the build aggregation all get
// exercised without an API key.
const FB = require('./fallback');
const lolagg = require('./lolagg');
const valagg = require('./valagg');
const lol = require('./lol');
const val = require('./val');

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const NAMES = ['Kuzey', 'Atlas', 'Nova', 'Mert', 'Shadow', 'Ece', 'Kaan', 'Luna', 'Riven Main', 'Baran', 'Zeynep', 'Toprak', 'Deniz', 'Pixel', 'Arda', 'Mira', 'Efe', 'Ghost', 'Selin', 'Onur'];
const TAGS = ['TR1', 'EUW', '0001', 'GG', 'TR', '7777', 'MID', 'ACE'];
const fakePlayer = r => ({ name: pick(r, NAMES) + (r() < 0.4 ? int(r, 1, 99) : ''), tag: pick(r, TAGS) });
const puuidOf = (name, tag) => 'demo-' + hash(name.toLowerCase() + '#' + tag.toLowerCase()).toString(36);

// ---------------- League ----------------
const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
const champsByRole = role => FB.CHAMPS.filter(c => FB.ROLE_FOR_CLASS[c[3]] === role || (role === 'JUNGLE' && ['LeeSin', 'Viego', 'Kayn', 'Graves'].includes(c[0])));

function fakeParticipant(r, pid, champ, team, role, opts) {
  const cls = champ[3];
  const set = FB.ITEM_SETS[cls];
  const page = FB.RUNE_PAGES[cls];
  const coreOrder = [...set.core].sort(() => r() - 0.45);
  const nItems = Math.min(5, Math.max(1, Math.round(opts.minutes / 6.5)));
  const completed = coreOrder.slice(0, nItems);
  const boots = opts.arena ? null : pick(r, set.boots);
  const finalItems = [...completed]; if (boots) finalItems.splice(1, 0, boots);
  while (finalItems.length < 6) finalItems.push(0);
  const k = int(r, 0, 14), d = int(r, 0, 11), a = int(r, 0, 18);
  const spells = opts.arena ? [4, 0] : opts.aram ? [4, pick(r, [32, 7, 21, 14])] : role === 'JUNGLE' ? [4, 11] : role === 'TOP' ? [4, pick(r, [12, 14])] : role === 'BOTTOM' ? [4, pick(r, [7, 21])] : [4, pick(r, [14, 3, 12])];
  const runeVariant = r() < 0.2;
  const p = {
    participantId: pid, puuid: opts.puuid, riotIdGameName: opts.name, riotIdTagline: opts.tag,
    championName: champ[0], championId: champ[1], champLevel: opts.arena ? int(r, 14, 18) : int(r, 9, 18), teamId: team,
    teamPosition: opts.aram || opts.arena ? '' : role, win: opts.win,
    kills: k, deaths: d, assists: a,
    totalMinionsKilled: role === 'UTILITY' || opts.arena ? int(r, 0, 40) : int(r, 4, 9) * opts.minutes, neutralMinionsKilled: role === 'JUNGLE' ? int(r, 4, 6) * opts.minutes : 0,
    goldEarned: opts.minutes * int(r, 300, 480), totalDamageDealtToChampions: opts.minutes * int(r, 450, 1300), totalDamageTaken: opts.minutes * int(r, 500, 1200),
    visionScore: role === 'UTILITY' ? int(r, 30, 90) : int(r, 5, 35), wardsPlaced: int(r, 2, 30),
    item0: finalItems[0], item1: finalItems[1], item2: finalItems[2], item3: finalItems[3], item4: finalItems[4], item5: finalItems[5],
    item6: opts.arena ? 0 : role === 'UTILITY' ? 3364 : 3340,
    summoner1Id: spells[0], summoner2Id: spells[1],
    perks: opts.arena ? { styles: [] } : {
      statPerks: { offense: page[4][0], flex: page[4][1], defense: page[4][2] },
      styles: [
        { style: page[0], selections: (runeVariant ? [page[1][0], page[1][2], page[1][1], page[1][3]] : page[1]).map(perk => ({ perk })) },
        { style: page[2], selections: page[3].map(perk => ({ perk })) },
      ],
    },
    largestMultiKill: k > 8 ? int(r, 2, 4) : int(r, 1, 2), gameEndedInEarlySurrender: false,
  };
  if (opts.arena || opts.augments) {
    const augIds = Object.keys(FB.AUGMENTS).map(Number).sort(() => r() - 0.5);
    for (let n = 1; n <= 6; n++) p['playerAugment' + n] = n <= (opts.arena ? 4 : 3) ? augIds[n - 1] : 0;
  }
  if (opts.arena) { p.playerSubteamId = opts.sub; p.placement = opts.place; p.subteamPlacement = opts.place; }
  // timeline events
  const ev = [];
  if (!opts.arena) set.start.forEach(id => ev.push({ type: 'ITEM_PURCHASED', participantId: pid, itemId: id, timestamp: int(r, 1000, 30000) }));
  let t = 300e3;
  if (boots) { ev.push({ type: 'ITEM_PURCHASED', participantId: pid, itemId: 1001, timestamp: t }); }
  completed.forEach((id, i) => { t += int(r, 240e3, 420e3); ev.push({ type: 'ITEM_PURCHASED', participantId: pid, itemId: id, timestamp: t }); if (i === 0 && boots) ev.push({ type: 'ITEM_PURCHASED', participantId: pid, itemId: boots, timestamp: t + 60e3 }); });
  const maxFirst = cls === 'marksman' || cls === 'mage' ? 'Q' : cls === 'tank' ? 'W' : 'Q';
  const second = maxFirst === 'Q' ? (r() < 0.7 ? 'E' : 'W') : 'Q';
  const third = ['Q', 'W', 'E'].find(x => x !== maxFirst && x !== second);
  const seq = ['Q', 'W', 'E'].sort(() => r() - 0.5);
  const cnt = { Q: 1, W: 1, E: 1, R: 0 };
  for (let lvl = 4; lvl <= 18; lvl++) {
    let s;
    if ([6, 11, 16].includes(lvl)) s = 'R';
    else s = cnt[maxFirst] < 5 ? maxFirst : cnt[second] < 5 ? second : third;
    cnt[s]++; seq.push(s);
  }
  seq.forEach((s, i) => ev.push({ type: 'SKILL_LEVEL_UP', participantId: pid, skillSlot: 'QWER'.indexOf(s) + 1, levelUpType: 'NORMAL', timestamp: i * 60e3 }));
  return { p, ev };
}

function fakeLolMatch(seed, queueId, me) {
  const r = rng(seed);
  const arena = queueId === 1700;
  const aram = [450, 2400, 720].includes(queueId);
  const minutes = arena ? int(r, 18, 26) : aram ? int(r, 15, 24) : queueId === 900 ? int(r, 14, 22) : int(r, 22, 38);
  const parts = []; const events = [];
  const used = new Set();
  const take = role => { let c; for (let i = 0; i < 20; i++) { c = pick(r, role ? champsByRole(role) : FB.CHAMPS); if (!used.has(c[1])) break; } used.add(c[1]); return c; };
  const blueWins = r() < 0.5;
  const meSlot = int(r, 0, arena ? 15 : 9);
  const n = arena ? 16 : 10;
  const places = arena ? [1, 2, 3, 4, 5, 6, 7, 8].sort(() => r() - 0.5) : [];
  for (let i = 0; i < n; i++) {
    const team = arena ? 100 : i < 5 ? 100 : 200;
    const role = arena || aram ? '' : ROLES[i % 5];
    const isMe = me && i === meSlot;
    const pl = isMe ? { name: me.name, tag: me.tag } : fakePlayer(r);
    const sub = arena ? Math.floor(i / 2) + 1 : 0;
    const place = arena ? places[sub - 1] : 0;
    const win = arena ? place <= 4 : (team === 100) === blueWins;
    const { p, ev } = fakeParticipant(r, i + 1, take(role || null), team, role, {
      minutes, win, arena, aram, augments: queueId === 2400, sub, place,
      puuid: isMe ? me.puuid : puuidOf(pl.name, pl.tag + i), name: pl.name, tag: pl.tag,
    });
    parts.push(p); events.push(...ev);
  }
  const start = Date.now() - seed % 1000 * 3600e3 / 7 - 3600e3;
  const match = {
    metadata: { matchId: `TR1_${7000000000 + seed % 999999999}` },
    info: {
      queueId, gameMode: arena ? 'CHERRY' : aram ? 'ARAM' : 'CLASSIC', mapId: arena ? 30 : aram ? 12 : 11,
      gameStartTimestamp: start, gameEndTimestamp: start + minutes * 60e3, gameDuration: minutes * 60, gameVersion: '16.22.715.1234',
      participants: parts,
      teams: arena ? [] : [100, 200].map(id => ({ teamId: id, win: (id === 100) === blueWins, bans: [0, 1, 2, 3, 4].map(() => ({ championId: pick(r, FB.CHAMPS)[1] })), objectives: { champion: { kills: parts.filter(p => p.teamId === id).reduce((s, p) => s + p.kills, 0) } } })),
    },
  };
  const timeline = { info: { frames: [{ events: events.sort((a, b) => a.timestamp - b.timestamp) }] } };
  return { match, timeline };
}

const DEMO_QUEUES = [420, 440, 400, 450, 1700, 2400, 900, 1020];

function lolProfile(riotId) {
  const [name, tag] = riotId.split('#');
  const puuid = puuidOf(name, tag);
  const r = rng(hash(puuid));
  const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'];
  return {
    account: { puuid, gameName: name, tagLine: tag }, platform: 'tr1', demo: true,
    summoner: { level: int(r, 30, 650), profileIconId: int(r, 1, 28) },
    ranks: [
      { queue: 'RANKED_SOLO_5x5', tier: pick(r, tiers), rank: pick(r, ['I', 'II', 'III', 'IV']), lp: int(r, 0, 99), wins: int(r, 20, 200), losses: int(r, 20, 200) },
      ...(r() < 0.6 ? [{ queue: 'RANKED_FLEX_SR', tier: pick(r, tiers), rank: pick(r, ['I', 'II', 'III', 'IV']), lp: int(r, 0, 99), wins: int(r, 5, 60), losses: int(r, 5, 60) }] : []),
    ],
    mastery: FB.CHAMPS.slice().sort(() => r() - 0.5).slice(0, 8).map((c, i) => ({ championId: c[1], level: Math.max(5, 40 - i * 4), points: int(r, 50, 900) * 1000 / (i + 1) | 0 })),
  };
}

function lolMatches(puuid, start, count, queue) {
  // reverse puuid → name isn't possible, so name is embedded by caller in demo store
  const me = demoPlayers.get(puuid) || { name: 'Player', tag: 'TR1', puuid };
  const r0 = hash(puuid);
  const out = [];
  for (let i = Number(start); out.length < count && i < 200; i++) {
    const q = queue ? Number(queue) : DEMO_QUEUES[(r0 + i * 7) % DEMO_QUEUES.length];
    const { match } = fakeLolMatch(r0 + i * 101, q, me);
    match.info.gameStartTimestamp = Date.now() - (i + 1) * 3.3 * 3600e3;
    match.info.gameEndTimestamp = match.info.gameStartTimestamp + match.info.gameDuration * 1000;
    out.push(lol.summarizeMatch(match));
  }
  return { matches: out, hasMore: Number(start) + count < 200, demo: true };
}

let lolBuildsCache = null;
function lolBuilds(stat) {
  if (lolBuildsCache) return lolBuildsCache;
  const raw = lolagg.newRaw(); raw.patch = '16.22';
  let seed = 12345;
  for (const q of DEMO_QUEUES) {
    const n = q === 420 ? 260 : q === 1700 ? 90 : 110;
    for (let i = 0; i < n; i++) { const { match, timeline } = fakeLolMatch(seed++, q, null); lolagg.addMatch(raw, match, timeline, stat); }
  }
  lolBuildsCache = lolagg.finalize(raw, stat);
  lolBuildsCache.index.demo = true;
  return lolBuildsCache;
}

async function lolLive(riotId) {
  const [name, tag] = riotId.split('#');
  const puuid = puuidOf(name, tag);
  const r = rng(hash(puuid) + Math.floor(Date.now() / 600e3));
  const acc = { puuid, gameName: name, tagLine: tag };
  if (r() < 0.25) return { inGame: false, account: acc };
  const { match } = fakeLolMatch(hash(puuid) + 7, pick(r, [420, 440, 450, 400]), { name, tag, puuid });
  const tiers = ['SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'];
  const g = {
    gameId: 1, gameQueueConfigId: match.info.queueId, gameMode: match.info.gameMode, mapId: match.info.mapId,
    gameStartTime: Date.now() - int(r, 3, 25) * 60e3, gameLength: 0,
    bannedChampions: match.info.queueId === 450 ? [] : [...Array(10)].map((_, i) => ({ championId: pick(r, FB.CHAMPS)[1], teamId: i < 5 ? 100 : 200 })),
    participants: match.info.participants.map(p => ({
      puuid: p.puuid, riotId: `${p.riotIdGameName}#${p.riotIdTagline}`, teamId: p.teamId, championId: p.championId,
      spell1Id: p.summoner1Id, spell2Id: p.summoner2Id, bot: false,
      perks: { perkIds: (p.perks.styles[0]?.selections || []).map(s => s.perk), perkStyle: p.perks.styles[0]?.style, perkSubStyle: p.perks.styles[1]?.style },
    })),
  };
  for (const p of g.participants) demoPlayers.set(p.puuid, { name: p.riotId.split('#')[0], tag: p.riotId.split('#')[1], puuid: p.puuid });
  return lol.summarizeLive(g, acc, 'tr1', {
    ranks: async pu => {
      const rr = rng(hash(pu));
      if (rr() < 0.15) return [];
      return [{ queueType: 'RANKED_SOLO_5x5', tier: pick(rr, tiers), rank: pick(rr, ['I', 'II', 'III', 'IV']), leaguePoints: int(rr, 0, 99), wins: int(rr, 10, 150), losses: int(rr, 10, 150) }];
    },
    mastery: async pu => {
      const rr = rng(hash(pu) + 3);
      const own = g.participants.find(p => p.puuid === pu);
      const list = FB.CHAMPS.slice().sort(() => rr() - 0.5).slice(0, 3).map(c => c[1]);
      if (own && rr() < 0.5) list[0] = own.championId;
      return [...new Set(list)].map((id, i) => ({ championId: id, championLevel: 30 - i * 8, championPoints: int(rr, 80, 600) * 1000 / (i + 1) | 0 }));
    },
  });
}

// ---------------- Valorant ----------------
const VAL_QUEUE_MIX = ['competitive', 'competitive', 'competitive', 'unrated', 'swiftplay', 'deathmatch', 'competitive', 'premier'];

function fakeValMatch(seed, queueId, me) {
  const r = rng(seed);
  const map = pick(r, FB.VAL_MAPS)[0];
  const dm = queueId === 'deathmatch';
  const target = queueId === 'swiftplay' ? 5 : 13;
  let red = 0, blue = 0;
  const roundsNeeded = () => (red < target && blue < target);
  const rounds = [];
  const baseTier = int(r, 6, 24);
  const players = [];
  const agentsUsed = { Red: new Set(), Blue: new Set() };
  const n = dm ? 14 : 10;
  const meSlot = int(r, 0, n - 1);
  for (let i = 0; i < n; i++) {
    const team = dm ? 'p' + i : i < 5 ? 'Red' : 'Blue';
    let ag; for (let t = 0; t < 30; t++) { ag = FB.VAL_AGENTS[Math.floor(Math.pow(r(), 1.6) * FB.VAL_AGENTS.length)]; if (dm || !agentsUsed[team].has(ag[0])) break; }
    if (!dm) agentsUsed[team].add(ag[0]);
    const pl = me && i === meSlot ? me : (() => { const f = fakePlayer(r); return { ...f, puuid: puuidOf(f.name, f.tag + seed + i) }; })();
    players.push({ puuid: pl.puuid, gameName: pl.name, tagLine: pl.tag, teamId: team, partyId: 'x' + i, characterId: ag[0].toUpperCase(),
      competitiveTier: queueId === 'competitive' ? Math.max(3, Math.min(27, baseTier + int(r, -2, 2))) : 0,
      skill: 0.6 + r() * 0.9, aim: 0.12 + r() * 0.22, stats: { kills: 0, deaths: 0, assists: 0, score: 0, roundsPlayed: 0 } });
  }
  const loops = dm ? 1 : 30;
  for (let rn = 0; rn < loops && (dm || roundsNeeded()); rn++) {
    const ps = Object.fromEntries(players.map(p => [p.puuid, { puuid: p.puuid, kills: [], damage: [] }]));
    const alive = new Set(players.map(p => p.puuid));
    let time = int(r, 8000, 20000);
    const killsThisRound = dm ? 120 : int(r, 5, 9);
    for (let kk = 0; kk < killsThisRound && alive.size > 1; kk++) {
      const al = players.filter(p => alive.has(p.puuid));
      let roll = r() * al.reduce((t, p) => t + p.skill, 0), killer = al[0];
      for (const p of al) { roll -= p.skill; if (roll <= 0) { killer = p; break; } }
      const enemies = al.filter(p => p.teamId !== killer.teamId);
      if (!enemies.length) break;
      const victim = pick(r, enemies);
      time += int(r, 1500, 12000);
      ps[killer.puuid].kills.push({ killer: killer.puuid, victim: victim.puuid, timeSinceRoundStartMillis: time });
      const hs = r() < killer.aim * 2.2 ? int(r, 1, 2) : 0; const bs = hs ? int(r, 0, 2) : int(r, 2, 4); const ls = r() < 0.15 ? 1 : 0;
      ps[killer.puuid].damage.push({ receiver: victim.puuid, damage: 150, headshots: hs, bodyshots: bs, legshots: ls });
      killer.stats.score += 150 + int(r, 60, 140); victim.stats.deaths++; killer.stats.kills++;
      const assist = al.find(p => p.teamId === killer.teamId && p !== killer && r() < 0.35);
      if (assist) { assist.stats.assists++; assist.stats.score += 25; ps[assist.puuid].damage.push({ receiver: victim.puuid, damage: int(r, 20, 90), headshots: 0, bodyshots: 1, legshots: r() < 0.3 ? 1 : 0 }); }
      if (!dm) alive.delete(victim.puuid);
    }
    const redAlive = players.filter(p => p.teamId === 'Red' && alive.has(p.puuid)).length;
    const blueAlive = players.filter(p => p.teamId === 'Blue' && alive.has(p.puuid)).length;
    const winTeam = redAlive === blueAlive ? (r() < 0.5 ? 'Red' : 'Blue') : redAlive > blueAlive ? 'Red' : 'Blue';
    if (!dm) { if (winTeam === 'Red') red++; else blue++; }
    players.forEach(p => { p.stats.roundsPlayed++; });
    rounds.push({ roundNum: rn, winningTeam: winTeam, playerStats: Object.values(ps),
      bombPlanter: r() < 0.5 ? pick(r, players.filter(p => p.teamId === 'Red')).puuid : undefined });
  }
  const start = Date.now() - (seed % 500) * 3600e3;
  const teams = dm
    ? players.map(p => ({ teamId: p.teamId, won: false, roundsWon: 0, numPoints: p.stats.kills }))
    : [{ teamId: 'Red', won: red > blue, roundsWon: red }, { teamId: 'Blue', won: blue > red, roundsWon: blue }];
  if (dm) { const best = teams.sort((a, b) => b.numPoints - a.numPoints)[0]; best.won = true; }
  return {
    matchInfo: { matchId: 'demo-' + seed.toString(16), mapId: map, queueId, isRanked: queueId === 'competitive', gameStartMillis: start, gameLengthMillis: (dm ? 9 : rounds.length * 1.75) * 60e3, seasonId: 'demo-act' },
    players: players.map(({ skill, aim, ...p }) => p), teams, roundResults: dm ? [] : rounds,
  };
}

function valProfile(riotId) {
  const [name, tag] = riotId.split('#');
  return { account: { puuid: puuidOf(name, tag), gameName: name, tagLine: tag }, shard: 'eu', demo: true };
}

function valMatches(puuid, start, count, queue) {
  const me = demoPlayers.get(puuid) || { name: 'Player', tag: 'TR1', puuid };
  const r0 = hash(puuid);
  const out = [];
  for (let i = Number(start); out.length < count && i < 120; i++) {
    const q = queue || VAL_QUEUE_MIX[(r0 + i) % VAL_QUEUE_MIX.length];
    const m = fakeValMatch(r0 + i * 31, q, me);
    m.matchInfo.gameStartMillis = Date.now() - (i + 1) * 2.7 * 3600e3;
    out.push(val.summarizeMatch(m));
  }
  return { matches: out, hasMore: Number(start) + count < 120, demo: true };
}

let valAgentsCache = null;
function valAgents() {
  if (valAgentsCache) return valAgentsCache;
  const raw = valagg.newRaw({ id: 'demo-act', name: 'ACT III', episode: 'DEMO EPISODE' }, 'competitive');
  for (let i = 0; i < 400; i++) valagg.addMatch(raw, val.summarizeMatch(fakeValMatch(99000 + i, 'competitive', null)));
  valAgentsCache = valagg.finalize(raw, { demo: true, shard: 'eu' });
  return valAgentsCache;
}

// Keep track of looked-up demo players so their name shows up in their own matches.
const demoPlayers = new Map();
function remember(profile) { const a = profile.account; demoPlayers.set(a.puuid, { name: a.gameName, tag: a.tagLine, puuid: a.puuid }); return profile; }

module.exports = {
  lolProfile: id => remember(lolProfile(id)), lolMatches, lolBuilds, lolLive,
  valProfile: id => remember(valProfile(id)), valMatches, valAgents,
  fakeLolMatch, fakeValMatch,
};
