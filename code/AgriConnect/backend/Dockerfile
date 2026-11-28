# ==========================================
# AgriConnect Backend - Production Dockerfile
# Multi-stage Node 24 TypeScript Runner
# ==========================================

# Stage 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run prisma:generate && npm run build

# Stage 2: Production Runner
FROM node:24-alpine AS runner
WORKDIR /app

# dumb-init handles process signals (SIGINT, SIGTERM) gracefully
RUN apk add --no-cache dumb-init libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=5001

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Non-root user for container security
USER node
EXPOSE 5001

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
