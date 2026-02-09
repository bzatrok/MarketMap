# Market Map

A Progressive Web App for finding weekly markets in the Netherlands and surrounding regions. Search by day, region, or name and see results on an interactive map.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker (for Meilisearch)

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone git@github.com:bzatrok/MarketMap.git
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

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

## Tech Stack

- **Next.js** (App Router) — SSR for content pages, client-side map interactions
- **Meilisearch** — geo filtering, faceted search, full-text search, persistent storage
- **MapLibre GL JS** — vector map rendering with OSM Bright style
- **Tailwind CSS** — styling
- **Docker Compose** — containerized deployment
