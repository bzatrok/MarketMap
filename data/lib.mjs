/**
 * Shared utilities for data pipeline scripts.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// --- Paths ---

export const DATA_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(DATA_DIR, '..');
export const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
export const GEOCACHE_PATH = join(DATA_DIR, 'geocache.json');
export const SOURCES_DIR = join(DATA_DIR, 'sources');
export const MANIFEST_PATH = join(SOURCES_DIR, 'manifest.json');

// --- Constants ---

export const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// --- Utilities ---

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function groupMarkets(markets) {
  const groups = new Map();
  for (const raw of markets) {
    const key = `${raw.city_town}|${raw.location}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(raw);
  }
  return groups;
}

/** Strip HTML tags — collapses whitespace (for compare-sources) */
export function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip HTML tags — preserves line breaks (for ai-verify) */
export function stripToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- JSON I/O ---

export function loadJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function saveJsonFile(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function loadSourceJson() {
  return loadJsonFile(SOURCE_PATH);
}

export function saveSourceJson(data) {
  saveJsonFile(SOURCE_PATH, data);
}
