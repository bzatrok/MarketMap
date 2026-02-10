import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE_PATH = join(ROOT, 'static', 'weekly_markets_netherlands.json');
const SOURCES_DIR = join(__dirname, 'sources');
const MANIFEST_PATH = join(SOURCES_DIR, 'manifest.json');

const FORCE = process.argv.includes('--force');
const RATE_LIMIT_MS = 1100;
const BACKOFF_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugifyUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase();
  } catch {
    return url.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }
}

async function main() {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf-8'));
  const markets = source.markets;

  // Collect unique source URLs and count markets per URL
  const urlCounts = new Map();
  for (const m of markets) {
    if (!m.source_url) continue;
    urlCounts.set(m.source_url, (urlCounts.get(m.source_url) || 0) + 1);
  }

  console.log(`Found ${urlCounts.size} unique source URLs across ${markets.length} entries.`);

  // Ensure output directory exists
  mkdirSync(SOURCES_DIR, { recursive: true });

  // Load existing manifest
  let manifest = {};
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [url, count] of urlCounts) {
    const slug = slugifyUrl(url);
    const filename = `${slug}.html`;
    const filepath = join(SOURCES_DIR, filename);

    // Skip if already downloaded (unless --force)
    if (!FORCE && existsSync(filepath) && manifest[url]?.status === 'ok') {
      skipped++;
      continue;
    }

    process.stdout.write(`  Fetching: ${url} ... `);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MarketMap/1.0 (source-verification-script)' },
      });

      if (res.ok) {
        const html = await res.text();
        writeFileSync(filepath, html);
        manifest[url] = {
          file: filename,
          markets: count,
          downloaded: new Date().toISOString().split('T')[0],
          status: 'ok',
        };
        downloaded++;
        console.log('ok');
      } else {
        const status = res.status === 404 ? '404' : res.status === 403 ? '403' : 'error';
        manifest[url] = {
          file: filename,
          markets: count,
          downloaded: new Date().toISOString().split('T')[0],
          status,
        };
        failed++;
        console.log(`${res.status}`);

        // Back off on rate limit or forbidden
        if (res.status === 429 || res.status === 403) {
          await sleep(BACKOFF_MS);
          continue;
        }
      }
    } catch (err) {
      manifest[url] = {
        file: filename,
        markets: count,
        downloaded: new Date().toISOString().split('T')[0],
        status: 'error',
      };
      failed++;
      console.log(`error: ${err.message}`);
    }

    // Save manifest after each URL (resume-friendly)
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

    // Rate limit
    await sleep(RATE_LIMIT_MS);
  }

  // Final manifest save
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\nDone. Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error('Download failed:', err);
  process.exit(1);
});
