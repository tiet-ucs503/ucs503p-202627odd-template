# Weeks 5–6 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Capstone Bidding UI, Mandi Benchmark Chips & 13-Locale Negotiation Parity |
| **Period** | Mon 12 Oct → Mon 26 Oct 2026 |
| **Hours** | ~20 |

---

## 1. Work Completed This Sprint (Weeks 5–6)

During Weeks 5–6, following our farm-authentic UI refresh, my teammate Kabir and I implemented the **B2B Bidding & Counter-Offer Negotiation** module. While Kabir spearheaded the core backend engine, PostgreSQL schema migrations, and transaction-safe order conversion, I owned the frontend implementation: user interfaces, live price discovery calculations, Mandi benchmark fairness indicators, strict post-login role gating, and full 13-locale localization parity.

My primary focus areas for this milestone sprint were:

- **Strict Post-Login Role-Gated UI (`listings/[id]/page.tsx`):** Built segmented dual tabs ("Buy at Asking Price" vs "Make an Offer / Bid") for authenticated buyers, and strictly gated bidding controls from unauthenticated guests (guests view only asking price and a prompt to sign in).
- **Mandi Benchmark Fairness Chip & Dynamic Deal Calculator (`BidForm.tsx`):** Built the price discovery form calculating real-time deal values (Unit Price × Quantity = Total Deal Value) and comparing buyer offers against local APMC modal rates with dynamic visual badges (`+X% above market`, `Competitive offer`, or warning on `-X% below local mandi modal rate`).
- **Farmer Incoming Bids Manager (`FarmerBidsList.tsx`):** Implemented the farmer-side management card on listing pages allowing farmers to Accept offers (auto-converting to an order), propose Counter-Offers with custom inline pricing, or Decline.
- **Buyer Desk Negotiation Workspace (`BuyerBidsList.tsx` & `/buyer`):** Added the "My Bids & Negotiations" workspace to `/buyer` with interactive "Accept Counter" and "Withdraw Bid" controls, including unmount race condition guards and an informative `EmptyState` fallback.
- **Typed Frontend API Client (`bids.ts` & `types.ts`):** Authored strongly typed API methods for bid operations with unified error handling.
- **13-Locale Full Parity & Native Script Quality Gates:** Designed modularized dictionary integration (`bids-messages.ts` via `messages/index.ts`) providing 100% native script translations across all 13 supported Indian languages with zero hardcoded English strings.

---

## 2. Post-Login Role-Gated Listing UI (`listings/[id]/page.tsx`)

A critical requirement of our design was ensuring that unauthenticated guests cannot manipulate negotiation inputs or place spurious bids:

- **Guest View:** When an unauthenticated visitor browses a crop listing, the sticky right panel displays the asking price and an authentic prompt: *"Sign in as a Buyer to purchase produce or place a bid on this lot"* with a direct CTA to `/login`. Bidding inputs and tabs are completely hidden.
- **Authenticated Buyer View:** Once logged in as a `BUYER`, the panel renders a responsive segmented tab selector:
  - **Tab 1: "Buy at Asking Price":** Direct purchase checkout with quantity, delivery mode (pickup vs delivery), and order placement.
  - **Tab 2: "Make an Offer / Bid":** Opens the interactive `BidForm` with live price negotiation controls.
- **Listing Owner View:** If the logged-in user is the farmer who published the listing, the buy panel automatically transforms into the **"Incoming Bids & Offers"** management workspace.

---

## 3. Dynamic Price Discovery & Mandi Benchmark Chip (`BidForm.tsx`)

To assist buyers in formulating fair, competitive offers without predatory lowballing, I engineered real-time calculation and benchmarking features:

- **Live Deal Calculation:** Automatically computes and formats the total offer commitment as buyers adjust their proposed rate or quantity.
- **Mandi Benchmark Fairness Chip:** Evaluates the percentage difference between the buyer's offer and the listing's benchmark rate:
  - Offers matching or exceeding the baseline display a green leaf badge: *"Competitive offer (matches prevailing mandi rate)"* or *"+X% (Generous offer above market average)"*.
  - Offers significantly below modal rates display a harvest warning badge: *"-X% · Offer is below local mandi modal rate"*, alerting buyers that their offer risks prompt rejection.
- **Order Boundary Enforcement:** Restricts bid quantity inputs between the farmer's specified minimum order quantity (`minimumOrderQuantity`) and available stock (`quantity`).

---

## 4. Negotiation Management Workspaces

### Farmer Incoming Bids Manager (`FarmerBidsList.tsx`)

