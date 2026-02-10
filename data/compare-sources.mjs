/**
 * Compares downloaded source HTML against JSON market entries.
 * Extracts market data from evenementenlijst.nl pages and reports discrepancies.
 *
 * Usage: node data/compare-sources.mjs [--json]
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const SOURCES_DIR = join(__dirname, 'sources');
const MANIFEST_PATH = join(SOURCES_DIR, 'manifest.json');

const JSON_OUTPUT = process.argv.includes('--json');

// Dutch day name → English
const DAY_MAP = {
  maandag: 'monday',
  dinsdag: 'tuesday',
  woensdag: 'wednesday',
  donderdag: 'thursday',
  vrijdag: 'friday',
  zaterdag: 'saturday',
  zondag: 'sunday',
};

function stripHtml(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTime(t) {
  if (!t) return null;
  const m = t.match(/(\d{1,2})[:\.](\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function normalizeLocation(loc) {
  return loc
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'")
    .trim()
    .toLowerCase();
}

/**
 * Parse municipality-style pages:
 * <p><strong>Day</strong><br>Location – Place – HH:MM tot HH:MM</p>
 * Can have multiple entries under one day (separated by <br>)
 */
function parseMunicipalityFormat(html) {
  const results = [];
  const dayPattern = /<p>\s*<strong>(Maandag|Dinsdag|Woensdag|Donderdag|Vrijdag|Zaterdag|Zondag)<\/strong>\s*<br\s*\/?>\s*([\s\S]*?)<\/p>/gi;

  let match;
  while ((match = dayPattern.exec(html)) !== null) {
    const day = DAY_MAP[match[1].toLowerCase()];
    const content = match[2];

    const lines = content.split(/<br\s*\/?>/i).map(stripHtml).filter(Boolean);

    for (const line of lines) {
      const parsed = parseMarketLine(line);
      if (parsed) {
        results.push({ day, ...parsed });
      }
    }
  }
  return results;
}

/**
 * Parse province-style pages:
 * <h2>Day</h2> then <li>City – Location – HH:MM tot HH:MM</li>
 */
function parseProvinceFormat(html) {
  const results = [];

  // Match <h2>Day</h2> with or without <strong> wrapping
  const dayHeadingPattern = /<h2[^>]*>\s*(?:<strong>)?(Maandag|Dinsdag|Woensdag|Donderdag|Vrijdag|Zaterdag|Zondag)(?:<\/strong>)?\s*<\/h2>/gi;

  const dayPositions = [];
  let match;
  while ((match = dayHeadingPattern.exec(html)) !== null) {
    dayPositions.push({ day: DAY_MAP[match[1].toLowerCase()], start: match.index + match[0].length });
  }

  for (let i = 0; i < dayPositions.length; i++) {
    const section = html.slice(
      dayPositions[i].start,
      i + 1 < dayPositions.length ? dayPositions[i + 1].start : undefined
    );
    const day = dayPositions[i].day;

    const liPattern = /<li>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(section)) !== null) {
      const text = stripHtml(liMatch[1]);
      const parsed = parseMarketLine(text);
      if (parsed) {
        results.push({ day, ...parsed });
      }
    }
  }

  return results;
}

/**
 * Parse a single market line. Supports formats:
 * "City – Location – HH:MM tot HH:MM"
 * "City – Location – HH:MM – HH:MM"
 * "Location – HH:MM tot HH:MM" (2-part, no separate city)
 */
function parseMarketLine(line) {
  // 3-part: City – Location – time_from tot/– time_to [uur]
  const m3 = line.match(/^(.+?)\s*[–\-]\s*(.+?)\s*[–\-]\s*(\d{1,2}[:.]\d{2})\s*(?:uur\s*)?(?:tot|[–\-])\s*(\d{1,2}[:.]\d{2})(?:\s*uur)?/i);
  if (m3) {
    return {
      city: m3[1].trim(),
      location: m3[2].trim(),
      time_from: normalizeTime(m3[3]),
      time_to: normalizeTime(m3[4]),
    };
  }

  // 2-part: Location – time_from tot/– time_to [uur] (no city)
  const m2 = line.match(/^(.+?)\s*[–\-]\s*(\d{1,2}[:.]\d{2})\s*(?:uur\s*)?(?:tot|[–\-])\s*(\d{1,2}[:.]\d{2})(?:\s*uur)?/i);
  if (m2) {
    return {
      city: '',
      location: m2[1].trim(),
      time_from: normalizeTime(m2[2]),
      time_to: normalizeTime(m2[3]),
    };
  }

  return null;
}

