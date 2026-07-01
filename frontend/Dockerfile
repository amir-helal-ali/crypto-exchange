# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install wget for healthcheck (busybox wget is in alpine but GNU wget
# is more reliable for HEAD requests; curl would also work).
RUN apk add --no-cache wget

WORKDIR /app

ENV NODE_ENV=production
# PORT is the internal container port — overridden by docker-compose env
ENV PORT=3000
ENV HOST=0.0.0.0
# ORIGIN is the public-facing URL — overridden by docker-compose env
ENV ORIGIN=http://localhost:3001

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Healthcheck: use plain --spider (sends HEAD). GNU wget (installed
# above via apk add) handles HEAD correctly. Busybox wget in alpine
# sometimes mishandles HEAD on adapter-node — that's why we install
# GNU wget. Start period 40s gives time for V8 to warm up on cold starts.
HEALTHCHECK --interval=15s --timeout=10s --start-period=40s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "build"]
