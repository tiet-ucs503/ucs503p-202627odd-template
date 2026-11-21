# Week 8–9 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Supabase Cloud Database Migration, Cloud Transaction Hardening & Full-Platform Senior QA Audit |
| **Period** | Mon 3 Nov → Fri 20 Nov 2026 |
| **Hours** | ~36 |

---

## 1. Work Completed (Week 8–9)

During Week 8–9, as Senior Technical Lead and QA Engineering Lead, I took primary ownership and the majority weightage (~70%) of our engineering deliverables. This milestone focused on two critical pillars: (1) resolving cloud database infrastructure failure by triaging and migrating to a fresh, high-performance Supabase PostgreSQL 17 cluster, and (2) designing and executing an exhaustive, multi-layered quality assurance audit across all backend domains, security guards, dynamic pricing negotiations, and database persistence layers.

My primary focus areas and contributions were:

- **Supabase Cloud Infrastructure Triage & Zero-Downtime Migration:**
  - Diagnosed a cloud control-plane restoration deadlock in the previous Supabase project where an orchestration sidecar timeout locked the web dashboard.
  - Formulated a 60-second Infrastructure-as-Code (IaC) migration strategy: provisioned a fresh, healthy PostgreSQL 17 project cluster (`ohiyyvdhsismkzoebvcp`) in the South Asia region (`ap-south-1`).
  - Automated schema deployment via `npx prisma db push`, executing 100% of relational tables (`User`, `ProduceListing`, `Bid`, `Order`, `Payment`, `Notification`, `AuditLog`, etc.) and database enum types.
  - Scripted and executed complete demo data seeding (`npm run prisma:seed` and `scripts/seed-sample-bids.ts`) for all user personas (Farmers, Buyers, Agronomists, Admins) and active negotiations.
  - Automated the programmatic creation and policy configuration of the public `listings` storage bucket via Supabase JavaScript SDK.
- **Cloud Database Latency & Interactive Transaction Hardening:**
  - Identified an intermittent `P2028` Prisma transaction timeout error caused by cumulative network roundtrip latency to remote PostgreSQL servers during multi-query interactive transactions.
  - Hardened `createOrder`, `createOrderFromBid`, `updateOrderStatus`, `updateOrderLogistics`, and `createReview` with explicit transaction options `{ maxWait: 10000, timeout: 20000 }`, giving cloud transactions a reliable 20-second execution window.
- **Full-Platform Senior QA Testing Architecture (Comprehensive Multi-Layer Audit):**
  - Designed and executed **9 test suites comprising 417 individual verification checks with a 100% pass rate (0 failures)**.
  - **B2B Dynamic Bidding Smoke Suite (`scripts/smoke-bidding-edge-cases.ts`):** 40/40 edge-case tests passed across 10 security, pricing boundary, Zod validation, and inventory locking invariant sections.
  - **REST API Contract Smoke Suite (`scripts/api-endpoint-smoke.ts`):** 32/32 endpoints passed across public, farmer, and buyer scopes, rigorously enforcing 401/403 RBAC barriers.
  - **Full-Lifecycle Persistence & CRUD Integration (`scripts/integration-crud-check.ts`):** Verified live end-to-end data persistence with direct Prisma read-backs for user registration, listing creation, photo uploads, order placement, order status state machine (`pending` $\rightarrow$ `accepted` $\rightarrow$ `confirmed` $\rightarrow$ `fulfilled`), and post-fulfillment reviews.
  - **Anti-Bypass & Escrow Testing (`scripts/smoke-antibypass-payments.ts`):** Verified contact information blockers against phone numbers, obfuscated spelled-out numbers, emails, and off-platform UPI solicitations across chat and order copy.
  - **WebRTC Voice Signalling (`scripts/smoke-call-signaling.ts`):** Tested ICE candidate relays, call invitations, caller privacy masking, and busy-state concurrency locks.
  - **Grounded Kisan Advisory Evaluation (`scripts/eval-grounded-kisan.ts`):** Verified offline routing and retrieval across 30 agricultural queries, achieving 100.0% classification accuracy and 100.0% correct escalation rate.
  - **Backend Domain Logic Testing (`npm test`):** 17 test files and 157/157 unit tests passed cleanly with 0 failures.
  - **Static Analysis & Strict Typing:** Verified zero TypeScript compiler errors (`tsc --noEmit`) and zero ESLint warnings across the entire backend.