function main() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  // Group JSON markets by source_url
  const bySource = new Map();
  for (const m of source.markets) {
    if (!m.source_url) continue;
    if (!bySource.has(m.source_url)) bySource.set(m.source_url, []);
    bySource.get(m.source_url).push(m);
  }

  const report = [];
  let totalMatches = 0;
  let totalDiscrepancies = 0;
  let totalUnmatched = 0;
  let totalMissing = 0;
  let unparseable = 0;

  for (const [url, entry] of Object.entries(manifest)) {
    if (entry.status !== 'ok') {
      report.push({ url, status: entry.status, error: 'Source page not available' });
      continue;
    }

    const filepath = join(SOURCES_DIR, entry.file);
    if (!existsSync(filepath)) continue;

    const html = readFileSync(filepath, 'utf-8');
    const jsonMarkets = bySource.get(url) || [];

    // Try both parsers, use whichever finds more results
    const municipalityResults = parseMunicipalityFormat(html);
    const provinceResults = parseProvinceFormat(html);
    const htmlMarkets = municipalityResults.length >= provinceResults.length
      ? municipalityResults
      : provinceResults;

    if (htmlMarkets.length === 0) {
      unparseable++;
      report.push({
        url,
        status: 'unparseable',
        jsonCount: jsonMarkets.length,
        note: 'Could not extract market data from HTML',
      });
      continue;
    }

    const sourceReport = {
      url,
      file: entry.file,
      htmlCount: htmlMarkets.length,
      jsonCount: jsonMarkets.length,
      matches: [],
      discrepancies: [],
      unmatchedHtml: [],
      missingFromHtml: [],
    };

    // Try to match each JSON entry against HTML entries
    const matchedHtml = new Set();

    for (const jm of jsonMarkets) {
      let bestMatch = null;
      let bestScore = 0;

      for (let hi = 0; hi < htmlMarkets.length; hi++) {
        if (matchedHtml.has(hi)) continue;
        const hm = htmlMarkets[hi];

        if (hm.day !== jm.day) continue;

        let score = 1;
        const cityNorm = normalizeLocation(hm.city);
        const jsonCityNorm = normalizeLocation(jm.city_town);
        if (cityNorm === jsonCityNorm || cityNorm.includes(jsonCityNorm) || jsonCityNorm.includes(cityNorm)) {
          score += 2;
        }
        const locNorm = normalizeLocation(hm.location);
        const jsonLocNorm = normalizeLocation(jm.location);
        if (locNorm === jsonLocNorm || locNorm.includes(jsonLocNorm) || jsonLocNorm.includes(locNorm)) {
          score += 2;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = { idx: hi, hm };
        }
      }

      if (bestMatch) {
        matchedHtml.add(bestMatch.idx);
        const hm = bestMatch.hm;
        const diffs = [];

        if (hm.time_from !== jm.time_from) {
          diffs.push(`time_from: HTML="${hm.time_from}" vs JSON="${jm.time_from}"`);
        }
        if (hm.time_to !== jm.time_to) {
          diffs.push(`time_to: HTML="${hm.time_to}" vs JSON="${jm.time_to}"`);
        }

        const locNorm = normalizeLocation(hm.location);
        const jsonLocNorm = normalizeLocation(jm.location);
        if (locNorm !== jsonLocNorm && !locNorm.includes(jsonLocNorm) && !jsonLocNorm.includes(locNorm)) {
          diffs.push(`location: HTML="${hm.location}" vs JSON="${jm.location}"`);
        }

        const cityNorm = normalizeLocation(hm.city);
        const jsonCityNorm = normalizeLocation(jm.city_town);
        if (cityNorm !== jsonCityNorm && !cityNorm.includes(jsonCityNorm) && !jsonCityNorm.includes(cityNorm)) {
          diffs.push(`city: HTML="${hm.city}" vs JSON="${jm.city_town}"`);
        }

        if (diffs.length === 0) {
          sourceReport.matches.push(`${jm.city_town} / ${jm.location} (${jm.day})`);
          totalMatches++;
        } else {
          sourceReport.discrepancies.push({
            market: `${jm.city_town} / ${jm.location} (${jm.day})`,
            diffs,
          });
          totalDiscrepancies++;
        }
      } else {
        sourceReport.missingFromHtml.push(`${jm.city_town} / ${jm.location} (${jm.day})`);
        totalMissing++;
      }
    }

    for (let hi = 0; hi < htmlMarkets.length; hi++) {
      if (!matchedHtml.has(hi)) {
        const hm = htmlMarkets[hi];
        sourceReport.unmatchedHtml.push(`${hm.city} / ${hm.location} (${hm.day}) ${hm.time_from}-${hm.time_to}`);
        totalUnmatched++;
      }
    }

    if (sourceReport.discrepancies.length > 0 || sourceReport.unmatchedHtml.length > 0 ||
        sourceReport.missingFromHtml.length > 0 || sourceReport.htmlCount !== sourceReport.jsonCount) {
      report.push(sourceReport);
    }
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n=== Source Verification Report ===\n`);
    console.log(`Matches: ${totalMatches}`);
    console.log(`Discrepancies: ${totalDiscrepancies}`);
    console.log(`In JSON but not found in HTML: ${totalMissing}`);
    console.log(`In HTML but not in JSON: ${totalUnmatched}`);
    console.log(`Unparseable pages: ${unparseable}`);
    console.log('');

    for (const item of report) {
      if (item.error || item.status === 'unparseable') {
        console.log(`--- ${item.url} [${item.status}] ---`);
        console.log(`  ${item.error || item.note}`);
        if (item.jsonCount) console.log(`  JSON entries: ${item.jsonCount}`);
        console.log('');
        continue;
      }

      console.log(`--- ${item.file} (HTML: ${item.htmlCount}, JSON: ${item.jsonCount}) ---`);

      for (const d of item.discrepancies) {
        console.log(`  DIFF: ${d.market}`);
        for (const diff of d.diffs) {
          console.log(`    ${diff}`);
        }
      }

      for (const m of item.missingFromHtml) {
        console.log(`  MISSING from HTML: ${m}`);
      }

      for (const u of item.unmatchedHtml) {
        console.log(`  EXTRA in HTML: ${u}`);
      }

      console.log('');
    }
  }
}

main();
