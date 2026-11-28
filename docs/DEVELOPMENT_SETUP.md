# AgriConnect — Development Setup

> For two teammates working in parallel. **Do not commit `.env` files.**
> Related: [Architecture](./ARCHITECTURE.md) · [API Contract](./API_CONTRACT.md)

Until **`START V1`**, this document is the intended setup. Commands and folder names match what Phase 1 will create.

---

## 1. Prerequisites

| Tool | Notes |
|---|---|
| Node.js | Current **Active LTS** (verify at [nodejs.org](https://nodejs.org/); do not copy a version from the PRD) |
| npm | Ships with Node |
| Git | Branching: `main` / `develop` / `feature/*` |
| Supabase account | [https://supabase.com](https://supabase.com) — provides PostgreSQL + Storage |
| (Optional) Docker | Only if you run local Postgres instead of Supabase; production is always Supabase |

---

## 2. Repository layout (after Phase 1)

```
AgriConnect/
├── frontend/          # Next.js — frontend teammate
├── backend/           # Express — backend teammate
│   └── prisma/        # Schema + migrations
└── docs/              # Contracts (read these first)
```

Clone, then work on a feature branch from `develop`.

---

## 3. Environment variables

### 3.1 Backend only — `backend/.env.example`

Copy to `backend/.env` (never commit `.env`).

```env
# ── Server ──────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=5001

# ── Frontend origin (cookies + emails) ──────────────────────────────────
CLIENT_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

# ── Supabase PostgreSQL (Prisma) ────────────────────────────────────────
# Settings → Database: use the pooled URI for DATABASE_URL (port 6543, pgbouncer)
# and the direct URI for DIRECT_URL (port 5432) used by migrations.
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@HOST:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres

# ── Supabase Storage (server only) ──────────────────────────────────────
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=replace_with_anon_key
SUPABASE_SERVICE_ROLE_KEY=replace_with_service_role_key
SUPABASE_LISTINGS_BUCKET=listings

# ── JWT ─────────────────────────────────────────────────────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=replace_with_64_char_hex
JWT_REFRESH_SECRET=replace_with_different_64_char_hex
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Encryption (sensitive fields / future OAuth tokens) ─────────────────
# Generate: openssl rand -hex 32
ENCRYPTION_KEY=replace_with_64_char_hex

# ── Admin seed ──────────────────────────────────────────────────────────
ADMIN_SEED_EMAIL=admin@agriconnect.local
ADMIN_SEED_PASSWORD=replace_with_strong_password

# ── Email (optional in local dev — falls back to console) ───────────────
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@agriconnect.local

# ── Monitoring (optional V1) ────────────────────────────────────────────
SENTRY_DSN=
```

**Zod on boot:** missing `DATABASE_URL`, `DIRECT_URL`, JWT secrets, `ENCRYPTION_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` → process exits.

`SUPABASE_ANON_KEY` may be unused in V1 if all storage goes through the service role; still keep it in example for future signed uploads. It is **not** a substitute for the service role and must not be treated as a secret with write-all-tables power — but it still should not be required on the frontend if the API returns photo URLs.

### 3.2 Frontend only — `frontend/.env.example`

Copy to `frontend/.env.local`.

```env
# Express API origin (no trailing slash)
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
```

Validate with Zod in `src/lib/env.ts` (or `src/env.ts`) at build/start.

### 3.3 Which variables go where

| Variable | Backend | Frontend | Why |
|---|---|---|---|
| `DATABASE_URL` | yes | **never** | Direct DB access is server-only |
| `DIRECT_URL` | yes | **never** | Migrations only |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **never** | Bypasses RLS; full storage/DB admin |
| `SUPABASE_URL` | yes | no (V1) | Photos returned as URLs from API |
| `SUPABASE_ANON_KEY` | optional | **never for DB** | Do not query tables from the browser |
| `JWT_*` / `ENCRYPTION_KEY` | yes | **never** | Token forging if leaked |
| `SMTP_*` | yes | never | |
| `ADMIN_SEED_*` | yes | never | |
| `CORS_ORIGINS` / `CLIENT_URL` | yes | never | |
| `NEXT_PUBLIC_API_BASE_URL` | no | yes | Public by definition (`NEXT_PUBLIC_*`) |
| `SENTRY_DSN` | optional | optional separate frontend DSN | |

**Never** prefix secrets with `NEXT_PUBLIC_`.

---

## 4. Supabase project (backend teammate)

1. Create a project (region close to the team).
2. **Settings → Database → Connection string:**
   - URI (Transaction / pooled, port **6543**) → `DATABASE_URL`. Append `?pgbouncer=true` if not present. Prisma also needs `connection_limit=1` in some serverless hosts; for a long-running Express process, pooled URL is enough.
   - URI (Session / direct, port **5432**) → `DIRECT_URL`.
3. **Settings → API:** `SUPABASE_URL`, `anon` key, `service_role` key.
4. **Storage:** create bucket `listings`. For V1, public bucket is acceptable if object keys are UUIDs. Do not grant the anon key insert/update on `public` tables.
5. Do **not** use Supabase Auth for app users. Express owns `users`.
6. If RLS on `public` blocks Prisma: ensure the database user in the URI can DML; do not expose table grants to `anon` / `authenticated` Supabase roles.

**Cursor + Supabase MCP:** `.cursor/mcp.json` points at your project (`project_ref` in the URL). After auth, use MCP tools (`list_tables`, `apply_migration`, `get_advisors`) to inspect schema and apply DDL without the direct `5432` port.

**RLS (applied):** All app tables have RLS enabled and `REVOKE ALL` for `anon` / `authenticated`. The API uses the `postgres` pooler user (bypasses RLS). Do not add permissive RLS policies for `anon` — the frontend never queries Supabase tables directly.

IP allowlist: if Supabase network restrictions are enabled, allow the backend host and local IP.

---

## 5. Backend workflow (after Phase 1+)

```bash
cd backend
copy .env.example .env   # Windows; then fill secrets
# macOS/Linux: cp .env.example .env

npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

- API: `http://localhost:5001`
- Health: `http://localhost:5001/health`
- Ready: `http://localhost:5001/ready`

Prisma Studio (optional): `npx prisma studio` — local only, never against production without care.

**Tests:** `npm test` (Vitest/Jest + Supertest; chosen at Phase 1 after version check).

**Postman:** import `backend/postman/collection.json` and `environment.json`. Set `baseUrl` to `http://localhost:5001`. After login, collection tests store `accessToken`.

---

## 6. Frontend workflow (parallel from day one)

Frontend does **not** wait for Prisma.

1. Read [API_CONTRACT.md](./API_CONTRACT.md) — mock JSON is canonical.
2. After Phase 1 scaffold:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

UI: `http://localhost:3000`

3. Point `NEXT_PUBLIC_API_BASE_URL` at localhost:5001 when backend routes exist.
4. Until then, develop against mock handlers or the contract examples (MSW or a thin mock server is optional; not required).

**Auth in the browser:** access token in memory; refresh cookie from Express (`withCredentials`). Never `localStorage`.

---

## 7. Parallel schedule

```mermaid
gantt
  title V1 parallel work
  dateFormat YYYY-MM-DD
  section Docs
  Phase0_contracts :done, p0, 2026-08-17, 1d
  section Backend
  Wait_START_V1 :p1, after p0, 1d
  Init_Prisma_Auth :p2, after p1, 7d
  Listings_Orders_Admin :p3, after p2, 10d
  section Frontend
  Pages_against_mocks :p4, after p0, 14d
  Wire_live_API :p5, after p3, 5d
```

Frontend teammate can build landing, login, register, dashboards, listing forms, and admin chrome against the contract immediately.

---

## 8. Git hygiene

```gitignore
node_modules/
.env
.env.*
!.env.example
dist/
build/
coverage/
*.pem
*.key
```

Also add `.cursorignore` with the same secret/build paths.

Verify before first push: `git status` must not list `.env` or `node_modules`.

---

## 9. docker-compose.yml (intent)

V1 compose may include:

- Optional `postgres:16` for offline demo **only if** the backend teammate cannot use Supabase that day. Schema still comes from Prisma. Switching URLs is a local `.env` change.
- Backend service (Phase 14 / V2 more relevant)
- Frontend is typically `npm run dev` on the host, or Vercel

**Production database remains Supabase.** Compose Postgres is not a second source of truth.

---

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| Prisma migrate fails | `DIRECT_URL` must be **direct** (5432), not pooled |
| App queries hang / prepared statement errors | `DATABASE_URL` should be pooled with `pgbouncer=true` |
| CORS / no cookie | Frontend origin in `CORS_ORIGINS`; `credentials`; cookie `Secure` off on http localhost |
| `/ready` 503 | Network / password / SSL (`?sslmode=require` often needed on Supabase) |
| 401 after login | Access token not attached; interceptor missing |
| 403 on farmer routes | Logged in as BUYER |
| Upload 415 | Only jpeg/png/webp |

---

## 11. Version Safety (every install)

Before adding a package:

1. Web search `"npm <name> latest version"` and `"<name> CVE"` / advisory.
2. `npm show <name> version`
3. Use `^` in `package.json` unless pinning a patched release.
4. `npm audit` — fix high/critical before a demo.

Do not copy versions from the PRD, the blueprint, or this file.
