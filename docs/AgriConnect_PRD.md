# AgriConnect — Product Requirements Document (PRD)

> **Version:** 1.0
> **Date:** August 17, 2026
> **Document type:** PRD (built on the structure/rigor of your *Full-Stack Project Blueprint & Prompt Sheet v2.2*)
> **Author:** Product/Engineering (you) — drafted with Claude
> **Status:** Draft for Lab (V1) → Prototype (V2) → Capstone (V3)
> **Engineering overrides:** [PRD_AMENDMENTS.md](./PRD_AMENDMENTS.md) is binding for V1 stack and scope.

---

## 0. How to use this document

This PRD follows the phased growth model from your blueprint (Lab → Prototype → Capstone) and inherits its engineering discipline: RBAC from day one, Zod-validated env vars, one module per domain resource, and a security checklist gating every release. Section 14 lists features added after market research that weren't in your original brief, with the reasoning for each. Section 15 has the version-safety rule reminder — **do not copy any version number below into `package.json` without re-verifying it**, per your blueprint's own rule.

---

## 1. Executive Summary

**AgriConnect** is a full-stack marketplace platform that connects farmers directly with buyers (traders, retailers, bulk/institutional purchasers), removing intermediaries who currently capture roughly 20–30% of a farmer's potential income. It ships as a straightforward CRUD marketplace for a lab assignment, grows into a real-time, analytics-rich prototype, and matures into an AI-assisted advisory + market intelligence platform for a capstone submission.

**One-line pitch:** *"Direct market access and price transparency for farmers, with AI-driven crop advisory as the platform matures."*

---

## 2. Problem Statement & Market Context

**The core problem:** Farmers lack price transparency and direct market access; buyers lack a reliable way to source produce directly from growers. Both sides lose value to opaque, multi-layered intermediary chains (commission agents, local traders, sub-traders) that exist mainly because of information asymmetry and fragmented local mandi (market) systems.

**Why this matters now:**
- India's agritech sector is projected to grow substantially through 2030, with digital platforms increasingly bundling marketplace access, financial services, and advisory into one experience — this is the direction AgriConnect's phased roadmap already points toward.
- Post-harvest losses remain a major economic drain, particularly for perishables, largely due to inadequate cold-chain and logistics infrastructure — a factor that shapes what "V2 logistics" needs to cover.
- The Government of India has been actively investing in digital market infrastructure — e-NAM (National Agriculture Market) and Agmarknet — to unify mandi price data and reduce the same intermediary problem AgriConnect targets. This is a strong signal that **live mandi price data is a near-mandatory feature**, not a nice-to-have (see Section 14).
- Trust is the biggest adoption blocker on both sides: farmers worry about non-payment or price manipulation; buyers worry about produce quality and consistency. Every mature agri-marketplace studied (B2B agri platforms, direct-to-farmer apps) responds to this with **escrow-style payments, ratings/reviews, and quality grading** — again, addressed in Section 14.

**Who is underserved today:** small and mid-size farmers without an existing buyer network, and small/medium buyers (local retailers, hotels/restaurants, small processors) who can't meet the minimum order volumes required by large agri-aggregators.

---

## 3. Goals & Non-Goals

### 3.1 Product Goals
1. Give farmers a direct, low-friction channel to list produce and reach buyers without a middleman.
2. Give buyers a trustworthy way to discover, evaluate, and purchase produce directly from verified farmers.
3. Increase price transparency by surfacing real/near-real-time market price data alongside listings.
4. Build a technical foundation (V1) that can grow into a data-and-AI-driven advisory platform (V3) without a rewrite.

### 3.2 Academic/Program Goals
- **V1 (Lab):** Demonstrate mastery of full-stack CRUD, auth, RBAC, and basic reporting under a graded rubric.
- **V2 (Prototype):** Demonstrate real-time systems, containerization, CI/CD, and a scalable data model.
- **V3 (Capstone):** Demonstrate applied AI/ML (CV, NLP, predictive modeling) integrated into a production-shaped product, with a credible thesis-level narrative and evaluation metrics.

