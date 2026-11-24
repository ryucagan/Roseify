// Riot API client: per-routing-host rate limiting, 429 handling, retries,
// in-memory cache, permanent disk cache for immutable data (matches, timelines),
// and request de-duplication.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

class RiotError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

class Limiter {
  constructor(limits) {
    this.limits = limits;
    this.hits = [];
    this.chain = Promise.resolve();
    this.pausedUntil = 0;
    this.maxWindow = Math.max(...limits.map(l => l.seconds)) * 1000;
  }
  take() {
    const p = this.chain.then(() => this._acquire());
    this.chain = p.catch(() => {});
    return p;
  }
  async _acquire() {
    for (;;) {
      const now = Date.now();
      if (this.pausedUntil > now) { await sleep(this.pausedUntil - now); continue; }
      this.hits = this.hits.filter(t => now - t < this.maxWindow);
      let wait = 0;
      for (const l of this.limits) {
        const w = l.seconds * 1000;
        let n = 0, oldest = null;
        for (const t of this.hits) if (now - t < w) { n++; if (oldest === null) oldest = t; }
        if (n >= l.count) wait = Math.max(wait, oldest + w - now + 10);
      }
      if (!wait) { this.hits.push(now); return; }
      await sleep(wait);
    }
  }
}

const limiters = new Map();
function limiterFor(host) {
  if (!limiters.has(host)) limiters.set(host, new Limiter(cfg.rateLimits));
  return limiters.get(host);
}

// ---- caches ----
const mem = new Map();
function memGet(k) {
  const e = mem.get(k);
  if (!e) return undefined;
  if (e.exp < Date.now()) { mem.delete(k); return undefined; }
  return e.data;
}
function memSet(k, data, ttl) {
  if (ttl <= 0) return;
  mem.set(k, { exp: Date.now() + ttl, data });
  if (mem.size > 3000) mem.delete(mem.keys().next().value);
}
function diskPath(k) {
  const h = crypto.createHash('sha1').update(k).digest('hex');
  return path.join(cfg.cacheDir, 'riot', h.slice(0, 2), h + '.json');
}
function diskGet(k) {
  try { return JSON.parse(fs.readFileSync(diskPath(k), 'utf8')); } catch { return undefined; }
}
function diskSet(k, data) {
  const f = diskPath(k);
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data)); } catch {}
}

function explain(status, body, p) {
  const isVal = p.startsWith('/val/');
  switch (status) {
    case 400: return `Bad request (${body || p})`;
    case 401: return 'Riot API key missing or invalid. Put a valid RIOT_API_KEY in .env';
    case 403: return isVal
      ? 'Forbidden: your key cannot use Valorant match data. Riot only allows VAL-MATCH on approved production keys, or your key expired (dev keys last 24h).'
      : 'Forbidden: your Riot API key has expired (dev keys last 24h) or lacks access to this endpoint.';
    case 404: return 'Not found';
    case 429: return 'Rate limited by Riot. Try again in a moment.';
    default: return `Riot API error ${status}${body ? ': ' + body : ''}`;
  }
}

const inflight = new Map();

/**
 * GET from the Riot API.
 * @param {string} host routing value, e.g. "europe", "tr1", "eu"
 * @param {string} p    path + query
 * @param {{ttl?:number, permanent?:boolean}} opt
 */
async function riotGet(host, p, opt = {}) {
  if (!cfg.apiKey) throw new RiotError(401, explain(401, '', p));
  const url = `https://${host}.api.riotgames.com${p}`;
  const cached = opt.fresh ? undefined : memGet(url);
  if (cached !== undefined) return cached;
  if (opt.permanent && !opt.fresh) {
    const d = diskGet(url);
    if (d !== undefined) { memSet(url, d, 3600e3); return d; }
  }
  if (inflight.has(url)) return inflight.get(url);
  const job = (async () => {
    const lim = limiterFor(host);
    for (let attempt = 0; ; attempt++) {
      await lim.take();
      let res;
      try {
        res = await fetch(url, { headers: { 'X-Riot-Token': cfg.apiKey } });
      } catch (e) {
        if (attempt < 2) { await sleep(1000 * (attempt + 1)); continue; }
        throw new RiotError(502, 'Network error contacting Riot: ' + e.message);
      }
      if (res.status === 429 && attempt < 6) {
        const ra = Number(res.headers.get('retry-after')) || 5;
        lim.pausedUntil = Date.now() + ra * 1000;
        continue;
      }
      if (res.status >= 500 && attempt < 2) { await sleep(1500 * (attempt + 1)); continue; }
      if (!res.ok) {
        let body = '';
        try { body = (await res.json())?.status?.message || ''; } catch {}
        throw new RiotError(res.status, explain(res.status, body, p));
      }
      const data = await res.json();
      memSet(url, data, opt.permanent ? 3600e3 : (opt.ttl ?? 60e3));
      if (opt.permanent) diskSet(url, data);
      return data;
    }
  })();
  inflight.set(url, job);
  try { return await job; } finally { inflight.delete(url); }
}

// Plain JSON fetch for public static data (Data Dragon, valorant-api.com, CommunityDragon).
async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

function splitRiotId(riotId) {
  const s = String(riotId || '').trim();
  const i = s.lastIndexOf('#');
  if (i <= 0 || i === s.length - 1) throw new RiotError(400, 'Use the full Riot ID, like Name#TAG');
  return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
}

async function getAccountByRiotId(riotId, region) {
  const [name, tag] = splitRiotId(riotId);
  return riotGet(region, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`, { ttl: 600e3 });
}

module.exports = { riotGet, getJson, RiotError, sleep, splitRiotId, getAccountByRiotId };
