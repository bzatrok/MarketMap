/**
 * AI-powered source verification: compares downloaded HTML sources against JSON market entries.
 * Uses OpenAI to semantically match and verify entries that regex parsing struggles with.
 *
 * Usage:
 *   node data/ai-verify-sources.mjs              # Process all unverified sources
 *   node data/ai-verify-sources.mjs --force       # Re-verify all sources
 *   node data/ai-verify-sources.mjs --url <url>   # Re-verify a single source URL
 *   node data/ai-verify-sources.mjs --model gpt-4o  # Use a different model
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import {
  SOURCE_PATH, SOURCES_DIR, MANIFEST_PATH,
  sleep, stripToText, loadJsonFile,
} from './lib.mjs';

const REPORT_PATH = join(SOURCES_DIR, 'ai-report.json');
const RATE_LIMIT_MS = 1000;
const MAX_RETRIES = 3;

/** Extract <article> content from full HTML page, falling back to full HTML */
function extractArticle(html) {
  const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return match ? match[0] : html;
}

function buildPrompt(articleHtml, jsonEntries, sourceUrl) {
  const articleText = stripToText(articleHtml);

  const jsonSummary = jsonEntries.map((e, i) => (
    `  [${i}] day=${e.day}, city_town="${e.city_town}", location="${e.location}", ` +
    `time_from="${e.time_from}", time_to="${e.time_to}", type="${e.type}"`
  )).join('\n');

  return `You are verifying Dutch weekly market data. Compare the HTML source text against the JSON entries below.

SOURCE URL: ${sourceUrl}

=== HTML SOURCE TEXT ===
${articleText}
=== END HTML ===

=== JSON ENTRIES (our database) ===
${jsonSummary}
=== END JSON ===

TASK:
1. Read the HTML and identify every market listed (day, city/neighborhood, location, time_from, time_to).
2. Match each JSON entry to the corresponding HTML market.
3. For each JSON entry, verify:
   - verified_times: do day + time_from + time_to match? ("conclusive" if match, "inconclusive" if mismatch)
   - verified_info: do city_town + location match semantically? ("conclusive" if match, "inconclusive" if mismatch)
     Note: "Binnenstad" and city name often refer to the same center area — that's a match.
     "Centrum" and a specific square name (e.g. "Marktplein") are a match if they refer to the same place.
4. If there are differences, suggest corrections in suggested_corrections.
5. List any markets in the HTML that don't appear in the JSON (extra_in_html).

Respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{
  "source_url": "${sourceUrl}",
  "html_markets_found": <number>,
  "entries": [
    {
      "json_index": <number>,
      "city_town": "<from JSON>",
      "day": "<from JSON>",
      "verified_times": "conclusive" | "inconclusive",
      "verified_info": "conclusive" | "inconclusive",
      "suggested_corrections": { "<field>": "<value>" } or null,
      "notes": "<brief explanation if inconclusive>"
    }
  ],
  "extra_in_html": [
    { "city": "<string>", "location": "<string>", "day": "<english day>", "time_from": "HH:MM", "time_to": "HH:MM" }
  ]
}`;
}

async function callOpenAI(client, prompt, model) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a data verification assistant. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      const content = response.choices[0].message.content.trim();
      const cleaned = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      return JSON.parse(cleaned);
    } catch (err) {
      if (err.status === 429 || err.code === 'rate_limit_exceeded') {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`  Rate limited, retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
        continue;
      }
      if (err instanceof SyntaxError) {
        console.log(`  JSON parse error on attempt ${attempt}/${MAX_RETRIES}`);
        if (attempt < MAX_RETRIES) continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} retries`);
}

/**
 * Run AI verification. Can be called programmatically from seed.mjs
 * or standalone via direct execution.
 */
