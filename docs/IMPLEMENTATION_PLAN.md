# AgriConnect — V1 Implementation Plan

> **Rule:** Do not implement application code until the project owner says **`START V1`**.
> **After that phrase:** execute Phase 1 first, then proceed incrementally. After each major phase, report what shipped and what remains.
> **Goal:** Clean, understandable, production-shaped code — not a bulk dump.

Related: [Architecture](./ARCHITECTURE.md) · [Database](./DATABASE_DESIGN.md) · [API Contract](./API_CONTRACT.md) · [Setup](./DEVELOPMENT_SETUP.md)

---

## Team split

| Teammate | Owns | Consumes |
|---|---|---|
| Backend | Supabase, Prisma, Express, auth, APIs, tests | This plan + DB + contract |
| Frontend | Next.js, UI, API client, in-memory auth | **API contract + mocks only** |

Frontend work can start as soon as Phase 0 docs exist (now). Backend work starts at Phase 1 after `START V1`.

**Branches:** `main` ← `develop` ← `feature/backend-*` / `feature/frontend-*`

---

## Phase 0 — Architecture first (current)

**Exit criteria:**

- [x] PRD copied to `docs/AgriConnect_PRD.md`
- [x] `docs/PRD_AMENDMENTS.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/DATABASE_DESIGN.md`
- [x] `docs/API_CONTRACT.md`
- [x] `docs/IMPLEMENTATION_PLAN.md`
- [x] `docs/DEVELOPMENT_SETUP.md`
- [ ] Owner approval + **`START V1`**

**No** `backend/src`, **no** Prisma schema file, **no** Next.js app until Phase 1.

---

## Phase 1 — Project initialization

**Creates:**

- Git repo (`main` + `develop`)
- Root `.gitignore`, `.cursorignore`
- Root `README.md` (setup pointer to docs)
- `docker-compose.yml` (optional local Postgres notes; production DB is Supabase)
- `backend/` package skeleton: `package.json`, `tsconfig.json`, `src/server.ts` + `src/app.ts` stubs, `.env.example`
- `frontend/` Next.js + TS + Tailwind scaffold, `.env.example`
- `backend/postman/` collection stub matching the contract

**Does not create:** feature modules, Prisma migrations, real secrets.

**Version safety:** before writing `package.json`, search + `npm show` for each dependency; record verified versions in the Phase 1 status note.

**Exit criteria:** `npm install` works in both apps; `.env` is gitignored; both `.env.example` files exist; `GET /health` can be wired in Phase 4 (stub OK).

---

## Phase 2 — Supabase project + PostgreSQL

**Creates (manual + docs, not committed secrets):**

- Supabase project
- Connection strings placed in **local** `backend/.env` (never committed)
- Storage bucket `listings` (public read or signed URLs per architecture)
- Confirm Prisma can connect (Phase 3)