Rendered directly on `/listings/[id]` when viewed by the listing owner:
- Displays all incoming buyer bids with proposed unit price, quantity, total value, and buyer notes.
- **Accept Offer Action:** Immediately calls the backend conversion API, reserving stock and transitioning to a confirmed order with a direct link to `/orders/[id]`.
- **Counter-Offer Action:** Opens an inline number input allowing the farmer to submit a revised price per unit back to the buyer with localized validation.
- **Decline Action:** Rejects the offer and notifies the buyer.

### Buyer Desk Workspace (`BuyerBidsList.tsx` & `/buyer`)

- Integrated under the **"My Bids & Negotiations"** section on the Buyer Desk:
  - Displays all active offers across all crop lots with status badges (`Under Review`, `Countered`, `Accepted`, `Declined`).
  - **Accept Counter Button:** For bids in `countered` status, buyers can accept the farmer's revised price with a single click, instantly converting the deal into an order.
  - **Withdraw Action:** Allows buyers to cancel active pending offers.
  - **EmptyState Fallback:** When a buyer has no bids, renders an engaging empty card with an authentic CTA directing them to browse produce.
  - **Unmount Protection:** Added an active component lifecycle guard (`let mounted = true`) in `loadBids` to prevent asynchronous memory leaks or React unmounted-component state warnings.

---

## 5. 13-Locale Full Dictionary Parity & Script Quality Gates

To uphold AgriConnect's strict accessibility standard across all 13 supported Indian languages, I ensured zero English fallback leakage for the bidding feature:

- **Supported Locales:** English (`en`), Hindi (`hi`), Punjabi (`pa`), Bengali (`bn`), Assamese (`as`), Marathi (`mr`), Gujarati (`gu`), Tamil (`ta`), Telugu (`te`), Kannada (`kn`), Malayalam (`ml`), Odia (`or`), and Urdu (`ur`).
- **Clean Architecture (`bids-messages.ts`):** Rather than performing fragile file manipulations across 10 huge dictionary files, I created a modular `bids-messages.ts` extension and merged it through `src/lib/i18n/messages/index.ts` using `deepMerge`.
- **Placeholder & Script Verification:** Verified that all placeholders (`{crop}`, `{price}`, `{qty}`, `{unit}`, `{counterPrice}`) match the English specification identically, and that each language passes native Unicode script regex validation (`tests/i18n-parity.test.ts`).
- **AST Hardcoded String Linter:** Audited all new JSX components; passed `no-hardcoded-strings.test.ts` with 0 untranslated strings.

---

## 6. Verification & Quality Gates

- **Frontend Vitest Tests:** 14/14 test suites passing, **128/128 tests green** (`npm test`).
- **Frontend Typecheck:** `tsc --noEmit` clean with **0 errors**.
- **i18n Parity Test:** **532 keys × 13 locales** verified (`npm run check:i18n`).
- **End-to-End Verification:** Verified live in browser with seeded data for Aman Singh (`/buyer`) across pending bids, counter-offers, and listing views.

---

## 7. Division of Responsibilities

| Subsystem / Task | Kabir Manchanda | Manbhav Kumar Terry (Me) |
|---|---|---|
| Agricultural Value & Engineering Proposal | **Lead** (70%) | Contributor (30%) |
| Prisma Schema & PostgreSQL DDL Migrations | **Lead** (100%) | — |
| Backend Bids Engine (`/api/v1/bids`) | **Lead** (100%) | — |
| Atomic Order Conversion & Stock Reservation | **Lead** (100%) | — |
| Anti-Disintermediation Contact Guard Integration | **Lead** (100%) | — |
| Database Seeding Tooling (`seed-sample-bids.ts`) | **Lead** (100%) | — |
| Post-Login Gated Listing Card (`listings/[id]`) | Reviewer | **Lead** (100%) |
| Dynamic BidForm & Mandi Benchmark Chip | Reviewer | **Lead** (100%) |
| Farmer Incoming Bids Manager (`FarmerBidsList`) | Reviewer | **Lead** (100%) |
| Buyer Desk Negotiations (`BuyerBidsList`) | Reviewer | **Lead** (100%) |
| 13-Locale i18n & Parity Integration | Co-Author | **Lead** (80%) |
| Frontend Testing & Unmount Guards | Reviewer | **Lead** (100%) |

---

## 8. Plan for Next Sprint

1. **Faculty Evaluator Walkthrough:** Present the bidding and counter-offer demonstration to faculty evaluators.
2. **Review Comments Protection:** Support Kabir in extending `contactGuard` protection to review comments.
3. **Escrow Delivery Settlements:** Work on the buyer confirmation and farmer payout release workflows.
