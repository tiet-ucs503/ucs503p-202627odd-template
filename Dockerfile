# ==========================================
# AgriConnect Backend - Root Dockerfile for Cloud PaaS
# (Enables 1-click Render/Railway builds from repo root)
# ==========================================

# Stage 1: Builder
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Copy backend package manifests and install dependencies
COPY code/AgriConnect/backend/package*.json ./
RUN npm ci

# Copy backend source code and generate Prisma Client + build TypeScript
COPY code/AgriConnect/backend/ ./
RUN npm run prisma:generate && npm run build

# Stage 2: Production Runner
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=5001

COPY code/AgriConnect/backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript dist & Prisma client artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Non-root user for container security
USER node
EXPOSE 5001

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
