/**
 * Unified data pipeline: geocode → validate → transform → index (→ optional AI verify)
 *
 * Usage:
 *   npm run seed                   # Full pipeline
 *   npm run seed -- --skip-geocode # Skip geocoding phase
 *   npm run seed -- --skip-verify  # Skip AI verification (default if no OPENAI_API_KEY)
 */
import { MeiliSearch } from 'meilisearch';
import { existsSync } from 'fs';
import {
  SOURCE_PATH, GEOCACHE_PATH, DAY_ORDER,
  sleep, slugify, groupMarkets,
  loadSourceJson, saveSourceJson, loadJsonFile, saveJsonFile,
} from './lib.mjs';

const SKIP_GEOCODE = process.argv.includes('--skip-geocode');
const SKIP_VERIFY = process.argv.includes('--skip-verify');
const INDEX_NAME = 'markets';

// ============================================================
// Phase 1: Geocode
// ============================================================

async function phaseGeocode() {
  const source = loadSourceJson();
  const groups = groupMarkets(source.markets);

  // Count entries missing _geo
  let missing = 0;
  for (const [, entries] of groups) {
    if (!entries[0]._geo) missing++;
  }

  if (missing === 0) {
    console.log('[geocode] All entries have _geo — skipping.');
    return;
  }

  console.log(`[geocode] ${missing} groups missing _geo — geocoding via Nominatim...`);

  // Load geocache
  let geocache = {};
  if (existsSync(GEOCACHE_PATH)) {
    geocache = loadJsonFile(GEOCACHE_PATH);
  }

  function saveGeocache() {
    saveJsonFile(GEOCACHE_PATH, geocache);
  }

  async function geocode(city, location) {
    const cacheKey = `${city}|${location}`;
    if (geocache[cacheKey]) return geocache[cacheKey];

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

      await sleep(1100);
    }

    console.warn(`  [!] Could not geocode: ${city} / ${location}`);
    return null;
  }

  let corrected = 0;
  let skipped = 0;
  let cached = 0;

  for (const [, entries] of groups) {
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

  saveSourceJson(source);
  saveGeocache();

  console.log(`[geocode] Done: ${groups.size} groups, ${cached} cached, ${corrected} corrected, ${skipped} skipped.`);
}

// ============================================================
// Phase 2: Validate
// ============================================================

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_TYPES = [
  'antique_market', 'bloemenmarkt', 'boekenmarkt', 'book_market',
  'fabric_market', 'farmers_market', 'flower_market', 'groentemarkt',
  'minimarkt', 'organic_market', 'regional_market', 'warenmarkt',
  'warenmarkt+stoffenmarkt', 'weekly_market',
];
const TIME_RE = /^\d{2}:\d{2}$/;
const VALID_VERIFIED = [null, 'conclusive', 'inconclusive'];

function phaseValidate() {
  const source = loadSourceJson();
  const markets = source.markets;
  const issues = [];

  function issue(idx, market, msg) {
    const label = `${market.city_town} / ${market.location} (${market.day})`;
    issues.push({ idx, label, msg });
  }

  const seen = new Set();

  for (let i = 0; i < markets.length; i++) {
    const m = markets[i];

    for (const field of ['province', 'city_town', 'location', 'day', 'time_from', 'time_to', 'type']) {
      if (!m[field]) issue(i, m, `Missing required field: ${field}`);
    }

    if (m.day && !VALID_DAYS.includes(m.day)) {
      issue(i, m, `Invalid day: "${m.day}"`);
    }

    if (m.time_from && !TIME_RE.test(m.time_from)) {
      issue(i, m, `Invalid time_from format: "${m.time_from}"`);
    }
    if (m.time_to && !TIME_RE.test(m.time_to)) {
      issue(i, m, `Invalid time_to format: "${m.time_to}"`);
    }

    if (m.time_from && m.time_to && m.time_from >= m.time_to) {
      issue(i, m, `time_from (${m.time_from}) >= time_to (${m.time_to})`);
    }

    if (m.time_from === '00:00') {
      issue(i, m, `Suspicious 00:00 start time`);
    }

    if (!m._geo) {
      issue(i, m, `Missing _geo`);
    } else {
      if (typeof m._geo.lat !== 'number' || typeof m._geo.lng !== 'number') {
        issue(i, m, `Invalid _geo: lat/lng must be numbers`);
      } else if (m._geo.lat < 50 || m._geo.lat > 54 || m._geo.lng < 3 || m._geo.lng > 8) {
        issue(i, m, `_geo outside Netherlands bounds: [${m._geo.lat}, ${m._geo.lng}]`);
      }
    }

    const dupKey = `${m.city_town}|${m.location}|${m.day}`;
    if (seen.has(dupKey)) issue(i, m, `Duplicate entry`);
    seen.add(dupKey);

    if (m.type && !VALID_TYPES.includes(m.type)) {
      issue(i, m, `Unknown type: "${m.type}"`);
    }

    if (!m.source_url) {
      issue(i, m, `Missing source_url`);
    }

    for (const field of ['verified_geo', 'verified_times', 'verified_info']) {
      if (!(field in m)) {
        issue(i, m, `Missing field: ${field}`);
      } else if (!VALID_VERIFIED.includes(m[field])) {
        issue(i, m, `Invalid ${field}: "${m[field]}" (expected null, "conclusive", or "inconclusive")`);
      }
    }
  }

  console.log(`[validate] Validated ${markets.length} entries.`);
  if (issues.length === 0) {
    console.log('[validate] No issues found.');
    return true;
  }

  console.log(`\n[validate] ${issues.length} issue(s) found:\n`);
  for (const { idx, label, msg } of issues) {
    console.log(`  [${idx}] ${label}: ${msg}`);
  }
  return false;
}

