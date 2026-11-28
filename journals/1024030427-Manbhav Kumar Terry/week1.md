# Week 1 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Lab — functional CRUD marketplace |
| **Period** | Mon 24 Aug → Mon 31 Aug 2026 |
| **Hours** | ~11 |

---

## 1. Work Completed This Week

During Week 1, I focused primarily on the **Next.js frontend** for AgriConnect’s Lab milestone: register/login flows, marketplace browse, listing and order screens, notifications UI, password-reset screens, and early landing / public profile pages. The goal was a usable farmer-to-buyer UI that talks only to the Express API Kabir built.

The major work streams this week were:

- Next.js App Router screens for auth and marketplace
- Frontend API wrappers and error handling
- Listing create/edit and order status UI
- Notifications and password-reset UI
- Public browse and early landing polish
- Local testing against the Lab API and GitHub sync

Kabir Manchanda owned the backend Lab stack (Express `/api/v1`, Prisma/Supabase, auth/RBAC, listings, orders, admin). I integrated against his documented contracts so the browser never held database or service-role secrets.

---

## 2. Frontend Architecture & App Router Screens

I set up and owned the user-facing Lab UI in the monorepo’s `frontend/` package.

### What I built / configured

- Next.js App Router pages for register, login, marketplace browse, listing detail, farmer listing create/edit, and order list/detail.
- Shared layout, navigation, and role-aware links so farmer, buyer, and admin reach the right screens.
- Client-side session wiring with access token + refresh cookie (`credentials: 'include'`).
- Consistent form layouts and validation feedback using API `error.fields` where returned.

### Application stack covered this week

- Next.js App Router + React + TypeScript
- Tailwind styling aligned with the AgriConnect brand
- Frontend API client wrappers under `frontend/src/lib/api/`
- Role-based UI guards (farmer / buyer / admin)
- Public marketplace browse without login

The goal was to turn the Lab APIs into a demoable product UI, not just empty pages.

---

## 3. Auth UI, Marketplace & Listings

### Auth and account

- Register and login forms for farmer and buyer roles.
- Post-login redirect to the correct dashboard by role.
- Password-forgot / reset screens wired to Kabir’s auth endpoints.
- Suspended-account messaging when the API returns `ACCOUNT_SUSPENDED`.

### Marketplace & listings

- Public browse of **active** listings with crop/state filters.
- Listing detail and public farmer profile cards (no private contact fields).
- Farmer flows to create draft listings, upload photos, publish, and edit own listings.
- Clear empty states and loading/error UI so demos do not look broken when data is sparse.

---

## 4. Orders, Notifications & Reports UI

### Orders

- Buyer place-order flow from listing detail.
- Order list and detail for both farmer and buyer.
- Status actions in the UI matching the Lab state machine (pending → accepted → confirmed → fulfilled / cancelled).
- Cancel-with-reason where the API requires it.

### Notifications & reports

- Notifications list with mark-one / mark-all-read.
- Header badge refresh after read actions.
- Personal reports screen consuming `GET /reports/me` for farmer/buyer.

These screens made Lab acceptance criteria visible end-to-end for faculty demos.

---

## 5. Testing & Debugging

I tested the Lab frontend locally against the running API and fixed UI issues found during integration.

### Areas checked

- App startup on `localhost:3000`
- Register / login / refresh cookie behaviour
- Role-based navigation (farmer vs buyer vs admin)
- Marketplace browse and listing filters
- Listing create / photo upload / publish
- Order place and status transitions from the UI
- Notifications mark-read and badge count
- Password-reset form path
- Error toasts for validation, 401 refresh, and 403 forbidden

### Issues investigated / resolved

- Cookie/`credentials` misalignment with the API origin — fixed client config so refresh works with Kabir’s cookie path.
- Form errors that only showed a generic message — mapped Zod `fields` into field-level help text.
- Role redirects after login so buyers and farmers do not land on the wrong dashboard.

---

## 6. Documentation & Presentation

### During Week 1, I

- Prepared the Week 1 progress report for my contributions.
- Documented which screens call which Lab endpoints for teammate handoff.
- Helped keep frontend guide notes aligned with the screens I added.
- Prepared UI demo steps: register → list produce → order → fulfil / cancel.

---

## 7. GitHub & Project Structure

```text
ucs503p-AgriConnect/
├── frontend/                 # Next.js UI (my primary Lab focus)
│   ├── src/app/              # App Router screens
│   ├── src/features/         # Auth context, widgets
│   └── src/lib/api/          # API wrappers
├── backend/                  # Express API (teammate-led)
├── docs/
└── journals/
    └── 1024030427-Manbhav Kumar Terry/
        ├── week1.md
        └── week2.md
```

### Process work

- Synced frontend commits with Kabir’s API branch workflow.
- Kept `.env.local` secrets local (only `NEXT_PUBLIC_API_BASE_URL` in the client).
- Coordinated on contract shapes before wiring new screens.

---

## 8. Challenges, Learnings & Next Week

### Challenges & how resolved

- **Auth cookies across Next and Express** — needed `withCredentials` / `credentials: 'include'` and matching CORS origin.
- **Role UX** — same app, different jobs; solved with clear nav and post-login redirects.
- **API error shapes** — standardized client helpers so forms show useful messages.

### Learnings

- A clear API contract makes frontend work predictable even when backend is still evolving.
- Empty and error states matter as much as happy-path screens for demos.
- Keeping secrets off the browser is non-negotiable in this architecture.

### Collaboration note

Manbhav (me): Next.js screens, API wrappers, notifications/password-reset UI, public browse and early landing.  
Kabir: backend, schema, auth, listings, orders, admin, API docs.

### Plan for Week 2 (Prototype)

Build Prototype UI: real-time order chat + typing, order timeline, `/market-prices` page, Hindi/Punjabi i18n, guest browse/landing polish, and Kisan assistant UI — while Kabir ships mandi, sockets, logistics, and Docker/CI on the API.
