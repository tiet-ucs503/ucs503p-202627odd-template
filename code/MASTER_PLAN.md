# Solpop master plan

Living document. Source of truth for what's built, what's queued, what's deferred.

---

## v1.0.0 capstone — shipped

Tagged `v1.0.0`. 17 routes, 22 features. Single-user demo app. IndexedDB-only persistence. Free-tier Gemini/Groq. No auth. No real fleet model. No audit trail. No queue. Local-only share-store on filesystem.

Designed to prove the two-model pipeline (Gemini vision + Llama 3.3 synthesis) end-to-end. It does. Now we turn it into a real SaaS for solar farms.

---

## Audit gaps to close (from honest review)

### Critical (10) — blocks paid usage
1. No auth, no multi-tenancy
2. No real DB / image storage / audit trail
3. Shared single Gemini key, no per-tenant metering, no rate-limit per user
4. No fleet data model (sites/strings/modules-with-serials/GPS/install-date)
5. No background queue (300s lambda timeout for big drone flights)
6. No real time-series identity (manual baseline-panel match)
7. EXIF stripped at upload (GPS lost = no GIS)
8. No "is this a solar panel" gate (hallucinated reports on garbage input)
9. Model versions unpinned (reports not reproducible)
10. Zero ground-truth benchmarks (no precision/recall numbers to sell)

### High (11–20) — UX failures
11. No team/roles
12. No human-in-loop override
13. No deduplication (drone overlap counted as separate panels)
14. No CMMS / SCADA / drone integrations
15. Refresh-during-analysis loses progress
16. No mobile-native (offline, GPS, voice)
17. Time-series matching is weak (type+loss greedy, no IoU/visual fingerprint)
18. A11y holes (keyboard, aria-live, color-only severity)
19. No error boundaries
20. No bulk operations

### Medium (21–30) — quality polish
21. UI i18n incomplete (synthesis 7-lang, UI EN-only)
22. No analytics
23. Free-tier 429 UX poor
24. Bundle bloat (react-pdf 600KB)
25. No CSRF / abuse rate-limit / body-size caps
26. HEIC untested
27. No CDN for samples
28. Lenis fights iOS pull-to-refresh
29. Print stylesheet half-done
30. No PWA / offline mode

---

## SaaS roadmap

### Phase 1 — foundation (4–6 wk for senior eng)
1.1 Auth + orgs (Auth.js v5 + Drizzle adapter) — magic-link + GitHub OAuth
1.2 Postgres + R2/S3 image store (Supabase or Neon + S3-compat)
1.3 Fleet data model (sites · strings · modules)
1.4 EXIF preserved + GPS extracted at upload
1.5 Background queue (Inngest or DB-backed jobs table)
1.6 Per-org BYO API keys + metered fallback + usage events
1.7 Audit log + model pinning
1.8 "Is this a solar panel" gate
1.9 Webhook event bus (HMAC-signed)
1.10 Public REST API + bearer auth + OpenAPI spec

### Phase 2 — solar-farm killers (6–8 wk)
2.1 Drone flight ingest (zip/folder, EXIF clustering, dedup)
2.2 GIS map view (Maplibre + module pins)
2.3 SCADA correlation (Solar-Log/SolarEdge/Enphase/SMA adapters)
2.4 Module-identity time-series (auto-match by serial/GPS/visual fingerprint)
2.5 Inspector override workflow + active-learning labels
2.6 CMMS webhooks (Maximo / SAP PM / eMaint)
2.7 Compliance reports (IEC 61215/61730/TS 62446-3 + manufacturer warranty templates)
2.8 Org analytics dashboard
2.9 Predictive degradation curves (model trained on accumulated data)
2.10 Mobile field-tech app (PWA + Capacitor)

