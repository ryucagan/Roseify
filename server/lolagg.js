// Aggregates raw League matches (+ timelines) into per-mode champion builds.
// Used by crawler/lol-builds.js. Works for every queue: Summoner's Rift modes get
// per-role builds; ARAM, Arena, URF, One for All, Mayhem etc. get one "ALL" bucket,
// and modes with augments (Arena, ARAM: Mayhem) also track augments + placement.

const NO_ROLE_QUEUES = new Set([900, 1900, 1020, 1300, 1400, 2300]);

function patchOf(gameVersion) { return String(gameVersion || '').split('.').slice(0, 2).join('.'); }
function cmpPatch(a, b) {
  const [a1, a2] = a.split('.').map(Number), [b1, b2] = b.split('.').map(Number);
  return a1 - b1 || a2 - b2;
}

function newRaw() { return { patch: '', seen: [], queues: {} }; }
function newRole() {
  return { g: 0, w: 0, runes: {}, spells: {}, start: {}, core: {}, full: {}, s4: {}, s5: {}, s6: {}, boots: {}, items: {}, seq: {}, max: {}, aug: {}, place: 0, top1: 0 };
}
function inc(obj, key, win) {
  const e = obj[key] || (obj[key] = [0, 0]);
  e[0]++; if (win) e[1]++;
}

const SUPPORT_NAMES = /^(World Atlas|Runic Compass|Bounty of Worlds|Bloodsong|Celestial Opposition|Dream Maker|Zaz'Zak's Realmspike|Solstice Sleigh)$/;
const SUPPORT_TIER = n => (/^World Atlas$/.test(n) ? 0 : /^Runic Compass$/.test(n) ? 1 : /^Bounty of Worlds$/.test(n) ? 2 : 3);

function itemKind(id, items) {
  const it = items[id];
  if (!id || !it) return 'none';
  const tags = it.tags || [];
  if (tags.includes('Trinket') || [3340, 3363, 3364, 3330, 3513].includes(+id)) return 'trinket';
  if (tags.includes('Consumable') || it.consumed) return 'consumable';
  if (tags.includes('Boots')) return +id === 1001 ? 'component' : 'boots';
  // support quest line (World Atlas -> Runic Compass -> Bounty of Worlds -> upgraded item)
  if (SUPPORT_NAMES.test(it.name || '') || (tags.includes('GoldPer') && !(it.into && it.into.length))) return 'support';
  if ((!it.into || it.into.length === 0) && it.gold >= 900) return 'completed';
  return 'component';
}

function skillData(levelUps) {
  const letters = levelUps.map(s => 'QWER'[s - 1]).filter(Boolean);
  const seq = letters.slice(0, 15).join('');
  const reach = {}; const cnt = { Q: 0, W: 0, E: 0 };
  letters.forEach((l, idx) => { if (l in cnt && ++cnt[l] === 5) reach[l] = idx; });
  const max = ['Q', 'W', 'E'].sort((a, b) => (reach[a] ?? 99) - (reach[b] ?? 99) || cnt[b] - cnt[a]).join('>');
  return { seq, max };
}

function timelineFor(timeline, participantId) {
  const purchases = []; const skills = [];
  if (!timeline) return null;
  for (const f of timeline.info?.frames || []) for (const e of f.events || []) {
    if (e.participantId !== participantId) continue;
    if (e.type === 'ITEM_PURCHASED') purchases.push({ id: e.itemId, t: e.timestamp });
    else if (e.type === 'ITEM_UNDO' && e.beforeId) {
      for (let i = purchases.length - 1; i >= 0; i--) if (purchases[i].id === e.beforeId) { purchases.splice(i, 1); break; }
    } else if (e.type === 'SKILL_LEVEL_UP' && e.levelUpType !== 'EVOLVE') skills.push(e.skillSlot);
  }
  return { purchases, skills };
}