export async function runAiVerify(options = {}) {
  const force = options.force ?? false;
  const singleUrl = options.url ?? null;
  const model = options.model ?? 'gpt-4o-mini';

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set in environment. Add it to .env');
    process.exit(1);
  }

  const client = new OpenAI();

  const source = loadJsonFile(SOURCE_PATH);
  const manifest = loadJsonFile(MANIFEST_PATH);

  // Group JSON markets by source_url
  const bySource = new Map();
  for (const m of source.markets) {
    if (!m.source_url) continue;
    if (!bySource.has(m.source_url)) bySource.set(m.source_url, []);
    bySource.get(m.source_url).push(m);
  }

  // Load existing report (for resumability)
  let report = {};
  if (existsSync(REPORT_PATH)) {
    report = loadJsonFile(REPORT_PATH);
  }

  // Determine which URLs to process
  let urls;
  if (singleUrl) {
    if (!manifest[singleUrl]) {
      console.error(`URL not found in manifest: ${singleUrl}`);
      process.exit(1);
    }
    urls = [singleUrl];
  } else {
    urls = Object.keys(manifest).filter((url) => manifest[url].status === 'ok');
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`AI Source Verification (model: ${model})`);
  console.log(`Sources to process: ${urls.length}`);
  console.log('');

  for (const url of urls) {
    if (!force && !singleUrl && report[url]) {
      skipped++;
      continue;
    }

    const entry = manifest[url];
    const filepath = join(SOURCES_DIR, entry.file);
    if (!existsSync(filepath)) {
      console.log(`  SKIP (no file): ${entry.file}`);
      skipped++;
      continue;
    }

    const jsonEntries = bySource.get(url) || [];
    if (jsonEntries.length === 0) {
      console.log(`  SKIP (no JSON entries): ${url}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  [${processed + skipped + failed + 1}/${urls.length}] ${entry.file} (${jsonEntries.length} entries) ... `);

    try {
      const html = readFileSync(filepath, 'utf-8');
      const articleHtml = extractArticle(html);
      const prompt = buildPrompt(articleHtml, jsonEntries, url);

      const result = await callOpenAI(client, prompt, model);

      report[url] = {
        ...result,
        file: entry.file,
        json_count: jsonEntries.length,
        verified_at: new Date().toISOString(),
        model,
      };

      processed++;
      console.log(`ok (${result.html_markets_found} found, ${result.entries?.length || 0} matched, ${result.extra_in_html?.length || 0} extra)`);
    } catch (err) {
      failed++;
      report[url] = {
        source_url: url,
        file: entry.file,
        error: err.message,
        verified_at: new Date().toISOString(),
      };
      console.log(`ERROR: ${err.message}`);
    }

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
    await sleep(RATE_LIMIT_MS);
  }

  console.log('');
  console.log(`Done. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Report: ${REPORT_PATH}`);

  // Quick stats from report
  let totalConclusive = 0;
  let totalInconclusive = 0;
  let totalExtra = 0;
  for (const [, r] of Object.entries(report)) {
    if (r.entries) {
      for (const e of r.entries) {
        if (e.verified_times === 'conclusive' && e.verified_info === 'conclusive') totalConclusive++;
        else totalInconclusive++;
      }
    }
    if (r.extra_in_html) totalExtra += r.extra_in_html.length;
  }
  console.log(`\nVerification totals: ${totalConclusive} conclusive, ${totalInconclusive} inconclusive, ${totalExtra} extra in HTML`);
}

// --- Standalone execution ---
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isDirectRun) {
  const FORCE = process.argv.includes('--force');
  const URL_FLAG_IDX = process.argv.indexOf('--url');
  const SINGLE_URL = URL_FLAG_IDX !== -1 ? process.argv[URL_FLAG_IDX + 1] : null;
  const MODEL_FLAG_IDX = process.argv.indexOf('--model');
  const MODEL = MODEL_FLAG_IDX !== -1 ? process.argv[MODEL_FLAG_IDX + 1] : undefined;

  runAiVerify({ force: FORCE, url: SINGLE_URL, model: MODEL }).catch((err) => {
    console.error('AI verification failed:', err);
    process.exit(1);
  });
}
