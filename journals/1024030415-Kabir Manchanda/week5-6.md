# Weeks 5–6 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Capstone Bidding & Dynamic Price Discovery Architecture |
| **Period** | Mon 12 Oct → Mon 26 Oct 2026 |
| **Hours** | ~28 |

---

## 1. Work Completed This Sprint (Weeks 5–6)

During Weeks 5–6, following the completion and faculty review of our farm-authentic UI refresh, we designed and implemented a core commercial milestone for AgriConnect: **B2B Bidding, Counter-Offer Negotiation & Dynamic Price Discovery**.

In traditional e-commerce, fixed-price retail checkout suffices. However, in wholesale agricultural commerce, fixed pricing breaks down due to lot quality variance, volatile daily APMC arrivals, and bulk commercial orders (e.g., 50–100 quintals). As the backend and database architecture lead, I took primary ownership and the higher weightage of this milestone, designing the end-to-end data model, PostgreSQL DDL migrations, Zod schema validation, transaction-safe inventory conversion, anti-disintermediation security, and automated database test seeding.

My primary ownership areas for this milestone sprint were:

- **Agricultural Commercial Architecture & Value Formulation:** Formulated the senior engineering specification establishing how bidding reflects real-world APMC/e-NAM dynamics (lot heterogeneity, bulk volume discount tiers, daily modal rate shifts) while adding digital transparency and anti-lowballing benchmarks.
- **Relational Schema & PostgreSQL DDL Migration Engine:**
  - Extended Prisma schema with `BidStatus` enum (`pending`, `accepted`, `rejected`, `countered`, `withdrawn`), four notification types (`BID_RECEIVED`, `BID_ACCEPTED`, `BID_REJECTED`, `BID_COUNTERED`), and `model Bid` indexed on `[listingId, status]` and `[buyerId, status]`.
  - Built and executed a custom pooler-safe database migration script (`scripts/apply-bids-migration.ts`) applying native PostgreSQL DDL directly to the remote Supabase database without being throttled by port 5432 direct connection limitations.
- **Backend Bids Module Architecture (`/api/v1/bids`):**
  - Developed comprehensive Zod validation schemas (`bids.schema.ts`) covering bid creation, decimal price validation, quantity boundary enforcement, and counter-offer parameters.
  - Built `bids.service.ts` managing the full negotiation lifecycle: buyer bid placement, withdrawal, farmer acceptance, counter-offer generation, and rejection.
  - Enforced anti-disintermediation security: parsed all buyer notes and farmer counter messages through `contactGuard` to automatically block phone numbers, emails, and off-platform contact leaks.
- **Atomic Order Conversion & Stock Reservation Safety:**
  - Implemented `createOrderFromBid` in `orders.service.ts` executing atomic inventory decrements (`quantity: { gte: quantity }`), status transitions, order creation, and bid-to-order linkage in a single race-free transaction.
- **RBAC & Endpoint Security:**
  - Configured REST endpoints (`bids.controller.ts`, `bids.routes.ts`) mounted at `/api/v1/bids` protected by `requireAuth` and role-scoped guards (`BUYER` for placing/withdrawing, `FARMER` for accept/counter/reject).
- **Backend Test Suite & Type Verification:**
  - Authored comprehensive test suite in `bids.test.ts` with 11 test cases validating schemas, negative price guards, and anti-disintermediation contact blocking.
  - Maintained 100% green status across all 157 backend Vitest tests with zero TypeScript compiler errors.
- **Live Database Seeding Engine (`seed-sample-bids.ts`):**
  - Built an automated database seeding utility that activates demo listings (Wheat, Rice, Tomato, Onion) and generates live sample negotiations in pending, countered, and accepted states for evaluator walkthroughs.

---

## 2. Senior Engineering Rationale: Value in Agriculture

In commercial agricultural trade, fixed retail pricing fails to capture commercial realities:
1. **Lot Heterogeneity & Quality Variance:** Unlike manufactured products, farm produce exhibits natural variations in moisture, grain grade, blemishes, and harvest timing. Price negotiation reflects actual lot quality.
2. **Bulk Volume Discount Tiers:** Commercial food processors and aggregators purchasing 20–100 quintals cannot pay single-unit retail rates. Negotiated offers enable volume discounts while protecting farmer profit margins.
3. **Daily Mandi Rate Volatility:** Crop rates fluctuate daily based on terminal market arrivals. Bidding allows dynamic price discovery without farmers having to constantly edit their active listings.
4. **Parity with Traditional APMC / e-NAM Auctions:** Mandis operate via open outcry or closed electronic tenders. AgriConnect's bidding system provides a digital, transparent version of this process.
5. **Anti-Lowballing & Disintermediation Protection:** Safeguards against predatory lowballing and off-platform deal cutting via Mandi Benchmark checks, strict post-login buyer role gating, and automated `contactGuard` scanning.

---

## 3. Database Schema & Migration Execution

### Prisma Data Model (`schema.prisma`)

