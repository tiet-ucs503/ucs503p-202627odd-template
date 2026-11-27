# Week 10 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Multi-Stage Dockerization, Zero-Downtime Cloud Deployment (Render + Supabase), IPv4 Networking & Full Production Launch |
| **Period** | Mon 23 Nov → Fri 27 Nov 2026 |
| **Hours** | ~28 |

---

## 1. Work Completed (Week 10)

During Week 10, as Senior Technical & DevOps Lead (maintaining ~70% engineering weightage), I spearheaded the production containerization, cloud orchestration, network troubleshooting, and live platform deployment of AgriConnect. Following our successful quality assurance audit in Weeks 8–9, this week transitioned AgriConnect from a local/staging prototype into a 100% operational, high-availability public production system deployed across Render, Vercel, and Supabase.

My primary focus areas and contributions were:

- **Multi-Stage Production Docker Architecture:**
  - Designed and implemented multi-stage production Dockerfiles (`Dockerfile` at repository root and `code/AgriConnect/backend/Dockerfile`) utilizing Node 24 Alpine with strict separation of `builder` and `runner` stages.
  - Implemented Linux process supervision using `dumb-init` to handle container lifecycle signals (`SIGTERM`, `SIGINT`) gracefully and prevent orphan zombie worker processes.
  - Hardened container security by enforcing a non-root `USER node` runtime execution context.
  - Optimized Prisma Client artifact packaging by copying generated native query engines (`src/generated/prisma`) and pre-bundled `node_modules` into a minimal production runner container.
  - Configured native container health probes (`HEALTHCHECK`) querying `http://localhost:5001/health` via `wget` spidering.
  - Modernized `code/AgriConnect/docker-compose.yml` to support production cloud Supabase connectivity out of the box while retaining local PostgreSQL in an optional profile (`docker compose --profile local-db up`).
  - Authored the root Infrastructure-as-Code blueprint (`render.yaml`) for 1-click declarative Web Service deployment.
- **Render Cloud PaaS Triage & Build Context Resolution:**
  - Diagnosed initial Render deployment failure where building from repository root context (`.`) with an inner Dockerfile path resulted in `npm ci` failures due to missing root lockfiles.
  - Resolved this by establishing a root Dockerfile and package delegator manifest, introducing resilient dependency installation (`npm ci || npm install`), and updating Render settings to build cleanly from root context `.`.
- **IPv4 Connection Pooler & Supabase Cloud Networking Resolution:**
  - Triaged runtime container crash on Render: `connect ENETUNREACH 2406:da1c:16f1:f601:0:840e:b81d:f5b0:5432`.
  - Identified that direct Supabase hostnames (`db.<ref>.supabase.co`) resolve exclusively to IPv6 addresses. Because Render free/starter tiers lack outbound IPv6 routing, direct database handshakes failed with network unreachable errors.
  - Traced project geolocation to AWS Sydney (`ap-southeast-2`) and migrated database connections to Supabase's IPv4 Connection Pooler (`aws-0-ap-southeast-2.pooler.supabase.com:5432`), establishing instant IPv4 TCP routing.
- **TLS Certificate Chain Relaxation (`@prisma/adapter-pg`):**
  - Diagnosed subsequent TLS handshake failure: `Error opening a TLS connection: self-signed certificate in certificate chain` (`code: P1011`).
  - Identified that `pg-adapter.ts` previously skipped SSL mode relaxation when `NODE_ENV === 'production'`, causing Node's `pg` driver to enforce strict public CA verification against Supabase pooler proxy certificates.
  - Updated `createPrismaAdapter` in `src/config/pg-adapter.ts` (`1e9fa4b`) to automatically apply `relaxSslMode` across all non-local environments, preserving end-to-end TLS encryption in transit while accepting Supabase pooler TLS proxy certificates.
- **Live Production Endpoints & Smoke Verification:**
  - Added root HTTP routing (`GET /` and `HEAD /` in `src/app.ts` via commit `41e6385`) responding with `{ status: "ok", service: "agriconnect-backend" }` to support cloud PaaS health probes.
  - Executed live production verification against `https://ucs503p-agriconnect.onrender.com`:
    - `GET /` $\rightarrow$ `HTTP 200 OK`
    - `GET /health` $\rightarrow$ `HTTP 200 OK`
    - `GET /ready` $\rightarrow$ `HTTP 200 OK` (`{"status":"ready","database":"up"}`)
  - Executed live remote smoke tests against the Render production backend:
    - `smoke:antibypass` (contact guard phone/email/UPI blocking & escrow lifecycle) passed 100%.
    - `smoke:calls` (WebRTC P2P signaling, privacy masking, ICE exchange) passed 100%.
    - `smoke:bids` (40/40 B2B dynamic negotiation edge-cases) passed 100%.