### Phase 3 — moat (12+ wk)
3.1 Self-hosted vision model (fine-tune open VLM on PV defect dataset)
3.2 Thermal IR + EL imagery support
3.3 Inverter / battery / BoS coverage
3.4 Drone vendor APIs (DJI / Skydio / Parrot)
3.5 Insurance partnership product
3.6 Carbon credit ledger + voluntary market integration
3.7 O&M crew marketplace
3.8 White-label tenancy
3.9 Edge inference on drone hardware
3.10 Public benchmark dataset

### Phase 4 — pricing & GTM
- Free: 50 panels/mo, 1 user, BYO keys
- Pro $99/mo/user: 500 panels/mo, CMMS integration, PDF unlimited
- Fleet $499/site/mo: 5k panels, SCADA, GIS map, predictive
- Enterprise: unlimited, on-prem, SOC 2, BAA, custom integrations

---

## What's getting built right now (this session)

Phase 1 starter set + critical gap closures we can ship locally without external services:

- **Drizzle ORM + sqlite (local) + Postgres-ready abstraction** — schema for orgs/users/memberships/sessions/sites/strings/modules/inspections/panel_results/defects/audit_log/model_versions/api_keys/usage_events/shares/jobs/webhook_subs. Migrations versioned.
- **Audit log + model version pinning** — every AI call records `{ model, version, prompt_hash, image_sha256, request_id, org_id, user_id, latency_ms, cost_estimate, created_at }`. JSON-line-store on disk for v0, DB-backed once Drizzle lands.
- **Panel gate preflight** — small Gemini classifier call before vision pipeline. Rejects non-PV uploads early with clear UX.
- **EXIF preservation + GPS extraction** — exifr at upload, sharp `withMetadata`, GPS surfaced into panel JSON for future GIS.
- **Error boundaries** — `app/inspect/error.tsx`, `app/sessions/[id]/error.tsx`, `app/chat/[id]/error.tsx`, `app/global-error.tsx`.
- **Rate-limit middleware** — token bucket per IP for `/api/chat`, `/api/explain`, `/api/synthesize`. 60 req/min default.
- **Body-size cap** — 8 MB on JSON endpoints, larger only on `/api/analyze` and `/api/share` POST.
- **DB-backed share store** — replace `.solpop-shares/<id>.json` filesystem with sqlite (Drizzle). Multi-process safe. Foundation for Phase 1.2.

### What we're NOT shipping this session (need user-provided creds)

- **Auth.js v5 fully wired** — needs email provider (Resend/Postmark) or OAuth client (GitHub/Google). Will scaffold lib/auth + middleware so wiring it later = 1 day work.
- **Stripe billing** — needs Stripe account.
- **Real Postgres** — sqlite locally, swap to Neon/Supabase by setting `DATABASE_URL` once a connection string is provided.
- **R2/S3 image storage** — needs cloud credentials. Stays on-disk for now.
- **Real CMMS / SCADA / drone integrations** — needs partner API access.
- **Self-hosted vision fine-tune** — needs GPU + labeled dataset.

When user provides those creds, swap-in is mostly env-var work + 1–2 day integration each.

---

## What I need from the user to unlock the rest

| Need | Phase unlocked | Cost |
|---|---|---|
| Email provider (Resend free tier ok) | Auth magic-link | $0–$20/mo |
| GitHub OAuth client (free) | Auth OAuth | $0 |
| Postgres URL (Neon free tier ok) | Real DB | $0–$19/mo |
| S3-compat bucket (R2 free tier ok) | Image storage | $0 |
| Stripe test keys | Billing | $0 (test) |
| Sentry DSN (free tier) | Error monitoring | $0 |
| Inngest API key (free tier) | Real queue | $0 |
| Maplibre OK out of the box | GIS map | $0 |
| Maximo / SAP PM sandbox | CMMS integration | varies |
| Solar-Log / SolarEdge dev key | SCADA | varies |
| DJI Cloud dev key | Drone ingest | varies |

Drop any of those in `.env.local` and I'll wire them.
