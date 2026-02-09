#!/bin/bash
# Entrypoint script: waits for Meilisearch, seeds data, starts the app

MEILI_URL="${MEILI_URL:-http://localhost:7700}"

echo "Waiting for Meilisearch at $MEILI_URL..."
until wget -q --spider "$MEILI_URL/health" 2>/dev/null; do
  sleep 1
done
echo "Meilisearch is ready."

echo "Seeding market data..."
node data/seed.mjs

echo "Starting Next.js..."
exec "$@"
