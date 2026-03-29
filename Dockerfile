FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ---
FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_MAPTILER_KEY
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder /app/static ./static
COPY --from=deps /app/node_modules/meilisearch ./node_modules/meilisearch
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps /app/node_modules/bindings ./node_modules/bindings
COPY --from=deps /app/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=deps /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