// ============================================================
// Phase 3 + 4: Transform + Index
// ============================================================

function transformGroup(entries) {
  const first = entries[0];
  const id = slugify(`${first.city_town}-${first.location}`);
  const name = first.location === first.city_town
    ? `${first.city_town} Weekmarkt`
    : `${first.city_town} - ${first.location}`;

  const schedule = entries
    .map((e) => ({ day: e.day, timeStart: e.time_from, timeEnd: e.time_to }))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  return {
    id,
    name,
    type: first.type,
    _geo: first._geo,
    geoFilledFrom: first.geo_filled_from || null,
    scheduleDays: schedule.map((s) => s.day),
    schedule,
    seasonNote: first.season_note || null,
    province: first.province,
    country: 'NL',
    cityTown: first.city_town,
    location: first.location,
    url: first.url || null,
    sourceUrl: first.source_url || null,
    municipalityUrl: first.municipality_url || null,
    lastVerified: first.last_verified,
  };
}

async function phaseTransformAndIndex() {
  const source = loadSourceJson();
  const markets = source.markets;
  console.log(`[transform] ${markets.length} source entries.`);

  const groups = groupMarkets(markets);
  const documents = [];
  let skipped = 0;

  for (const [, entries] of groups) {
    const first = entries[0];
    if (!first._geo) {
      console.warn(`  [!] No _geo for ${first.city_town} / ${first.location} — skipping.`);
      skipped++;
      continue;
    }
    documents.push(transformGroup(entries));
  }

  console.log(`[transform] Merged into ${documents.length} unique markets (${skipped} skipped).`);

  // Index into Meilisearch
  const client = new MeiliSearch({
    host: process.env.MEILI_INTERNAL_URL || process.env.MEILI_URL || 'http://localhost:7700',
    apiKey: process.env.MEILI_MASTER_KEY || 'devMasterKey123',
  });

  try {
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });
    console.log(`[index] Created index '${INDEX_NAME}'.`);
  } catch {
    console.log(`[index] Index '${INDEX_NAME}' already exists.`);
  }

  const index = client.index(INDEX_NAME);

  const settingsTask = await index.updateSettings({
    filterableAttributes: ['type', 'scheduleDays', 'province', 'country', '_geo'],
    searchableAttributes: ['name', 'cityTown', 'location', 'province'],
    sortableAttributes: ['name', '_geo'],
  });
  await client.waitForTask(settingsTask.taskUid);
  console.log('[index] Settings configured.');

  const deleteTask = await index.deleteAllDocuments();
  await client.waitForTask(deleteTask.taskUid);
  console.log('[index] Cleared existing documents.');

  const addTask = await index.addDocuments(documents);
  const result = await client.waitForTask(addTask.taskUid);
  console.log(`[index] Seed complete: ${result.status}. Indexed ${documents.length} documents.`);
}

// ============================================================
// Phase 5: Optional AI Verify
// ============================================================

async function phaseAiVerify() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[ai-verify] No OPENAI_API_KEY set — skipping.');
    return;
  }

  try {
    const { runAiVerify } = await import('./ai-verify-sources.mjs');
    await runAiVerify();
  } catch (err) {
    console.warn(`[ai-verify] Skipped: ${err.message}`);
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== MarketMap Seed Pipeline ===\n');

  // Phase 1: Geocode
  if (SKIP_GEOCODE) {
    console.log('[geocode] Skipped (--skip-geocode).\n');
  } else {
    await phaseGeocode();
    console.log('');
  }

  // Phase 2: Validate
  const valid = phaseValidate();
  console.log('');
  if (!valid) {
    console.error('Validation failed — aborting seed.');
    process.exit(1);
  }

  // Phase 3+4: Transform + Index
  await phaseTransformAndIndex();
  console.log('');

  // Phase 5: AI Verify (optional)
  if (!SKIP_VERIFY) {
    await phaseAiVerify();
  } else {
    console.log('[ai-verify] Skipped (--skip-verify).');
  }

  console.log('\n=== Pipeline complete ===');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
