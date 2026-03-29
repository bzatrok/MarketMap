/**
 * AI content generation for market detail pages.
 *
 * Usage:
 *   npm run generate-descriptions              # Generate missing only
 *   npm run generate-descriptions -- --force   # Regenerate all
 *   npm run generate-descriptions -- --slug amsterdam-albert-cuyp  # Single market
 */
import Database from 'better-sqlite3';
import OpenAI from 'openai';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadSourceJson, groupMarkets, slugify, sleep, DAY_ORDER } from './lib.mjs';

const DATA_DIR = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(DATA_DIR, 'marketmap.db');
const FORCE = process.argv.includes('--force');
const SLUG_FLAG = process.argv.indexOf('--slug');
const SINGLE_SLUG = SLUG_FLAG !== -1 ? process.argv[SLUG_FLAG + 1] : null;

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('[generate] ERROR: OPENAI_API_KEY is required.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: API_KEY });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const DAY_LABELS_NL = {
  monday: 'Maandag', tuesday: 'Dinsdag', wednesday: 'Woensdag',
  thursday: 'Donderdag', friday: 'Vrijdag', saturday: 'Zaterdag', sunday: 'Zondag',
};

const TYPE_LABELS_NL = {
  weekly_market: 'Weekmarkt', groentemarkt: 'Groentemarkt', bloemenmarkt: 'Bloemenmarkt',
  boekenmarkt: 'Boekenmarkt', book_market: 'Boekenmarkt', fabric_market: 'Stoffenmarkt',
  farmers_market: 'Boerenmarkt', flower_market: 'Bloemenmarkt', minimarkt: 'Minimarkt',
  organic_market: 'Biologische markt', regional_market: 'Streekmarkt',
  warenmarkt: 'Warenmarkt', 'warenmarkt+stoffenmarkt': 'Warenmarkt & Stoffenmarkt',
  antique_market: 'Antiekmarkt',
};

function transformMarkets() {
  const source = loadSourceJson();
  const groups = groupMarkets(source.markets);
  const markets = [];

  for (const [, entries] of groups) {
    const first = entries[0];
    const schedule = entries
      .map((e) => ({ day: e.day, timeStart: e.time_from, timeEnd: e.time_to }))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

    markets.push({
      id: slugify(`${first.city_town}-${first.location}`),
      cityTown: first.city_town,
      location: first.location,
      province: first.province,
      type: first.type,
      schedule,
    });
  }
  return markets;
}

function buildPrompt(market) {
  const typeLabel = TYPE_LABELS_NL[market.type] || market.type;
  const scheduleText = market.schedule
    .map((s) => `${DAY_LABELS_NL[s.day]} ${s.timeStart}–${s.timeEnd}`)
    .join(', ');

  return `Je bent een expert op het gebied van Nederlandse weekmarkten en steden.
Schrijf 2-3 alinea's over de weekmarkt in ${market.cityTown} op ${market.location}, provincie ${market.province}.

Eerste alinea: beschrijf de stad of het dorp kort — wat maakt het bijzonder, wat is de sfeer?
Tweede alinea: beschrijf de markt zelf — wat kun je er vinden, waarom is het de moeite waard om te bezoeken?
Optioneel derde alinea: praktische tips voor bezoekers.

Marktinformatie:
- Type: ${typeLabel}
- Openingstijden: ${scheduleText}
- Locatie: ${market.location}, ${market.cityTown}

Schrijf in een warme, informatieve toon. Geen opsommingstekens, gewoon lopende tekst. Maximaal 200 woorden.`;
}

async function generateDescription(market) {
  const prompt = buildPrompt(market);
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  });
  return response.choices[0].message.content.trim();
}

const upsert = db.prepare(`
  INSERT INTO descriptions (slug, content, generatedAt, model)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET content = excluded.content, generatedAt = excluded.generatedAt, model = excluded.model
`);

async function main() {
  const markets = transformMarkets();
  console.log(`[generate] ${markets.length} markets total. Model: ${MODEL}`);

  let targets;
  if (SINGLE_SLUG) {
    targets = markets.filter((m) => m.id === SINGLE_SLUG);
    if (targets.length === 0) {
      console.error(`[generate] Market '${SINGLE_SLUG}' not found.`);
      process.exit(1);
    }
  } else if (FORCE) {
    targets = markets;
  } else {
    const existing = new Set(
      db.prepare('SELECT slug FROM descriptions').all().map((r) => r.slug)
    );
    targets = markets.filter((m) => !existing.has(m.id));
  }

  console.log(`[generate] ${targets.length} descriptions to generate.`);

  let done = 0;
  let errors = 0;

  for (const market of targets) {
    try {
      const content = await generateDescription(market);
      const now = new Date().toISOString();
      upsert.run(market.id, content, now, MODEL);
      done++;
      console.log(`[generate] ${done}/${targets.length} ${market.id}`);
    } catch (err) {
      errors++;
      console.error(`[generate] ERROR ${market.id}: ${err.message}`);
    }
    // Rate limit: avoid hammering the API
    await sleep(200);
  }

  console.log(`\n[generate] Done: ${done} generated, ${errors} errors.`);
  db.close();
}

main();
