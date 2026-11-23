// Loads .env (no dependencies) and exposes app configuration.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function loadEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

function parseLimits(s) {
  return s.split(',').map(p => {
    const [count, seconds] = p.split(':').map(Number);
    return { count, seconds };
  }).filter(l => l.count > 0 && l.seconds > 0);
}

const apiKey = (process.env.RIOT_API_KEY || '').trim();
const validKey = /^RGAPI-/.test(apiKey) && !apiKey.includes('xxxx');

module.exports = {
  root,
  dataDir: path.join(root, 'data'),
  cacheDir: path.join(root, 'cache'),
  publicDir: path.join(root, 'public'),
  port: Number(process.env.PORT) || 3000,
  apiKey: validKey ? apiKey : '',
  demo: process.argv.includes('--demo') || process.env.DEMO === '1' || !validKey,
  lolPlatform: process.env.LOL_PLATFORM || 'tr1',
  valShard: process.env.VAL_SHARD || 'eu',
  rateLimits: parseLimits(process.env.RATE_LIMITS || '20:1,100:120'),
};
