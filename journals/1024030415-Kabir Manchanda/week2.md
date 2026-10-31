# Week 2 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Prototype — real-time, production-shaped system |
| **Period** | Mon 31 Aug → Mon 7 Sep 2026 |
| **Hours** | ~14 |

---

## 1. Work Completed This Week

During Week 2, I focused primarily on completing AgriConnect’s **Prototype** milestone on top of the Lab CRUD marketplace: live mandi market intelligence, real-time order chat, logistics and payment stubs, buyer alerts, listing lifecycle jobs, Docker/CI packaging, and backend hardening for faculty demo.

The major work streams this week were:

- Agmarknet / data.gov.in mandi prices service and market APIs
- Socket.io + REST order chat, typing, and reviews backend
- Logistics tracking, escrow-style payment stub, and buyer alerts
- Listing expiry jobs, V2 migration, and demo seed data
- Docker Compose, Dockerfiles, and GitHub Actions CI fixes
- Testing, debugging, and API documentation updates

Manbhav Kumar Terry owned Prototype UI work in parallel: chat/typing screens, order timeline, `/market-prices` page UX, Hindi/Punjabi (en/hi/pa) i18n, guest browse/landing polish, and Kisan assistant UI wiring. Backend APIs, integrations, and infra were primarily my responsibility.

---

## 2. Market Intelligence (Mandi Prices)

The Lab marketplace showed farmer list prices only. Prototype needed transparent comparison with real mandi rates.

### What I built

- Mandi prices service (`mandi-prices.service.ts`) integrating Agmarknet / data.gov.in.
- `latestOnly` probes and a history window (about 90 days) so sparse daily arrivals still produce useful results.
- Market APIs for price listing, summary/trends, and listing-vs-mandi compare.
- Grain/crop probes so demo crops (e.g. Haryana Potato/Onion) can show live rows when the feed has data.

### Why this matters

Farmers and buyers can compare platform listing prices against government mandi arrivals instead of relying only on opaque middleman rates. Empty crop×state pairs are handled honestly when Agmarknet has no arrivals that day.

---

## 3. Real-time Chat, Reviews & Assistant Backend

### Order chat

I added real-time communication for an order’s farmer and buyer:

- Socket.io realtime channel plus REST message history
- Typing indicators for a live negotiation feel
- Auth-scoped rooms so only order participants join the chat

### Reviews

- Review APIs so completed trades can leave feedback and improve trust on the platform.

### Assistant path

- Supported the Kisan assistant backend path used by the UI; investigated and fixed failures when Gemini replies were very long so demos stay reliable.

These changes move AgriConnect from form-only order updates to a production-shaped negotiation and trust layer.

---

## 4. Logistics, Payments, Alerts & Lifecycle Jobs

### Logistics

- `PATCH /orders/:id/logistics` so shipment/tracking-style status can be recorded on an order after Lab fulfilment states.

### Payments (Prototype stub)

- Escrow-style mock hold / confirm flow so the product shows how payment would sit between buyer and farmer without requiring live Razorpay yet.
- Production Razorpay + webhooks remain backlog after the Prototype demo.

### Buyer alerts

- `/buyer/alerts` so buyers can watch produce interest and get notified when matching supply appears.

### Listing lifecycle

- Expiry warning and auto-expire jobs so stale listings do not stay “active” forever.
- V2 schema migration and demo seed data so faculty demos have realistic marketplace + Prototype rows.

---

## 5. Docker, CI & Backend Hardening

### Packaging

- `docker-compose.yml` and Dockerfiles so backend/frontend can run in a containerized Prototype shape.
- GitHub Actions CI workflow to lint/typecheck/test on the active branch (`backend_frontend`).

### Hardening fixes

- Fixed backend TypeScript strict errors in the mandi service after merge.
- Fixed backend CI lint/type failures so the pipeline stays green.
- Kept Vitest backend suite passing (full suite verified locally for Prototype demos).

The goal was a demo-ready, CI-backed Prototype — not only features on a laptop.

---

## 6. Testing & Debugging

I tested Prototype features locally and against CI, and fixed issues found during integration with Manbhav’s UI.

### Areas checked

- API startup with new Prototype modules
- Mandi price fetch, summary, and compare endpoints
- Empty mandi responses for crop×state pairs with no arrivals
- Socket.io chat connect, message send/receive, typing
- Reviews create/list paths
- Logistics patch on orders
- Payment hold/confirm stub
- Buyer alerts create/list behaviour
- Listing expiry job behaviour with seed data
- Docker build/compose smoke path
- GitHub Actions CI (lint / types / tests)
- Long Kisan assistant replies
- Frontend integration against updated API contracts

### Issues investigated / resolved

- **Sparse mandi feed** — some crops empty on a given day; mitigated with probes, history window, and clear empty-state behaviour for the UI.
- **CI TypeScript strictness** — mandi-related types broke CI; repaired for a green `backend_frontend` pipeline.
- **Long assistant replies** — tightened response handling so the assistant path does not fail mid-demo.

---

## 7. Documentation, Presentation & Repository

### Documentation & presentation

During Week 2, I:

- Updated API contract and status-code docs for mandi, chat, logistics, payments, and alerts.
- Kept frontend guide notes aligned so Manbhav’s wrappers/screens match new endpoints.
- Updated changelog / weekly progress for Prototype completion.
- Prepared Week 2 progress report material for faculty Prototype demo.
- Organized demo notes (e.g. Haryana Potato/Onion live rows; Wheat may be empty the same day).

### GitHub & project structure

```text
ucs503p-AgriConnect/
├── backend/
│   ├── src/modules/          # auth, listings, orders, chat, market, ...
│   ├── src/services/         # mandi-prices.service.ts, jobs, ...
│   └── Dockerfile
├── frontend/                 # Next.js UI + i18n (teammate-led)
├── docker-compose.yml
├── .github/workflows/ci.yml
├── docs/
└── journals/
    └── 1024030415-Kabir Manchanda/
        ├── week1.md
        └── week2.md
```

### Process work

- Shipped Prototype slice and CI fixes to `origin/backend_frontend`.
- Kept secrets (e.g. `DATA_GOV_IN_API_KEY`) in env configuration, not in git.
- Coordinated merge/CI fixes so UI and API stayed demoable together.

---

## 8. Challenges, Learnings & Next Week

### Challenges & how resolved

- External government feeds are incomplete by nature — design for empty states, not only happy paths.
- Strict CI after feature merges needs dedicated cleanup time; fixed typing/lint before demo week.
- Realtime chat + long AI replies both need careful payload and error handling for live faculty walks.

### Learnings

- Prototype value comes from integrations (mandi, sockets, Docker/CI) on top of a solid Lab CRUD core.
- Documenting compare/summary/alert endpoints early keeps UI and backend from drifting.
- Splitting backend/infra (me) and UI/i18n (Manbhav) works when contracts and error codes stay shared.

### Collaboration note

Kabir (me): mandi service, chat/reviews APIs, logistics/payments/alerts, jobs, migration/seed, Docker/CI, Vitest/docs.  
Manbhav: chat UI, order timeline, market-prices UX, en/hi/pa i18n, guest browse/landing, Kisan assistant UI.

### Plan for next week

- Faculty Prototype demo walkthrough from `backend_frontend`.
- Polish marketplace/mandi load UX when backend is down; register required-field improvements.
- Plan **Capstone** scope (ML advisory / price prediction) without blocking the Prototype demo.
- Production Razorpay remains backlog after demo.
