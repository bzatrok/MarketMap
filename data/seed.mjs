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

function transformMarket(raw, geo) {
  const id = slugify(`${raw.city_town}-${raw.location}-${raw.day}`);
  const name = raw.location === raw.city_town
    ? `${raw.city_town} Weekmarkt`
    : `${raw.city_town} - ${raw.location}`;

  return {
    id,
    name,
    type: raw.type,
    _geo: geo,
    schedule: {
      days: [raw.day],
      timeStart: raw.time_from,
      timeEnd: raw.time_to,
    },
    seasonNote: raw.season_note || null,
    province: raw.province,
    country: 'NL',
    cityTown: raw.city_town,
    location: raw.location,
    sourceUrl: raw.source_url || null,
    municipalityUrl: raw.municipality_url || null,
    lastVerified: raw.last_verified,
  };
}

// --- Seed ---

async function seed() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;
  console.log(`Found ${markets.length} markets in source data.`);

  // Transform and geocode
  const documents = [];
  let geocoded = 0;
  let skipped = 0;

  for (const raw of markets) {
    // Use pre-baked _geo from source data, fall back to Nominatim
    const geo = raw._geo || await geocode(raw.city_town, raw.location);
    if (!geo) {
      skipped++;
      continue;
    }

    documents.push(transformMarket(raw, geo));
  }

  console.log(`Transformed ${documents.length} markets (${skipped} skipped due to geocoding failure).`);

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
    filterableAttributes: ['type', 'schedule.days', 'province', 'country', '_geo'],
    searchableAttributes: ['name', 'cityTown', 'location', 'province'],
    sortableAttributes: ['name', '_geo'],
  });
  await client.waitForTask(settingsTask.taskUid);
  console.log('Index settings configured.');

  // Add documents
  const addTask = await index.addDocuments(documents);
  const result = await client.waitForTask(addTask.taskUid);
  console.log(`Seed complete: ${result.status}. Indexed ${documents.length} documents.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