### 3.3 Non-Goals (explicitly out of scope unless stated otherwise)
- AgriConnect is **not** a payment processor of record — it integrates with third-party payment gateways rather than building custom payment rails.
- AgriConnect is **not** replacing e-NAM/APMC/mandi legal trading infrastructure — it complements it by consuming public price data and offering a direct-sale channel outside regulated auction mandis (a model similar to existing farmer-buyer apps).
- No owned logistics fleet in V1/V2 — logistics is coordinated via listings/status tracking and, where feasible, third-party logistics (3PL) API integration, not physical fulfillment infrastructure built in-house.
- Full blockchain traceability, IoT hardware provisioning, and multi-state legal/regulatory compliance work are **capstone-optional/simulated**, not production commitments (see Section 8, V3).

---

## 4. Personas & Roles

| Role | Description | Primary needs |
|---|---|---|
| **Farmer** | Grows and lists produce for sale (individual smallholder or small farm) | List produce fast (low digital literacy tolerance), see fair market price, get paid reliably, understand demand trends |
| **Buyer** | Trader, retailer, bulk/institutional purchaser, or HORECA (hotel/restaurant/catering) buyer | Discover verified sellers, compare price/quality, place orders confidently, track delivery |
| **Admin** | Platform operator | Moderate listings/users, resolve disputes, monitor platform health, view analytics |
| **Agronomist / Expert** *(added V3)* | Domain expert or AI-augmented advisory persona | Answer farmer questions, validate AI advisory outputs, build trust in AI recommendations |
| **FPO / Aggregator** *(added — see Section 14.1)* | Farmer Producer Organization representing a group of smallholders | Bulk-list on behalf of multiple farmers, negotiate as a collective, meet buyers' minimum order quantities |

**Role growth path:** Farmer, Buyer, Admin exist from V1. Agronomist/Expert and the optional FPO/Aggregator sub-role are introduced without breaking the V1 RBAC model — both are additive roles on the same `roleGuard` middleware pattern from your blueprint.

---

## 5. Phased Roadmap Overview

| Phase | Theme | Key additions over previous phase |
|---|---|---|
| **V1 — Lab** | Functional CRUD marketplace | Auth + RBAC, listings, orders, admin dashboard, notifications, basic reports |
| **V2 — Prototype** | Real-time, production-shaped | Chat, market price trends, reviews, richer analytics, Docker + CI/CD, logistics tracking, escrow-style payments |
| **V3 — Capstone** | AI-assisted advisory platform | CV crop-disease detection, NLP advisory chatbot, ML price prediction, IoT soil sensors (simulated or real), optional blockchain traceability |

