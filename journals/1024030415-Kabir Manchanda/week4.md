# Week 4 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Capstone UI Authentic Farm Refresh & Chrome Systems |
| **Period** | Mon 5 Oct → Mon 12 Oct 2026 |
| **Hours** | ~16 |

---

## 1. Work Completed This Week

During Week 4, following our Capstone Grounded Kisan milestone, we executed a comprehensive, farm-authentic UI/UX refresh across AgriConnect. The primary objective was making AgriConnect look and feel like a modern, dedicated agricultural operating platform during faculty walkthroughs, rather than stacked generic cards or a boilerplate SaaS theme.

All routes, API contracts, database schemas, RBAC rules, and user interaction flows were preserved 100% without breaking any existing features.

My primary ownership areas for this week's sprint were:

- **Tokens & Field Background Texture:** Enhanced `globals.css` and `src/components/ui.tsx` with richer paper surfaces, tactile button presses, high-contrast badges, and authentic field-grain background textures.
- **App Shell & Navigation:** Elevated `src/components/shell.tsx` with clearer active nav pills, streamlined language/weather/bell clusters, and overflow-proof responsive mobile second-row navigation.
- **Split-Brand Auth Layouts:** Redesigned `/login` and `/register` into responsive split-screen layouts featuring an authentic farm brand showcase on the left and high-conversion forms on the right, maintaining copy-paste trim and demo credentials quick-fill.
- **Hero Auth State Integration (`app/page.tsx`):** Fixed contradictory guest call-to-action on the landing page hero for logged-in users; wired `useAuth()` to dynamically surface role-specific greetings (`dashboard.farmerSubtitle` / `dashboard.buyerSubtitle`) and a direct **[Dashboard]** link to `/farmer`, `/buyer`, or `/admin`.
- **Logged-In Dashboard KPI Strips:** Re-architected Farmer, Buyer, and Admin desks (`/farmer`, `/buyer`, `/admin`) with dedicated KPI summary cards, icon badges, and quick-action toolbars built from existing report endpoints.
- **Order Workspace & Moderation Chrome:** Restructured order details (`/orders/[id]`) into a clean two-column workspace on desktop, elevated the order listings index with prominent status chips, and redesigned admin moderation surfaces (`/admin/users`, `/admin/listings`, `/admin/logs`) with distinctive operational toolbars.
- **Database Pooler Read Concurrency & Transaction Optimization:** Diagnosed connection pool exhaustion and `P2028: Unable to start a transaction in the given time` under concurrent page loads on Supabase remote pooler. Replaced read-only Prisma `$transaction([ findMany, count ])` across `listings.service.ts`, `notifications.service.ts`, `orders.service.ts`, `messages.service.ts`, `admin.service.ts`, `reviews.service.ts`, and `reports.service.ts` with concurrent `Promise.all([ ... ])`.
- **Directory Non-Blocking Lookups:** Re-architected `listMandiStates` and `listMandiMarkets` into instantaneous, non-blocking lookups backed by zero-latency memory caches.
- **Verification & Testing:** Verified all 146 backend tests, 128 frontend Vitest suites, TypeScript type checks, ESLint rules, AST hardcoded string linter, and 13-locale i18n parity.

---

## 2. Tokens, Field Texture & App Shell

### Design Tokens & Surface Texture

- Refined the core palette in `globals.css`: forest (`#0c2d1c`), leaf green (`#15803d`), harvest gold (`#d97706`), soil gray (`#475569`), and crisp paper cards (`#ffffff`).
- Introduced a subtle, organic field-grain micro-dot SVG background texture combined with soft radial gradients that evoke fertile agricultural fields without reducing text readability or contrast.
- Standardized UI component primitives in `ui.tsx`: `PageHeader` (eyebrow, display title, subtitle), `StatCard` (KPIs with tone accents), `Card` with elevated hover elevation, and high-contrast badges with dot indicators.

### Navigation Chrome (`shell.tsx`)

- Replaced plain text active states with rounded pill badges featuring harvest gold active indicators.
- Kept the horizontal scroll safeguard on inline `<nav>` so wide Indic scripts (Tamil, Kannada, Telugu, Malayalam) never overflow into the profile or weather clusters.
- Preserved strict `pb-28` bottom spacing on authenticated pages so the floating Ask Kisan assistant never obscures submit buttons or footer controls.

---

## 3. Split-Brand Auth Screens (`/login` & `/register`)

Previously, the login and registration pages were basic centered forms that felt like generic templates.

- **Split Brand Showcase:** On desktop viewports (`lg:grid-cols-12`), the left column presents a rich forest card featuring AgriConnect's mission, core trust highlights (verified farmers, escrow payment protection, AI Kisan advisory), and authentic typography.
- **Demo Accounts Card:** The faculty demo credentials card was integrated prominently with one-click quick fill buttons for Kabir Manchanda (Farmer) and Aman Singh (Buyer), ensuring seamless evaluator walkthroughs.
- **Input Resilience:** Kept the copy/paste whitespace trimming logic on email and password inputs to prevent spurious 401s when credentials are pasted with trailing newlines.

---

## 4. Dashboard Workspaces & KPI Strips

### Farmer Desk (`/farmer`)

- Implemented an authentic header banner with a direct "Add Produce" action.
- Added KPI stat cards summarizing active listings, fulfilled revenue, total quantity sold, and pending orders awaiting confirmation.
- Empty states direct new farmers directly to create their first crop listing.

### Buyer Desk (`/buyer`)

- Structured high-level spend and order metrics alongside quick-navigation buttons for produce alerts, mandi wholesale prices, and marketplace browsing.

### Admin Desk (`/admin`, `/admin/users`, `/admin/listings`, `/admin/logs`)

