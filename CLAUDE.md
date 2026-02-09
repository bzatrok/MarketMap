# Amberglass.MarketMap - Weekly Market Finder

PWA for discovering weekly markets in the Netherlands and surrounding regions. Built as the first app in the Location Curator framework.

## Project Structure

```
Amberglass.MarketMap/
├── static/                         # Raw market data (JSON, manually curated)
├── data/
│   ├── seed.mjs                    # Transforms, geocodes, indexes into Meilisearch
│   └── geocache.json               # Nominatim geocoding cache (gitignored)
├── public/
│   ├── icons/                      # PWA icons
│   └── sw.js                       # Service worker
└── src/
    ├── app/
    │   ├── page.js                 # Homepage (map view with sidebar)
    │   ├── markets/
    │   │   ├── page.js             # Market listing (SSR)
    │   │   └── [slug]/page.js      # Market detail (SSR, SEO metadata)
    │   └── api/
    │       └── markets/route.js    # Search proxy to Meilisearch
    ├── components/
    │   ├── Map.js                  # MapLibre GL + OSM Bright (client component)
    │   ├── Sidebar.js              # Collapsible left panel
    │   ├── FilterBar.js            # Day multi-select, province, open-now
    │   ├── SearchInput.js          # Debounced text search
    │   ├── MarketCard.js           # Card in sidebar results
    │   ├── MarketDetail.js         # Full detail view
    │   ├── Header.js               # Nav bar
    │   └── Footer.js
    └── lib/
        ├── meilisearch.js          # Server-side Meilisearch client singleton
        ├── filters.js              # Builds Meilisearch filter strings
        └── constants.js            # Days, provinces, map defaults
```

## Stack

- **Framework**: Next.js (app router, JavaScript - no TypeScript)
- **Search/Data**: Meilisearch (primary data store + search engine)
- **Maps**: MapLibre GL JS with OSM Bright style (MapTiler tiles)
- **Styling**: Tailwind CSS
- **Containerization**: Docker Compose (Meilisearch + seed in dev, app + Meilisearch in prod)

## Architecture

- **API proxy pattern**: Frontend calls `/api/markets`, never Meilisearch directly. Master key stays server-side.
- **Data flow**: `static/*.json` → `data/seed.mjs` (geocode + transform) → Meilisearch → `/api/markets` → components
- **Map**: MapLibre GL with MapTiler tiles (API key in `NEXT_PUBLIC_MAPTILER_KEY`). Uses `[lng, lat]` order.
- **Geocoding**: Nominatim (free, no API key). Results cached in `data/geocache.json`. Rate limited to 1 req/sec.

## Development

```bash
# Start Meilisearch + auto-seed (193 markets indexed automatically)
docker compose up -d

# Start Next.js dev server
npm run dev

# Re-seed manually (if data changed)
npm run seed
```

### Production

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

Production uses `entrypoint.sh` which waits for Meilisearch, seeds, then starts Next.js.

## Code Patterns

- JavaScript only, no TypeScript
- Tailwind for all styling
- Server components by default, `'use client'` only when needed (Map, Sidebar, FilterBar, SearchInput)
- MapLibre GL requires `dynamic(() => import(...), { ssr: false })` — it needs `window`
- Filter state lives in the page component, passed down to FilterBar/SearchInput/Map

## Testing

### Before Committing

```bash
# Build must pass
npm run build
```

**The build must pass before committing.** This catches SSR errors, missing imports, and broken pages.

### When to Write Tests

| Change Type | Required Tests |
|---|---|
| New `lib/` utility function | Unit test |
| New API route | Integration test (request/response) |
| Bug fix | Test if regression-prone |
| New component | No test required (visual, tested via build) |
| Refactoring | No new tests (existing tests validate) |

## Git Workflow

**CRITICAL: Commit frequently to avoid losing work.**

```bash
git add -A             # Stage all changes (including deletions)
git status             # Verify staged files
git commit -m "message"
git push               # Push immediately after commit
```

- Commit after completing each small task (ideally <3-4 files per commit)
- Push immediately after each commit
- **Always run `git add -A` before commit** — unstaged changes are not committed
- Use `git status` to verify what's staged before committing
- Use `--no-verify` only when the pre-commit hook triggers on the hook file itself (contains blocked pattern `bzatrok`)

### Pre-Push Checklist

```bash
npm run build          # Must pass
git add -A
git status             # Review staged changes
git commit -m "message"
git push
```

## Environment Variables

### Local (.env — gitignored)

```
MEILI_URL=http://localhost:7700
MEILI_MASTER_KEY=devMasterKey123
NEXT_PUBLIC_MAPTILER_KEY=<your-key>
```

### Template (.env.example — committed)

Copy to `.env` and fill in your MapTiler key. Pre-commit hook blocks real API keys from being committed.
