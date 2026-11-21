# AgriConnect — Developer documentation

Start here if you are joining the project or picking up work after a pause. These docs are written so a frontend or backend developer can run the stack, call the APIs, and continue from the current V1 implementation.

The public project overview (problem, personas, stack, architecture sketch, quick start) lives in the root [README.md](../README.md). This folder is the deeper engineering set.

**Faculty / UCS503 template docs:** [index.md](./index.md) · [requirements.md](./requirements.md) · [architecture-overview.md](./architecture-overview.md) · [testing.md](./testing.md) · [evaluation.md](./evaluation.md) · [ROADMAP.md](./ROADMAP.md) · [WEEKLY_PROGRESS.md](./WEEKLY_PROGRESS.md) · Week [1](./AgriConnect_Progress_Week1.pptx) / [2](./AgriConnect_Progress_Week2.pptx) / [3](./AgriConnect_Progress_Week3.pptx) decks

**Complete endpoint catalog (discovery):** [API_ENDPOINTS.md](./API_ENDPOINTS.md)  
**Canonical API contract (request/response shapes):** [API_CONTRACT.md](./API_CONTRACT.md)  
**Status codes, approve/discard/change scenarios, and errors:** [API_STATUS_CODES.md](./API_STATUS_CODES.md)  
**Frontend how-to:** [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)  
**Backend how-to:** [BACKEND_GUIDE.md](./BACKEND_GUIDE.md)

---

## What this product is

AgriConnect is a farmer-to-buyer marketplace. Farmers publish crop listings. Buyers place orders. Admins moderate users and listings. The Next.js app talks **only** to the Express API. It never talks to Supabase Postgres or Storage directly.

| Layer | Stack | Local URL |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind | `http://localhost:3000` |
| Backend | Express 5, Prisma, PostgreSQL (Supabase), Zod | `http://localhost:5001` |
| API prefix | REST v1 | `/api/v1` |

---

## First 30 minutes (run the project)

1. Install **Node.js 24+** and npm.
2. Clone the repo. Copy env files:

```bash
cd backend
copy .env.example .env
cd ..\frontend
copy .env.example .env.local
```

3. Fill `backend/.env` with Supabase Postgres + Storage keys, JWT secrets, and admin seed credentials. Details: [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md).
4. Start the API:

```bash
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

5. Confirm `GET http://localhost:5001/health` returns `{ "success": true, "data": { "status": "ok" } }`.
6. Start the UI:

```bash
cd frontend
npm install
npm run dev
```

7. Open `http://localhost:3000`. Log in as the seeded admin, or register a farmer/buyer.

Verify backend: `npm run typecheck`, `npm run lint`, `npm test` from `backend/`.

---

## Read in this order

| # | Document | Why |
|---|---|---|
| 1 | This file | Map of the docs |
| 2 | [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) | Env vars, Docker Postgres option, CORS/cookies |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | Boundaries: Express owns data; frontend is a client |
| 4 | [API_ENDPOINTS.md](./API_ENDPOINTS.md) | Every HTTP + Socket + outbound surface (discovery) |
| 5 | [API_CONTRACT.md](./API_CONTRACT.md) | Method, path, body, success payload |
| 6 | [API_STATUS_CODES.md](./API_STATUS_CODES.md) | Every HTTP code, approve/discard/change, errors |
| 7 | Role-specific guide | [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) or [BACKEND_GUIDE.md](./BACKEND_GUIDE.md) |
| 8 | [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | Tables, enums, order/listing state machines |
| 9 | [CHANGELOG.md](./CHANGELOG.md) | What changed since you last pulled |
| — | [WEEKLY_PROGRESS.md](./WEEKLY_PROGRESS.md) | Monday→Monday faculty tracker (backlog / working on / done) |

Product intent lives in [AgriConnect_PRD.md](./AgriConnect_PRD.md) and [PRD_AMENDMENTS.md](./PRD_AMENDMENTS.md). [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) is historical phase planning; the code has already shipped past Phase 0.

---

## What else a new developer needs (handoff checklist)

Industry practice for picking up a leftover codebase is five kinds of docs, not only an endpoint list:

1. **How do I run this?** — README + setup (env, seed, ports).
2. **How is it built?** — architecture, folder map, auth, data flow.
3. **How do I call it?** — API contract + status codes + errors + examples.
4. **What data do we store?** — Prisma schema + relationships.
5. **What is unfinished or dangerous?** — known gaps below, plus changelog.

Also useful and present in this repo:

- Authentication and token refresh (`Authorization: Bearer` + HttpOnly refresh cookie)
- Role-based access (`FARMER`, `BUYER`, `ADMIN`)
- State machines (listings and orders)
- Pagination, decimal strings, ISO dates
- Rate limits
- Frontend API client (`frontend/src/lib/api/`)
- Postman collection (`backend/postman/`)
- Seed admin user (from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`)

---

## Current V1 surface

| Area | Status | Entry points |
|---|---|---|
| Auth | Shipped | `/api/v1/auth/*` |
| Users / profiles / export / delete | Shipped | `/api/v1/users/*` |
| Listings + photos | Shipped | `/api/v1/listings/*` |
| Orders + status machine | Shipped | `/api/v1/orders/*` |
| Notifications | Shipped | `/api/v1/notifications/*` |
| Farmer/buyer reports | Shipped | `/api/v1/reports/me` |
| Admin users, moderate, analytics, logs | Shipped | `/api/v1/admin/*` |
| Admin CSV export | Not implemented | Do not call `GET /api/v1/admin/reports.csv` |
| Socket.io / realtime | Shipped (V2) | Order chat + voice calls on `/socket.io` |
| Reviews | Shipped | `/api/v1/orders/:id/reviews`, `/api/v1/users/:id/reviews` |
| Payments / escrow | Shipped (V2) | `/api/v1/orders/:id/payment*`, `/api/v1/payments/*` (incl. signed Razorpay webhook) |
| ML advisory | V3 | Do not implement |

---

## Known gaps and constraints

- `GET /api/v1/admin/reports.csv` is documented as optional in the contract and is **not** implemented.
- Listings **cannot** be created as `active`. Create `draft` → upload photos → `PATCH` to `active`.
- Admin may only **cancel** orders, not accept/confirm/fulfill them.
- Buyer may cancel only while the order is `pending`.
- Public browse of listings is `active` only unless the caller is admin or `mine=true` (farmer).
- Frontend never receives `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or JWT secrets.
- Access JWT lives in memory (`tokenStore`), not `localStorage`. Refresh cookie path is `/api/v1/auth`.

---

## Where to change code

| If you are changing… | Look here first |
|---|---|
| A route or status code | `backend/src/modules/<resource>/` then update API docs (see Cursor rule) |
| Request validation | `*.schema.ts` / `*.schemas.ts` (Zod) |
| JSON envelope | `backend/src/common/response.ts` |
| Frontend fetch / types | `frontend/src/lib/api/` |
| UI screens | `frontend/src/app/` |
| Auth session | `frontend/src/features/auth/` |
| Prisma models | `backend/prisma/schema.prisma` |

When you change an endpoint, the project rule `.cursor/rules/update-api-docs.mdc` requires the docs in this folder to be updated in the same change.
