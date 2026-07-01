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

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json .

ENV NODE_ENV=production
# PORT is the internal container port — overridden by docker-compose env
ENV PORT=3000
# ORIGIN is the public-facing URL — overridden by docker-compose env
ENV ORIGIN=http://localhost:3002

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

CMD ["node", "build"]
