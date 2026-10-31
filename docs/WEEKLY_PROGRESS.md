# AgriConnect — weekly progress

Monday → Monday (IST). **Newest week on top.** On Monday close, move the finished week to **Archive** and open the next week number.

| | |
|---|---|
| **Team** | Kabir Manchanda, Manbhav Kumar Terry |
| **Course** | UCS503P |
| **Current week** | **Weeks 5–6** — Mon 12 Oct → Mon 26 Oct 2026 |
| **Updated** | Wed 14 Oct 2026 |
| **Status** | **Green** — Capstone B2B bidding, counter-offer negotiation & dynamic price discovery shipped; 13-locale parity; 157 backend / 128 frontend tests passing |

## Project phase snapshot

_Phased growth model (PRD §5): **Lab → Prototype → Capstone** — not release version numbers._

| Phase | Theme | Status | Notes |
|---|---|---|---|
| **Lab** | Functional CRUD marketplace | Complete (Week 1) | Auth/RBAC, listings, orders, admin, notifications, reports — see Archive |
| **Prototype** | Real-time, production-shaped system | Complete (Week 2–3) | Chat, calls, mandi, logistics, escrow payments + webhook, 13-locale UI, contact guard — see board |
| **Capstone** | AI advisory & B2B dynamic negotiation | In progress | Grounded Kisan RAG + UI refresh + B2B bidding & counter-offer engine |

## Board — weeks 5–6

**Focus:** Capstone B2B bidding, counter-offer negotiation, Mandi benchmark fairness, atomic order conversion, and 13-locale parity; then faculty demo walkthrough.

| | Task | Notes |
|---|---|---|
| **Done** | Agricultural bidding value & architecture | Formulated senior engineering rationale for wholesale negotiation (lot quality variance, bulk volume tiers, APMC volatility parity, anti-lowballing guardrails) |
| **Done** | Prisma schema & PostgreSQL DDL migration | Added `BidStatus` enum, `NotificationType` enum entries, `model Bid`, composite indexes; applied via pooler-safe migration `apply-bids-migration.ts` |
| **Done** | Backend bids negotiation module | Zod validation schemas, `bids.service.ts` lifecycle state machine (submit, withdraw, counter, accept, reject) mounted at `/api/v1/bids` with RBAC |
| **Done** | Concurrency-safe atomic order conversion | Implemented `createOrderFromBid` in `orders.service.ts` executing atomic inventory decrements (`quantity: { gte: quantity }`), status transitions, and bid-order linkage |
| **Done** | Anti-disintermediation contact guard | Integrated `contactGuard` into bid notes and counter messages to block phone numbers and emails (HTTP 400 `CONTACT_INFO_BLOCKED`) |
| **Done** | Post-login role-gated listing detail panel | Segmented tabs ("Buy at Asking Price" vs "Make an Offer / Bid") on `/listings/[id]`; guest view strictly hides bid forms with login prompt |
| **Done** | Dynamic BidForm & Mandi Benchmark chip | Deal value calculator with live Mandi Benchmark fairness badges (`+X% above market`, `Competitive offer`, `-X% below local mandi modal rate`) |
| **Done** | Farmer incoming bids & counter-offer manager | Integrated `FarmerBidsList` directly on `/listings/[id]` for listing owners with Accept, inline Counter-Offer, and Decline actions |
| **Done** | Buyer desk negotiation workspace | Integrated `BuyerBidsList` under "My Bids & Negotiations" on `/buyer` with Accept Counter and Withdraw controls, unmount guards, and EmptyState fallback |
| **Done** | 13-locale dictionary parity & native script | Modularized `bids-messages.ts` merged into `messages/index.ts`; 532 keys × 13 locales verified with 100% native script compliance and 0 hardcoded strings |
| **Done** | Automated database demo seeding | Authored `seed-sample-bids.ts` activating demo produce lots and seeding multi-state negotiations for buyer Aman Singh |
| **Working on** | Faculty milestone demonstration | Live evaluator walkthrough of buyer bid submission, Mandi fairness chip, farmer counter-offer, and order creation |
| **Blocked** | — | None |
| **Backlog** | Native-speaker pass on the ten new dictionaries | Machine-translated today |
| **Backlog** | Capstone — ML price / crop CV | Still backlog after Grounded Kisan & Bidding |
| **Backlog** | Farmer payouts / settlement | Escrow holds and refunds are done; paying the farmer out through Razorpay is not |
| **Backlog** | TURN server for calls | Public STUN only today, so calls behind strict NATs may fail to connect |
| **Backlog** | Contact blocking on review comments | Chat, order notes, listing copy, and bid notes are scanned; review comments are the last free-text field still unscanned |
| **Backlog** | Razorpay webhook tunnel for local demos | Checkout works without it; webhook needs a public HTTPS URL |

