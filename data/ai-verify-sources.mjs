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
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const SOURCES_DIR = join(__dirname, 'sources');
const MANIFEST_PATH = join(SOURCES_DIR, 'manifest.json');
const REPORT_PATH = join(SOURCES_DIR, 'ai-report.json');

// CLI args
const FORCE = process.argv.includes('--force');
const URL_FLAG_IDX = process.argv.indexOf('--url');
const SINGLE_URL = URL_FLAG_IDX !== -1 ? process.argv[URL_FLAG_IDX + 1] : null;
const MODEL_FLAG_IDX = process.argv.indexOf('--model');
const MODEL = MODEL_FLAG_IDX !== -1 ? process.argv[MODEL_FLAG_IDX + 1] : 'gpt-4o-mini';

const RATE_LIMIT_MS = 1000;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract <article> content from full HTML page, falling back to full HTML */
function extractArticle(html) {
  const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return match ? match[0] : html;
}

/** Strip HTML tags for a cleaner text representation, keeping structure hints */
function stripToText(html) {
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

async function callOpenAI(client, prompt) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a data verification assistant. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4096,
      });

      const content = response.choices[0].message.content.trim();

      // Strip markdown fences if model adds them
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

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not set in environment. Add it to .env');
    process.exit(1);
  }

  const client = new OpenAI();

  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

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
    report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'));
  }

  // Determine which URLs to process
  let urls;
  if (SINGLE_URL) {
    if (!manifest[SINGLE_URL]) {
      console.error(`URL not found in manifest: ${SINGLE_URL}`);
      process.exit(1);
    }
    urls = [SINGLE_URL];
  } else {
    urls = Object.keys(manifest).filter((url) => manifest[url].status === 'ok');
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`AI Source Verification (model: ${MODEL})`);
  console.log(`Sources to process: ${urls.length}`);
  console.log('');

  for (const url of urls) {
    // Skip already-verified unless --force or --url
    if (!FORCE && !SINGLE_URL && report[url]) {
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

      const result = await callOpenAI(client, prompt);

      report[url] = {
        ...result,
        file: entry.file,
        json_count: jsonEntries.length,
        verified_at: new Date().toISOString(),
        model: MODEL,
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

    // Save after each URL (crash-safe)
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');

    // Rate limit
    await sleep(RATE_LIMIT_MS);
  }

  // Print summary
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

main().catch((err) => {
  console.error('AI verification failed:', err);
  process.exit(1);
});
