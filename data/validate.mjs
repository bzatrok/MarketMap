import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_TYPES = [
  'antique_market',
  'bloemenmarkt',
  'boekenmarkt',
  'book_market',
  'fabric_market',
  'farmers_market',
  'flower_market',
  'groentemarkt',
  'minimarkt',
  'organic_market',
  'regional_market',
  'warenmarkt',
  'warenmarkt+stoffenmarkt',
  'weekly_market',
];
const TIME_RE = /^\d{2}:\d{2}$/;

const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
const markets = source.markets;

const issues = [];

function issue(idx, market, msg) {
  const label = `${market.city_town} / ${market.location} (${market.day})`;
  issues.push({ idx, label, msg });
}

const seen = new Set();

for (let i = 0; i < markets.length; i++) {
  const m = markets[i];

  // Required fields
  for (const field of ['province', 'city_town', 'location', 'day', 'time_from', 'time_to', 'type']) {
    if (!m[field]) {
      issue(i, m, `Missing required field: ${field}`);
    }
  }

  // Valid day
  if (m.day && !VALID_DAYS.includes(m.day)) {
    issue(i, m, `Invalid day: "${m.day}"`);
  }

  // Time format
  if (m.time_from && !TIME_RE.test(m.time_from)) {
    issue(i, m, `Invalid time_from format: "${m.time_from}"`);
  }
  if (m.time_to && !TIME_RE.test(m.time_to)) {
    issue(i, m, `Invalid time_to format: "${m.time_to}"`);
  }

  // Time ordering
  if (m.time_from && m.time_to && m.time_from >= m.time_to) {
    issue(i, m, `time_from (${m.time_from}) >= time_to (${m.time_to})`);
  }

  // Suspicious 00:00 start
  if (m.time_from === '00:00') {
    issue(i, m, `Suspicious 00:00 start time`);
  }

  // _geo present with valid lat/lng
  if (!m._geo) {
    issue(i, m, `Missing _geo`);
  } else {
    if (typeof m._geo.lat !== 'number' || typeof m._geo.lng !== 'number') {
      issue(i, m, `Invalid _geo: lat/lng must be numbers`);
    } else if (m._geo.lat < 50 || m._geo.lat > 54 || m._geo.lng < 3 || m._geo.lng > 8) {
      issue(i, m, `_geo outside Netherlands bounds: [${m._geo.lat}, ${m._geo.lng}]`);
    }
  }

  // Duplicate check (same city + location + day)
  const dupKey = `${m.city_town}|${m.location}|${m.day}`;
  if (seen.has(dupKey)) {
    issue(i, m, `Duplicate entry`);
  }
  seen.add(dupKey);

  // Valid type
  if (m.type && !VALID_TYPES.includes(m.type)) {
    issue(i, m, `Unknown type: "${m.type}"`);
  }

  // source_url present
  if (!m.source_url) {
    issue(i, m, `Missing source_url`);
  }

  // verified_* fields must be null, "conclusive", or "inconclusive"
  const VALID_VERIFIED = [null, 'conclusive', 'inconclusive'];
  for (const field of ['verified_geo', 'verified_times', 'verified_info']) {
    if (!(field in m)) {
      issue(i, m, `Missing field: ${field}`);
    } else if (!VALID_VERIFIED.includes(m[field])) {
      issue(i, m, `Invalid ${field}: "${m[field]}" (expected null, "conclusive", or "inconclusive")`);
    }
  }
}

// Report
console.log(`Validated ${markets.length} entries.`);
if (issues.length === 0) {
  console.log('No issues found.');
} else {
  console.log(`\n${issues.length} issue(s) found:\n`);
  for (const { idx, label, msg } of issues) {
    console.log(`  [${idx}] ${label}: ${msg}`);
  }
  process.exit(1);
}
