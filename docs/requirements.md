# Software Requirements

## Functional Requirements

### Lab — marketplace
- FR-01: Register and log in as Farmer or Buyer; Admin is seeded.
- FR-02: Role-based access for farmer, buyer, and admin routes.
- FR-03: Farmers create draft listings, upload photos, and publish.
- FR-04: Buyers browse/filter active listings and place orders.
- FR-05: Order status machine: pending → accepted → confirmed → fulfilled (or cancelled).
- FR-06: Inventory-safe quantity updates (no oversell).
- FR-07: Admin can verify/suspend users and remove/reinstate listings.
- FR-08: In-app notifications on order and moderation events.
- FR-09: Farmer and buyer summary reports.

### Prototype — production-shaped
- FR-10: Order-scoped chat with typing indicators.
- FR-11: Block phone / email / UPI (and similar) in chat, order notes, and listing copy.
- FR-12: In-app voice call between buyer and farmer (no phone exchange).
- FR-13: Post-fulfillment mutual reviews and rating averages.
- FR-14: Live mandi price trends and listing compare.
- FR-15: Logistics checkpoint updates on orders.
- FR-16: Escrow-style payment hold/release/refund with gateway verification.
- FR-17: Buyer alerts for crop/state listing matches.
- FR-18: UI available in multiple Indian languages.

### Capstone — advisory
- FR-19: Farmer-facing Kisan AI assistant.
- FR-20: Grounded answers with source citations; refuse when ungrounded.
- FR-21: Escalate high-stakes questions to an agronomist.
- FR-22: Profile weather context for advisory.

## Non-Functional Requirements

- NFR-01: API responses use a consistent success/error envelope.
- NFR-02: Access JWT short-lived; refresh token in HttpOnly cookie.
- NFR-03: Secrets (DB URL, JWT, service role) never reach the browser.
- NFR-04: Request bodies validated with Zod; invalid input returns structured field errors.
- NFR-05: Rate limiting on auth and sensitive routes.
- NFR-06: Automated unit/API/frontend tests run in CI and must pass.
- NFR-07: Decimal money/quantity values must not use floating-point JSON numbers.
- NFR-08: Interface usable by first-time farmers/buyers with clear status feedback.
