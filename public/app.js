'use strict';
// ===================== helpers =====================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '-');
const fix = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const num = x => (x ?? 0).toLocaleString('en-US');
const kfmt = x => (x >= 1000 ? (x / 1000).toFixed(1) + 'k' : String(Math.round(x || 0)));
const initials = s => String(s || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3) || '?';
const dur = s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
function ago(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return Math.max(1, Math.round(d / 60)) + 'm ago';
  if (d < 86400) return Math.round(d / 3600) + 'h ago';
  if (d < 86400 * 30) return Math.round(d / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}
const wrClass = wr => (wr >= 0.53 ? 'g' : wr < 0.47 ? 'l' : '');
const kdaRatio = (k, d, a) => (d ? (k + a) / d : k + a);

async function api(p) {
  const r = await fetch(p);
  const j = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const S = { cfg: null, lol: null, val: null };
const main = $('#main');
let navToken = 0;

function settings() {
  return { lolId: '', valId: '', lolPlatform: S.cfg.lolPlatform, valShard: S.cfg.valShard, ...store.get('gglens.settings', {}) };
}

// ===================== images =====================
function img(src, alt, cls = '') {
  if (!src) return `<span class="ph ${cls}" title="${esc(alt)}">${esc(initials(alt))}</span>`;
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" title="${esc(alt)}" loading="lazy" onerror="imgFail(this)">`;
}
window.imgFail = el => {
  const s = document.createElement('span');
  s.className = 'ph ' + el.className; s.title = el.alt; s.textContent = initials(el.alt);
  el.replaceWith(s);
};
const DD = () => `https://ddragon.leagueoflegends.com/cdn/${S.lol.version}`;
const L = {
  c: id => S.lol.champions[id],
  champName: id => S.lol.champions[id]?.name || `#${id}`,
  champ: (id, cls = 'ic') => { const c = S.lol.champions[id]; return img(c ? `${DD()}/img/champion/${c.id}.png` : '', c?.name || 'Champion', cls); },
  champByKey: (key, cls = 'ic') => img(`${DD()}/img/champion/${key}.png`, key, cls),
  item: (id, cls = 'it') => (id ? img(`${DD()}/img/item/${id}.png`, S.lol.items[id]?.name || `Item ${id}`, cls) : `<span class="it empty ${cls}"></span>`),
  spell: id => { const s = S.lol.spells[id]; return s ? img(`${DD()}/img/spell/${s.id}.png`, s.name, 'sp') : ''; },
  rune: (id, cls = 'rn') => { const r = S.lol.runes[id] || S.lol.styles[id]; return img(r?.icon ? `https://ddragon.leagueoflegends.com/cdn/img/${r.icon}` : '', r?.name || `Rune ${id}`, cls); },
  runeName: id => (S.lol.runes[id] || S.lol.styles[id])?.name || `Rune ${id}`,
  aug: id => { const a = S.lol.augments[id]; return img(a?.icon || '', a?.name || `Augment ${id}`, 'au'); },
  augName: id => S.lol.augments[id]?.name || `Augment ${id}`,
  icon: id => img(`${DD()}/img/profileicon/${id}.png`, 'Profile icon', 'pi'),
  emblem: tier => img(`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${String(tier).toLowerCase()}.png`, tier, 'emb'),
  queue: q => S.lol.queues[q] || `Queue ${q}`,
};
const V = {
  agent: (id, cls = 'ic') => { const a = S.val.agents[id]; return img(a?.icon, a?.name || 'Agent', cls); },
  agentName: id => S.val.agents[id]?.name || 'Unknown',
  map: url => S.val.maps[url]?.name || String(url || '').split('/').pop(),
  tier: t => (t >= 3 ? img(S.val.tiers[t]?.icon, S.val.tiers[t]?.name || '', 'tier') : ''),
  tierName: t => S.val.tiers[t]?.name || 'Unranked',
  queue: q => S.val.queues[q] ?? q,
};

// ===================== router =====================
function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [p, qs] = h.split('?');
  return { path: p, params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
const ROUTES = [
  [/^\/$/, () => home()],
  [/^\/val\/me$/, () => myProfile('val')],
  [/^\/val\/player\/(.+)$/, (m, p) => valPlayer(decodeURIComponent(m[1]), p.r)],
  [/^\/val\/agents$/, () => valAgents()],
  [/^\/lol\/me$/, () => myProfile('lol')],
  [/^\/lol\/player\/(.+)$/, (m, p) => lolPlayer(decodeURIComponent(m[1]), p.r)],
  [/^\/lol\/live\/me$/, () => { const st = settings(); return st.lolId ? lolLive(st.lolId, st.lolPlatform, true) : settingsPage('lolId'); }],
  [/^\/lol\/live\/(.+)$/, (m, p) => lolLive(decodeURIComponent(m[1]), p.r)],
  [/^\/lol\/builds$/, () => lolBuilds()],
  [/^\/lol\/builds\/(\d+)(?:\/(\d+))?$/, (m, p) => lolBuild(m[1], m[2], p.role)],
  [/^\/settings$/, () => settingsPage()],
];
async function route() {
  const token = ++navToken;
  const { path, params } = parseHash();
  $$('nav a').forEach(a => a.classList.toggle('on', path === a.dataset.nav || (a.dataset.nav !== '/' && path.startsWith(a.dataset.nav))));
  main.className = path.startsWith('/lol') ? 'lolp' : 'valp';
  document.body.classList.toggle('lolp', path.startsWith('/lol'));
  if (path.startsWith('/lol') || path.startsWith('/val')) { $('#sGame').value = path.startsWith('/lol') ? 'lol' : 'val'; fillRegions(); }
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      main.innerHTML = '<div class="loading">Loading…</div>';
      try { await fn(m, params, token); } catch (e) { if (token === navToken) main.innerHTML = errBox(e); }
      window.scrollTo(0, 0);
      return;
    }
  }
  main.innerHTML = errBox(new Error('Page not found'));
}
const alive = t => t === navToken;
const errBox = e => `<div class="err"><b>Something went wrong.</b><br>${esc(e.message)}</div>`;
const go = h => { location.hash = h; };
const playerLink = (game, name, tag, region) => `#/${game}/player/${enc(name + '#' + tag)}${region ? '?r=' + enc(region) : ''}`;

// ===================== search bar =====================
function fillRegions() {
  const game = $('#sGame').value, st = settings();
  const list = game === 'lol' ? S.cfg.lolPlatforms : S.cfg.valShards;
  const def = game === 'lol' ? st.lolPlatform : st.valShard;
  $('#sRegion').innerHTML = list.map(r => `<option value="${r}" ${r === def ? 'selected' : ''}>${r.toUpperCase()}</option>`).join('');
}
$('#sGame').addEventListener('change', fillRegions);
$('#search').addEventListener('submit', e => {
  e.preventDefault();
  const id = $('#sId').value.trim();
  if (!id.includes('#')) { $('#sId').focus(); $('#sId').placeholder = 'Include the tag, e.g. Name#TR1'; $('#sId').value = ''; return; }
  const [name, tag] = [id.slice(0, id.lastIndexOf('#')), id.slice(id.lastIndexOf('#') + 1)];
  go(playerLink($('#sGame').value, name, tag, $('#sRegion').value));
});

// ===================== home & settings =====================
function home() {
  const st = settings();
  main.innerHTML = `
    <h1 style="margin-bottom:6px">Welcome to Roseify</h1>
    <p class="mute" style="margin-top:0">Match history, player lookups, agent stats and builds for every League game mode.</p>
    <div class="hero">
      <div class="card val"><h2>VALORANT</h2>
        <ul><li>Your match history with ACS, ADR and K/D</li><li>Accuracy: headshot, body and leg hit %</li><li>Look up any player by Riot ID</li><li>Agent pick and win rates for the current act, by map and rank</li></ul>
        <div class="row"><a href="#/val/me"><button>${st.valId ? 'My profile' : 'Set my Riot ID'}</button></a><a href="#/val/agents"><button class="ghost">Agent stats</button></a></div>
      </div>
      <div class="card lol"><h2>LEAGUE OF LEGENDS</h2>
        <ul><li>Your match history, ranks and mastery</li><li>Look up any player by Riot ID</li><li>Builds, runes, skill order and items</li><li>Every mode: Ranked, Normals, ARAM, Arena, URF, Mayhem…</li></ul>
        <div class="row"><a href="#/lol/me"><button style="background:#a88a4e">${st.lolId ? 'My profile' : 'Set my Riot ID'}</button></a><a href="#/lol/builds"><button class="ghost">Builds</button></a></div>
      </div>
    </div>`;
}

function settingsPage(focus) {
  const st = settings();
  const opts = (list, sel) => list.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${r.toUpperCase()}</option>`).join('');
  main.innerHTML = `
    <h1 style="margin-bottom:16px">Settings</h1>
    <form class="card form" id="setf">
      <h2>Your accounts</h2>
      <label>Valorant Riot ID</label>
      <div class="pair"><input name="valId" placeholder="Name#TAG" value="${esc(st.valId)}"><select name="valShard">${opts(S.cfg.valShards, st.valShard)}</select></div>
      <label>League Riot ID</label>
      <div class="pair"><input name="lolId" placeholder="Name#TAG" value="${esc(st.lolId)}"><select name="lolPlatform">${opts(S.cfg.lolPlatforms, st.lolPlatform)}</select></div>
      <div class="row"><button type="submit">Save</button><span id="saved" class="g small"></span></div>
    </form>`;
  const f = $('#setf');
  if (focus) f.elements[focus]?.focus();
  f.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    for (const k of ['valId', 'lolId']) if (d[k] && !d[k].includes('#')) { f.elements[k].focus(); f.elements[k].style.borderColor = 'var(--loss)'; return; }
    store.set('gglens.settings', d);
    $('#saved').textContent = 'Saved';
    fillRegions();
    if (focus) go(focus === 'valId' ? '#/val/me' : '#/lol/me');
  });
}

function myProfile(game) {
  const st = settings();
  const id = game === 'val' ? st.valId : st.lolId;
  if (!id) return settingsPage(game === 'val' ? 'valId' : 'lolId');
  return game === 'val' ? valPlayer(id, st.valShard, true) : lolPlayer(id, st.lolPlatform, true);
}

// ===================== VALORANT: player =====================
async function valPlayer(riotId, shard, isMe) {
  const token = navToken;
  shard = shard || settings().valShard;
  const prof = await api(`/api/val/profile?riotId=${enc(riotId)}&shard=${enc(shard)}`);
  if (!alive(token)) return;
  const st = { matches: [], start: 0, queue: store.get('gglens.valQueue', ''), hasMore: true, busy: false };
  const me = prof.account.puuid;
  const queues = ['', 'competitive', 'unrated', 'swiftplay', 'premier', 'spikerush', 'deathmatch', 'hurm', 'ggteam'];

  main.innerHTML = `
    <div class="phead">
      <div><div class="name">${esc(prof.account.gameName)} <span class="tag">#${esc(prof.account.tagLine)}</span></div>
      <div class="row small mute"><span class="pill">${esc(prof.shard.toUpperCase())}</span>${isMe ? '<span class="pill">You</span>' : ''}<span id="vRank"></span></div></div>
    </div>
    <div class="tabs" id="vq">${queues.map(q => `<div class="tab ${q === st.queue ? 'on' : ''}" data-q="${q}">${q ? esc(V.queue(q)) : 'All modes'}</div>`).join('')}</div>
    <div class="cols">
      <div class="grid" id="vSide"></div>
      <div><div id="vList"></div><div class="more"><button class="ghost" id="vMore">Load more</button></div></div>
    </div>`;

  async function load() {
    if (st.busy) return; st.busy = true; $('#vMore').disabled = true; $('#vMore').textContent = 'Loading…';
    try {
      const r = await api(`/api/val/matches?puuid=${enc(me)}&shard=${enc(prof.shard)}&start=${st.start}&count=10&queue=${enc(st.queue)}`);
      if (!alive(token)) return;
      st.matches.push(...r.matches); st.start += 10; st.hasMore = r.hasMore;
      render();
    } catch (e) { $('#vList').innerHTML = errBox(e); }
    finally { st.busy = false; const b = $('#vMore'); if (b) { b.disabled = !st.hasMore; b.textContent = st.hasMore ? 'Load more' : 'No more matches'; } }
  }
  function render() {
    $('#vSide').innerHTML = valSummary(st.matches, me);
    const comp = st.matches.find(m => m.queue === 'competitive');
    const myTier = comp?.players.find(p => p.puuid === me)?.tier;
    $('#vRank').innerHTML = myTier ? `<span class="pill">${V.tier(myTier).replace('class="tier"', 'class="sp"')} ${esc(V.tierName(myTier))}</span>` : '';
    $('#vList').innerHTML = st.matches.length ? st.matches.map(m => valMatchRow(m, me)).join('') : '<div class="card empty-state">No matches found for this mode.</div>';
  }
  $('#vMore').addEventListener('click', load);
  $('#vq').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    st.queue = t.dataset.q; store.set('gglens.valQueue', st.queue);
    $$('#vq .tab').forEach(x => x.classList.toggle('on', x === t));
    Object.assign(st, { matches: [], start: 0, hasMore: true }); $('#vList').innerHTML = '<div class="loading">Loading…</div>'; load();
  });
  $('#vList').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const s = e.target.closest('.sum'); if (s) s.parentElement.classList.toggle('open');
  });
  await load();
}

function bodySvg(hs, bs, ls) {
  const c = v => `rgba(255,70,85,${0.18 + Math.min(1, v * 1.6) * 0.82})`;
  return `<svg width="56" height="120" viewBox="0 0 56 120" aria-hidden="true">
    <circle cx="28" cy="13" r="11" fill="${c(hs)}"/>
    <rect x="12" y="28" width="32" height="44" rx="7" fill="${c(bs)}"/>
    <rect x="2" y="30" width="8" height="36" rx="4" fill="${c(bs)}"/><rect x="46" y="30" width="8" height="36" rx="4" fill="${c(bs)}"/>
    <rect x="13" y="75" width="13" height="44" rx="5" fill="${c(ls)}"/><rect x="30" y="75" width="13" height="44" rx="5" fill="${c(ls)}"/>
  </svg>`;
}

function valSummary(matches, me) {
  if (!matches.length) return '<div class="card empty-state">No matches yet.</div>';
  const t = { n: 0, w: 0, l: 0, k: 0, d: 0, a: 0, score: 0, rounds: 0, dmg: 0, hs: 0, bs: 0, ls: 0, fk: 0, roundGames: 0 };
  const agents = {}, maps = {};
  for (const m of matches) {
    const p = m.players.find(x => x.puuid === me); if (!p) continue;
    const won = m.teams.find(x => x.id === p.team)?.won;
    t.n++; won ? t.w++ : t.l++;
    t.k += p.k; t.d += p.d; t.a += p.a; t.hs += p.hs; t.bs += p.bs; t.ls += p.ls; t.fk += p.fk;
    if (m.rounds > 1) { t.score += p.score; t.rounds += p.rounds; t.dmg += p.dmg; t.roundGames++; }
    const A = agents[p.agent] || (agents[p.agent] = { n: 0, w: 0, k: 0, d: 0, a: 0, score: 0, rounds: 0, hs: 0, shots: 0 });
    A.n++; if (won) A.w++; A.k += p.k; A.d += p.d; A.a += p.a; if (m.rounds > 1) { A.score += p.score; A.rounds += p.rounds; } A.hs += p.hs; A.shots += p.hs + p.bs + p.ls;
    if (m.rounds > 1) { const M = maps[m.map] || (maps[m.map] = { n: 0, w: 0 }); M.n++; if (won) M.w++; }
  }
  const shots = t.hs + t.bs + t.ls || 1;
  const hs = t.hs / shots, bs = t.bs / shots, ls = t.ls / shots;
  const stat = (k, v, s = '') => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const agentRows = Object.entries(agents).sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([id, A]) => `
    <tr><td><div class="row">${V.agent(id, 'ic sm')} ${esc(V.agentName(id))}</div></td><td class="num">${A.n}</td>
    <td class="num ${wrClass(A.w / A.n)}">${pct(A.w / A.n, 0)}</td><td class="num">${fix(A.k / Math.max(1, A.d), 2)}</td>
    <td class="num">${A.rounds ? Math.round(A.score / A.rounds) : '-'}</td><td class="num">${pct(A.hs / (A.shots || 1), 0)}</td></tr>`).join('');
  const mapRows = Object.entries(maps).sort((a, b) => b[1].n - a[1].n).map(([id, M]) => `
    <tr><td>${esc(V.map(id))}</td><td class="num">${M.n}</td><td class="num ${wrClass(M.w / M.n)}">${M.w}W ${M.n - M.w}L · ${pct(M.w / M.n, 0)}</td></tr>`).join('');
  return `
    <div class="card"><h3>Last ${t.n} matches</h3>
      <div class="stats">
        ${stat('Win rate', `<span class="${wrClass(t.w / t.n)}">${pct(t.w / t.n, 0)}</span>`, `${t.w}W ${t.l}L`)}
        ${stat('K/D', fix(t.k / Math.max(1, t.d), 2), `${fix(t.k / t.n)} / ${fix(t.d / t.n)} / ${fix(t.a / t.n)}`)}
        ${stat('ACS', t.rounds ? Math.round(t.score / t.rounds) : '-', 'Avg combat score')}
        ${stat('ADR', t.rounds ? Math.round(t.dmg / t.rounds) : '-', 'Damage / round')}
        ${stat('KDA', fix(kdaRatio(t.k, t.d, t.a), 2))}
        ${stat('First kills', fix(t.fk / t.n, 1), 'per match')}
      </div>
    </div>
    <div class="card"><h3>Accuracy (hit locations)</h3>
      <div class="acc">${bodySvg(hs, bs, ls)}
        <div style="flex:1">
          <div class="rowv"><span>Head</span><b>${pct(hs)}</b></div><div class="bar"><i style="width:${hs * 100}%"></i></div>
          <div class="rowv"><span>Body</span><b>${pct(bs)}</b></div><div class="bar"><i style="width:${bs * 100}%"></i></div>
          <div class="rowv"><span>Legs</span><b>${pct(ls)}</b></div><div class="bar"><i style="width:${ls * 100}%"></i></div>
          <div class="small dim" style="margin-top:8px">${num(shots)} hits counted</div>
        </div>
      </div>
    </div>
    <div class="card"><h3>Agents</h3><table><tr><th>Agent</th><th class="num">G</th><th class="num">Win</th><th class="num">K/D</th><th class="num">ACS</th><th class="num">HS</th></tr>${agentRows}</table></div>
    ${mapRows ? `<div class="card"><h3>Maps</h3><table><tr><th>Map</th><th class="num">G</th><th class="num">Record</th></tr>${mapRows}</table></div>` : ''}`;
}

function valMatchRow(m, me) {
  const p = m.players.find(x => x.puuid === me);
  if (!p) return '';
  const myTeam = m.teams.find(t => t.id === p.team);
  const other = m.teams.filter(t => t.id !== p.team).sort((a, b) => b.rounds - a.rounds)[0];
  const isDM = m.rounds <= 1;
  const draw = !isDM && other && myTeam && myTeam.rounds === other.rounds;
  const won = myTeam?.won;
  const cls = draw ? '' : won ? 'win' : 'loss';
  const shots = p.hs + p.bs + p.ls || 1;
  let place = '';
  if (isDM) {
    const order = [...m.players].sort((a, b) => b.k - a.k);
    place = `#${order.findIndex(x => x.puuid === me) + 1} of ${order.length}`;
  }
  const result = draw ? 'Draw' : isDM ? (won ? 'Victory' : place) : won ? 'Victory' : 'Defeat';
  const score = isDM ? place : `${myTeam?.rounds ?? 0} – ${other?.rounds ?? 0}`;
  return `<div class="match ${cls}">
    <div class="sum">
      <div><div class="res">${esc(result)}</div><div class="meta">${esc(V.queue(m.queue) || 'Custom')}</div><div class="meta">${ago(m.start)}</div></div>
      <div class="row">${V.agent(p.agent)}<div><div style="font-weight:600">${esc(V.map(m.map))}</div><div class="meta">${esc(score)}</div></div>${V.tier(p.tier)}</div>
      <div class="mstats">
        <div><div class="kda">${p.k}<span class="slash">/</span><span class="l">${p.d}</span><span class="slash">/</span>${p.a}</div><div class="meta">${fix(p.k / Math.max(1, p.d), 2)} K/D</div></div>
        ${isDM ? '' : `<div><div class="k">ACS</div><div class="v">${Math.round(p.score / Math.max(1, p.rounds))}</div></div>
        <div><div class="k">ADR</div><div class="v">${Math.round(p.dmg / Math.max(1, p.rounds))}</div></div>`}
        <div><div class="k">HS%</div><div class="v">${pct(p.hs / shots, 0)}</div></div>
        <div><div class="k">FK</div><div class="v">${p.fk}</div></div>
      </div>
      <div class="meta">${dur(m.duration)}</div>
    </div>
    <div class="detail">${valScoreboard(m, me)}</div>
  </div>`;
}

