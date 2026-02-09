import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const CACHE_PATH = join(__dirname, 'province-cache.json');

// Nominatim "Fryslân" → our constant "Friesland"
const PROVINCE_ALIASES = {
  'Fryslân': 'Friesland',
};

let cache = {};
if (existsSync(CACHE_PATH)) {
  cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
}

function saveCache() {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reverseGeocode(lat, lng) {
  const cacheKey = `${lat},${lng}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MarketMap/1.0 (province-fix-script)' },
  });
  const data = await res.json();

  const state = data.address?.state || null;
  const province = PROVINCE_ALIASES[state] || state;

  cache[cacheKey] = province;
  saveCache();

  // Respect Nominatim rate limit (1 req/sec)
  await sleep(1100);
  return province;
}

// --- Main ---

const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));

let fixed = 0;
let unresolved = 0;

for (const market of source.markets) {
  if (!market._geo) continue;

  const detected = await reverseGeocode(market._geo.lat, market._geo.lng);

  if (!detected) {
    console.warn(`[!] No province found for: ${market.city_town} (${market._geo.lat}, ${market._geo.lng})`);
    unresolved++;
    continue;
  }

  if (market.province !== detected) {
    console.log(`[fix] ${market.city_town} / ${market.location}: "${market.province}" → "${detected}"`);
    market.province = detected;
    fixed++;
  }
}

writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
console.log(`\nDone. Fixed ${fixed} markets, ${unresolved} unresolved.`);
