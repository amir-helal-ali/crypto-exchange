# ── Stage 1: Build ──────────────────────────────────────
FROM node:20-alpine AS builder

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline 2>/dev/null || npm install --prefer-offline

COPY . .
RUN npm run build

# ── Stage 2: Run ────────────────────────────────────────
FROM node:20-alpine AS runner

# Install GNU wget — busybox wget in alpine sometimes mishandles HEAD
# requests on SvelteKit adapter-node, causing false-negative health checks.
RUN apk add --no-cache wget

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
# PORT is the internal container port — overridden by docker-compose env
ENV PORT=3000
# HOST must be 0.0.0.0 so adapter-node listens on all interfaces inside Docker
ENV HOST=0.0.0.0
# ORIGIN is the public-facing URL — overridden by docker-compose env
ENV ORIGIN=http://localhost:3002

EXPOSE 3000

# Healthcheck: GNU wget (installed above) handles HEAD correctly on adapter-node.
# Start period 40s gives V8 time to warm up on cold starts.
HEALTHCHECK --interval=15s --timeout=10s --start-period=40s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

CMD ["node", "build"]