**Exit criteria:** `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) work from the backend teammate’s machine. Service role key is backend-only.

---

## Phase 3 — Prisma schema + migrations

**Creates:** `backend/prisma/schema.prisma` exactly as [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) V1 tables (no Payment/Review/Message/…).

- Initial migration
- Seed: admin user
- `prisma generate`

**Exit criteria:** `npx prisma migrate dev` applies cleanly against Supabase; seed creates one ADMIN.

---

## Phase 4 — Express backend foundation

**Creates:**

- `config/env.ts` — Zod, crash on bad env
- `config/db.ts` — Prisma client singleton
- Middleware: helmet, CORS, rate limit, json limit, `validate`, `errorHandler`, async wrapper
- Envelope helpers
- `GET /health`, `GET /ready`
- Winston (or pino) with redaction

**Exit criteria:** Server boots, rejects missing env, `/health` 200, `/ready` 200 against Supabase.

---

## Phase 5 — Authentication + RBAC

**Creates:** `modules/auth/*`, `utils/jwt.ts`, `utils/tokenCompare.ts`, `middleware/requireAuth.ts`, `middleware/roleGuard.ts`

Endpoints: register, login, refresh, logout, me, forgot-password, reset-password.

**Exit criteria:** Tests for register, login, protected route 401, wrong role 403, refresh rotation. Refresh cookie HttpOnly. Passwords hashed. Admin cannot self-register.

---

## Phase 6 — User profiles

**Creates:** `modules/users/*`

Endpoints: PATCH me, farmer/buyer profile get/patch, public farmer summary, export, soft-delete.

**Exit criteria:** Farmer register yields farmer profile; buyer cannot hit farmer-profile routes (403).

---

## Phase 7 — Listings + storage

**Creates:** `modules/listings/*`, `services/storage.service.ts`

CRUD, search/filter, photo upload/delete, status rules, view counts.

**Exit criteria:** Farmer CRUD own listings; buyer lists active; non-owner PATCH 404; photo MIME/size/count enforced; admin can see all for moderation (Phase 10). Tests: create/update/delete listing.

---

## Phase 8 — Orders

**Creates:** `modules/orders/*` with transactional inventory.

State machine in one function (`transitionOrder(from, to, actor)`).

**Exit criteria:** Buyer order decrements stock; illegal transitions 400; farmer cannot order; buyer cannot accept. Tests: create order + authorization.

---

## Phase 9 — Notifications

**Creates:** `modules/notifications/*`, `services/notification.service.ts`, `services/email.service.ts`, cron for listing expiry.

**Exit criteria:** Order placed → farmer has in-app row (+ email or console). Mark read works. Expiry cron documented (can run on an interval in `server.ts`).

---

## Phase 10 — Admin

**Creates:** `modules/admin/*`

Suspend/verify users, moderate listings, analytics, activity log, `reports/me` for farmer/buyer.

**Exit criteria:** Suspended user cannot create listing/order (403 `ACCOUNT_SUSPENDED`). Analytics GMV matches fulfilled orders. Admin actions logged.

---

## Phase 11 — Frontend integration

**Creates (frontend teammate, with backend available):**

- API client + refresh interceptor + tokenStore
- AuthProvider, role-aware dashboards
- All V1 pages listed in architecture
- Wire to live `/api/v1`

**Exit criteria:** PRD §6.7 acceptance flows work in the browser.

---

## Phase 12 — Testing

Backend minimum:

| Case | Type |
|---|---|
| Register | API |
| Login | API |
| Protected route without token | API |
| Role authorization | API |
| Create listing | API |
| Update listing | API |
| Delete listing | API |
| Create order | API |
| Order authorization | API |
| Order state machine | unit |
| Refresh reuse revocation | API |

Frontend: smoke tests for login + listing form if practical.

`npm audit` with no high/critical on both packages.

---

## Phase 13 — Security review

Walk blueprint §6 (adapted) and §8:

- Env Zod, secrets, cookie flags
- Helmet/CORS/rate limit
- IDOR → 404
- Upload validation
- No localStorage tokens
- Log redaction
- Health not throttled
- Service role not in frontend bundle

Fix findings before Phase 14.

---

## Phase 14 — V1 deployment

- Supabase production project (or same project, separate caution)
- Backend on Render/Railway: env vars, `prisma migrate deploy`
- Frontend on Vercel: `NEXT_PUBLIC_API_BASE_URL`
- CORS + cookie `Secure` + HTTPS
- Seed admin out-of-band

---

## What not to do in V1

- Socket.io rooms / chat
- Payments, reviews, mandi feeds
- FastAPI / ML
- Google OAuth
- Phone OTP
- Full i18n / PWA
- Frontend querying Supabase tables
- MongoDB

---

## Status log (fill after each phase)

| Phase | Date | Shipped | Remains |
|---|---|---|---|
| 0 | 2026-08-17 | Architecture docs | Wait for `START V1` |
| 1–14 | — | — | — |
