# ==========================================
# AgriConnect Backend - Root Dockerfile for Cloud PaaS (Render / Railway)
# Builds backend from repository root context (.)
# ==========================================

# Stage 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Copy backend package manifests and install dependencies
COPY code/AgriConnect/backend/package*.json ./
RUN npm ci || npm install

# Copy backend source code, generate Prisma Client, and build TypeScript
COPY code/AgriConnect/backend/ ./
RUN npm run prisma:generate && npm run build

# Stage 2: Production Runner (Fast & Lightweight)
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=5001

COPY code/AgriConnect/backend/package*.json ./
# Copy pre-installed node_modules and Prisma artifacts from builder
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
