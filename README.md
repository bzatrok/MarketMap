# Market Map

A Progressive Web App for finding weekly markets in the Netherlands. Search by day, province, or name and see results on an interactive map with province boundary overlays.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker (for Meilisearch)

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd MarketMap
   npm install
   ```

2. Copy the environment file and add your MapTiler API key:
   ```bash
   cp .env.example .env
   ```

3. Start Meilisearch:
   ```bash
   docker compose up -d
   ```

4. Seed market data:
   ```bash
   npm run seed
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Data Pipeline

Before each Docker build, two scripts run automatically to keep market data accurate:

1. **`scripts/geocode-markets.mjs`** — Geocodes markets missing `_geo` coordinates via Nominatim
2. **`data/fix-provinces.mjs`** — Reverse-geocodes each market's coordinates to assign the correct province via Nominatim

Both scripts update `static/weekly_markets_netherlands.json` in-place. API results are cached locally (`data/geocache.json`, `data/province-cache.json`) to avoid redundant calls.

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

## Tech Stack

- **Next.js 15** (App Router) — SSR for content pages, client-side map interactions
- **Meilisearch** — geo filtering, faceted search, full-text search
- **MapLibre GL JS** — vector map rendering with province boundary overlays
- **Tailwind CSS** — styling
- **Docker Compose** — containerized deployment