function valScoreboard(m, me) {
  const isDM = m.rounds <= 1;
  const groups = isDM ? [{ id: 'all', players: m.players }] :
    m.teams.map(t => ({ ...t, players: m.players.filter(p => p.team === t.id) }));
  const rows = list => [...list].sort((a, b) => (b.score / b.rounds) - (a.score / a.rounds) || b.k - a.k).map(p => {
    const sh = p.hs + p.bs + p.ls || 1;
    return `<tr class="${p.puuid === me ? 'me' : ''}">
      <td><div class="row">${V.agent(p.agent, 'ic sm')}<a class="plink" href="${playerLink('val', p.name, p.tag, settings().valShard)}">${esc(p.name)}<span class="dim">#${esc(p.tag)}</span></a></div></td>
      <td>${p.tier >= 3 ? `<div class="row small">${V.tier(p.tier).replace('class="tier"', 'class="sp"')} ${esc(V.tierName(p.tier))}</div>` : '<span class="dim">-</span>'}</td>
      ${isDM ? '' : `<td class="num">${Math.round(p.score / Math.max(1, p.rounds))}</td>`}
      <td class="num">${p.k}</td><td class="num">${p.d}</td><td class="num">${p.a}</td>
      <td class="num ${p.k - p.d >= 0 ? 'g' : 'l'}">${p.k - p.d > 0 ? '+' : ''}${p.k - p.d}</td>
      ${isDM ? '' : `<td class="num">${Math.round(p.dmg / Math.max(1, p.rounds))}</td>`}
      <td class="num">${pct(p.hs / sh, 0)}</td>${isDM ? '' : `<td class="num">${p.fk}</td>`}
    </tr>`;
  }).join('');
  const head = `<tr><th>Player</th><th>Rank</th>${isDM ? '' : '<th class="num">ACS</th>'}<th class="num">K</th><th class="num">D</th><th class="num">A</th><th class="num">+/-</th>${isDM ? '' : '<th class="num">ADR</th>'}<th class="num">HS%</th>${isDM ? '' : '<th class="num">FK</th>'}</tr>`;
  return groups.map(g => `${isDM ? '' : `<div class="teamhead ${g.won ? 'win' : 'loss'}">${esc(g.id)} team · ${g.rounds} rounds ${g.won ? '· Won' : ''}</div>`}
    <div class="scroll"><table>${head}${rows(g.players)}</table></div>`).join('');
}

