/**
 * Geocode markets in the source JSON that don't have lat/lng yet.
 * Run: node data/geocode-markets.mjs
 *
 * Adds _geo: { lat, lng } to each market item in-place.
 * Respects Nominatim's 1 req/sec rate limit.
 * Skips items that already have _geo data.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = join(__dirname, '..', 'static', 'weekly_markets_netherlands.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(city, location) {
  const queries = [
    `${location}, ${city}, Netherlands`,
    `${city}, Netherlands`,
  ];

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=nl`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MarketMap/1.0 (geocode-script)' },
    });
    const data = await res.json();

    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }

    await sleep(1100);
  }

  return null;
}

async function main() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;

  const needsGeo = markets.filter(m => !m._geo && (m.city_town || m.location));
  console.log(`${markets.length} total markets, ${needsGeo.length} need geocoding.`);

  if (needsGeo.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const market of needsGeo) {
    const geo = await geocode(market.city_town, market.location);
    if (geo) {
      market._geo = geo;
      success++;
      console.log(`  [${success + failed}/${needsGeo.length}] ${market.city_town} / ${market.location} -> ${geo.lat}, ${geo.lng}`);
    } else {
      failed++;
      console.warn(`  [${success + failed}/${needsGeo.length}] FAILED: ${market.city_town} / ${market.location}`);
    }

    await sleep(1100);
  }

  writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
  console.log(`\nDone. ${success} geocoded, ${failed} failed. Source JSON updated.`);
}

main().catch((err) => {
  console.error('Geocoding failed:', err);
  process.exit(1);
});
