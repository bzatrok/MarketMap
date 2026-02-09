# Amberglass.MarketMap - Weekly Market Finder

## Overview
PWA for discovering weekly markets in the Netherlands and surrounding regions. Built as the first app in the Location Curator framework.

## Stack
- **Framework**: Next.js (app router, JavaScript - no TypeScript)
- **Search/Data**: Meilisearch (primary data store + search engine)
- **Maps**: MapLibre GL JS with OSM Bright style (MapTiler tiles)
- **Styling**: Tailwind CSS
- **Containerization**: Docker Compose (Meilisearch in dev, app + Meilisearch in prod)

## Run Commands
```bash
# Dev: start Meilisearch
docker compose up -d

# Dev: start Next.js
npm run dev

# Seed market data into Meilisearch
npm run seed

# Prod: full stack
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

## Architecture
- `static/` — raw market data (JSON)
- `data/seed.mjs` — transforms raw data, geocodes, indexes into Meilisearch
- `src/app/api/markets/` — API proxy to Meilisearch (master key stays server-side)
- `src/components/` — React components (Map, Sidebar, FilterBar, etc.)
- `src/lib/` — shared utilities (Meilisearch client, filter builders, constants)

## Conventions
- JavaScript only, no TypeScript
- Tailwind for all styling
- Server components by default, `'use client'` only when needed
- API proxy pattern — frontend never talks to Meilisearch directly
- Keep commits small and focused
