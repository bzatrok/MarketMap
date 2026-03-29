# Weekmarkten Nederland

A Progressive Web App for discovering weekly markets across the Netherlands. Search by day, province, type or name — see results on an interactive clustered map with province overlays.

856 markets across all 12 provinces, with Dutch-language SEO pages, JSON-LD structured data, and AI-generated descriptions.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker (for Meilisearch)

### Setup

1. Clone and install:
   ```bash
   git clone <repo-url>
   cd MarketMap
   npm install
   ```

2. Copy the environment file and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. Start Meilisearch (auto-seeds market data):
   ```bash
   docker compose up -d
   ```

4. Initialize the database (creates admin user + default settings):
   ```bash
   npm run init-db
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Features

- **Interactive map** — MapLibre GL with clustered markers (supercluster) and province overlays
- **Search & filter** — full-text search, day/province/type filters, "Nu open" toggle
- **765 market detail pages** — SSR with JSON-LD structured data, Dutch metadata, OG tags
- **12 province landing pages** — markets grouped by day
- **AI-generated descriptions** — city + market descriptions via OpenAI (gpt-5-mini)
- **Admin panel** (`/admin`) — content management, settings, description generation
- **SEO** — sitemap.xml, robots.txt, canonical URLs, Open Graph, Twitter cards
- **PWA** — service worker, installable, offline-capable for static assets

## Admin Panel

Protected by NextAuth 5 (credentials + JWT). Login at `/login`.

- **Dashboard** — market count, description coverage stats
- **Content** — generate, edit, regenerate AI descriptions per market
- **Settings** — site name, SEO defaults, OpenAI model, analytics toggle

```bash
# Create/reset admin user
npm run init-db

# Bulk-generate descriptions for all markets
npm run generate-descriptions

# Generate for a single market
npm run generate-descriptions -- --slug amsterdam-albert-cuyp
```

## Data Pipeline

```bash
npm run seed
```

Phases:
1. **Geocode** — Nominatim, cached in `data/geocache.json`
2. **Validate** — required fields, time formats, geo bounds, duplicates
3. **Transform** — groups entries into unique market documents
4. **Index** — populates Meilisearch
5. **AI Verify** *(optional)* — source verification if `OPENAI_API_KEY` is set

Flags: `--skip-geocode`, `--skip-verify`

### Source Verification

```bash
npm run download-sources           # Download source HTML pages
npm run compare-sources            # Regex-based comparison
npm run ai-verify                  # AI-powered verification
```

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

The entrypoint script initializes the database, seeds Meilisearch, then starts Next.js.

SQLite data (`data/marketmap.db`) is persisted via the `app_data` Docker volume.

## Tech Stack

- **Next.js 15** (App Router, JavaScript) — SSR pages, API routes
- **Meilisearch** — geo filtering, faceted search, full-text search
- **MapLibre GL JS** — vector map with supercluster and province overlays
- **SQLite** (better-sqlite3) — admin users, AI descriptions, settings
- **NextAuth 5** — authentication with JWT sessions
- **OpenAI** — AI content generation (gpt-5-mini)
- **Tailwind CSS** — styling
- **Docker Compose** — containerized deployment (Meilisearch + app)

## Environment Variables

See [.env.example](.env.example) for all required variables:
- `MEILI_URL`, `MEILI_MASTER_KEY` — Meilisearch connection
- `NEXT_PUBLIC_MAPTILER_KEY` — MapTiler tiles
- `OPENAI_API_KEY` — AI descriptions + source verification
- `AUTH_SECRET` — NextAuth JWT signing
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — initial admin user seed
- `REINDEX_TOKEN` — hot reload endpoint auth
