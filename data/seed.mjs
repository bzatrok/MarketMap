import { MeiliSearch } from 'meilisearch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GEOCACHE_PATH = join(__dirname, 'geocache.json');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const INDEX_NAME = 'markets';

const client = new MeiliSearch({
  host: process.env.MEILI_INTERNAL_URL || process.env.MEILI_URL || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'devMasterKey123',
});

// --- Geocoding ---

let geocache = {};
if (existsSync(GEOCACHE_PATH)) {
  geocache = JSON.parse(readFileSync(GEOCACHE_PATH, 'utf-8'));
}

function saveGeocache() {
  writeFileSync(GEOCACHE_PATH, JSON.stringify(geocache, null, 2));
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
      headers: { 'User-Agent': 'MarketMap/1.0 (market-finder-seed-script)' },
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

// --- Transform ---

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function groupMarkets(markets) {
  const groups = new Map();
  for (const raw of markets) {
    const key = `${raw.city_town}|${raw.location}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(raw);
  }
  return groups;
}

function transformGroup(entries, geo, geoFilledFrom) {
  const first = entries[0];
  const id = slugify(`${first.city_town}-${first.location}`);
  const name = first.location === first.city_town
    ? `${first.city_town} Weekmarkt`
    : `${first.city_town} - ${first.location}`;

  // Merge and sort schedule slots by day order
  const schedule = entries
    .map((e) => ({ day: e.day, timeStart: e.time_from, timeEnd: e.time_to }))
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  return {
    id,
    name,
    type: first.type,
    _geo: geo,
    geoFilledFrom,
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

// --- Seed ---

async function seed() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;
  console.log(`Found ${markets.length} source entries.`);

  // Group by (city_town, location) and geocode per group
  const groups = groupMarkets(markets);
  const documents = [];
  let skipped = 0;

  let corrected = 0;

  for (const [key, entries] of groups) {
    const first = entries[0];

    // Always prefer Nominatim; fall back to pre-filled _geo
    const nominatimGeo = await geocode(first.city_town, first.location);
    const geo = nominatimGeo || first._geo;
    const geoFilledFrom = nominatimGeo ? 'nominatim' : (first._geo ? 'pre-filled' : null);

    if (!geo) {
      skipped++;
      continue;
    }

    // Write corrected _geo and geo_filled_from back to source entries
    for (const entry of entries) {
      const changed = !entry._geo || entry._geo.lat !== geo.lat || entry._geo.lng !== geo.lng;
      entry._geo = geo;
      entry.geo_filled_from = geoFilledFrom;
      if (changed) corrected++;
    }

    documents.push(transformGroup(entries, geo, geoFilledFrom));
  }

  // Save corrected source JSON
  writeFileSync(SOURCE_PATH, JSON.stringify(source, null, 2) + '\n');
  console.log(`Merged into ${documents.length} unique markets (${skipped} skipped, ${corrected} geo-corrected, was ${markets.length} entries).`);

  // Create/update index
  try {
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });
    console.log(`Created index '${INDEX_NAME}'.`);
  } catch {
    console.log(`Index '${INDEX_NAME}' already exists.`);
  }

  const index = client.index(INDEX_NAME);

  // Configure index settings
  const settingsTask = await index.updateSettings({
    filterableAttributes: ['type', 'scheduleDays', 'province', 'country', '_geo'],
    searchableAttributes: ['name', 'cityTown', 'location', 'province'],
    sortableAttributes: ['name', '_geo'],
  });
  await client.waitForTask(settingsTask.taskUid);
  console.log('Index settings configured.');

  // Delete all existing documents (old day-suffixed IDs would persist otherwise)
  const deleteTask = await index.deleteAllDocuments();
  await client.waitForTask(deleteTask.taskUid);
  console.log('Cleared existing documents.');

  // Add documents
  const addTask = await index.addDocuments(documents);
  const result = await client.waitForTask(addTask.taskUid);
  console.log(`Seed complete: ${result.status}. Indexed ${documents.length} documents.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