**Risks:** Locale dictionaries still need a native-speaker pass. Voice calls are single-process + public STUN (TURN still backlog).

**Next week:** faculty walkthrough of Bidding & Grounded Kisan; review comments contact guard; optional TURN + farmer payouts.

---

## Archive

### Week 4 — Mon 5 Oct → Mon 12 Oct 2026

| | |
|---|---|
| **Milestone** | Capstone UI Authentic Farm Refresh & Concurrency Overhaul |
| **Status** | **Green** — Farm-authentic UI refresh across all surfaces; 13-locale parity; Mandi & DB pooler concurrency overhaul |
| **Closed** | Mon 12 Oct 2026 |

| | Task | Notes |
|---|---|---|
| **Done** | Tokens & field surface texture | Soft field micro-dot grain background, tactile buttons, rich cards, PageHeader and StatCard tokens in `globals.css` and `ui.tsx` |
| **Done** | App shell & navigation pills | Clearer active nav pills, tighter weather/lang/bell cluster, mobile second-row nav in `shell.tsx` |
| **Done** | Split-brand auth screens | Responsive brand showcase + form on `/login` and `/register`; demo credentials quick-fill maintained |
| **Done** | Landing page auth hero sync | Synced landing hero with active `useAuth()` session; role-aware subtitle and dynamic [Dashboard] link to eliminate contradictory guest CTAs |
| **Done** | Logged-in dashboard KPI strips | Farmer, buyer, and admin desk KPI cards, revenue/spend stats, and quick actions |
| **Done** | Two-column order workspace | Desktop two-column layout on `/orders/[id]` (details/timeline left, payment/call/chat right); list status badges |
| **Done** | Admin moderation chrome | Distinct filter toolbars, search bar, and audit timeline cards on `/admin/users`, `/admin/listings`, `/admin/logs` |
| **Done** | Landing page farm story | Authentic hero banner, trust credentials strip, horizontal category pill slider, live produce showcase |
| **Done** | Sticky marketplace filter bar | Anchored filter toolbar (`sticky top-16`), result count badges, dense card grid, empty search reset |
| **Done** | Listing detail gallery & sticky buy card | Photo badge overlays, harvest & availability cards, farmer rating, sticky desktop order panel |
| **Done** | Mandi rate cards & dual layout | High modal rate banner, mobile card view + desktop APMC table, 90-day history chart in `/market-prices` |
| **Done** | Mandi latency & APMC benchmark fallbacks | Eliminated 45s timeouts & unbounded loops with 3.5s budget in `mandi-prices.service.ts`; built realistic APMC benchmark matrices (6 states, 15 staples); decoupled frontend waterfall in `/market-prices` |
| **Done** | Database pooler concurrency optimization | Replaced read-only Prisma `$transaction` across 7 backend services with concurrent `Promise.all` to eliminate Supabase pooler lockups and P2028 timeouts |
| **Done** | Trade widgets refresh | Enlarged Ask Kisan launcher & voice wave bars, payment method radio cards, compact phone bar, 5-day weather popover |
| **Done** | 13-locale i18n & quality gates | 483 keys × 13 locales parity, AST zero hardcoded strings check, width budget tests, 128 frontend / 146 backend tests green |

### Week 3 — Mon 7 Sep → Mon 14 Sep 2026