---

## 2. Senior QA Audit Results & Metrics

The table below summarizes the empirical test execution results collected during the full-platform verification audit:

| Test Suite / Engineering Check | Tools / Commands | Scope & Coverage | Empirical Result |
|---|---|---|:---:|
| **B2B Dynamic Bidding Edge Cases** | `npx tsx scripts/smoke-bidding-edge-cases.ts` | 10 invariant sections: Zod boundary checks, contact evasion, counter-offers, atomic order conversion, stock depletion | **40 / 40 Passed (100%)** |
| **REST API Contract Smoke** | `npx tsx scripts/api-endpoint-smoke.ts` | 32 endpoints: Public routes, Authenticated Farmer/Buyer endpoints, 401/403 RBAC rejection | **32 / 32 Passed (100%)** |
| **Full CRUD Persistence Lifecycle** | `npx tsx scripts/integration-crud-check.ts` | Registration $\rightarrow$ Listing $\rightarrow$ Photo Upload $\rightarrow$ Order $\rightarrow$ Chat $\rightarrow$ Multi-step Fulfillment $\rightarrow$ Review | **100% Passed (All Assertions Green)** |
| **Anti-Bypass & Escrow Security** | `npm run smoke:antibypass` | Regex/phonetic contact leak detection in chat, order notes, and crop listings; Escrow hold/release lifecycle | **100% Passed** |
| **WebRTC Call Signalling** | `npm run smoke:calls` | Socket.io call handshake, ICE relay, caller privacy masking, concurrent call rejection | **100% Passed** |
| **Grounded Kisan AI Evaluation** | `npm run eval:grounded` | 30 benchmark agricultural queries: cite vs refuse vs human agronomist escalation | **30 / 30 Passed (100.0% Accuracy)** |
| **Backend Unit & Logic Tests** | `npm test` (`vitest run`) | Order state machine, contact guards, inventory reservation, payments, assistant TTS | **17 Files / 157 Tests Passed** |
| **Backend Strict Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Strict mode TypeScript compilation across all backend modules and schemas | **0 Errors** |
| **Backend Lint & Style** | `npm run lint` (`eslint .`) | Static analysis and security linting | **0 Errors, 0 Warnings** |

---

## 3. Technical Highlights & Code Implementations

### A. Cloud Interactive Transaction Hardening (`orders.service.ts`)
To prevent `P2028` timeout failures on cloud database connections during multi-step order updates, interactive transactions were equipped with explicit timeout budgets:

```typescript
export async function updateOrderStatus(
  actor: AuthenticatedActor,
  orderId: string,
  input: UpdateOrderStatusInput,
) {
  const updated = await getPrismaClient().$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({ ... });
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
    
    // Validate role-based transition
    if (!canTransitionOrder(order.status, input.status, { ... })) {
      throw new AppError(400, 'INVALID_REQUEST', 'Order status transition is not allowed');
    }

    // Atomic update, stock restoration on cancel, escrow release on fulfilled
    const next = await transaction.order.update({ ... });
    await createNotifications(...);
    
    if (input.status === 'fulfilled') {
      await recordPriceTrend(...);
      await transaction.payment.updateMany({
        where: { orderId: order.id, status: 'held' },
        data: { status: 'released', releasedAt: new Date() },
      });
    }
    return next;
  }, { maxWait: 10000, timeout: 20000 }); // Hardened 20s budget for cloud database roundtrips

  return serializeOrder(updated);
}
```

### B. Automated Storage Bucket Provisioning
Configured automated provisioning of the public crop photo bucket on the fresh Supabase project:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: buckets } = await supabase.storage.listBuckets();
if (!buckets.some(b => b.name === 'listings')) {
  await supabase.storage.createBucket('listings', { public: true });
}
```

---

## 4. Next Steps & Capstone Finalization
1. Finalize Capstone project documentation and evaluation presentation slides.
2. Conduct final walkthrough with teammate Manbhav demonstrating the live B2B negotiation desks, payment escrow flows, and AI advisory capabilities.
3. Archive full regression test logs as evaluation artifacts.