```prisma
enum BidStatus {
  pending
  accepted
  rejected
  countered
  withdrawn
}

model Bid {
  id           String      @id @default(uuid())
  listingId    String
  listing      Listing     @relation(fields: [listingId], references: [id], onDelete: Cascade)
  buyerId      String
  buyer        User        @relation("BuyerBids", fields: [buyerId], references: [id], onDelete: Cascade)
  farmerId     String
  farmer       User        @relation("FarmerBids", fields: [farmerId], references: [id], onDelete: Cascade)
  pricePerUnit Decimal     @db.Decimal(10, 2)
  quantity     Decimal     @db.Decimal(10, 2)
  priceTotal   Decimal     @db.Decimal(12, 2)
  counterPrice Decimal?    @db.Decimal(10, 2)
  unit         String
  status       BidStatus   @default(pending)
  notes        String?     @db.VarChar(500)
  orderId      String?     @unique
  order        Order?      @relation(fields: [orderId], references: [id], onDelete: SetNull)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([listingId, status])
  @@index([buyerId, status])
  @@index([farmerId, status])
  @@map("bids")
}
```

### PostgreSQL DDL Migration (`scripts/apply-bids-migration.ts`)

Because our production database uses a Supabase PgBouncer pooler connection that restricts direct interactive shadow databases, I authored an automated DDL migration script executing:
- `CREATE TYPE "BidStatus" AS ENUM ('pending', 'accepted', 'rejected', 'countered', 'withdrawn');`
- `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BID_RECEIVED' / 'BID_ACCEPTED' / 'BID_REJECTED' / 'BID_COUNTERED';`
- `CREATE TABLE IF NOT EXISTS "bids" (...)` with composite foreign key indexes.

---

## 4. Backend Bids Service & Concurrency Safety

### State Machine Transitions

```
[Buyer submits bid]  ──> PENDING
       │
       ├──> [Buyer withdraws] ───────────────────> WITHDRAWN
       ├──> [Farmer rejects] ────────────────────> REJECTED
       ├──> [Farmer counters with revised rate] ─> COUNTERED
       │         │
       │         ├──> [Buyer accepts counter] ───> ACCEPTED ──> [Atomic Order Creation]
       │         └──> [Buyer withdraws] ─────────> WITHDRAWN
       │
       └──> [Farmer accepts bid directly] ───────> ACCEPTED ──> [Atomic Order Creation]
```

### Atomic Order Conversion (`orders.service.ts`)

When a bid is accepted (either directly by the farmer or via a counter-offer by the buyer), stock allocation must be concurrency-safe:
- Executes `listing.updateMany({ where: { id, quantity: { gte: bid.quantity } } })` to guarantee stock availability without race conditions.
- Calculates escrow totals, sets `deliveryMode`, copies validated buyer notes, and links the resulting `orderId` back to the bid record atomically.
- Triggers push notifications to both parties (`BID_ACCEPTED`).

### Anti-Disintermediation Security

All free-text notes submitted in bid proposals or counter-offers are processed through `contactGuard`:
- Blocks 10-digit Indian mobile numbers (standard, spaced, dashed, and zero-prefixed).
- Blocks email addresses and social handles, responding with HTTP 400 `CONTACT_INFO_BLOCKED`.

---

## 5. Live Demonstration Data Seeding

To ensure immediate, frictionless verification for faculty evaluators, I authored `scripts/seed-sample-bids.ts`:
- Activates demo produce listings (`Wheat`, `Rice`, `Tomato`, `Onion`) with 30-day future validity.
- Seeds active negotiation threads for demo buyer **Aman Singh**:
  1. **Wheat (Pending / Under Review):** ₹2,300/quintal for 25 quintals (Total: ₹57,500).
  2. **Rice (Counter-Offer Received):** Initial offer ₹2,900/quintal; farmer countered at ₹3,050/quintal with real-time "Accept Counter" action.
  3. **Onion (Pending / Under Review):** ₹2,100/quintal for 20 quintals (Total: ₹42,000).

---

## 6. Verification & Quality Gates

- **Backend Vitest Tests:** 17/17 test suites passing, **157/157 tests green** (`npm test`).
- **Backend Typecheck:** `tsc --noEmit` clean with **0 errors**.
- **Security Check:** Anti-disintermediation contact guards verified against phone and email payloads.
- **Concurrency Test:** Atomic stock decrement verified against double-spend bids.

---

## 7. Division of Responsibilities

| Subsystem / Task | Kabir Manchanda (Me) | Manbhav Kumar Terry |
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

1. **Faculty Milestone Demo:** Conduct full live evaluator walkthrough of buyer bid submission, Mandi benchmark fairness indicators, farmer counter-offers, and atomic order conversion.
2. **Review Comments Contact Guard:** Extend `contactGuard` protection to review comments (the final unscanned user-input field in the system).
3. **Escrow Farmer Settlement / Payouts:** Implement farmer payout settlement flow once goods are confirmed as delivered.
