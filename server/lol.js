// League of Legends: profiles and match history via Riot API.
const { riotGet, getAccountByRiotId, RiotError } = require('./riot');

const PLATFORM_REGION = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  kr: 'asia', jp1: 'asia',
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', me1: 'europe',
  oc1: 'sea', ph2: 'sea', sg2: 'sea', th2: 'sea', tw2: 'sea', vn2: 'sea',
};
const PLATFORMS = Object.keys(PLATFORM_REGION);

function regionFor(platform) {
  const r = PLATFORM_REGION[platform];
  if (!r) throw new RiotError(400, `Unknown platform "${platform}"`);
  return r;
}
// account-v1 has no "sea" cluster
const accountRegionFor = platform => (regionFor(platform) === 'sea' ? 'asia' : regionFor(platform));

async function profile(riotId, platform) {
  const account = await getAccountByRiotId(riotId, accountRegionFor(platform));
  const { puuid } = account;
  const [summoner, ranks, mastery] = await Promise.all([
    riotGet(platform, `/lol/summoner/v4/summoners/by-puuid/${puuid}`, { ttl: 300e3 }),
    riotGet(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, { ttl: 120e3 }).catch(() => []),
    riotGet(platform, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=8`, { ttl: 600e3 }).catch(() => []),
  ]);
  return {
    account: { puuid, gameName: account.gameName, tagLine: account.tagLine },
    platform,
    summoner: { level: summoner.summonerLevel, profileIconId: summoner.profileIconId },
    ranks: ranks.map(r => ({ queue: r.queueType, tier: r.tier, rank: r.rank, lp: r.leaguePoints, wins: r.wins, losses: r.losses, hotStreak: r.hotStreak })),
    mastery: mastery.map(m => ({ championId: m.championId, level: m.championLevel, points: m.championPoints, lastPlay: m.lastPlayTime })),
  };
}

function summarizeMatch(m) {
  const i = m.info;
  const participants = i.participants.map(p => ({
    puuid: p.puuid,
    name: p.riotIdGameName || p.summonerName || 'Unknown',
    tag: p.riotIdTagline || '',
    champ: p.championName, champId: p.championId, level: p.champLevel,
    team: p.teamId, sub: p.playerSubteamId || 0,
    place: p.placement || p.subteamPlacement || 0,
    win: !!p.win,
    k: p.kills, d: p.deaths, a: p.assists,
    cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
    gold: p.goldEarned, dmg: p.totalDamageDealtToChampions, taken: p.totalDamageTaken,
    vision: p.visionScore || 0, wards: p.wardsPlaced || 0,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
    spells: [p.summoner1Id, p.summoner2Id],
    keystone: p.perks?.styles?.[0]?.selections?.[0]?.perk || 0,
    secondary: p.perks?.styles?.[1]?.style || 0,
    role: p.teamPosition || '',
    aug: [1, 2, 3, 4, 5, 6].map(n => p['playerAugment' + n]).filter(Boolean),
    multi: p.largestMultiKill || 0,
  }));
  return {
    id: m.metadata.matchId,
    queue: i.queueId, mode: i.gameMode, map: i.mapId,
    start: i.gameStartTimestamp, end: i.gameEndTimestamp || (i.gameStartTimestamp + i.gameDuration * 1000),
    duration: i.gameEndTimestamp ? i.gameDuration : Math.round(i.gameDuration / 1000),
    version: i.gameVersion,
    remake: !!i.participants[0]?.gameEndedInEarlySurrender,
    teams: (i.teams || []).map(t => ({ id: t.teamId, win: t.win, kills: t.objectives?.champion?.kills || 0, bans: (t.bans || []).map(b => b.championId) })),
    participants,
  };
}

async function matches(puuid, platform, start = 0, count = 10, queue = '') {
  const region = regionFor(platform);
  const q = queue ? `&queue=${Number(queue)}` : '';
  const ids = await riotGet(region, `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${Number(start)}&count=${Math.min(Number(count) || 10, 20)}${q}`, { ttl: 60e3 });
  const list = await Promise.all(ids.map(id =>
    riotGet(region, `/lol/match/v5/matches/${id}`, { permanent: true }).then(summarizeMatch).catch(() => null)));
  return { matches: list.filter(Boolean), hasMore: ids.length >= Math.min(Number(count) || 10, 20) };
}

// Live game (spectator-v5) for a Riot ID. Enriches each player with their ranked info.
async function liveGame(riotId, platform) {
  const account = await getAccountByRiotId(riotId, accountRegionFor(platform));
  let g;
  try {
    g = await riotGet(platform, `/lol/spectator/v5/active-games/by-summoner/${account.puuid}`, { ttl: 20e3 });
  } catch (e) {
    if (e.status === 404) return { inGame: false, account: { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine } };
    throw e;
  }
  return summarizeLive(g, account, platform);
}

async function summarizeLive(g, account, platform, fns = {}) {
  const getRanks = fns.ranks || (puuid => riotGet(platform, `/lol/league/v4/entries/by-puuid/${puuid}`, { ttl: 300e3 }).catch(() => []));
  const getMastery = fns.mastery || (puuid => riotGet(platform, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`, { ttl: 3600e3 }).catch(() => []));
  const players = await Promise.all((g.participants || []).map(async p => {
    const [name, tag] = String(p.riotId || '').split('#');
    const real = p.puuid && !p.bot;
    const [ranks, mastery] = real ? await Promise.all([getRanks(p.puuid), getMastery(p.puuid)]) : [[], []];
    const solo = ranks.find(r => r.queueType === 'RANKED_SOLO_5x5');
    const flex = ranks.find(r => r.queueType === 'RANKED_FLEX_SR');
    const pick = solo || flex;
    return {
      puuid: p.puuid, name: name || p.summonerName || 'Hidden', tag: tag || '', bot: !!p.bot,
      team: p.teamId, champId: p.championId, spells: [p.spell1Id, p.spell2Id],
      keystone: p.perks?.perkIds?.[0] || 0, primary: p.perks?.perkStyle || 0, secondary: p.perks?.perkSubStyle || 0,
      perks: p.perks?.perkIds || [],
      mains: (mastery || []).map(m => ({ champId: m.championId, level: m.championLevel, points: m.championPoints })),
      rank: pick ? { queue: pick.queueType, tier: pick.tier, rank: pick.rank, lp: pick.leaguePoints, wins: pick.wins, losses: pick.losses } : null,
    };
  }));
  return {
    inGame: true,
    account: { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine },
    gameId: g.gameId, queue: g.gameQueueConfigId, mode: g.gameMode, map: g.mapId,
    start: g.gameStartTime || 0, length: g.gameLength || 0, fetchedAt: Date.now(),
    bans: (g.bannedChampions || []).map(b => ({ champId: b.championId, team: b.teamId })),
    players,
  };
}

// Per-champion record from a player's recent games.
function recentByChamp(list, puuid) {
  const out = {};
  for (const m of list) {
    if (m.remake) continue;
    const p = m.participants.find(x => x.puuid === puuid); if (!p) continue;
    const c = out[p.champId] || (out[p.champId] = { champId: p.champId, games: 0, wins: 0, k: 0, d: 0, a: 0 });
    c.games++; if (p.win) c.wins++; c.k += p.k; c.d += p.d; c.a += p.a;
  }
  const champs = Object.values(out).sort((a, b) => b.games - a.games);
  return { games: champs.reduce((s, c) => s + c.games, 0), wins: champs.reduce((s, c) => s + c.wins, 0), champs };
}

module.exports = { recentByChamp, profile, matches, summarizeMatch, liveGame, summarizeLive, regionFor, PLATFORMS, PLATFORM_REGION };