---

## 2. Production Deployment & Live Verification Results

The table below summarizes the live production status and test execution results for the deployed infrastructure:

| Component / Test Suite | Target / Command | Verification Scope | Production Status |
|---|---|---|:---:|
| **Live Backend API** | `https://ucs503p-agriconnect.onrender.com` | Express 5.2.1 REST API hosted on Render Docker container | **LIVE (200 OK)** |
| **API Liveness Probe** | `GET /health` | Container process health and memory status | **200 OK (`status: ok`)** |
| **Database Readiness** | `GET /ready` | Supabase IPv4 Pooler live database query execution | **200 OK (`database: up`)** |
| **CORS Handshake** | `OPTIONS /api/v1/listings` | Allowed origin verification for Vercel edge domain | **204 No Content (CORS Passed)** |
| **B2B Negotiation Suite** | `npx tsx scripts/smoke-bidding-edge-cases.ts` | 40 edge cases executed directly against live Render API | **40 / 40 Passed (100%)** |
| **Anti-Bypass & Escrow** | `npm run smoke:antibypass` | Live contact evasion detection & escrow payment lifecycle | **100% Passed** |
| **WebRTC Call Signaling** | `npm run smoke:calls` | Socket.io live caller masking, ICE relay, call cleanup | **100% Passed** |
| **Backend Unit Tests** | `npm test` (`vitest run`) | Full backend test suite (17 test files) | **157 / 157 Passed (100%)** |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Strict type checking across all backend modules | **0 Errors** |

---

## 3. Technical Highlights & Code Implementations

### A. Root Dockerfile for Cloud PaaS Deployment (`Dockerfile`)
Multi-stage build engineered specifically for repository root context (`.`):

```dockerfile
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

RUN apk add --no-cache dumb-init libc6-compat openssl

ENV NODE_ENV=production
ENV PORT=5001

COPY code/AgriConnect/backend/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER node
EXPOSE 5001

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/server.js"]
```

### B. Supabase Pooler TLS Relaxation (`src/config/pg-adapter.ts`)
Ensured Prisma Pg adapter accepts Supabase pooler TLS proxy certificates across all environments:

```typescript
export function createPrismaAdapter(connectionString: string): PrismaPg {
  const local = isLocalPostgres(connectionString);
  // Relax SSL mode for cloud databases across all environments
  const url = local ? connectionString : relaxSslMode(connectionString);

  const pool = new Pool({
    connectionString: url,
    max: 10,
    ssl: local ? false : { rejectUnauthorized: false },
  });

  return new PrismaPg(pool);
}
```

---

## 4. Key Learnings & Engineering Reflections

1. **Cloud PaaS Dual-Stack Networking Realities:** Direct connections to managed cloud databases (like Supabase) frequently resolve exclusively to IPv6 addresses on modern infrastructure. PaaS platforms like Render or Fly.io on free/starter tiers do not yet offer outbound IPv6 egress routing. Utilizing dedicated connection poolers that support IPv4 resolution is critical for production reliability.
2. **Container Process Supervision:** Running Node.js directly as PID 1 in a container often leads to improper handling of `SIGTERM` signals and leaves zombie child processes. Utilizing `dumb-init` ensures proper signal forwarding, graceful shutdowns, and clean connection pool drainage.
3. **Atomic Verification of Production State:** Having comprehensive smoke testing scripts (`smoke-antibypass`, `smoke-calls`, `smoke-bids`) capable of executing directly against the live production URL gave us 100% empirical certainty that our cloud deployment was fully operational before declaring the milestone complete.

---

## 5. Next Steps for Project Defense & Evaluation

1. Deliver live demonstration to course instructor Mr. Hardik showcasing real-time trade, B2B bidding negotiations, and Grounded Kisan advisory on the live Vercel/Render URLs.
2. Finalize capstone project report and presentation slides with production architecture diagrams and empirical QA test matrices.
