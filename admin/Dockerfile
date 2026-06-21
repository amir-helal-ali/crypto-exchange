FROM node:20-alpine AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app
COPY package.json package-lock.json ./
COPY public ./public
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
# Install wget for healthcheck (busybox wget in alpine sometimes
# returns non-zero on HEAD requests; GNU wget is more reliable).
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
# Next.js standalone typically boots in 2-5s, but allow generous
# margin on cold starts (JS minification, JIT compilation).
HEALTHCHECK --interval=15s --timeout=10s --start-period=40s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
