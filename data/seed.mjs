import { MeiliSearch } from 'meilisearch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const INDEX_NAME = 'markets';

const client = new MeiliSearch({
  host: process.env.MEILI_INTERNAL_URL || process.env.MEILI_URL || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'devMasterKey123',
});

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

// --- Seed ---

async function seed() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;
  console.log(`Found ${markets.length} source entries.`);

  const groups = groupMarkets(markets);
  const documents = [];
  let skipped = 0;

  for (const [key, entries] of groups) {
    const first = entries[0];

    if (!first._geo) {
      console.warn(`  [!] No _geo for ${first.city_town} / ${first.location} — skipping. Run "npm run geocode" first.`);
      skipped++;
      continue;
    }

    documents.push(transformGroup(entries));
  }

  console.log(`Merged into ${documents.length} unique markets (${skipped} skipped, was ${markets.length} entries).`);

  // Create/update index
  try {
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });
    console.log(`Created index '${INDEX_NAME}'.`);
  } catch {
    console.log(`Index '${INDEX_NAME}' already exists.`);
  }

  const index = client.index(INDEX_NAME);

  const settingsTask = await index.updateSettings({
    filterableAttributes: ['type', 'scheduleDays', 'province', 'country', '_geo'],
    searchableAttributes: ['name', 'cityTown', 'location', 'province'],
    sortableAttributes: ['name', '_geo'],
  });
  await client.waitForTask(settingsTask.taskUid);
  console.log('Index settings configured.');

  const deleteTask = await index.deleteAllDocuments();
  await client.waitForTask(deleteTask.taskUid);
  console.log('Cleared existing documents.');

  const addTask = await index.addDocuments(documents);
  const result = await client.waitForTask(addTask.taskUid);
  console.log(`Seed complete: ${result.status}. Indexed ${documents.length} documents.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
