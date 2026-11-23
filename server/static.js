// Static game data: League (Data Dragon + CommunityDragon) and Valorant (valorant-api.com).
// Cached in memory for 6h and on disk so the app keeps working if a CDN is down.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { getJson } = require('./riot');
const FB = require('./fallback');

const SIX_HOURS = 6 * 3600e3;
let lolCache = null, lolAt = 0;
let valCache = null, valAt = 0;

function diskFile(name) { return path.join(cfg.cacheDir, name); }
function readDisk(name) { try { return JSON.parse(fs.readFileSync(diskFile(name), 'utf8')); } catch { return null; } }
function writeDisk(name, d) { try { fs.mkdirSync(cfg.cacheDir, { recursive: true }); fs.writeFileSync(diskFile(name), JSON.stringify(d)); } catch {} }

function lolFallback() {
  const champions = {};
  for (const [id, key, name, cls] of FB.CHAMPS) champions[key] = { id, name, tags: [cls] };
  const items = {};
  const boots = [1001, 3006, 3020, 3047, 3111, 3158], starters = [1054, 1055, 1056, 3850, 1101, 1102, 1103];
  for (const [id, name] of Object.entries(FB.ITEMS)) {
    const n = +id;
    items[id] = {
      name, into: [],
      gold: starters.includes(n) ? 450 : n === 2003 ? 50 : n === 1001 ? 300 : boots.includes(n) ? 1100 : 3000,
      tags: boots.includes(n) ? ['Boots'] : n === 2003 ? ['Consumable'] : [3340, 3363, 3364].includes(n) ? ['Trinket'] : [],
    };
  }
  const runes = {}; for (const [id, name] of Object.entries(FB.RUNES)) runes[id] = { name, icon: '' };
  const styles = {}; for (const [id, name] of Object.entries(FB.RUNE_STYLES)) styles[id] = { name, icon: '' };
  const spells = {}; for (const [k, [id, name]] of Object.entries(FB.SPELLS)) spells[k] = { id, name };
  const augments = {}; for (const [id, name] of Object.entries(FB.AUGMENTS)) augments[id] = { name, icon: '' };
  return { version: '16.22.1', champions, items, runes, styles, spells, queues: { ...FB.QUEUE_NAMES }, augments, fallback: true };
}

async function loadLol() {
  const versions = await getJson('https://ddragon.leagueoflegends.com/api/versions.json');
  const v = versions[0];
  const base = `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US`;
  const [champ, item, runes, summ] = await Promise.all([
    getJson(`${base}/champion.json`), getJson(`${base}/item.json`),
    getJson(`${base}/runesReforged.json`), getJson(`${base}/summoner.json`),
  ]);
  const out = { version: v, champions: {}, items: {}, runes: {}, styles: {}, spells: {}, queues: { ...FB.QUEUE_NAMES }, augments: {} };
  for (const c of Object.values(champ.data)) out.champions[c.key] = { id: c.id, name: c.name, tags: c.tags };
  for (const [id, it] of Object.entries(item.data)) {
    out.items[id] = {
      name: it.name, gold: it.gold?.total || 0, into: it.into || [], tags: it.tags || [],
      depth: it.depth || 1, consumed: !!it.consumed, maps: it.maps || {},
    };
  }
  for (const style of runes) {
    out.styles[style.id] = { name: style.name, icon: style.icon, slots: style.slots.map(sl => sl.runes.map(r => r.id)) };
    for (const slot of style.slots) for (const r of slot.runes) out.runes[r.id] = { name: r.name, icon: r.icon, style: style.id };
  }
  for (const [n, id] of Object.entries({ 5008: 'Adaptive Force', 5005: 'Attack Speed', 5007: 'Ability Haste', 5001: 'Health Scaling', 5011: 'Health', 5013: 'Tenacity and Slow Resist', 5010: 'Move Speed', 5002: 'Armor', 5003: 'Magic Resist' }))
    out.runes[n] = { name: id, icon: '' };
  for (const s of Object.values(summ.data)) out.spells[s.key] = { id: s.id, name: s.name };
  try {
    const qs = await getJson('https://static.developer.riotgames.com/docs/lol/queues.json');
    for (const q of qs) if (!out.queues[q.queueId] && q.description)
      out.queues[q.queueId] = q.description.replace(/ games$/, '').replace(/^5v5 /, '');
  } catch {}
  try {
    const arena = await getJson('https://raw.communitydragon.org/latest/cdragon/arena/en_us.json');
    for (const a of arena.augments || []) out.augments[a.id] = {
      name: a.name, rarity: a.rarity,
      icon: a.iconSmall ? 'https://raw.communitydragon.org/latest/game/' + a.iconSmall.toLowerCase() : '',
    };
  } catch {}
  return out;
}

async function lolStatic() {
  if (lolCache && Date.now() - lolAt < SIX_HOURS) return lolCache;
  if (!cfg.demo || !lolCache) {
    try { lolCache = await loadLol(); lolAt = Date.now(); writeDisk('static-lol.json', lolCache); return lolCache; }
    catch (e) { console.warn('[static] LoL CDN unavailable:', e.message); }
  }
  lolCache = lolCache || readDisk('static-lol.json') || lolFallback();
  lolAt = Date.now() - SIX_HOURS + 10 * 60e3; // retry in 10 min
  return lolCache;
}

function valFallback() {
  return {
    agents: Object.fromEntries(FB.VAL_AGENTS.map(([id, name, role]) => [id, { name, role, icon: `https://media.valorant-api.com/agents/${id}/displayicon.png` }])),
    maps: Object.fromEntries(FB.VAL_MAPS.map(([url, name]) => [url, { name, icon: '', splash: '' }])),
    tiers: Object.fromEntries(FB.VAL_TIER_NAMES.map((n, i) => [i, { name: n, icon: i >= 3 || i === 0 ? `https://media.valorant-api.com/competitivetiers/${FB.VAL_TIER_SET}/${i}/smallicon.png` : '', color: '' }])),
    queues: { ...FB.VAL_QUEUES },
    fallback: true,
  };
}

async function loadVal() {
  const [agents, maps, tiers] = await Promise.all([
    getJson('https://valorant-api.com/v1/agents?isPlayableCharacter=true'),
    getJson('https://valorant-api.com/v1/maps'),
    getJson('https://valorant-api.com/v1/competitivetiers'),
  ]);
  const out = { agents: {}, maps: {}, tiers: {}, queues: { ...FB.VAL_QUEUES } };
  for (const a of agents.data) out.agents[a.uuid.toLowerCase()] = { name: a.displayName, role: a.role?.displayName || '', icon: a.displayIcon };
  for (const m of maps.data) if (m.mapUrl) out.maps[m.mapUrl] = { name: m.displayName, icon: m.listViewIcon, splash: m.splash };
  const latest = tiers.data[tiers.data.length - 1];
  for (const t of latest.tiers) out.tiers[t.tier] = { name: t.tierName, icon: t.smallIcon || '', color: t.color ? '#' + t.color.slice(0, 6) : '' };
  return out;
}

async function valStatic() {
  if (valCache && Date.now() - valAt < SIX_HOURS) return valCache;
  if (!cfg.demo || !valCache) {
    try { valCache = await loadVal(); valAt = Date.now(); writeDisk('static-val.json', valCache); return valCache; }
    catch (e) { console.warn('[static] valorant-api.com unavailable:', e.message); }
  }
  valCache = valCache || readDisk('static-val.json') || valFallback();
  valAt = Date.now() - SIX_HOURS + 10 * 60e3;
  return valCache;
}

module.exports = { lolStatic, valStatic };