/** Add one match to the raw aggregate. Returns false if the match was skipped. */
function addMatch(raw, match, timeline, stat) {
  const info = match.info;
  if (!info || info.participants?.[0]?.gameEndedInEarlySurrender) return false;
  const q = String(info.queueId);
  const Q = raw.queues[q] || (raw.queues[q] = { matches: 0, champs: {}, bans: {} });
  Q.matches++;
  for (const t of info.teams || []) for (const b of t.bans || []) if (b.championId > 0) Q.bans[b.championId] = (Q.bans[b.championId] || 0) + 1;
  const isArena = info.participants.some(p => p.playerSubteamId);
  const items = stat.items;

  for (const p of info.participants) {
    const placement = p.placement || p.subteamPlacement || 0;
    const win = isArena ? placement > 0 && placement <= 4 : !!p.win;
    const role = (info.mapId === 11 && p.teamPosition && !NO_ROLE_QUEUES.has(info.queueId)) ? p.teamPosition : 'ALL';
    const C = Q.champs[p.championId] || (Q.champs[p.championId] = { g: 0, w: 0, roles: {} });
    C.g++; if (win) C.w++;
    const R = C.roles[role] || (C.roles[role] = newRole());
    for (const k of ['full', 's4', 's5', 's6']) R[k] = R[k] || {};
    R.g++; if (win) R.w++;

    // matchups: teammates (synergy), all enemies (counters), and direct lane opponent on Summoner's Rift
    C.with = C.with || {}; C.vs = C.vs || {}; C.lane = C.lane || {};
    for (const o of info.participants) {
      if (o === p) continue;
      const ally = isArena ? o.playerSubteamId === p.playerSubteamId : o.teamId === p.teamId;
      if (ally) inc(C.with, o.championId, win);
      else {
        inc(C.vs, o.championId, win);
        if (role !== 'ALL' && o.teamPosition === p.teamPosition) inc(C.lane, o.championId, win);
      }
    }
    if (placement) { R.place += placement; if (placement === 1) R.top1++; }

    // runes
    const st = p.perks?.styles || [];
    let RP = null; // per-rune-page item stats, so the UI can show the build that goes with each page
    if (st[0]?.selections?.length) {
      const key = [st[0].style, st[0].selections.map(s => s.perk).join(','), st[1]?.style || 0,
        (st[1]?.selections || []).map(s => s.perk).join(','),
        [p.perks.statPerks?.offense, p.perks.statPerks?.flex, p.perks.statPerks?.defense].join(',')].join('|');
      inc(R.runes, key, win);
      R.rp = R.rp || {};
      RP = R.rp[key] || (R.rp[key] = { g: 0, w: 0, core: {}, full: {}, boots: {}, items: {}, s4: {}, s5: {}, s6: {}, support: {} });
      RP.g++; if (win) RP.w++;
    }
    const T = RP ? [R, RP] : [R]; // item stats go to the role AND to its rune page
    // summoner spells (order-independent)
    const sp = [p.summoner1Id, p.summoner2Id].filter(Boolean).sort((a, b) => a - b);
    if (sp.length) inc(R.spells, sp.join(','), win);
    // augments
    for (const n of [1, 2, 3, 4, 5, 6]) { const a = p['playerAugment' + n]; if (a) inc(R.aug, a, win); }

    // items
    const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter(Boolean);
    const finalCompleted = finalItems.filter(id => itemKind(id, items) === 'completed');
    for (const X of T) for (const id of new Set(finalCompleted)) inc(X.items, id, win);
    const boots = finalItems.find(id => itemKind(id, items) === 'boots');
    if (boots) for (const X of T) inc(X.boots, boots, win);
    // final support item (most upgraded one in the inventory)
    const supportItem = finalItems.filter(id => itemKind(id, items) === 'support')
      .sort((a, c) => SUPPORT_TIER(items[c]?.name || '') - SUPPORT_TIER(items[a]?.name || ''))[0];
    if (supportItem) for (const X of T) { X.support = X.support || {}; inc(X.support, supportItem, win); }

    const tl = timelineFor(timeline, p.participantId);
    if (tl) {
      const start = tl.purchases.filter(x => x.t < 90e3).map(x => x.id).sort((a, b) => a - b);
      if (start.length) inc(R.start, start.join(','), win);
      const ordered = [];
      for (const x of tl.purchases) {
        if (itemKind(x.id, items) === 'completed' && !ordered.includes(x.id)) ordered.push(x.id);
      }
      const kept = ordered.filter(id => finalCompleted.includes(id));
      const core = [...kept, ...ordered.filter(id => !kept.includes(id))].slice(0, 3);
      if (core.length >= 2) for (const X of T) inc(X.core, core.join(','), win);
      // full build: every finished item (boots included) in the order it was bought
      const fullOrder = [];
      for (const x of tl.purchases) {
        const kind = itemKind(x.id, items);
        if ((kind === 'completed' || kind === 'boots') && finalItems.includes(x.id) && !fullOrder.includes(x.id)) fullOrder.push(x.id);
      }
      // supports buy World Atlas first and it upgrades over the game, so the final support item leads the build
      if (supportItem && !fullOrder.includes(supportItem)) fullOrder.unshift(supportItem);
      if (fullOrder.length >= 3) for (const X of T) inc(X.full, fullOrder.join(','), win);
      // what people buy as their 4th / 5th / 6th finished item
      const noBoots = kept.length ? kept : ordered;
      for (const X of T) [X.s4, X.s5, X.s6].forEach((slot, i) => { if (noBoots[3 + i]) inc(slot, noBoots[3 + i], win); });
      // what THIS core goes on to build, so the recommended 6 items stay one coherent build
      if (core.length >= 2) {
        const ck = core.join(',');
        for (const X of T) {
          X.cb = X.cb || {};
          const CB = X.cb[ck] || (X.cb[ck] = { g: 0, w: 0, boots: {}, support: {}, s4: {}, s5: {}, s6: {} });
          CB.g++; if (win) CB.w++;
          if (boots) inc(CB.boots, boots, win);
          if (supportItem) inc(CB.support, supportItem, win);
          [CB.s4, CB.s5, CB.s6].forEach((slot, i) => { if (noBoots[3 + i]) inc(slot, noBoots[3 + i], win); });
        }
      }
      if (tl.skills.length >= 6) {
        const s = skillData(tl.skills);
        inc(R.seq, s.seq, win); inc(R.max, s.max, win);
      }
    } else if (finalCompleted.length >= 2) {
      for (const X of T) inc(X.core, finalCompleted.slice(0, 3).sort((a, b) => a - b).join(','), win);
    }
  }
  return true;
}