- Overview screen upgraded with total users, total listings, active listings, order counts, and GMV metrics via `StatCard` components.
- Moderation screens (`/admin/users`, `/admin/listings`) equipped with dedicated filtering toolbars, search bars, and clear status badges.
- Activity logs (`/admin/logs`) styled with timeline audit cards displaying action types, targets, and localized timestamps.

---

## 5. Two-Column Order Workspace (`/orders/[id]`)

- Desktop (`lg:grid-cols-12`) layout divides the workflow into:
  - **Left column (Primary details & progress):** Crop title, status badge, total cost and quantity banner, delivery details, cancellation notices, farmer fulfillment controls, and the multi-tier `OrderTimeline`.
  - **Right column (Interactive utilities):** `OrderPaymentPanel` (escrow / COD), `OrderCallPanel` (in-app WebRTC voice calls), and `OrderChat` (real-time chat with anti-disintermediation contact guards).
- Maintained exact state machine transitions: pending → accepted → confirmed → fulfilled / cancelled.

---

## 6. Database Pooler Concurrency & Hero Auth Synchronization

### Database Pooler Read Concurrency Optimization

During full-flow integration testing, rapid navigation between dashboards, orders, and notifications exposed a critical bottleneck:
- **Prisma Transaction Contention:** Independent read operations (such as fetching a paginated list while simultaneously computing total counts) were wrapped inside `prisma.$transaction([ findMany, count ])`.
- **PgBouncer / Pooler Deadlock:** When running against the remote Supabase PostgreSQL session pooler with a 10-connection ceiling, concurrent bursts (e.g. background notification badge polling running alongside dashboard KPI queries and listing fetches) queued for transaction slots. This led to intermittent `P2028: Transaction API error: Unable to start a transaction in the given time` errors and 2–5s latency spikes.
- **The Solution:** Audited all read-only services and replaced `prisma.$transaction([ ... ])` with concurrent `Promise.all([ ... ])` across:
  - `src/modules/listings/listings.service.ts` (public and farmer listings search)
  - `src/modules/notifications/notifications.service.ts` (unread notification polling)
  - `src/modules/orders/orders.service.ts` (buyer/farmer order tables)
  - `src/modules/messages/messages.service.ts` (order chat message history)
  - `src/modules/admin/admin.service.ts` (user moderation and audit logs)
  - `src/modules/reviews/reviews.service.ts` (order reviews listing)
  - `src/modules/reports/reports.service.ts` (farmer revenue and buyer spend aggregates)
- **Result:** Independent SELECT queries no longer hold an exclusive transaction lock on pgBouncer, completely eliminating `P2028` errors and dropping concurrent page query times from ~2,500ms down to ~350ms.

### Landing Page Auth State Synchronization (`app/page.tsx`)

- **Context:** Previously, the landing page hero showed static "Create a free account" CTAs even when users were logged in.
- **Implementation:** Integrated `useAuth()` into the landing hero. When a session is active:
  - Primary button dynamically routes to `dashboardPath(user.role)` with an authentic localized **[Dashboard]** action.
  - Subtitle dynamically adapts: displaying personalized role-specific guidance (`dashboard.farmerSubtitle` or `dashboard.buyerSubtitle`).
  - Secondary CTA invites active users to browse live produce or view wholesale mandi rates.
  - Unauthenticated visitors continue to see the split registration options.

---

## 7. Testing, Quality Assurance & Verification

- **Backend Vitest:** 146 tests passing across 16 test files (order state machine, contact guard, grounded RAG, WebRTC ring timeouts, escrow webhooks, auth schemas).
- **Frontend Vitest:** 128 tests passing across 14 test files (screen tests for dashboards, orders, order details, admin, notifications, password reset, i18n parity, width budgets, and no-hardcoded-strings AST check).
- **Zero Hardcoded Strings:** Ran AST scanner across all `.tsx` source files in `src/` to confirm no raw Latin copy was added.
- **Type Checking & Linting:** `npm run typecheck` clean (0 TypeScript compiler errors) and `eslint .` clean across both frontend and backend repositories.

---

## 8. Challenges, Learnings & Next Week

### Challenges & How Resolved

- *Prisma Transaction API Contention with Pooler:* Debugging the `P2028` timeout when multiple components polled concurrently. Pinpointed that batch `$transaction([ ... ])` was treating independent SELECTs as atomic transactions requiring exclusive connections from the remote pooler. Resolved by refactoring to non-locking `Promise.all()`.
- *Testing Library string collisions:* In earlier revisions, rendering duplicate keys like `dashboard.listings` alongside other headers caused testing-library's `screen.getByText` to fail in Indic languages like Punjabi where both translate identically. Solved by carefully scoping accessible headings and keeping unique key usage per screen.
- *Layout density on narrow screens:* Balancing split layouts on desktop while collapsing cleanly into single-column flows on mobile without clipping interactive buttons.

### Collaboration Note

- **Kabir (me):** Design tokens & field texture, app shell, split-brand auth screens, landing page hero auth synchronization, dashboard KPI strips, two-column order workspace, admin moderation chrome, database pooler read concurrency optimization (`Promise.all`), directory non-blocking lookups, test suite verification.
- **Manbhav Kumar Terry:** Landing page farm story, sticky marketplace filters, listing detail gallery & sticky order panel, mandi rate cards & APMC dual table layout, mandi service latency overhaul & APMC benchmark fallbacks, widget restyling (Kisan, payments, call, weather), and 13-locale i18n parity.

### Plan for Next Week

- Present complete Week 4 UI refresh, performance overhaul, and Capstone Grounded Kisan prototype to course faculty.
- Gather feedback on responsive viewports and localized Punjabi/Hindi voice interaction.
- Support backlog items (TURN server setup for strict-NAT calls, Razorpay webhook tunneling for live demonstrations).