| | |
|---|---|
| **Milestone** | **Prototype** close-out + **Capstone** start (Grounded Kisan) |
| **Status** | **Green** — Prototype demo-ready; login copy/paste whitespace trim, Grounded Kisan RAG, and profile weather shipped |
| **Closed** | Mon 14 Sep 2026 |

| | Task | Notes |
|---|---|---|
| **Done** | Faculty Prototype demo | Walkthrough from `master`; use ordered deck in `docs/` |
| **Done** | Login copy/paste trim | Email/password trim + one-click Farmer/Buyer fill on `/login` |
| **Done** | Faculty ordered presentation | `docs/AgriConnect_Presentation_Ordered.pptx` + link in `docs/index.md` - `7f1d501` |
| **Done** | Interactive README polish | Hero TOC, phase shields, centered demo, `<details>` for dense sections; Quick start stays open |
| **Done** | README demo assets refreshed | Recaptured `demo.gif`, `demo-marketplace.png`, `demo-market-prices.png` with real crop photos — `e7b446d` |
| **Done** | Marketplace wheat photo fallback | Detect tiny/corrupt Supabase JPEGs; fall back to `/crops/*.jpg` then Unsplash — `e7b446d` |
| **Done** | Root README refresh | Faculty-facing Lab→Prototype→Capstone snapshot; `code/AgriConnect` paths; accurate Capstone status |
| **Done** | UCS503 faculty docs + Week 1–3 decks | `docs/index.md`, requirements, architecture-overview, testing, evaluation, ROADMAP, progress PPTX |
| **Done** | Master layout like UCS503 template | App under `code/AgriConnect/`; `assets/`, stub `project-report-*`, `reports/`; `LICENSE` |
| **Done** | `project-proposal/` on `master` | AgriConnect PDF + LaTeX (BharatAssist-style headings; Submitted to Mr. Hardik) |
| **Done** | Grounded Kisan (RAG) Capstone §8.2 | Same widget; curated pack + cite/refuse; `AGRONOMIST` + escalations; profile weather + 5-day; `eval:grounded` 30/30 |
| **Done** | Commit + push Prototype slice | Local verify: 138 backend / 128 frontend tests; smoke antibypass + calls; push `backend_frontend` → merge `master` |
| **Done** | Payment methods + gateway escrow | UPI/card/netbanking/COD; Razorpay verify on confirm; signed webhook; buyer payment nudge; unpaid-fulfill warning |
| **Done** | Anti-bypass contact guard | Chat, order notes, listing description/variety/village → 400 `CONTACT_INFO_BLOCKED` |
| **Done** | In-app voice calls | WebRTC + Socket.io; 45s ring timeout; smoke:calls 13/13 |
| **Done** | 13-locale UI + frontend tests | 477 keys × 13; Vitest screens/parity/width budget; header/RTL/webfonts |
| **Done** | Faster Kisan talk | Pinned TTS model + minimal thinking; ~45-word replies; ~280-char speak clip |
| **Done** | Edge-case hardening | Body-parser 413 mapping; webhook match by checkout id; socket token refresh; COD switchable |
| **Done** | Natural orders list | Smoke junk cleaned; active statuses sort above cancelled |
| **Blocked** | — | None |
| **Backlog** | Native-speaker pass on the ten new dictionaries | Machine-translated today |
| **Backlog** | Capstone — ML price / crop CV | Still backlog after Grounded Kisan |
| **Backlog** | Farmer payouts / settlement | Escrow holds and refunds are done; paying the farmer out through Razorpay is not |
| **Backlog** | TURN server for calls | Public STUN only today, so calls behind strict NATs may fail to connect |
| **Backlog** | Contact blocking on review comments | Chat, order notes, and listing copy are scanned; review comments are the last free-text field still unscanned |
| **Backlog** | Razorpay webhook tunnel for local demos | Checkout works without it; webhook needs a public HTTPS URL |

**Risks:** Locale dictionaries still need a native-speaker pass. Voice calls are single-process + public STUN (TURN still backlog).

**Carried into Week 4:** Farm-authentic UI refresh across all surfaces while keeping all routes, APIs, and features intact.

---

### Week 2 — Mon 31 Aug → Mon 7 Sep 2026

