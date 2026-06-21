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

WORKDIR /app

ENV NODE_ENV=production
# adapter-node defaults to PORT=3000 — keep it that way to match docker-compose
# port mapping "3001:3000" and healthcheck on :3000.
ENV PORT=3000
ENV HOST=0.0.0.0
ENV ORIGIN=http://localhost:3001

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "build"]