Each phase is additive — nothing built in V1 needs to be re-architected to support V2 or V3; new modules and services are layered on top (this mirrors the blueprint's "one module per domain resource" backend pattern and "one feature folder per resource" frontend pattern).

---

## 6. V1 — Lab: Functional Requirements

### 6.1 Auth & RBAC
- Email/password registration and login; role selected at signup (Farmer / Buyer), Admin seeded manually.
- JWT access + refresh token pattern (15 min access / 7 day refresh, per blueprint's token lifetime standard), refresh token in `HttpOnly; Secure; SameSite=Strict` cookie.
- Role-based route guards (`requireAuth` + `roleGuard`) enforced both at API and UI route level.
- Password reset via email token.
- Basic profile: name, phone, location (state/district/village), preferred language.

### 6.2 Produce Listings (Farmer)
- Create/edit/delete listing: crop name, category, variety, quantity, unit (kg/quintal/ton), price per unit, harvest date, location, photos (1–5), description, minimum order quantity.
- Listing status: `draft → active → sold_out → expired → removed`.
- Farmer dashboard: view own listings, edit/deactivate, see view/interest counts.

### 6.3 Discovery & Ordering (Buyer)
- Browse/search listings with filters: crop type, location/radius, price range, quantity available, harvest date.
- Listing detail page with farmer profile summary (name, location, rating once V2 reviews exist).
- Place order: quantity requested, delivery preference (pickup/delivery), notes.
- Order state machine: `pending → accepted → confirmed → fulfilled → cancelled` (adapted from the blueprint's e-commerce order pattern, simplified for V1 — payment/shipped/delivered split added in V2).
- Buyer dashboard: order history, order status tracking.

### 6.4 Admin
- User management: view/suspend/verify farmers and buyers.
- Listing moderation: flag/remove inappropriate or fraudulent listings.
- Basic platform analytics: total users, total listings, total orders, GMV (gross merchandise value) proxy.

### 6.5 Notifications (basic)
- In-app + email notifications: order placed, order status changed, listing approaching expiry.
- Uses the blueprint's `email.service.ts` (Nodemailer) pattern; in-app notifications stored in a `notifications` table, polled or fetched on load (Socket.io real-time push deferred to V2).

### 6.6 Basic Reports
- Farmer: total listings, total quantity sold, revenue summary (simple sum, no ML).
- Buyer: total orders, total spend.
- Admin: platform-wide counts (users, listings, orders) as a simple dashboard, CSV export optional.

### 6.7 V1 Acceptance Criteria (lab-gradeable)
- A Farmer can register, log in, create a listing, and see it appear in Buyer search within the same session.
- A Buyer can place an order against a listing and the Farmer sees the order appear in their dashboard.
- An Admin can suspend a user and that user is immediately blocked from creating new listings/orders.
- All protected routes reject unauthenticated and wrong-role requests with correct HTTP status codes (401/403).
- `npm audit` clean of high/critical on both `backend/` and `frontend/` at submission time.

---

## 7. V2 — Prototype: Functional Requirements

Builds on all of V1. New capabilities:

### 7.1 Real-Time Chat
- Farmer ↔ Buyer direct messaging per order/listing, via Socket.io with JWT-guarded connection and room-based events (per blueprint Section 4/9 conventions).
- Typing indicators, read receipts, message history persisted.

### 7.2 Market Price Trends
- Time-series view of price-per-unit for a given crop, aggregated from AgriConnect's own listing/order data **and** external mandi price feeds (see Section 14.2 — Agmarknet/e-NAM integration, added feature).
- Simple line/bar charts (Recharts or Chart.js, per blueprint's Analytics/Dashboard domain add-on) showing price by crop, by region, over time.

### 7.3 Reviews & Ratings
- Buyer → Farmer rating after order fulfillment (1–5 stars + comment).
- Farmer → Buyer rating (reliability, on-time payment).
- Aggregate rating shown on profile and listing cards — directly addresses the trust gap identified in market research (Section 14.3).

### 7.4 Escrow-Style Payments *(added — Section 14.3)*
- Integration with a payment gateway (e.g., Razorpay/Stripe — verify current recommendation at implementation time) using a hold-and-release pattern: buyer's payment is authorized/held on order confirmation and released to the farmer on delivery confirmation, reducing fraud risk on both sides.
- Payment status becomes part of the order state machine: `pending → confirmed → payment_held → shipped → delivered → payment_released / refunded / disputed`.

### 7.5 Logistics & Delivery Tracking *(added — Section 14.4)*
- Delivery mode selection per order: farmer self-delivery, buyer pickup, or 3PL-assisted (optional connector/API stub).
- Status checkpoints: `dispatched → in_transit → delivered`, with timestamped updates.
- Perishability flag on listings (e.g., vegetables/fruit vs. grain) to visually warn buyers about cold-chain-sensitive orders — informed by research showing cold-chain gaps are a leading cause of post-harvest loss in India.

### 7.6 Richer Analytics
- Admin: cohort growth, GMV trends, top crops/regions, dispute rate.
- Farmer: demand heatmap for their crops/region, suggested pricing band based on recent trades.

### 7.7 Infrastructure
- Dockerized backend, frontend, and (if used) ML microservice; `docker-compose.yml` for local dev.
- GitHub Actions CI: lint → typecheck → test → build on every PR; deploy pipeline to Vercel (frontend) + Render/Railway (backend) on merge to `main`.
- Structured logging (Winston) + error monitoring (Sentry) live in this phase, not deferred to V3.

### 7.8 V2 Acceptance Criteria
- Two logged-in users (one Farmer, one Buyer) can exchange real-time chat messages tied to a specific order.
- A payment can be authorized, held, and released end-to-end in a sandbox/test payment environment.
- Market price chart renders both internal transaction data and at least one external price data point (even if mocked/cached during dev).
- CI pipeline blocks merge on lint/test failure; `npm audit` gate for high/critical enforced in CI.

---

## 8. V3 — Capstone: AI-Assisted Advisory Platform

Builds on all of V1 + V2. This phase is where the thesis-level differentiation lives.

### 8.1 CV Crop-Disease Detection
- Farmer uploads a photo of a diseased crop/leaf; a CV model (e.g., fine-tuned CNN — MobileNet/ResNet family, trained/fine-tuned on an open plant-disease dataset such as PlantVillage, verify current best-practice dataset/model choice at build time) returns a predicted disease + confidence score + recommended action.
- Served via the Python/FastAPI ML microservice, called from the Node backend over an internal API.
- Store prediction history per farmer for longitudinal tracking (useful both as a feature and as capstone evaluation data).

### 8.2 NLP Advisory Chatbot
- Conversational assistant answering farming questions (crop care, pest management, government scheme eligibility) in the farmer's preferred language.
- V3 minimum: retrieval-augmented responses grounded in a curated agri-knowledge base (avoids hallucinated agronomic advice, which carries real-world risk).
- Escalation path to a human Agronomist/Expert role for low-confidence or high-stakes queries.

### 8.3 ML Price Prediction
- Short-horizon price forecast per crop/region using historical AgriConnect transaction data blended with external mandi price history (same data source as V2's price trends).
- Presented as a *range/band with confidence*, not a single hard number — sets accurate expectations and is defensible in a capstone evaluation.

### 8.4 IoT Soil Sensors *(simulated acceptable for capstone)*
- Soil moisture/temperature/pH data ingestion (real low-cost sensors via MQTT/HTTP, or a simulated data generator if hardware isn't available) feeding into the advisory chatbot and dashboards ("your soil moisture is low — consider irrigating before listing").

### 8.5 Optional: Blockchain Traceability
- Immutable batch/lot record (farm origin → sale → delivery) for a subset of listings, positioned as a premium trust feature for buyers who need provenance (e.g., export-oriented or HORECA buyers). Explicitly optional/stretch — do not let it block core V3 evaluation criteria.

### 8.6 V3 Acceptance Criteria
- CV model achieves a documented accuracy/F1 on a held-out test set, with a clear discussion of failure modes (this is what capstone graders look for — not just "it works").
- Chatbot correctly answers a defined evaluation set of agronomy questions and correctly escalates out-of-scope/high-risk questions instead of guessing.
- Price prediction is back-tested against historical data with a stated error metric (e.g., MAPE) and compared against a naive baseline (e.g., last-known-price).
- All ML endpoints have documented latency and are behind the same auth/rate-limiting stack as the rest of the API — this is not a side project bolted onto the main app.

---

## 9. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Accessibility & inclusivity** | Multilingual UI (at minimum English + one regional language, e.g. Hindi/Punjabi), designed for low digital literacy; this is a differentiator most competitor apps call out as essential, not optional (see Section 14.5) |
| **Connectivity resilience** | Core flows (view listings, view own orders) should degrade gracefully on poor connectivity; consider a lightweight PWA/offline-cache layer for listing drafts (see Section 14.5) |
| **Performance** | API p95 < 500ms for read endpoints under expected lab/prototype load; paginated lists everywhere (per blueprint frontend security checklist item 14) |
| **Security** | Full backend + frontend security checklists from the blueprint (Sections 6 & 8) apply unmodified: helmet, CORS allowlist, rate limiting, NoSQL/SQL injection prevention, JWT in memory (never localStorage), DOMPurify on any rendered HTML |
| **Availability** | `GET /health` (liveness) + `GET /ready` (readiness) from day one; rate limits tuned so health checks aren't throttled |
| **Data privacy** | Farmer location data (village/district) is sensitive — expose only what's needed for discovery (region-level), not exact GPS, unless the farmer opts in for delivery coordination |
| **Compliance awareness** | AgriConnect operates *alongside* regulated mandi/APMC trading, not as a replacement — document this distinction clearly in-app so users understand it is a direct-sale channel, not a licensed mandi (this matters if presented publicly, given APMC Acts vary by state) |
| **Auditability** | Activity log for admin actions (suspensions, listing removals) — who did what, when |

---

## 10. Tech Stack

> Per your blueprint's Version Safety Rule: **do not hardcode these as final package.json pins.** Search + `npm show`/`pip show` at implementation time. What's below is what was verified as of this document's date (Aug 17, 2026) plus guidance on what to check.

| Layer | Choice | Verification note |
|---|---|---|
| **Frontend framework** | Next.js + Tailwind CSS | Verify latest stable Next.js major/minor via `npm show next version`; confirm App Router conventions haven't shifted |
| **Backend framework** | Node.js + Express | **Runtime: Node.js 24.x is the current Active LTS line as of Aug 2026** (Node 22 is in Maintenance LTS, Node 26 is Current/non-LTS); re-verify at build time since Node's release cadence changes in Oct 2026 onward |
| **Backend language** | TypeScript (strict mode) | Verify latest via `npm show typescript version` |
| **Database** | PostgreSQL | **V1 locked: Supabase** (see PRD_AMENDMENTS). Do not use Neon/Railway/MongoDB. |
| **ORM** | Prisma | Schema at `backend/prisma/` |
| **Validation** | Zod | Same pattern as blueprint: env schema + request body schemas |
| **Auth** | JWT (access + refresh); Google OAuth out of V1 | Same token lifetime standard as blueprint (15m/7d) |
| **Real-time** | Socket.io | Room-based, JWT-guarded on connection (V2+) |
| **ML microservice** | Python + FastAPI | Verify latest FastAPI + Python version; containerize separately from Node backend |
| **ML/CV libraries** | PyTorch or TensorFlow (pick one), scikit-learn for price prediction baseline | Verify current stable + CUDA compatibility if using GPU training |
| **Payments** | Razorpay (India-first) or Stripe | V2; verify RBI payment-aggregator guidelines before integrating |
| **Mapping/geolocation** | Mapbox or Google Maps Platform (for location filters/delivery) | Domain-specific UI lib slot from blueprint Section 1 |
| **Charts** | Recharts or Chart.js | Per blueprint's Analytics/Dashboard domain add-on |
| **Containerization** | Docker + docker-compose | V2+ |
| **CI/CD** | GitHub Actions | Lint → typecheck → test → build → deploy |
| **Deploy: Frontend** | Vercel | |
| **Deploy: Backend** | Render / Railway | |
| **Deploy: ML service** | Render / Railway (separate service) or a GPU-capable host if training is heavy | |
| **Monitoring** | Sentry (`@sentry/node` + frontend SDK) | |
| **Logging** | Winston | |

**Note on PostgreSQL vs. the blueprint's MongoDB default:** PostgreSQL is a strong fit because AgriConnect's core entities are relational with referential-integrity needs. Keep the blueprint's *practices* (Zod env validation, RBAC middleware, module-per-resource structure) even though the data layer differs.

---

## 11. High-Level Data Model

Core entities (V1 baseline, extended in V2/V3). Canonical column-level design: [DATABASE_DESIGN.md](./DATABASE_DESIGN.md).

- **User** (`id, role[farmer|buyer|admin], name, email, phone, password_hash, language_pref, location, verified, created_at`)
- **FarmerProfile** (`user_id, farm_name, region, fpo_id?, rating_avg`)
- **BuyerProfile** (`user_id, business_name, buyer_type[trader|retailer|bulk|horeca], rating_avg`)
- **Listing** (`id, farmer_id, crop, variety, category, quantity, unit, price_per_unit, harvest_date, status, min_order_qty, perishable, location, photos[]`)
- **Order** (`id, listing_id, buyer_id, farmer_id, quantity, status, delivery_mode, price_total, created_at`)
- **Payment** (`id, order_id, provider, status[held|released|refunded|disputed], amount, held_at, released_at`) — V2
- **Review** (`id, order_id, from_user_id, to_user_id, rating, comment`) — V2
- **Message** (`id, order_id, sender_id, body, sent_at, read_at`) — V2
- **PriceTrend** (`id, crop, region, source[internal|agmarknet|enam], price, recorded_at`) — V2
- **DiseasePrediction** (`id, farmer_id, image_url, predicted_disease, confidence, recommended_action, created_at`) — V3
- **SoilReading** (`id, farmer_id, sensor_id, moisture, temperature, ph, recorded_at`) — V3
- **FPO** (`id, name, region, member_farmer_ids[]`) — V2

---

## 12. Repository Structure

Canonical V1 layout is in [ARCHITECTURE.md](./ARCHITECTURE.md). Prisma lives at `backend/prisma/` (no root `prisma/`). `ml-service/` and `sockets/` are V2/V3.

---

## 13. Security & Compliance Checklist (inherited from blueprint, applied)

Carry over the blueprint's full Backend Security Checklist (Section 6) and Frontend Security Hardening Prompt (Section 11.4), adapted for Postgres/Prisma (no mongo-sanitize). AgriConnect-specific additions:

1. **Payment webhook verification** (V2) — validate payment provider webhook signatures server-side; never trust client-reported payment success.
2. **Image upload validation** — listing photos: file type/size validation client- and server-side; Express → Supabase Storage (service role never on the frontend).
3. **Rate-limit the ML endpoints separately** (V3) from the main API.
4. **PII minimization for location data** — show region-level location in public listing views.
5. **DPDP-aligned data export** — `GET /api/v1/users/me/export`.

---

## 14. Features Added After Market Research (and why)

Your brief covered the core CRUD → real-time → AI roadmap well. Research into live agritech products, government digital-agriculture infrastructure, and academic/industry analyses of digital farmer-buyer marketplaces surfaced several features that recur across nearly every mature product in this space. V1 cuts for these items are in [PRD_AMENDMENTS.md](./PRD_AMENDMENTS.md).

### 14.1 FPO / Bulk Aggregation Support
Individual smallholder listings often can't meet a buyer's minimum order quantity. Letting a Farmer Producer Organization (FPO) or informal farmer group list on behalf of multiple members increases addressable transaction volume. **V2.**

### 14.2 Live Mandi Price Integration (Agmarknet / e-NAM)
e-NAM and Agmarknet 2.0 provide mandi price/arrival data. Surfacing this alongside internal `PriceTrend` records reinforces price transparency. **V2 feature; V3 training data.**

### 14.3 Escrow-Style Payments + Ratings/Reviews
Farmers fear non-payment; buyers fear inconsistent quality. Hold-and-release payments plus ratings are the standard mitigation. **V2.**

### 14.4 Logistics & Cold-Chain Awareness
Flag perishable listings (V1), track delivery checkpoints and optional 3PL (V2).

### 14.5 Multilingual UI, Low-Literacy Design, and Offline Resilience
Vernacular language, voice input, and poor-connectivity tolerance are baseline for farmer apps. **V1: English + i18n stub + low-literacy layout. Full locale + PWA in V2.**

### 14.6 KYC / Verification Badges
**V1:** admin `verified` flag. **V2:** phone OTP.

### 14.7 Weather & Government Scheme Advisory *(V3)*
Extend the NLP chatbot knowledge base to weather-linked advice and scheme eligibility (e.g. PMFBY).

---

## 15. Version Safety Reminder

Before writing or editing `package.json`, `requirements.txt`, or any install command:
1. Web search each non-trivial dependency for its latest stable version and any open CVE/security advisory.
2. Cross-check with `npm show <package> version` / `pip index versions <package>` where the environment allows.
3. State what was verified in your PR description or commit message — don't silently invent versions.
4. Re-run `npm audit` / `pip-audit` and fix all high/critical findings before each phase's demo/submission.

---

## 16. Success Metrics (by phase)

| Phase | Metric |
|---|---|
| V1 | Functional completeness against rubric; 0 unresolved high/critical `npm audit` findings; core user flows (list → discover → order) complete end-to-end |
| V2 | p95 API latency, chat message delivery latency, % of orders with successful escrow release, CI pipeline green rate, Docker build reproducibility |
| V3 | CV model accuracy/F1 on held-out set; chatbot correct-escalation rate on an evaluation question set; price-prediction error (e.g., MAPE) vs. naive baseline; qualitative user-testing feedback if available |

Business-facing (aspirational): average price uplift farmers receive vs. local mandi rate; repeat buyer rate; dispute rate as % of orders.

---

## 17. Risks & Assumptions

| Risk | Mitigation |
|---|---|
| External mandi price data (Agmarknet/e-NAM) may not have a clean public API | Pluggable `priceFeed.service.ts`; cached or seeded data for demos |
| CV disease-detection accuracy may be low without a large labeled dataset | Transfer learning on PlantVillage (or current equivalent); report limitations honestly |
| Payment gateway compliance (RBI) | Use an established gateway's hold feature; do not build custom escrow rails |
| Low farmer digital literacy | Low-literacy UI in V1; i18n/offline in V2 |
| Scope creep across three phases | Hard gates: acceptance criteria in §§6.7, 7.8, 8.6 |

---

## 18. Sources Consulted

- StarAgri — Agritech app features 2026: https://www.staragri.com/top-5-must-haves-every-farmer-should-look-for-in-agritech-apps-in-2026/
- Agribazaar — Digital agriculture marketplace, India: https://blog.agribazaar.com/how-is-the-digital-agriculture-marketplace-in-india-enabling-real-time-price-discovery-direct-farmer-buyer-linkages/
- Akoode — AgriTech App Development: Cost and Features 2026: https://www.akoode.com/blog/agritech-app-development-cost
- Successive Tech — Agritech and E-Commerce driving direct-to-farmer marketplaces: https://successive.tech/blog/agritech-and-e-commerce-are-driving-direct-to-farmer-marketplaces
- PIB — National Agriculture Market (e-NAM): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2251543&reg=3&lang=1
- Global Agriculture — Agmarknet and e-NAM real-time mandi prices: https://www.global-agriculture.com/india-region/agmarknet-and-e-nam-empower-farmers-with-real-time-mandi-price-information/
- Agriculture.Institute — e-NAM explainer: https://agriculture.institute/institutional-support/e-nam-revolutionizing-agricultural-marketing-india/
- FAO STI Portal — Digital Agricultural Marketplaces: https://sti-portal.fao.org/classes/digital-agricultural-marketplaces
- FAO STI Portal — Digital farmer-buyer marketplaces: https://sti-portal.fao.org/families/digital-farmer-buyer-marketplaces
- KisaanTrade — B2B Agriculture Marketplace key features: https://www.kisaantrade.com/blogs/what-are-the-key-features-and-services
- Agriculture.Institute — Agricultural production logistics: https://agriculture.institute/marketing-management-for-agribusiness/agricultural-production-logistics-features-challenges/
- Node.js Release Working Group: https://github.com/nodejs/release
- endoflife.date — Node.js: https://endoflife.date/nodejs

---

*End of PRD. Update this document at each phase gate (V1 → V2 → V3). V1 engineers follow PRD_AMENDMENTS.md where it narrows this file.*