| | |
|---|---|
| **Milestone** | **Prototype** â€” real-time, production-shaped system |
| **Status** | **Green** â€” Prototype demo-ready; anti-bypass chat guard, in-app voice calls, and payment methods verified against the live API |
| **Closed** | Mon 7 Sep 2026 |

| | Task | Notes |
|---|---|---|
| **Done** | Commit + push Prototype slice | `49a11f1` (+ CI fixes `4bc4814`, `4e17381`); remote `origin/backend_frontend` |
| **Done** | Live mandi feed (Agmarknet) | `latestOnly`, grain probes, 90-day history â€” `49a11f1` / `mandi-prices.service.ts` |
| **Done** | Docker + CI | `docker-compose.yml`, Dockerfiles, `.github/workflows/ci.yml` â€” `49a11f1` |
| **Done** | Hindi / Punjabi i18n | en/hi/pa switcher; register + profile; Kisan language â€” `41455f0` |
| **Blocked** | â€” | None |
| **Done** | Real-time order chat + typing | Socket.io + REST â€” commit `c603f78` |
| **Done** | Reviews + Kisan assistant + CI | Commits `c603f78`, `9477dc0`, `0736886` |
| **Done** | Market price trends + summary | `GET /market/prices`, `/prices/summary`, `/market-prices` â€” `49a11f1` |
| **Done** | Logistics tracking | `PATCH /orders/:id/logistics` â€” `49a11f1` |
| **Done** | Escrow-style payment stub | Mock hold/confirm â€” `49a11f1` |
| **Done** | Buyer produce alerts | `/buyer/alerts` â€” `49a11f1` |
| **Done** | Listing lifecycle jobs | Expiry warnings + auto-expire â€” `49a11f1` |
| **Done** | Demo seed + schema migration | V2 migration + seed â€” `49a11f1` |
| **Done** | Guest browse + landing UX | Logo hero, public marketplace â€” `49a11f1` |
| **Done** | Order timeline + mandi compare badge | `OrderTimeline`; `POST /market/prices/compare` â€” `49a11f1` |
| **Done** | Verification | Backend Vitest 43/43; frontend build; i18n parity â€” local + `41455f0` |
| **Done** | API endpoint catalog (boss review) | `docs/API_ENDPOINTS.md` + contract gaps (meta, commodities, outbound) |
| **Done** | Marketplace / mandi load UX | Backend-down message; Haryana in state fallback; `Promise.allSettled` on mandi page; `filters[state]` fix |
| **Done** | Register required fields | Phone, state, district required; village optional |
| **Done** | Localize every screen end to end | Orders, listings, marketplace, dashboards, mandi table, admin, alerts, password, badges, ratings, logo, metadata; `tt()` for non-React modules; locale-aware money/qty/date; `agriconnect.locale` cookie drives `<html lang>` |

**Carried into Week 3:** the whole uncommitted Prototype slice (voice calls, payment methods + escrow refunds, contact guard, 13-locale translation, frontend test layer, localized notifications, RLS) plus the faculty demo.

---

### Week 1 â€” Mon 24 Aug â†’ Mon 31 Aug 2026

| | |
|---|---|
| **Milestone** | **Lab** â€” functional CRUD marketplace |
| **Status** | **Green** â€” lab acceptance criteria met |
| **Closed** | Mon 31 Aug 2026 |

**Delivered:** Auth/RBAC (farmer, buyer, admin), listings + photos, order state machine (pending â†’ accepted â†’ confirmed â†’ fulfilled / cancelled), admin moderate/verify/suspend, notifications, reports, password reset, public marketplace browse.

**Engineering:** Full-stack monorepo, Prisma + Supabase, Express REST API, Next.js App Router, Zod validation, JWT + refresh cookies, ownership checks, rate limits.

**Deferred to Prototype (Week 2):** Real-time chat, market intelligence, logistics, payments, alerts, containerization.

**Commits (remote):** through `1f65e2c` initial stack; Lab feature work on `backend_frontend` before 31 Aug.

---

_When Week 5 starts (Mon 12 Oct): archive the Week 4 board here, then open Week 5 with fresh **Working on** rows._
