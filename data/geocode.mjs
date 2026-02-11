/**
 * Geocode script (dev-only, run before build)
 *
 * Reads static/weekly_markets_netherlands.json, geocodes entries missing _geo
 * via Nominatim, writes corrected _geo back to the source JSON, and saves
 * data/geocache.json (committed) as a persistent record of all lookups.
 *
 * Usage: npm run geocode
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GEOCACHE_PATH = join(__dirname, 'geocache.json');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');

// --- Geocache ---

let geocache = {};
if (existsSync(GEOCACHE_PATH)) {
  geocache = JSON.parse(readFileSync(GEOCACHE_PATH, 'utf-8'));
}

function saveGeocache() {
  writeFileSync(GEOCACHE_PATH, JSON.stringify(geocache, null, 2) + '\n');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(city, location) {
  const cacheKey = `${city}|${location}`;
  if (geocache[cacheKey]) return geocache[cacheKey];

  // Try city + location first, fall back to city only
  const queries = [
    `${location}, ${city}, Netherlands`,
    `${city}, Netherlands`,
  ];

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=nl`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MarketMap/1.0 (market-finder-geocode-script)' },
    });

    if (!res.ok) {
      console.warn(`  [!] Nominatim ${res.status} for: ${q}`);
      await sleep(res.status === 429 ? 5000 : 1100);
      continue;
    }

    const data = await res.json();

    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocache[cacheKey] = result;
      saveGeocache();
      return result;
    }

    // Respect Nominatim rate limit
    await sleep(1100);
  }

  console.warn(`  [!] Could not geocode: ${city} / ${location}`);
  return null;
}

// --- Main ---

async function main() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;
  console.log(`Found ${markets.length} source entries.`);

  // Group by (city_town, location)
  const groups = new Map();
  for (const raw of markets) {
    const key = `${raw.city_town}|${raw.location}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(raw);
  }

  let corrected = 0;
  let skipped = 0;
  let cached = 0;

  for (const [key, entries] of groups) {
    const first = entries[0];
    const cacheKey = `${first.city_town}|${first.location}`;
    const wasCached = !!geocache[cacheKey];

    const nominatimGeo = await geocode(first.city_town, first.location);
    const geo = nominatimGeo || first._geo;
    const geoFilledFrom = nominatimGeo ? 'nominatim' : (first._geo ? 'pre-filled' : null);

    if (!geo) {
      skipped++;
      continue;
    }

    if (wasCached) cached++;

    for (const entry of entries) {
      const changed = !entry._geo || entry._geo.lat !== geo.lat || entry._geo.lng !== geo.lng;
      entry._geo = geo;
      entry.geo_filled_from = geoFilledFrom;
      if (changed) corrected++;
    }
  }

  // Save corrected source JSON
  writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
  saveGeocache();

  console.log(`Done: ${groups.size} groups, ${cached} cached, ${corrected} geo-corrected, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('Geocode failed:', err);
  process.exit(1);
});