// ===================== VALORANT: agent stats =====================
async function valAgents() {
  const token = navToken;
  let d;
  try { d = await api('/api/val/agents'); } catch (e) { if (alive(token)) main.innerHTML = `<h1 style="margin-bottom:12px">Agent stats</h1>${errBox(e)}`; return; }
  if (!alive(token)) return;
  const st = { map: '', rank: '', sort: 'pickRate', dir: -1, role: '' };
  const roles = [...new Set(Object.values(S.val.agents).map(a => a.role).filter(Boolean))].sort();
  main.innerHTML = `
    <div class="row sp-between wrap-row" style="margin-bottom:14px">
      <div><h1>Agent stats</h1><div class="mute">${esc(d.act?.episode || '')} ${esc(d.act?.name || '')} · ${esc(V.queue(d.queue))} · ${num(d.matches)} matches sampled${d.shard ? ' · ' + esc(d.shard.toUpperCase()) : ''}${d.demo ? ' · <span class="gold">demo data</span>' : ''}</div></div>
      <div class="row">
        <select id="aRole"><option value="">All roles</option>${roles.map(r => `<option>${esc(r)}</option>`).join('')}</select>
        <select id="aMap"><option value="">All maps</option>${d.maps.map(m => `<option value="${esc(m.id)}">${esc(V.map(m.id))} (${m.matches})</option>`).join('')}</select>
        <select id="aRank"><option value="">All ranks</option>${d.rankGroups.map((g, i) => i ? `<option value="${i}">${esc(g)}</option>` : '').join('')}</select>
      </div>
    </div>
    <div class="card scroll" id="aTable"></div>`;
  const cols = [['agent', 'Agent'], ['role', 'Role'], ['pickRate', 'Pick rate'], ['winRate', 'Win rate'], ['kd', 'K/D'], ['acs', 'ACS'], ['adr', 'ADR'], ['hs', 'HS%'], ['fkpr', 'FK/round'], ['picks', 'Picks']];
  function rowsFor() {
    return d.agents.map(a => {
      const sub = st.map ? a.maps[st.map] : st.rank ? a.ranks[st.rank] : null;
      if ((st.map || st.rank) && !sub) return null;
      const r = { ...a, name: V.agentName(a.id), role: S.val.agents[a.id]?.role || '' };
      if (sub) Object.assign(r, { pickRate: sub.pickRate, winRate: sub.winRate, picks: sub.picks });
      return r;
    }).filter(r => r && (!st.role || r.role === st.role));
  }
  function render() {
    const rows = rowsFor().sort((a, b) => {
      const k = st.sort === 'agent' ? 'name' : st.sort;
      return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * st.dir;
    });
    const maxPick = Math.max(...rows.map(r => r.pickRate), 0.01);
    $('#aTable').innerHTML = `<table><tr>${cols.map(([k, n]) => `<th class="sort ${k === st.sort ? 'sorted' : ''} ${['agent', 'role'].includes(k) ? '' : 'num'}" data-k="${k}">${n}${k === st.sort ? (st.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr>
      ${rows.map(r => `<tr>
        <td><div class="row">${V.agent(r.id, 'ic sm')}<b>${esc(r.name)}</b></div></td><td class="mute">${esc(r.role)}</td>
        <td class="num"><div class="row" style="justify-content:flex-end">${pct(r.pickRate)}<span class="bar dmgbar"><i style="width:${r.pickRate / maxPick * 100}%"></i></span></div></td>
        <td class="num ${wrClass(r.winRate)}">${pct(r.winRate)}</td>
        <td class="num">${fix(r.kd, 2)}</td><td class="num">${Math.round(r.acs)}</td><td class="num">${Math.round(r.adr)}</td>
        <td class="num">${pct(r.hs)}</td><td class="num">${fix(r.fkpr, 2)}</td><td class="num dim">${num(r.picks)}</td></tr>`).join('')}
      </table>${(st.map || st.rank) ? '<div class="small dim" style="margin-top:8px">K/D, ACS, ADR and HS% are act-wide; pick and win rate are filtered.</div>' : ''}`;
  }
  $('#aTable').addEventListener('click', e => {
    const th = e.target.closest('th.sort'); if (!th) return;
    if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = ['agent', 'role'].includes(st.sort) ? 1 : -1; }
    render();
  });
  $('#aMap').onchange = e => { st.map = e.target.value; if (st.map) { st.rank = ''; $('#aRank').value = ''; } render(); };
  $('#aRank').onchange = e => { st.rank = e.target.value; if (st.rank) { st.map = ''; $('#aMap').value = ''; } render(); };
  $('#aRole').onchange = e => { st.role = e.target.value; render(); };
  render();
}

// ===================== LEAGUE: player =====================
const ARENA_QUEUES = [1700, 1710, 1750];
const LOL_QUEUE_FILTER = ['', 420, 440, 400, 490, 480, 450, 1750, 2400, 900, 1900, 1020, 1300];
const ROLE_NAMES = { TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid', BOTTOM: 'Bot', UTILITY: 'Support', ALL: 'All' };
const tierText = r => (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier) ? r.tier[0] + r.tier.slice(1).toLowerCase() : `${r.tier[0]}${r.tier.slice(1).toLowerCase()} ${r.rank}`);

async function lolPlayer(riotId, platform, isMe) {
  const token = navToken;
  platform = platform || settings().lolPlatform;
  const prof = await api(`/api/lol/profile?riotId=${enc(riotId)}&platform=${enc(platform)}`);
  if (!alive(token)) return;
  const st = { matches: [], start: 0, queue: store.get('gglens.lolQueue', ''), hasMore: true, busy: false };
  const me = prof.account.puuid;
  const rankCard = q => {
    const r = prof.ranks.find(x => x.queue === q);
    const label = q === 'RANKED_SOLO_5x5' ? 'Ranked Solo/Duo' : 'Ranked Flex';
    if (!r) return `<div class="rank">${img('', 'Unranked', 'emb')}<div><span class="small mute">${label}</span><b>Unranked</b></div></div>`;
    const g = r.wins + r.losses;
    return `<div class="rank">${L.emblem(r.tier)}<div><span class="small mute">${label}</span><b>${esc(tierText(r))} · ${r.lp} LP</b><span class="small"><span class="${wrClass(r.wins / g)}">${pct(r.wins / g, 0)}</span> <span class="mute">${r.wins}W ${r.losses}L</span></span></div></div>`;
  };
  main.innerHTML = `
    <div class="phead">
      ${L.icon(prof.summoner.profileIconId)}
      <div><div class="name">${esc(prof.account.gameName)} <span class="tag">#${esc(prof.account.tagLine)}</span></div>
        <div class="row small mute"><span class="pill">${esc(prof.platform.toUpperCase())}</span><span class="pill">Level ${prof.summoner.level}</span>${isMe ? '<span class="pill">You</span>' : ''}<span id="liveBadge"></span></div></div>
      <div class="ranks">${rankCard('RANKED_SOLO_5x5')}${rankCard('RANKED_FLEX_SR')}</div>
    </div>
    <div class="tabs" id="lq">${LOL_QUEUE_FILTER.map(q => `<div class="tab ${String(q) === String(st.queue) ? 'on' : ''}" data-q="${q}">${q ? esc(L.queue(q)) : 'All modes'}</div>`).join('')}</div>
    <div class="cols">
      <div class="grid" id="lSide"></div>
      <div><div id="lList"></div><div class="more"><button class="ghost" id="lMore">Load more</button></div></div>
    </div>`;
  const masteryHtml = prof.mastery.length ? `<div class="card"><h3>Top mastery</h3><div class="stack">${prof.mastery.map(m => `
    <a class="row" style="padding:4px 0" href="#/lol/builds/${m.championId}">${L.champ(m.championId, 'ic sm')}<span style="flex:1">${esc(L.champName(m.championId))}</span><span class="mute small">M${m.level} · ${kfmt(m.points)}</span></a>`).join('')}</div></div>` : '';

  async function load() {
    if (st.busy) return; st.busy = true; $('#lMore').disabled = true; $('#lMore').textContent = 'Loading…';
    try {
      const r = await api(`/api/lol/matches?puuid=${enc(me)}&platform=${enc(prof.platform)}&start=${st.start}&count=10&queue=${enc(st.queue)}`);
      if (!alive(token)) return;
      st.matches.push(...r.matches); st.start += 10; st.hasMore = r.hasMore;
      $('#lSide').innerHTML = lolSummary(st.matches, me) + masteryHtml;
      $('#lList').innerHTML = st.matches.length ? st.matches.map(m => lolMatchRow(m, me, prof.platform)).join('') : '<div class="card empty-state">No matches found for this mode.</div>';
    } catch (e) { $('#lList').innerHTML = errBox(e); }
    finally { st.busy = false; const b = $('#lMore'); if (b) { b.disabled = !st.hasMore; b.textContent = st.hasMore ? 'Load more' : 'No more matches'; } }
  }
  api(`/api/lol/live?riotId=${enc(riotId)}&platform=${enc(prof.platform)}`).then(g => {
    if (alive(token) && g.inGame) $('#liveBadge').innerHTML = `<a class="pill live" href="#/lol/live/${enc(riotId)}?r=${enc(prof.platform)}"><span class="dot"></span> In game: ${esc(L.queue(g.queue))} · watch</a>`;
  }).catch(() => {});
  $('#lMore').addEventListener('click', load);
  $('#lq').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    st.queue = t.dataset.q; store.set('gglens.lolQueue', st.queue);
    $$('#lq .tab').forEach(x => x.classList.toggle('on', x === t));
    Object.assign(st, { matches: [], start: 0, hasMore: true }); $('#lList').innerHTML = '<div class="loading">Loading…</div>'; load();
  });
  $('#lList').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const s = e.target.closest('.sum'); if (s) s.parentElement.classList.toggle('open');
  });
  await load();
}

function lolSummary(matches, me) {
  const ms = matches.filter(m => !m.remake);
  if (!ms.length) return '<div class="card empty-state">No matches yet.</div>';
  const t = { n: 0, w: 0, k: 0, d: 0, a: 0, cs: 0, min: 0, dmg: 0, vis: 0, kp: 0, kpN: 0 };
  const champs = {}, roles = {};
  for (const m of ms) {
    const p = m.participants.find(x => x.puuid === me); if (!p) continue;
    const min = m.duration / 60;
    t.n++; if (p.win) t.w++; t.k += p.k; t.d += p.d; t.a += p.a; t.dmg += p.dmg; t.min += min;
    if (!p.sub) { t.cs += p.cs; t.vis += p.vision; }
    const teamKills = m.participants.filter(x => (p.sub ? x.sub === p.sub : x.team === p.team)).reduce((s, x) => s + x.k, 0);
    if (teamKills) { t.kp += (p.k + p.a) / teamKills; t.kpN++; }
    const C = champs[p.champId] || (champs[p.champId] = { n: 0, w: 0, k: 0, d: 0, a: 0, cs: 0, min: 0 });
    C.n++; if (p.win) C.w++; C.k += p.k; C.d += p.d; C.a += p.a; C.cs += p.cs; C.min += min;
    if (p.role) roles[p.role] = (roles[p.role] || 0) + 1;
  }
  const srMin = ms.filter(m => !m.participants.some(x => x.sub)).reduce((s, m) => s + m.duration / 60, 0) || 1;
  const stat = (k, v, s = '') => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const champRows = Object.entries(champs).sort((a, b) => b[1].n - a[1].n).slice(0, 7).map(([id, C]) => `
    <tr class="click" onclick="location.hash='#/lol/builds/${id}'"><td><div class="row">${L.champ(id, 'ic sm')} ${esc(L.champName(id))}</div></td><td class="num">${C.n}</td>
    <td class="num ${wrClass(C.w / C.n)}">${pct(C.w / C.n, 0)}</td><td class="num">${fix(kdaRatio(C.k, C.d, C.a), 2)}</td><td class="num">${fix(C.cs / C.min, 1)}</td></tr>`).join('');
  const roleTotal = Object.values(roles).reduce((a, b) => a + b, 0);
  const roleHtml = roleTotal ? `<div class="card"><h3>Roles</h3>${Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([r, n]) => `
    <div class="rowv row sp-between small" style="margin-top:6px"><span>${ROLE_NAMES[r] || r}</span><span class="mute">${n} · ${pct(n / roleTotal, 0)}</span></div><div class="bar"><i style="width:${n / roleTotal * 100}%"></i></div>`).join('')}</div>` : '';
  return `
    <div class="card"><h3>Last ${t.n} games</h3>
      <div class="stats">
        ${stat('Win rate', `<span class="${wrClass(t.w / t.n)}">${pct(t.w / t.n, 0)}</span>`, `${t.w}W ${t.n - t.w}L`)}
        ${stat('KDA', fix(kdaRatio(t.k, t.d, t.a), 2), `${fix(t.k / t.n)} / ${fix(t.d / t.n)} / ${fix(t.a / t.n)}`)}
        ${stat('Kill part.', pct(t.kp / (t.kpN || 1), 0))}
        ${stat('CS / min', fix(t.cs / srMin, 1))}
        ${stat('Damage / min', Math.round(t.dmg / (t.min || 1)))}
        ${stat('Vision / min', fix(t.vis / srMin, 2))}
      </div>
    </div>
    <div class="card"><h3>Champions</h3><table><tr><th>Champion</th><th class="num">G</th><th class="num">Win</th><th class="num">KDA</th><th class="num">CS/m</th></tr>${champRows}</table></div>
    ${roleHtml}`;
}

function lolMatchRow(m, me, platform) {
  const p = m.participants.find(x => x.puuid === me);
  if (!p) return '';
  const arena = m.participants.some(x => x.sub);
  const min = m.duration / 60;
  const teamKills = m.participants.filter(x => (arena ? x.sub === p.sub : x.team === p.team)).reduce((s, x) => s + x.k, 0);
  const cls = m.remake ? '' : p.win ? 'win' : 'loss';
  const result = m.remake ? 'Remake' : arena ? `${ordinal(p.place)} place` : p.win ? 'Victory' : 'Defeat';
  const loadout = arena || p.aug.length
    ? `<div class="stack"><div class="items">${p.aug.slice(0, 3).map(L.aug).join('')}</div><div class="items">${p.aug.slice(3, 6).map(L.aug).join('')}</div></div>`
    : `<div class="stack">${L.spell(p.spells[0])}${L.spell(p.spells[1])}</div><div class="stack">${L.rune(p.keystone)}${p.secondary ? L.rune(p.secondary, 'rn sm') : ''}</div>`;
  return `<div class="match ${cls}">
    <div class="sum">
      <div><div class="res">${esc(result)}</div><div class="meta">${esc(L.queue(m.queue))}</div><div class="meta">${ago(m.end)} · ${dur(m.duration)}</div></div>
      <div class="row"><div style="position:relative">${L.champ(p.champId, 'ic lg')}<span class="pill" style="position:absolute;bottom:-6px;right:-6px;padding:1px 6px">${p.level}</span></div>${loadout}</div>
      <div class="mstats">
        <div><div class="kda">${p.k}<span class="slash">/</span><span class="l">${p.d}</span><span class="slash">/</span>${p.a}</div><div class="meta">${fix(kdaRatio(p.k, p.d, p.a), 2)} KDA</div></div>
        ${arena ? '' : `<div><div class="k">CS</div><div class="v">${p.cs} <span class="meta">(${fix(p.cs / min, 1)})</span></div></div>`}
        <div><div class="k">KP</div><div class="v">${teamKills ? pct((p.k + p.a) / teamKills, 0) : '-'}</div></div>
        <div><div class="k">Damage</div><div class="v">${kfmt(p.dmg)}</div></div>
        <div class="items">${p.items.slice(0, 6).map(id => L.item(id)).join('')}${arena ? '' : L.item(p.items[6])}</div>
      </div>
      <div class="meta">${p.multi >= 3 ? `<span class="pill gold">${['', '', 'Double', 'Triple', 'Quadra', 'Penta'][p.multi]} kill</span>` : ''}</div>
    </div>
    <div class="detail">${lolScoreboard(m, me, platform)}</div>
  </div>`;
}
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function lolScoreboard(m, me, platform) {
  const arena = m.participants.some(x => x.sub);
  const min = m.duration / 60;
  const maxDmg = Math.max(...m.participants.map(p => p.dmg), 1);
  let groups;
  if (arena) {
    const subs = {};
    for (const p of m.participants) (subs[p.sub] || (subs[p.sub] = [])).push(p);
    groups = Object.values(subs).sort((a, b) => a[0].place - b[0].place).map(ps => ({ title: `${ordinal(ps[0].place)} place`, win: ps[0].place <= 4, players: ps }));
  } else {
    groups = [100, 200].map(tid => {
      const ps = m.participants.filter(p => p.team === tid);
      const team = m.teams.find(t => t.id === tid);
      return { title: `${tid === 100 ? 'Blue' : 'Red'} team · ${ps.reduce((s, p) => s + p.k, 0)} kills${team?.bans?.length ? ' · bans ' : ''}`, bans: team?.bans || [], win: ps[0]?.win, players: ps };
    });
  }
  const head = `<tr><th>Player</th><th class="num">KDA</th><th class="num">Damage</th><th class="num">Gold</th>${arena ? '' : '<th class="num">CS</th><th class="num">Vision</th>'}<th>Items</th></tr>`;
  return groups.map(g => `<div class="teamhead ${g.win ? 'win' : 'loss'} row">${esc(g.title)}${(g.bans || []).filter(b => b > 0).map(b => L.champ(b, 'sp')).join('')}</div>
    <div class="scroll"><table>${head}${g.players.map(p => `
      <tr class="${p.puuid === me ? 'me' : ''}">
        <td><div class="row">${L.champ(p.champId, 'ic sm')}<div class="stack">${p.aug.length ? '' : `${L.spell(p.spells[0])}`}</div>
          <a class="plink" href="${playerLink('lol', p.name, p.tag, platform)}">${esc(p.name)}<span class="dim">#${esc(p.tag)}</span></a></div></td>
        <td class="num">${p.k}/${p.d}/${p.a} <span class="dim">${fix(kdaRatio(p.k, p.d, p.a), 1)}</span></td>
        <td class="num">${kfmt(p.dmg)}<span class="bar dmgbar"><i style="width:${p.dmg / maxDmg * 100}%"></i></span></td>
        <td class="num">${kfmt(p.gold)}</td>
        ${arena ? '' : `<td class="num">${p.cs} <span class="dim">${fix(p.cs / min, 1)}</span></td><td class="num">${p.vision}</td>`}
        <td><div class="items">${p.items.slice(0, 6).map(id => L.item(id, 'it')).join('')}</div></td>
      </tr>`).join('')}</table></div>`).join('');
}

// ===================== LEAGUE: live game =====================
async function lolLive(riotId, platform, isMe) {
  const token = navToken;
  platform = platform || settings().lolPlatform;
  let timer = null, refresher = null;
  const stop = () => { clearInterval(timer); clearInterval(refresher); };
  async function load() {
    const g = await api(`/api/lol/live?riotId=${enc(riotId)}&platform=${enc(platform)}`);
    if (!alive(token)) return stop();
    render(g);
  }
  function render(g) {
    stop();
    const who = `${esc(g.account.gameName)} <span class="tag">#${esc(g.account.tagLine)}</span>`;
    if (!g.inGame) {
      main.innerHTML = `<div class="phead"><div><div class="name">${who}</div><div class="small mute">Live game · ${esc(platform.toUpperCase())}</div></div></div>
        <div class="card empty-state">Not in a game right now.<br><br><button class="ghost" id="lvAgain">Check again</button>
        <a href="${playerLink('lol', g.account.gameName, g.account.tagLine, platform)}"><button class="ghost">Match history</button></a></div>`;
      $('#lvAgain').onclick = () => { main.innerHTML = '<div class="loading">Checking…</div>'; load().catch(e => { main.innerHTML = errBox(e); }); };
      return;
    }
    const startMs = g.start || (g.fetchedAt - g.length * 1000);
    const elapsed = () => { const s = Math.max(0, Math.floor((Date.now() - startMs) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const teams = [...new Set(g.players.map(p => p.team))].sort();
    const rankCell = p => {
      if (p.bot) return '<span class="dim">Bot</span>';
      if (!p.rank) return '<span class="dim">Unranked</span>';
      const games = p.rank.wins + p.rank.losses;
      return `<div class="row">${L.emblem(p.rank.tier).replace('class="emb"', 'class="emb sm"')}<div><b>${esc(tierText(p.rank))}</b> <span class="mute small">${p.rank.lp} LP</span>
        <div class="small"><span class="${wrClass(p.rank.wins / games)}">${pct(p.rank.wins / games, 0)}</span> <span class="dim">${games} games${p.rank.queue === 'RANKED_FLEX_SR' ? ' (Flex)' : ''}</span></div></div></div>`;
    };
    const teamName = t => (t === 100 ? 'Blue team' : t === 200 ? 'Red team' : `Team ${t}`);
    main.innerHTML = `
      <div class="phead">
        <div><div class="name">${who}</div>
          <div class="row small mute"><span class="pill live"><span class="dot"></span> Live</span><span class="pill">${esc(L.queue(g.queue))}</span><span class="pill">${esc(platform.toUpperCase())}</span></div></div>
        <div class="ranks"><div class="rank"><div><span class="small mute">Game time</span><b id="lvClock" style="font-size:24px">${elapsed()}</b></div></div>
          <div class="row"><button class="ghost" id="lvRefresh">Refresh</button></div></div>
      </div>
      <div class="grid">${teams.map(t => {
        const ps = g.players.filter(p => p.team === t);
        const bans = g.bans.filter(b => b.team === t && b.champId > 0);
        return `<div class="card"><div class="row sp-between" style="margin-bottom:6px"><h2 class="${t === 100 ? 'w' : 'l'}" style="margin:0">${teamName(t)}</h2>
          ${bans.length ? `<div class="row small mute">Bans ${bans.map(b => L.champ(b.champId, 'ic sm')).join('')}</div>` : ''}</div>
          <div class="scroll"><table><tr><th>Champion</th><th>Player</th><th>Rank</th><th>Most played</th><th>Runes</th></tr>
          ${ps.map(p => `<tr class="${p.puuid === g.account.puuid ? 'me' : ''}">
            <td><div class="row"><a href="#/lol/builds/${p.champId}${g.queue ? '/' + g.queue : ''}" title="Open build">${L.champ(p.champId)}</a><div class="stack">${L.spell(p.spells[0])}${L.spell(p.spells[1])}</div><span>${esc(L.champName(p.champId))}</span></div></td>
            <td>${p.bot ? esc(p.name) : `<a class="plink" href="${playerLink('lol', p.name, p.tag, platform)}">${esc(p.name)}<span class="dim">#${esc(p.tag)}</span></a>`}</td>
            <td>${rankCell(p)}</td>
            <td><div class="mains">${(p.mains || []).map(m => `<span class="main ${m.champId === p.champId ? 'cur' : ''}" title="${esc(L.champName(m.champId))} · Mastery ${m.level} · ${num(m.points)} pts">${L.champ(m.champId, 'ic sm')}<span class="small mute">${kfmt(m.points)}</span></span>`).join('') || '<span class="dim">-</span>'}
              ${p.bot ? '' : `<button class="ghost tiny" data-recent="${esc(p.puuid)}">Recent games</button>`}</div>
              ${(p.mains || []).some(m => m.champId === p.champId) ? '<div class="small gold">Playing one of their mains</div>' : ''}
              <div class="recent" id="rc-${esc(p.puuid)}"></div></td>
            <td><div class="row">${p.keystone ? L.rune(p.keystone) : ''}${p.secondary ? L.rune(p.secondary, 'rn sm') : ''}<span class="small mute">${p.keystone ? esc(L.runeName(p.keystone)) : ''}</span></div></td>
          </tr>`).join('')}</table></div></div>`;
      }).join('')}</div>
      <div class="small dim" style="margin-top:10px">Riot delays live game data by about 3 minutes. Click a champion to open its build for this mode. Hover a champion for details. Checks every minute whether the game has ended.</div>`;
    timer = setInterval(() => { if (!alive(token)) return stop(); const c = $('#lvClock'); if (c) c.textContent = elapsed(); }, 1000);
    refresher = setInterval(async () => {
      if (!alive(token)) return stop();
      // only re-render if the game ended or changed, so opened "Recent games" stay visible
      try { const n = await api(`/api/lol/live?riotId=${enc(riotId)}&platform=${enc(platform)}`); if (alive(token) && (!n.inGame || n.gameId !== g.gameId)) render(n); } catch {}
    }, 60e3);
    $('#lvRefresh').onclick = () => load().catch(e => { main.innerHTML = errBox(e); });
    main.querySelectorAll('[data-recent]').forEach(btn => btn.addEventListener('click', async () => {
      const puuid = btn.dataset.recent, box = document.getElementById('rc-' + puuid);
      btn.disabled = true; btn.textContent = 'Loading…';
      const q = [420, 440].includes(g.queue) ? g.queue : '';
      try {
        const r = await api(`/api/lol/recent?puuid=${enc(puuid)}&platform=${enc(platform)}&queue=${q}`);
        btn.remove();
        box.innerHTML = r.games ? `<div class="small mute" style="margin:4px 0 2px">Last ${r.games}${q ? ' ' + esc(L.queue(q)) : ''} games · <span class="${wrClass(r.wins / r.games)}">${pct(r.wins / r.games, 0)}</span></div>
          <div class="mains">${r.champs.slice(0, 5).map(c => `<span class="main ${c.champId === g.players.find(x => x.puuid === puuid)?.champId ? 'cur' : ''}" title="${esc(L.champName(c.champId))}: ${c.wins}W ${c.games - c.wins}L, KDA ${fix(kdaRatio(c.k, c.d, c.a), 2)}">${L.champ(c.champId, 'ic sm')}<span class="small"><span class="${wrClass(c.wins / c.games)}">${c.wins}W</span> <span class="dim">${c.games - c.wins}L</span></span></span>`).join('')}</div>`
          : '<div class="small dim">No recent games.</div>';
      } catch (e) { btn.disabled = false; btn.textContent = 'Retry'; box.innerHTML = `<div class="small l">${esc(e.message)}</div>`; }
    }));
  }
  await load();
}

// ===================== LEAGUE: builds & tier list =====================
const LANES = [['', 'All lanes'], ['TOP', 'Top'], ['JUNGLE', 'Jungle'], ['MIDDLE', 'Mid'], ['BOTTOM', 'Bot'], ['UTILITY', 'Support']];
const LANE_ICON = { '': 'fill', TOP: 'top', JUNGLE: 'jungle', MIDDLE: 'middle', BOTTOM: 'bottom', UTILITY: 'utility' };
const laneIcon = (k, n) => img(`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${LANE_ICON[k]}.png`, n, 'laneic');

const FLEX_NOTE = `<div class="note">⚠️ <b>Take Ranked Flex stats with a grain of salt.</b> At higher ranks, players often queue in Flex with their regular teammates, so win rates can reflect coordinated premade groups more than the champions themselves. Plan around that before copying a pick or build.</div>`;

function assignTiers(champs, matches) {
  const minGames = Math.max(5, Math.round(matches * 0.004));
  const eligible = champs.filter(c => c.games >= minGames);
  const avg = eligible.reduce((s, c) => s + c.wins, 0) / Math.max(1, eligible.reduce((s, c) => s + c.games, 0));
  for (const c of champs) {
    const wr = c.wins / c.games;
    // shrink winrate toward the mean for small samples, then reward popularity a little
    const adj = (c.wins + avg * 20) / (c.games + 20);
    c.score = (adj - avg) * 100 + Math.sqrt(c.pickRate) * 6 + (c.banRate || 0) * 4;
    c.wr = wr;
  }
  const sorted = [...eligible].sort((a, b) => b.score - a.score);
  sorted.forEach((c, i) => { const q = i / sorted.length; c.tier = q < 0.08 ? 'S' : q < 0.28 ? 'A' : q < 0.62 ? 'B' : q < 0.88 ? 'C' : 'D'; });
  for (const c of champs) if (!c.tier) c.tier = '?';
}

async function lolBuilds() {
  const token = navToken;
  let idx;
  try { idx = await api('/api/lol/builds'); } catch (e) { if (alive(token)) main.innerHTML = `<h1 style="margin-bottom:12px">Builds &amp; tier list</h1>${errBox(e)}`; return; }
  if (!alive(token)) return;
  if (!idx.queues.length) { main.innerHTML = '<div class="card empty-state">No matches collected yet. Run <code>npm run crawl:lol</code>.</div>'; return; }
  const saved = store.get('gglens.buildQueue', null);
  const st = { q: idx.queues.find(q => q.id === saved) ? saved : idx.queues[0].id, search: '', sort: 'tier', dir: 1, role: store.get('gglens.buildRole', '') };
  main.innerHTML = `
    <div class="row sp-between wrap-row" style="margin-bottom:14px">
      <div><h1>Builds &amp; tier list</h1><div class="mute">Patch ${esc(idx.patch || '?')}${idx.platform ? ' · ' + esc(idx.platform.toUpperCase()) : ''}${idx.demo ? ' · <span class="gold">demo data</span>' : ''} · pick a mode, then a champion for its build</div></div>
      <input id="bSearch" placeholder="Search champion…" style="width:220px">
    </div>
    <div class="tabs" id="bq">${idx.queues.map(q => `<div class="tab" data-q="${q.id}">${esc(q.name)} <span class="dim small">${num(q.matches)}</span></div>`).join('')}</div>
    <div id="bNote"></div>
    <div class="lanes" id="bLanes">${LANES.map(([k, n]) => `<button class="lane" data-role="${k}" title="${n}">${laneIcon(k, n)}</button>`).join('')}</div>
    <div class="card scroll" id="bTable"></div>`;
  const ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4, '?': 5 };
  function render() {
    $$('#bq .tab').forEach(t => t.classList.toggle('on', +t.dataset.q === st.q));
    const Q = idx.queues.find(q => q.id === st.q);
    $('#bNote').innerHTML = st.q === 440 ? FLEX_NOTE : '';
    const hasLanes = Q.champions.some(c => c.roles && Object.keys(c.roles).length);
    $('#bLanes').style.display = hasLanes ? '' : 'none';
    const role = hasLanes ? st.role : '';
    $$('#bLanes .lane').forEach(b => b.classList.toggle('on', b.dataset.role === role));
    let champs = Q.champions.map(c => ({ ...c, name: L.champName(c.id) }));
    if (role) {
      // lane view: only champions with a real share of games in this lane, using that lane's numbers
      champs = champs.filter(c => c.roles?.[role] && c.roles[role].games >= Math.max(3, c.games * 0.1))
        .map(c => ({ ...c, games: c.roles[role].games, wins: c.roles[role].wins, pickRate: c.roles[role].games / Q.matches }));
    }
    assignTiers(champs, Q.matches);
    const arena = ARENA_QUEUES.includes(st.q);
    let rows = champs.filter(c => !st.search || c.name.toLowerCase().includes(st.search));
    const key = { tier: c => ORDER[c.tier] * 1000 - c.score, name: c => c.name, wr: c => c.wr, pickRate: c => c.pickRate, banRate: c => c.banRate, games: c => c.games }[st.sort];
    rows.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; });
    const hasBans = champs.some(c => c.banRate > 0);
    const th = (k, n, numCls = true) => `<th class="sort ${numCls ? 'num' : ''} ${st.sort === k ? 'sorted' : ''}" data-k="${k}">${n}${st.sort === k ? (st.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
    $('#bTable').innerHTML = `<table><tr>${th('tier', 'Tier', false)}${th('name', 'Champion', false)}${th('wr', arena ? 'Top 4 rate' : 'Win rate')}${th('pickRate', 'Pick rate')}${hasBans ? th('banRate', 'Ban rate') : ''}${th('games', 'Games')}</tr>
      ${rows.map(c => `<tr class="click" data-id="${c.id}">
        <td><span class="tierbadge t-${c.tier === '?' ? 'D' : c.tier}">${c.tier}</span></td>
        <td><div class="row">${L.champ(c.id, 'ic sm')}<b>${esc(c.name)}</b></div></td>
        <td class="num ${wrClass(c.wr)}">${pct(c.wr)}</td><td class="num">${pct(c.pickRate)}</td>
        ${hasBans ? `<td class="num">${pct(c.banRate)}</td>` : ''}<td class="num dim">${num(c.games)}</td></tr>`).join('')}
      </table>${rows.length ? '' : '<div class="empty-state">No champions match.</div>'}`;
  }
  $('#bq').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; st.q = +t.dataset.q; store.set('gglens.buildQueue', st.q); render(); });
  $('#bLanes').addEventListener('click', e => { const b = e.target.closest('.lane'); if (!b) return; st.role = b.dataset.role; store.set('gglens.buildRole', st.role); render(); });
  $('#bSearch').addEventListener('input', e => { st.search = e.target.value.trim().toLowerCase(); render(); });
  $('#bTable').addEventListener('click', e => {
    const th = e.target.closest('th.sort');
    if (th) { if (st.sort === th.dataset.k) st.dir *= -1; else { st.sort = th.dataset.k; st.dir = ['tier', 'name'].includes(st.sort) ? 1 : -1; } return render(); }
    const tr = e.target.closest('tr[data-id]'); if (tr) go(`#/lol/builds/${tr.dataset.id}/${st.q}${st.role && $('#bLanes').style.display !== 'none' ? '?role=' + st.role : ''}`);
  });
  render();
}

// Recommended 6-item build (most popular core + boots + most popular 4th/5th/6th items),
// plus the long (5-6 item) builds actually seen in games.
function fullBuildCard(r, itemsRow, itemNames, opts, card) {
  const used = new Set();
  const take = id => { if (id && !used.has(id)) { used.add(id); return id; } return null; };
  // supports: the upgraded support item counts as one of the 6 when most games end with one
  // everything after the core comes from games that started with that same core (keeps AP and AD builds apart)
  const topCore = r.core[0];
  const after = topCore?.after;
  const supList = after?.support?.length ? after.support : r.support || [];
  const supBase = after?.support?.length ? after.games : (r.itemGames || r.games);
  const sup = supList[0] && supList[0].games >= supBase * 0.4 ? take(supList[0].id) : null;
  const core = (topCore?.items || []).map(take).filter(Boolean);
  const boots = take((after?.boots?.[0] || r.boots[0])?.id);
  const late = [];
  for (const list of (after?.slots || [])) { const pickId = list.map(x => x.id).find(id => !used.has(id)); if (pickId) late.push(take(pickId)); }
  // still short (games ended early)? fill only from long builds that start with this core, then this core's other options
  const coreKey = (topCore?.items || []).join(',');
  for (const f of (r.full || [])) {
    if (core.length + late.length + (boots ? 1 : 0) + (sup ? 1 : 0) >= 6) break;
    const fi = f.items.filter(id => !(S.lol.items[id]?.tags || []).includes('Boots'));
    if (fi.slice(0, core.length).join(',') !== coreKey && !(sup && fi[0] === sup && fi.slice(1, core.length + 1).join(',') === coreKey)) continue;
    for (const id of fi) { if (core.length + late.length + (boots ? 1 : 0) + (sup ? 1 : 0) >= 6) break; const t = take(id); if (t) late.push(t); }
  }
  for (const list of (after?.slots || [])) for (const x of list) { if (core.length + late.length + (boots ? 1 : 0) + (sup ? 1 : 0) >= 6) break; const t = take(x.id); if (t) late.push(t); }
  // put boots where players usually buy them (from real full builds), default 2nd
  let bootPos = 1;
  const withBoots = (r.full || []).find(f => f.items.includes(boots));
  if (withBoots) bootPos = Math.min(withBoots.items.indexOf(boots), core.length);
  const rec = [...core, ...late].slice(0, 6 - (boots ? 1 : 0) - (sup ? 1 : 0));
  if (boots) rec.splice(bootPos, 0, boots);
  if (sup) rec.unshift(sup);
  const pickPct = id => { const it = r.items.find(x => x.id === id) || r.boots.find(x => x.id === id) || (r.support || []).find(x => x.id === id); return it ? pct(it.games / (r.itemGames || r.games), 0) : ''; };
  const short = rec => rec.length < 6;
  const recHtml = rec.length >= 3 ? `<div class="opt"><div>${itemsRow(rec)}<div class="small mute" style="margin-top:4px">${esc(itemNames(rec))}</div>
      <div class="small dim" style="margin-top:2px">${after ? `Most popular core (${num(topCore.games)} games), then what those same games built next` : 'Built from the most popular core and items'}${rec.length < 6 ? ` · only ${rec.length} items: games with this core rarely went longer` : ''}</div></div></div>` : '';
  let long = (r.full || []).filter(f => f.items.length >= 5);
  if (!long.length) long = (r.full || []).filter(f => f.items.length >= 4);
  const longHtml = long.length ? `<div class="small mute" style="margin:12px 0 0">Long builds seen in games (${long[0].items.length >= 5 ? '5–6' : '4+'} items, in buy order)</div>${opts(long.slice(0, 4), o => `<div>${itemsRow(o.items)}<div class="small mute" style="margin-top:4px">${esc(itemNames(o.items))}</div></div>`)}`
    : '<div class="small dim" style="margin-top:10px">Not enough long games yet to show complete builds people actually finished.</div>';
  return card('Full build (6 items)', recHtml + longHtml);
}

// Full rune page: every rune in both trees, chosen ones lit, the rest dimmed (like the in-game rune screen).
const SHARD_ROWS = [[5008, 5005, 5007], [5008, 5010, 5001], [5011, 5013, 5001]];
const SHARD_ICON = { 5008: 'statmodsadaptiveforceicon', 5005: 'statmodsattackspeedicon', 5007: 'statmodscdrscalingicon', 5010: 'statmodsmovementspeedicon', 5001: 'statmodshealthscalingicon', 5011: 'statmodshealthplusicon', 5013: 'statmodstenacityicon', 5002: 'statmodsarmoricon', 5003: 'statmodsmagicresicon' };
function runeFull(ru) {
  if (!ru) return '';
  const P = S.lol.styles[ru.primary], Sec = S.lol.styles[ru.secondary];
  if (!P?.slots) { // no tree layout available (offline data): simple list
    return `<div class="rtree">${[ru.primary, ...ru.perks, ru.secondary, ...ru.subPerks].filter(Boolean).map(id => `<div class="rl">${L.rune(id)}${esc(L.runeName(id))}</div>`).join('')}</div>`;
  }
  const chosen = new Set([...ru.perks, ...ru.subPerks]);
  const cell = (id, big) => `<span class="rc ${chosen.has(id) ? 'on' : ''} ${big ? 'big' : ''}">${L.rune(id, big ? 'rn lg' : 'rn md')}</span>`;
  const tree = (st, id, rows, keystones) => `<div class="rcol">
      <div class="rhead">${L.rune(id)}<b>${esc(st.name)}</b></div>
      ${rows.map((row, i) => `<div class="rrow ${keystones && i === 0 ? 'rkey' : ''}">${row.map(r => cell(r, keystones && i === 0)).join('')}</div>`).join('')}
    </div>`;
  const shardIcon = id => img(`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/${SHARD_ICON[id] || ''}.png`, L.runeName(id), 'rn sh');
  const shards = `<div class="rshards">${SHARD_ROWS.map((row, i) => `<div class="rrow">${row.map(id => `<span class="rc ${ru.shards[i] === id ? 'on' : ''}" title="${esc(L.runeName(id))}">${shardIcon(id)}</span>`).join('')}</div>`).join('')}</div>`;
  const chosenNames = `<div class="small mute" style="margin-top:10px">${[...ru.perks, ...ru.subPerks].map(id => esc(L.runeName(id))).join(' · ')}</div>`;
  return `<div class="rfull">${tree(P, ru.primary, P.slots, true)}<div class="rcol">${Sec?.slots ? tree(Sec, ru.secondary, Sec.slots.slice(1), false) : ''}${shards}</div></div>${chosenNames}`;
}

// Counters / good matchups / best teammates. Sorted by win rate shrunk toward the champion's
// own win rate, so a 3-0 or 0-3 sample can't jump to the top.
function matchupsHtml(b, arena) {
  const mu = b.matchups;
  if (!mu || (!mu.vs.length && !mu.with.length)) return '';
  const base = b.wins / b.games;
  const adj = x => (x.wins + base * 10) / (x.games + 10);
  const row = x => {
    const wr = x.wins / x.games, diff = wr - base;
    return `<a class="mu" href="#/lol/builds/${x.id}/${b.queue}" title="${esc(L.champName(x.id))}: ${x.wins}W ${x.games - x.wins}L">
      ${L.champ(x.id, 'ic sm')}<span class="mu-name">${esc(L.champName(x.id))}</span>
      <span class="mu-wr"><b class="${wrClass(wr)}">${pct(wr, 0)}</b><span class="small ${diff >= 0 ? 'g' : 'l'}">${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}</span><br><span class="dim small">${num(x.games)} games</span></span></a>`;
  };
  const col = (title, sub, list) => `<div><div class="mu-title">${title}</div><div class="small dim" style="margin-bottom:6px">${sub}</div>
    ${list.length ? list.map(row).join('') : '<div class="small dim">Not enough games yet</div>'}</div>`;
  const vsSource = mu.lane.length >= 4 ? mu.lane : mu.vs;
  const vsLabel = mu.lane.length >= 4 ? 'lane opponent' : 'on the enemy team';
  const worst = [...vsSource].sort((a, c) => adj(a) - adj(c)).slice(0, 6).filter(x => x.wins / x.games < base);
  const bestVs = [...vsSource].sort((a, c) => adj(c) - adj(a)).slice(0, 6).filter(x => x.wins / x.games > base);
  const mates = [...mu.with].sort((a, c) => adj(c) - adj(a)).slice(0, 6).filter(x => x.wins / x.games > base);
  const name = esc(L.champName(b.champId));
  return `<div class="card"><h3>Matchups &amp; synergy</h3>
    <div class="mu-grid">
      ${col('Counters', `${name} struggles vs these as ${vsLabel}`, worst)}
      ${col('Good against', `${name} wins more vs these`, bestVs)}
      ${col(arena ? 'Best partners' : 'Best teammates', `${name} wins more with these ${arena ? 'as duo' : 'on their team'}`, mates)}
    </div>
    <div class="small dim" style="margin-top:8px">The +/- number compares to ${name}'s overall ${pct(base)} ${arena ? 'top 4' : 'win'} rate. Only champions met at least ${mu.min} times are shown.</div></div>`;
}

async function lolBuild(champId, queue, wantRole) {
  const token = navToken;
  queue = queue || store.get('gglens.buildQueue', '') || '';
  const b = await api(`/api/lol/build?champ=${enc(champId)}&queue=${enc(queue)}`);
  if (!alive(token)) return;
  const arena = ARENA_QUEUES.includes(b.queue);
  const c = L.c(champId);
  let roleIdx = Math.max(0, b.roles.findIndex(r => r.role === wantRole));
  let runeIdx = 0;
  const wrLabel = arena ? 'Top 4' : 'Win';
  const wrBox = o => `<div class="wr"><b class="${wrClass(o.wins / o.games)}">${pct(o.wins / o.games)}</b><span class="dim">${num(o.games)} games</span></div>`;
  const stat = (k, v, s = '') => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  main.innerHTML = `
    <div class="champhead">
      ${L.champ(champId, 'ic lg')}
      <div><h1>${esc(c?.name || 'Champion')} <span class="mute" style="font-weight:500">build</span></h1>
        <div class="mute">${esc(b.queueName)} · Patch ${esc(b.patch || '?')}</div></div>
      <div class="stats">
        ${stat(arena ? 'Top 4 rate' : 'Win rate', `<span class="${wrClass(b.wins / b.games)}">${pct(b.wins / b.games)}</span>`)}
        ${stat('Pick rate', pct(b.pickRate))}
        ${b.banRate ? stat('Ban rate', pct(b.banRate)) : ''}
        ${stat('Games', num(b.games))}
      </div>
    </div>
    <div class="tabs" id="bModes">${b.available.sort((x, y) => y.games - x.games).map(a => `<a class="tab ${a.queue === b.queue ? 'on' : ''}" href="#/lol/builds/${champId}/${a.queue}">${esc(a.name)} <span class="dim small">${num(a.games)}</span></a>`).join('')}</div>
    ${b.queue === 440 ? FLEX_NOTE : ''}
    <div class="tabs" id="bRoles"></div>
    <div id="bBody"></div>`;

  function renderRole() {
    const R0 = b.roles[roleIdx];
    // items follow the selected rune page when that page has enough games
    const page = R0.runes[runeIdx];
    const usePage = !!(page?.build && page.build.games >= 1 && (page.build.core.length || page.build.items.length));
    const r = usePage ? { ...R0, core: page.build.core, full: page.build.full, boots: page.build.boots, items: page.build.items, slots: page.build.slots, support: page.build.support || [], itemGames: page.build.games } : { ...R0, support: R0.support || [], itemGames: R0.games };
    $('#bRoles').innerHTML = b.roles.length > 1 ? b.roles.map((x, i) => `<div class="tab ${i === roleIdx ? 'on' : ''}" data-i="${i}">${ROLE_NAMES[x.role] || x.role} <span class="dim small">${pct(x.share, 0)}</span></div>`).join('') : '';
    const top = r.runes[0];
    const runeTree = ru => `<div class="runepage">
        <div class="rtree"><div class="rl">${L.rune(ru.primary)}<b>${esc(L.runeName(ru.primary))}</b></div>${ru.perks.map((id, i) => `<div class="rl">${L.rune(id, i === 0 ? 'rn lg' : 'rn')}${esc(L.runeName(id))}</div>`).join('')}</div>
        ${ru.secondary ? `<div class="rtree"><div class="rl">${L.rune(ru.secondary)}<b>${esc(L.runeName(ru.secondary))}</b></div>${ru.subPerks.map(id => `<div class="rl">${L.rune(id)}${esc(L.runeName(id))}</div>`).join('')}</div>` : ''}
        <div class="rtree"><div class="rl"><b>Shards</b></div>${ru.shards.filter(Boolean).map(id => `<div class="rl small mute">${esc(L.runeName(id))}</div>`).join('')}</div>
      </div>`;
    const itemsRow = (ids, cls = 'it lg') => `<div class="row">${ids.map((id, i) => `${i ? '<span class="arrow">›</span>' : ''}${L.item(id, cls)}`).join('')}</div>`;
    const itemNames = ids => ids.map(id => S.lol.items[id]?.name || id).join(' → ');
    const coreIds = new Set((r.core[0]?.items || []).concat(r.boots.map(x => x.id)));
    const situational = r.items.filter(x => !coreIds.has(x.id)).slice(0, 10);
    const skill = r.skills.seq[0];
    const skillGrid = skill ? `<div class="skillgrid"><div class="k"></div>${[...Array(15)].map((_, i) => `<div class="k">${i + 1}</div>`).join('')}
      ${['Q', 'W', 'E', 'R'].map(k => `<div class="k">${k}</div>${[...Array(15)].map((_, i) => `<div class="${skill.order[i] === k ? 'on ' + k : ''}">${skill.order[i] === k ? k : ''}</div>`).join('')}`).join('')}</div>` : '';
    const card = (title, body, extra = '') => body ? `<div class="card ${extra}"><h3>${title}</h3>${body}</div>` : '';
    const opts = (list, render) => list.length ? list.map(o => `<div class="opt">${render(o)}${wrBox(o)}</div>`).join('') : '';

    const placeInfo = r.avgPlace ? `<div class="stats" style="margin-bottom:12px">${stat('Avg placement', fix(r.avgPlace, 2))}${stat('1st place', pct(r.top1 / r.games))}${stat('Top 4', pct(r.wins / r.games))}</div>` : '';
    $('#bBody').innerHTML = `
      <div class="grid">
        ${placeInfo}
        <div class="cols2">
          ${top ? card('Runes', `<div class="rpages">${r.runes.slice(0, 4).map((ru, i) => `
              <button class="rpage ${i === runeIdx ? 'on' : ''}" data-rune="${i}">
                <span class="row">${L.rune(ru.perks[0])}${L.rune(ru.secondary, 'rn sm')}<span>${['Most popular', '2nd most popular', '3rd most popular', '4th most popular'][i]}</span></span>
                <span class="wr small"><b class="${wrClass(ru.wins / ru.games)}">${pct(ru.wins / ru.games)}</b> <span class="dim">${num(ru.games)} games</span></span>
              </button>`).join('')}</div>
            <div id="rTree">${runeFull(r.runes[runeIdx] || top)}</div>`) : ''}
          <div class="grid">
            ${card('Summoner spells', opts(r.spells.filter(s => s.ids.some(Boolean)), s => `<div class="row">${s.ids.filter(Boolean).map(L.spell).join('')}<span class="small mute">${s.ids.filter(Boolean).map(id => S.lol.spells[id]?.name || id).join(' + ')}</span></div>`))}
            ${card('Skill order', skill ? `<div class="opt"><div class="maxorder">${r.skills.max[0].order.split('>').map((k, i) => `${i ? '<span class="arrow">›</span>' : ''}<span class="key">${k}</span>`).join('')}<span class="small mute" style="margin-left:6px">max order</span></div>${wrBox(r.skills.max[0])}</div>${skillGrid}` : '')}
            ${card('Starting items', opts(r.starting, s => `<div class="row">${s.items.map(id => L.item(id, 'it lg')).join('')}<span class="small mute">${esc(itemNames(s.items).replace(/ → /g, ', '))}</span></div>`))}
          </div>
        </div>
        ${matchupsHtml(b, arena)}
        ${r.augments.length ? card(arena ? 'Augments (Top 4 rate)' : 'Augments', `<div class="augs">${r.augments.map(a => `<div class="aug">${L.aug(a.id)}<span>${esc(L.augName(a.id))}</span><span class="wr"><b class="${wrClass(a.wins / a.games)}">${pct(a.wins / a.games, 0)}</b><br><span class="dim">${num(a.games)}</span></span></div>`).join('')}</div>`) : ''}
        ${R0.runes.length ? `<div class="itemsfor">${usePage
          ? `🧩 Items below are from games with the <b>${['most popular', '2nd most popular', '3rd most popular', '4th most popular'][runeIdx]}</b> rune page (${num(page.build.games)} game${page.build.games === 1 ? '' : 's'}). Pick another page in Runes to see its build.${page.build.games < 5 ? ' <span class="gold">⚠️ Very few games, treat this as a rough guide.</span>' : ''}`
          : `🧩 Items below are from all ${num(R0.games)} games${page?.build ? ` (the selected rune page has only ${page.build.games} game${page.build.games === 1 ? '' : 's'}, too few for its own build)` : ''}.`}</div>` : ''}
        ${fullBuildCard(r, itemsRow, itemNames, opts, card)}
        ${(r.slots || []).some(x => x.length) ? card('Late game item options', `<div class="slots">${r.slots.map((list, i) => `<div><div class="small mute" style="margin-bottom:6px">${['4th', '5th', '6th'][i]} item</div>${list.length ? list.map(o => `<div class="aug" style="margin-bottom:6px">${L.item(o.id, 'it')}<span>${esc(S.lol.items[o.id]?.name || o.id)}</span><span class="wr"><b class="${wrClass(o.wins / o.games)}">${pct(o.wins / o.games, 0)}</b><br><span class="dim">${num(o.games)}</span></span></div>`).join('') : '<div class="dim small">Not enough games</div>'}</div>`).join('')}</div>`) : ''}
        <div class="cols2">
          ${card('Core build (first 3 items)', opts(r.core, o => `<div>${itemsRow(o.items)}<div class="small mute" style="margin-top:4px">${esc(itemNames(o.items))}</div></div>`))}
          <div class="grid">
            ${(r.support || []).length ? card('Support item', opts(r.support, o => `<div class="row">${L.item(o.id, 'it lg')}<span>${esc(S.lol.items[o.id]?.name || o.id)}</span></div>`)) : ''}
            ${card('Boots', opts(r.boots, o => `<div class="row">${L.item(o.id, 'it lg')}<span>${esc(S.lol.items[o.id]?.name || o.id)}</span></div>`))}
            ${card('Other popular items', situational.length ? `<div class="augs">${situational.map(o => `<div class="aug">${L.item(o.id, 'it')}<span>${esc(S.lol.items[o.id]?.name || o.id)}</span><span class="wr"><b class="${wrClass(o.wins / o.games)}">${pct(o.wins / o.games, 0)}</b><br><span class="dim">${pct(o.games / r.itemGames, 0)} pick</span></span></div>`).join('')}</div>` : '')}
          </div>
        </div>
        <div class="small dim">${wrLabel} rates are from ${num(r.games)} ${esc(b.queueName)} games${b.roles.length > 1 ? ' in this role' : ''}. Small samples swing a lot, so check the game counts.</div>
      </div>`;
  }
  $('#bRoles').addEventListener('click', e => { const t = e.target.closest('.tab'); if (!t) return; roleIdx = +t.dataset.i; runeIdx = 0; renderRole(); });
  $('#bBody').addEventListener('click', e => {
    const btn = e.target.closest('.rpage'); if (!btn) return;
    runeIdx = +btn.dataset.rune;
    const y = window.scrollY; renderRole(); window.scrollTo(0, y);
  });
  renderRole();
}

// ===================== boot =====================
(async function boot() {
  try {
    [S.cfg, S.lol, S.val] = await Promise.all([api('/api/config'), api('/api/lol/static'), api('/api/val/static')]);
  } catch (e) { main.innerHTML = errBox(new Error('Could not reach the Roseify server. Is it running? ' + e.message)); return; }
  if (S.cfg.demo) $('#banner').innerHTML = '<div class="bn"><b>Demo mode.</b> You are seeing generated sample data. Put your Riot API key in <code>.env</code> and restart to see real players.</div>';
  $('#modeTag').textContent = S.cfg.demo ? 'Demo mode' : `Live · LoL ${S.cfg.lolPlatform.toUpperCase()} · VAL ${S.cfg.valShard.toUpperCase()}`;
  fillRegions();
  window.addEventListener('hashchange', route);
  route();
})();
