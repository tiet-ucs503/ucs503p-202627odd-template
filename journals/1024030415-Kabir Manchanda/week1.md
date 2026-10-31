# Week 1 Progress Report — AgriConnect — Kabir Manchanda

| | |
|---|---|
| **Name** | Kabir Manchanda |
| **Roll No.** | 1024030415 |
| **Teammate** | Manbhav Kumar Terry (1024030427) |
| **Project** | AgriConnect |
| **Milestone** | Lab — functional CRUD marketplace |
| **Period** | Mon 24 Aug → Mon 31 Aug 2026 |
| **Hours** | ~14 |

---

## 1. Work Completed This Week

During Week 1, I focused primarily on building AgriConnect’s **Lab** foundation: the Express REST API, Prisma/Supabase data model, authentication and RBAC, listings and photo upload, the order state machine, and admin moderation. The goal was to deliver a working farmer-to-buyer marketplace backend that the frontend could consume safely.

The major work streams this week were:

- Backend architecture and monorepo setup
- Authentication, JWT sessions, and role-based access control
- Listings CRUD and secure photo upload
- Order lifecycle and admin moderation APIs
- Validation, rate limits, notifications, and API documentation
- Local testing, debugging, and GitHub organization

Manbhav Kumar Terry worked in parallel on Next.js App Router screens (register/login, marketplace browse, listing/order UI, notifications UI, and early landing/public profile). My APIs and contracts were designed so his UI could integrate without talking to the database directly.

---

## 2. Backend Architecture & Platform Setup

The project is a full-stack monorepo. I set up and owned the backend side of the Lab stack.

### What I built / configured

- Express REST API under `/api/v1` as the only browser-facing backend.
- Prisma ORM against Supabase PostgreSQL for users, listings, orders, notifications, and related Lab entities.
- Environment and local run configuration so the API can start on the project’s backend port and talk to Supabase.
- Clear separation of concerns: the Next.js frontend never receives database URLs, JWT secrets, or the Supabase service-role key.

### Application stack covered this week

- Express 5 backend
- Prisma + Supabase PostgreSQL
- Supabase Storage (listing photos, via backend only)
- JWT access tokens + refresh cookies
- Zod request validation
- Role-based middleware (farmer / buyer / admin)
- SMTP / console mail path for password-reset and notifications support

The goal was to turn the empty template into a production-shaped Lab foundation rather than a throwaway demo script.

---

## 3. Authentication, RBAC & Account Safety

I implemented the auth and access-control layer that every Lab feature depends on.

### Major improvements included

- User registration and login for farmer and buyer roles.
- Seeded admin account path (admin is not self-registered).
- JWT access tokens with refresh-cookie session handling across the API.
- Suspended-account checks so blocked users cannot keep using protected routes.
- Ownership and role middleware so farmers, buyers, and admins only hit endpoints they are allowed to use.
- Password-reset support on the API side so the UI can complete the account-recovery flow.

### Roles supported

| Role | Lab capabilities (API) |
|---|---|
| **Farmer** | Create/edit listings, upload photos, publish/remove own listings, accept/confirm/fulfill/cancel orders |
| **Buyer** | Browse active listings, place orders, cancel while pending, view own order history |
| **Admin** | Verify users, suspend/unsuspend, moderate listings, cancel orders, view moderation-related activity |
| **Public** | Browse active listings and public farmer profiles (no private contact fields) |

These changes make AgriConnect a multi-role marketplace instead of a single shared login.

---

## 4. Listings, Orders & Admin Moderation

### Listings & media

I built listings CRUD with draft → publish lifecycle and secure photo upload:

- Create, update, publish, and remove listing flows with Zod-validated payloads.
- Quantity, price, crop, and location fields needed for marketplace discovery.
- Photo upload routed through the backend to Supabase Storage so privileged keys never reach the browser.
- Public marketplace browse of **active** listings only.

### Order state machine

I implemented the core Lab business logic as an explicit order state machine:

- `pending` → `accepted` → `confirmed` → `fulfilled`
- Cancel paths from allowed states, with reason support where required
- Ownership checks on every transition (buyer places/cancels pending; farmer advances fulfilment; admin can moderate)

### Admin moderation

- Verify / suspend / unsuspend users
- Remove or reinstate listings
- Cancel orders when needed for trust & safety
- Supporting notification hooks so users see status changes

The goal was a complete Lab acceptance path: register → list produce → order → fulfil / cancel → admin oversight.

---

## 5. Testing & Debugging

I tested the Lab backend locally and fixed issues found during development and frontend integration.

### Areas checked

- API startup and health/ready endpoints
- Register / login / refresh cookie behaviour
- Role middleware (farmer vs buyer vs admin)
- Listing create / publish / photo upload
- Order place and status transitions
- Cancel and ownership edge cases
- Admin verify / suspend / moderate paths
- Suspended-user blocked access
- CORS and cookie behaviour with the Next.js frontend
- Rate-limit and validation error responses

### Issues investigated / resolved

- Refresh cookies and CORS needed careful same-site/local alignment so the frontend could stay logged in.
- Early order-transition bugs where the wrong role could attempt a status change; tightened ownership checks.
- Photo upload security: kept service-role credentials server-side only.

I also verified that Manbhav’s UI could call the documented endpoints and receive predictable success/error shapes.

---

## 6. Documentation & Presentation

Alongside coding, I contributed to Lab documentation so the team (and faculty) can follow the system.

### During Week 1, I

- Documented API request/response shapes and auth requirements for Lab routes.
- Documented status codes and approve/discard/change scenarios for orders and admin actions.
- Kept frontend-facing contract notes so wrappers and screens stay aligned.
- Prepared Week 1 progress material describing Lab milestone completion.
- Organized backend module layout (auth, listings, orders, admin, notifications) for clarity.

This documentation is what lets the Prototype week add chat, mandi, and logistics without rewriting Lab contracts.

---

## 7. GitHub & Project Structure

I organized and synchronized the AgriConnect repository so Lab work lives in a clear monorepo layout.

### Structure maintained

```text
ucs503p-AgriConnect/
├── backend/          # Express API, Prisma, services, tests
├── frontend/         # Next.js App Router UI (teammate-led screens)
├── docs/             # API contract, guides, weekly progress
└── journals/         # UCS503 individual weekly journals
```

### GitHub / process work

- Pushed Lab foundation work to the project remote.
- Kept backend and frontend folders separated with a single shared product goal.
- Ensured secrets stay in env files and are not committed.
- Coordinated with Manbhav so UI commits and API commits landed on a consistent branch workflow.

---

## 8. Challenges, Learnings & Next Week

### Challenges & how resolved

- **Cross-origin auth cookies** — fixed cookie options and documented the auth flow for the frontend.
- **Order ownership edge cases** — reinforced middleware so only the rightful actor can change status.
- **Storage secrets** — backend-only upload path; browser never holds privileged Supabase keys.

### Learnings

- A Zod-validated REST contract plus an explicit order state machine makes UI integration much faster.
- RBAC and ownership checks must land early; retrofitting them after screens exist is costly.
- Lab scope (CRUD marketplace) is enough for a demoable product if auth, listings, and orders are solid end-to-end.

### Collaboration note

Kabir (me): backend, schema, auth, listings, orders, admin, API docs.  
Manbhav: Next.js screens, API wrappers, notifications/password-reset UI, public browse and early landing.

### Plan for Week 2 (Prototype)

Start the Prototype milestone: real-time order chat (Socket.io), live Agmarknet mandi prices, logistics and payment stubs, buyer alerts, Docker/CI packaging, while Manbhav continues UI, chat screens, and Hindi/Punjabi i18n.
