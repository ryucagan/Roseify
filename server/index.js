// Roseify server: serves the web UI and a small JSON API in front of the Riot API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { RiotError } = require('./riot');
const lol = require('./lol');
const val = require('./val');
const { lolStatic, valStatic } = require('./static');
const demo = require('./demo');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

// ---- generated stats files (from the crawlers) ----
const fileCache = {};
function readData(name) {
  const f = path.join(cfg.dataDir, name);
  let st; try { st = fs.statSync(f); } catch { return null; }
  const c = fileCache[name];
  if (c && c.mtime === st.mtimeMs) return c.data;
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  fileCache[name] = { mtime: st.mtimeMs, data };
  return data;
}

async function lolBuildsData() {
  const index = readData('lol-builds.json');
  if (index) return { index, details: readData('lol-builds-details.json') || {} };
  if (cfg.demo) return demo.lolBuilds(await lolStatic());
  return null;
}
async function valAgentsData() {
  return readData('val-agents.json') || (cfg.demo ? demo.valAgents() : null);
}

// Adds per-lane games/wins to each champion in the index (from the detail file), cached per data version.
const roleCache = new WeakMap();
function withRoles(d) {
  if (roleCache.has(d.index)) return roleCache.get(d.index);
  const out = { ...d.index, queues: d.index.queues.map(q => ({
    ...q,
    champions: q.champions.map(c => {
      const det = d.details?.[c.id]?.[q.id];
      const roles = {};
      for (const r of det?.roles || []) if (r.role !== 'ALL') roles[r.role] = { games: r.games, wins: r.wins };
      return { ...c, roles };
    }),
  })) };
  roleCache.set(d.index, out);
  return out;
}

const NO_STATS = (what, cmd) => new RiotError(404, `No ${what} yet. Run "${cmd}" to collect them from Riot's API (see README).`);

// ---- routes ----
const routes = {
  'GET /api/config': async () => ({
    demo: cfg.demo, hasKey: !!cfg.apiKey, lolPlatform: cfg.lolPlatform, valShard: cfg.valShard,
    lolPlatforms: lol.PLATFORMS, valShards: val.SHARDS,
  }),
  'GET /api/lol/static': () => lolStatic(),
  'GET /api/val/static': () => valStatic(),

  'GET /api/lol/profile': async q => {
    need(q, 'riotId');
    return cfg.demo ? demo.lolProfile(q.riotId) : lol.profile(q.riotId, q.platform || cfg.lolPlatform);
  },
  'GET /api/lol/matches': async q => {
    need(q, 'puuid');
    const count = clamp(q.count, 1, 20, 10);
    return cfg.demo ? demo.lolMatches(q.puuid, +q.start || 0, count, q.queue)
      : lol.matches(q.puuid, q.platform || cfg.lolPlatform, +q.start || 0, count, q.queue);
  },
  'GET /api/lol/live': async q => {
    need(q, 'riotId');
    return cfg.demo ? demo.lolLive(q.riotId) : lol.liveGame(q.riotId, q.platform || cfg.lolPlatform);
  },
  'GET /api/lol/recent': async q => {
    need(q, 'puuid');
    const r = cfg.demo ? demo.lolMatches(q.puuid, 0, 10, q.queue)
      : await lol.matches(q.puuid, q.platform || cfg.lolPlatform, 0, 10, q.queue);
    return lol.recentByChamp(r.matches, q.puuid);
  },
  'GET /api/lol/builds': async () => {
    const d = await lolBuildsData(); if (!d) throw NO_STATS('build stats', 'npm run crawl:lol');
    return withRoles(d);
  },
  'GET /api/lol/build': async q => {
    need(q, 'champ');
    const d = await lolBuildsData(); if (!d) throw NO_STATS('build stats', 'npm run crawl:lol');
    const byQueue = d.details[q.champ];
    if (!byQueue) throw new RiotError(404, 'No games recorded for this champion yet.');
    const queue = q.queue && byQueue[q.queue] ? q.queue : Object.keys(byQueue).sort((a, b) => byQueue[b].games - byQueue[a].games)[0];
    return { ...byQueue[queue], available: Object.values(byQueue).map(b => ({ queue: b.queue, name: b.queueName, games: b.games })) };
  },

  'GET /api/val/profile': async q => {
    need(q, 'riotId');
    return cfg.demo ? demo.valProfile(q.riotId) : val.profile(q.riotId, q.shard);
  },
  'GET /api/val/matches': async q => {
    need(q, 'puuid');
    const count = clamp(q.count, 1, 20, 10);
    return cfg.demo ? demo.valMatches(q.puuid, +q.start || 0, count, q.queue)
      : val.matches(q.puuid, q.shard || cfg.valShard, +q.start || 0, count, q.queue);
  },
  'GET /api/val/agents': async () => {
    const d = await valAgentsData(); if (!d) throw NO_STATS('agent stats', 'npm run crawl:val');
    return d;
  },
};

function need(q, k) { if (!q[k]) throw new RiotError(400, `Missing "${k}"`); }
function clamp(v, a, b, d) { const n = Number(v); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; }

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(cfg.publicDir, rel));
  if (!file.startsWith(cfg.publicDir)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return fs.readFile(path.join(cfg.publicDir, 'index.html'), (e2, b2) => e2 ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, b2, MIME['.html']));
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'Unknown endpoint' });
  try {
    send(res, 200, await handler(Object.fromEntries(url.searchParams)));
  } catch (e) {
    const status = e instanceof RiotError ? e.status : 500;
    if (status >= 500) console.error(e);
    send(res, status, { error: e.message || 'Server error' });
  }
});

if (require.main === module) {
  server.listen(cfg.port, () => {
    console.log(`\n  Roseify running at http://localhost:${cfg.port}`);
    console.log(cfg.demo ? '  Mode: DEMO (sample data). Add RIOT_API_KEY to .env for real data.\n' : `  Mode: LIVE  (LoL ${cfg.lolPlatform}, Valorant ${cfg.valShard})\n`);
  });
}
module.exports = server;
