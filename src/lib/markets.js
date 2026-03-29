/**
 * Server-side market data utilities.
 * Reads from static JSON and transforms into the same shape as Meilisearch documents.
 * Used by SSR pages (detail, listing, sitemap) to avoid runtime Meilisearch dependency.
 */
import { readFileSync } from 'fs';
import path from 'path';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function loadAndTransform() {
  const filePath = path.join(process.cwd(), 'static', 'weekly_markets_netherlands.json');
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));

  const groups = new Map();
  for (const raw of data.markets) {
    const key = `${raw.city_town}|${raw.location}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(raw);
  }

  const markets = [];
  for (const [, entries] of groups) {
    const first = entries[0];
    const schedule = entries
      .map((e) => ({ day: e.day, timeStart: e.time_from, timeEnd: e.time_to }))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

    markets.push({
      id: slugify(`${first.city_town}-${first.location}`),
      name: `${first.city_town} - ${first.location}`,
      type: first.type,
      _geo: first._geo,
      scheduleDays: [...new Set(entries.map((e) => e.day))],
      schedule,
      seasonNote: first.season_note || null,
      province: first.province,
      country: 'NL',
      cityTown: first.city_town,
      location: first.location,
      url: first.url || null,
      sourceUrl: first.source_url || null,
      municipalityUrl: first.municipality_url || null,
      lastVerified: first.last_verified || null,
    });
  }

  return { markets, meta: data.meta };
}

let cached = null;

export function getMarkets() {
  if (!cached) cached = loadAndTransform();
  return cached;
}

export function getMarketBySlug(slug) {
  const { markets } = getMarkets();
  return markets.find((m) => m.id === slug) || null;
}

export function getMarketsByProvince(provinceSlug) {
  const { markets } = getMarkets();
  return markets.filter(
    (m) => slugify(m.province) === provinceSlug
  );
}

export function getProvinces() {
  const { meta } = getMarkets();
  return meta.provinces_complete || [];
}

export function slugifyProvince(name) {
  return slugify(name);
}