function withAfter(coreList, cb) {
  for (const c of coreList) {
    const CB = cb?.[c.items.join(',')];
    if (CB) c.after = { games: CB.g, boots: top(CB.boots, 3, k => ({ id: +k })), support: top(CB.support, 3, k => ({ id: +k })), slots: [CB.s4, CB.s5, CB.s6].map(o => top(o, 5, k => ({ id: +k }))) };
  }
  return coreList;
}

function top(obj, n, map) {
  return Object.entries(obj).sort((a, b) => b[1][0] - a[1][0]).slice(0, n)
    .map(([k, [g, w]]) => ({ ...map(k), games: g, wins: w }));
}
const ids = k => k.split(',').filter(Boolean).map(Number);

function finalizeRole(role, R, champGames) {
  return {
    role, games: R.g, wins: R.w, share: champGames ? R.g / champGames : 0,
    avgPlace: R.place && R.g ? R.place / R.g : 0, top1: R.top1,
    runes: top(R.runes, 4, k => {
      const [ps, pp, ss, sp, sh] = k.split('|');
      const P = R.rp?.[k];
      return {
        primary: +ps, perks: ids(pp), secondary: +ss, subPerks: ids(sp), shards: ids(sh),
        build: P ? {
          games: P.g, wins: P.w,
          core: withAfter(top(P.core, 6, kk => ({ items: ids(kk) })), P.cb), full: top(P.full, 6, kk => ({ items: ids(kk) })),
          boots: top(P.boots, 4, kk => ({ id: +kk })), items: top(P.items, 14, kk => ({ id: +kk })),
          support: top(P.support || {}, 4, kk => ({ id: +kk })),
          slots: [P.s4, P.s5, P.s6].map(o => top(o || {}, 5, kk => ({ id: +kk }))),
        } : null,
      };
    }),
    spells: top(R.spells, 4, k => ({ ids: ids(k) })),
    starting: top(R.start, 4, k => ({ items: ids(k) })),
    core: withAfter(top(R.core, 6, k => ({ items: ids(k) })), R.cb),
    full: top(R.full || {}, 6, k => ({ items: ids(k) })),
    slots: [R.s4, R.s5, R.s6].map(o => top(o || {}, 5, k => ({ id: +k }))),
    boots: top(R.boots, 4, k => ({ id: +k })),
    support: top(R.support || {}, 4, k => ({ id: +k })),
    items: top(R.items, 14, k => ({ id: +k })),
    skills: { seq: top(R.seq, 3, k => ({ order: k })), max: top(R.max, 3, k => ({ order: k })) },
    augments: top(R.aug, 18, k => ({ id: +k })),
  };
}

// Every opponent/teammate with enough games; the UI sorts them into counters, good matchups and synergies.
function matchups(C) {
  const list = (obj, min) => Object.entries(obj || {}).filter(([, [g]]) => g >= min)
    .map(([id, [g, w]]) => ({ id: +id, games: g, wins: w })).sort((a, b) => b.games - a.games);
  const min = Math.max(3, Math.round(C.g * 0.015));
  return { min, with: list(C.with, min), vs: list(C.vs, min), lane: list(C.lane, Math.max(2, Math.round(min / 2))) };
}

/** Turn raw aggregate into { index, details } for the API. */
function finalize(raw, stat) {
  const index = { patch: raw.patch, generatedAt: Date.now(), queues: [] };
  const details = {};
  for (const [q, Q] of Object.entries(raw.queues)) {
    const champs = [];
    for (const [cid, C] of Object.entries(Q.champs)) {
      const pickRate = Math.min(1, C.g / Q.matches);
      const banRate = (Q.bans[cid] || 0) / Q.matches;
      champs.push({ id: +cid, games: C.g, wins: C.w, pickRate, banRate });
      const roles = Object.entries(C.roles).sort((a, b) => b[1].g - a[1].g).map(([r, R]) => finalizeRole(r, R, C.g));
      (details[cid] || (details[cid] = {}))[q] = {
        champId: +cid, queue: +q, queueName: stat.queues[q] || `Queue ${q}`, patch: raw.patch,
        games: C.g, wins: C.w, pickRate, banRate, roles,
        matchups: matchups(C),
      };
    }
    champs.sort((a, b) => b.games - a.games);
    index.queues.push({ id: +q, name: stat.queues[q] || `Queue ${q}`, matches: Q.matches, champions: champs });
  }
  index.queues.sort((a, b) => b.matches - a.matches);
  return { index, details };
}

module.exports = { newRaw, addMatch, finalize, finalizeRole, patchOf, cmpPatch, itemKind, skillData };
