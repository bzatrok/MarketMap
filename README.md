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

3. Start Meilisearch (auto-seeds market data):
   ```bash
   docker compose up -d
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Data Pipeline

A single command runs the full pipeline — geocode, validate, transform, and index:

```bash
npm run seed
```

The pipeline has four phases (plus an optional fifth):

1. **Geocode** — fills missing `_geo` coordinates via Nominatim (auto-skips if all entries have coordinates)
2. **Validate** — checks JSON integrity (required fields, valid days/times, geo bounds, duplicates). Exits on errors.
3. **Transform** — groups raw entries by city/location into unique market documents
4. **Index** — configures and populates the Meilisearch index
5. **AI Verify** *(optional)* — if `OPENAI_API_KEY` is set, runs AI-powered source verification

Flags: `--skip-geocode`, `--skip-verify`

Geocode results are cached in `data/geocache.json` to avoid redundant Nominatim calls. In Docker, geocoding auto-skips since all committed entries already have coordinates.

### Source Verification

Standalone scripts for verifying market data against source web pages:

```bash
npm run download-sources           # Download source HTML pages (~90 sec)
npm run compare-sources            # Regex-based comparison report
npm run ai-verify                  # AI-powered verification (requires OPENAI_API_KEY in .env)
```

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
