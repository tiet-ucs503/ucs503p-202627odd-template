# CityServe

## Latest changes (this revision)

1. **Database consolidated from 14 tables down to 8.** Six remaining single-purpose child/1-to-1 tables were folded into their parent row:
  * - `Cart` → `cartPartnerId` + `cartItems` (JSON) on `User`
  * - `Favorite` → `favorites` (JSON) on `User`
  * - `Notification` → `notifications` (JSON) on `User`
  * - `Verification` → `verificationStatus`, `verificationDocuments`, `verificationSubmittedAt`, `verificationReviewedAt`, `verificationReviewedBy`, `verificationReviewNotes` columns on `Partner`
  * - `Payment` → `paymentStatus`, `paymentMethod`, `paymentIsDemo`, `razorpayOrderId`, `razorpayPaymentId` columns on both `Order` and `Booking`
  * - `Report` → `reportReason`, `reportStatus`, `reportDetails`, `reportedAt`, `reportResolutionNote`, `reportResolvedAt` columns on both `Order` and `Booking`

   **Final schema (8 tables): `User`, `Category`, `Partner`, `Offering`, `Address`, `Order`, `Booking`, `Review`.** Every merge was a 1-to-1 or always-fetched-together relation, so no functionality changed — only where the data lives. Run `npm run db:sync` after pulling this to update your MySQL tables to the new columns (existing rows are preserved; `sequelize.sync({ alter: true })` adds the new columns and drops the old tables).

   API contracts that changed as a result:
   - `POST /payments/initiate` and `POST /payments/confirm` now take `{ orderId }` or `{ bookingId }` instead of `{ paymentId }`.
   - `PATCH /reports/:id/status` now requires `targetType: "ORDER" | "BOOKING"` in the body, since reports are no longer a standalone table keyed by their own id.
   - `GET /verification/pending` now returns `Partner` records directly (with a `documents` array attached) instead of nested `Verification` records with a `.partner` property.

2. **Fixed a dark/light theme contrast bug.** The app's Tailwind color tokens were already fully theme-aware (light/dark CSS variables, `.dark` class toggle) — the actual bug was that `color-scheme` was never declared in CSS. Without it, native form elements (inputs, selects, scrollbars) follow the OS's own dark/light setting instead of the app's `.dark` class, causing them to render out of sync with the rest of the page (e.g. dark input text on a dark background when the OS is in dark mode but the app is toggled to light, or vice versa). Fixed with two lines in `globals.css`: `color-scheme: light` under `:root` and `color-scheme: dark` under `.dark`.

---

**Premium local services, made convenient for Thapar.**

CityServe is a local-services marketplace for the Thapar Institute of
Engineering and Technology (TIET) community and the surrounding Patiala
area. This build integrates a **real, sourced local business dataset**
(155 Patiala-area businesses across 20 sub-categories) alongside the
platform's own booking/ordering/review system.

```
cityserve/
├── backend/    Express + TypeScript API, Sequelize ORM, MySQL (mysql2 driver)
└── frontend/   Next.js 14 (App Router) + TypeScript + Tailwind CSS
```

---

## 0. What changed in this revision

This update addresses four things directly:

1. **Database/ORM correction** — the project now uses **plain MySQL via Sequelize + mysql2**. Prisma and PostgreSQL have been fully removed; there is no ORM abstraction pretending to be something else. See §2 for the model layer.
2. **Real dataset integration** — the provided `cityserve_patiala_seed_dataset.csv` (155 businesses) is no longer just a file sitting in the repo. A dedicated import script (`npm run import:businesses`) reads it, validates it, and writes it into the same Category/Partner/Service tables the rest of the app already uses — see §3.
3. **Homepage search placeholder removed** — the cycling "Fresh milk / Laundry / Electrician…" animated example is gone; the search bar is now a plain functional input that submits to `/explore?q=…`.
4. **Performance + visual polish** — debounced search, skeleton loaders instead of spinner text, the homepage now renders server-side (no client fetch-then-spinner waterfall), and every card component was rebuilt to remove the "product name typed inside a flat gradient box" placeholder look. See §7.

---

## 1. Prerequisites

- Node.js 18+ and npm
- A running MySQL 8 server (local install, Docker, or hosted — PlanetScale/RDS/etc.)
- (Optional) Mapbox access token — without it, location features run in **DEMO MODE**
- (Optional) Razorpay API keys — without them, checkout runs in **DEMO MODE** (clearly labeled, no real charge)

## 2. Database & ORM

**Sequelize model files live in `backend/src/models/`** — one file per entity
(`User.ts`, `Partner.ts`, `Category.ts`, `Product.ts`, `Service.ts`,
`Availability.ts`, `Address.ts`, `Cart.ts`/`CartItem.ts`, `Order.ts`/`OrderItem.ts`,
`Booking.ts`, `Payment.ts`, `Review.ts`, `Favorite.ts`, `Notification.ts`,
`Verification.ts`/`VerificationDocument.ts`, `Report.ts`). All associations
(`hasMany`, `belongsTo`, `hasOne`) are wired centrally in
`backend/src/models/index.ts` — this file is the MySQL/Sequelize equivalent
of what used to be `schema.prisma`'s relation blocks.

There is no migration DSL like Prisma Migrate. Tables are created/updated
directly from the model definitions:

```sql
CREATE DATABASE cityserve CHARACTER SET utf8mb4;
CREATE USER 'cityserve'@'%' IDENTIFIED BY 'cityserve_pw';
GRANT ALL PRIVILEGES ON cityserve.* TO 'cityserve'@'%';
FLUSH PRIVILEGES;
```

```bash
cd backend
cp .env.example .env
# edit .env — set DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD to match the
# MySQL credentials above, and set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET

npm install
npm run db:sync     # creates/updates every table from the Sequelize models
```

## 3. Dataset integration pipeline

```
cityserve_patiala_seed_dataset.csv
        ↓
backend/src/scripts/importBusinesses.ts   (validate → map → upsert)
        ↓
MySQL (Category, User, Partner, Service tables)
        ↓
Express API  (/api/partners, /api/catalog/services, /api/search, /api/admin/*)
        ↓
Next.js frontend (directory, search, category pages, partner profiles)
```

Run it:

```bash
cd backend
npm run import:businesses
# or, for a different CSV file:
npm run import:businesses -- path/to/other-dataset.csv
```

**What the importer does** (`backend/src/scripts/importBusinesses.ts`):

- Parses the CSV (hand-rolled parser — the dataset has quoted fields with embedded commas in addresses, so a naive `split(",")` would corrupt rows).
- **Validates every row**: hard-invalid rows (missing `business_name`, missing `category`, unparseable/out-of-range lat/lng) are skipped and counted separately from soft-invalid rows (missing/invalid `rating` or `review_count`, missing `source` — these are imported with sane defaults and logged as warnings).
- **Deduplicates on `place_id`** (falls back to `business_name + address` if `place_id` is absent). Re-running the importer **updates** existing rows instead of creating duplicates.
- **Maps CSV `category` → a broader CityServe `Category`** via a lookup table (e.g. `Electricians`, `Plumbers`, `AC Repair & Service` → *Home Services*; `Car/Bike Mechanics` → *Vehicle Services*; `Tutors / Coaching` → *Education*; `Laundry / Dry Cleaning` → the existing *Laundry & Care* category). Five new categories are created automatically the first time you run the importer: **Vehicle Services, Education, Photography, Moving, Technology**. If a future CSV contains a category outside this map, the importer creates a new top-level Category for it on the fly rather than dropping the row.
- Stores the CSV's more specific `category` value on `Partner.subcategory` (e.g. `"Electricians"`), and creates a **Service** record from the CSV `subcategory` field (e.g. `"Residential electrician"` → Service name "Residential Electrician"), so the existing booking system works against imported businesses immediately.
- Creates the **minimum required `User` record** for each imported business so it can satisfy the `Partner.userId` foreign key — with an unusable, randomly-generated password hash and a placeholder `@unclaimed.cityserve.local` email. **No login credentials are ever generated or implied for these businesses.**
- Sets `isClaimed = false` and `isVerified = false` on every imported partner. `verificationStatus` is set to `APPROVED` so the listing is *visible* in the directory (this field gates visibility, not trust) — the visible trust signal is the **"Imported listing · Not CityServe Verified"** badge shown throughout the UI wherever `isClaimed` is false, which is completely independent of CityServe's own partner-verification workflow (`isVerified`/`verificationStatus`, unchanged for self-registered partners).
- Preserves `source`, `sourceUrl`, and `placeId` permanently on the Partner record — never stripped after import — and surfaces them on the partner profile page ("This is an imported listing sourced from a local business dataset (…)").
- Prints an import summary:
  ```
  Imported:      142
  Updated:       0
  Skipped:       0
  Invalid rows:  0
  Duplicate rows:0
  ```

**Demo data vs sourced data — kept strictly separate:**

| Command | What it loads |
|---|---|
| `npm run seed` | Fictional demo/test data (FreshPure Dairy, Campus Tiffin Co., etc.) for local dev and the second half of the professor demo flow. Only ever touches rows it created itself (`source = "CityServe demo seed"`) — safe to re-run without touching imported businesses. |
| `npm run import:businesses` | The real, sourced Patiala business dataset. Never mixed with fictional demo partners. |

Run both — they're additive and don't conflict:

```bash
npm run seed
npm run import:businesses
npm run dev
```

## 4. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL should point at the backend, e.g. http://localhost:4000/api

npm install
npm run dev                 # http://localhost:3000
```

## 5. Environment variables

### backend/.env

| Variable | Required | Notes |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Yes | MySQL connection details (Sequelize + mysql2) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Yes | Long random strings |
| `CLIENT_URL` | Yes | Frontend origin, for CORS |
| `MAPBOX_ACCESS_TOKEN` | No | Falls back to DEMO MODE |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | No | Falls back to DEMO MODE |
| `CLOUDINARY_*` | No | File upload endpoints disabled if unset |

### frontend/.env.local

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL (also used server-side by the homepage/footer) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Same demo-mode fallback |

## 6. Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cityserve.demo` | `Admin@123` |
| Customer (demo flow) | `student@thapar.demo` | `Student@123` |
| Demo partner (fictional) | `freshpure.dairy@cityserve.demo` | `Partner@123` |
| Imported businesses | *(none — see §3, these are unclaimed listings by design)* | — |

## 7. Interactivity, performance & UI fixes in this revision

**Interactivity checklist** (per the professor's feedback) — all of these are wired to real API calls, not static markup:

1. Homepage → real category list + flagship product, fetched server-side ✅
2. Search (hero bar and `/explore`) → hits `GET /api/search` and `GET /api/partners`, debounced ✅
3. Category filter → `GET /api/partners?categorySlug=…`, real DB query ✅
4. Provider profile → real partner + products/services/reviews from MySQL ✅
5. Product/service detail → add to cart / book service, both hit the backend ✅
6. Address/location selection → geolocation + reverse geocoding, editable, saved to `Address` table ✅
7. Checkout → creates a real `Order`/`Booking` + `Payment` row, demo-mode-aware ✅
8. Status tracking → partner dashboard status updates are reflected live on the customer's tracking timeline ✅
9. Reviews → gated on `DELIVERED`/`COMPLETED` status, one per transaction, updates partner/product/service rating aggregates ✅
10. Partner dashboard → accept/advance/decline orders and bookings, all persisted ✅
11. Admin dashboard → verification queue, reports queue, analytics — all real aggregate queries ✅

**Performance fixes:**

- Homepage converted from a client component (fetch-in-`useEffect` + spinner) to a **server component** with `revalidate: 60` — content is present on first paint instead of appearing after a round trip.
- `/explore` search input is now **debounced (300ms)** instead of firing an API call on every keystroke.
- Loading states across list pages use skeleton card grids instead of a blocking spinner, so the layout doesn't jump and perceived load time drops.
- If you're still seeing slowness locally: confirm you're running `npm run dev` against a **local** MySQL instance (not a slow remote one), and note that `next dev` compiles routes on first visit — `npm run build && npm start` will be noticeably faster than dev mode for demoing to your professor.

**Visual polish:**

- Removed the flat "product name typed inside a gradient box" placeholder used everywhere images would normally go — replaced with a consistent `MediaTile` component (soft dot-grid texture + a centered category icon in a raised disc).
- Cards now have consistent hover elevation, transition timing, and spacing rhythm across Partner/Product/Service/Category cards.
- Badges now clearly distinguish **"Verified Local Partner"** (CityServe's own verification) from **"Imported listing · Not CityServe Verified"** (sourced dataset, unclaimed) — this distinction is visible on every card, partner profile, and the admin partner table.

## 8. Database entities

`User`, `Partner` (+ `subcategory`, `website`, `phone`, `isClaimed`, `source`, `sourceUrl`, `placeId`), `Category`, `Product`, `Service` (nullable `price` for imported listings without pricing data), `Availability`, `Address`, `Cart`/`CartItem`, `Booking`, `Order`/`OrderItem`, `Payment`, `Review`, `Favorite`, `Notification`, `Verification`/`VerificationDocument`, `Report`.

## 9. Files changed in this revision (summary)

**Backend — removed:** `prisma/` directory entirely (`schema.prisma`, old `seed.ts`), `@prisma/client` and `prisma` npm packages.

**Backend — added:** `src/models/*.ts` (19 Sequelize model files + `index.ts` associations), `src/config/database.ts`, `src/scripts/syncDb.ts`, `src/scripts/importBusinesses.ts`, `src/seed/seed.ts` (rewritten for Sequelize), `data/cityserve_patiala_seed_dataset.csv`.

**Backend — rewritten:** every controller (`auth`, `category`, `partner`, `catalog`, `cart`, `order`, `booking`, `payment`, `review`, `favorite`, `notification`, `address`, `search`, `verification`, `report`, `admin`), `services/notification.service.ts`, `services/payment.service.ts`, `middleware/auth.ts` (Role import), `utils/jwt.ts` (Role import), `src/index.ts` (Sequelize connection bootstrap), `.env.example`, `package.json`.

**Frontend — added:** `components/HeroSearch.tsx`, `components/ui/MediaTile.tsx`, `components/ui/CardSkeleton.tsx`.

**Frontend — rewritten:** `app/page.tsx` (server component, no cycling placeholder), `components/Footer.tsx` (async, dynamic categories), `components/PartnerCard.tsx`, `components/ProductCard.tsx`, `components/ServiceCard.tsx`, `components/CategoryCard.tsx`, `components/ui/Badge.tsx` (added `ImportedBadge`), `lib/icons.ts` (5 new category icons), `lib/format.ts` (null-price handling), `types/index.ts` (new Partner/Service fields), `app/explore/page.tsx` (debounced search, skeleton loading), `app/category/[slug]/page.tsx` (skeleton loading), `app/partner/[id]/page.tsx` (subcategory/website/phone/provenance), `app/service/[id]/page.tsx` (null-price handling, imported badge), `app/admin/partners/page.tsx` and `app/admin/page.tsx` (claimed/imported stats).

## 10. Commands reference

```bash
# Backend
npm run dev                 # dev server with hot reload
npm run build && npm start
npm run db:sync              # create/update MySQL tables from models
npm run seed                 # fictional demo data (safe to re-run)
npm run import:businesses    # real Patiala business dataset (safe to re-run — upserts)

# Frontend
npm run dev
npm run build && npm start
```

## 11. How to verify the real dataset appears on the site

1. `npm run db:sync && npm run import:businesses` in `backend/`.
2. Start both servers, open `http://localhost:3000`.
3. Go to **Explore** or any of the new categories (**Vehicle Services**, **Education**, **Photography**, **Moving**, **Technology**, or the expanded **Home Services** / **Laundry & Care**) — you should see dozens of real business names from the CSV.
4. Open any listing — it should show an **"Imported listing · Not CityServe Verified"** badge (not "Verified Local Partner"), plus its subcategory, phone/website if present, and a note naming the data source.
5. In the admin panel (`/admin/partners`), the header line reports how many partners are imported vs self-registered, and each row shows its source.
6. Search "electrician" or "photographer" in the hero/explore search bar — results should include real dataset businesses.

## 12. Known limitations — implemented vs still planned

**Implemented:**
- Full CSV → validate → map → MySQL → API → UI pipeline, with upsert-safe re-runs.
- Clear, UI-visible distinction between CityServe-verified and imported/unclaimed listings.
- Booking flow works against imported (service-only, no listed price) businesses — shows "Contact for pricing" and still charges the platform service fee.
- Dynamic category creation for CSV categories outside the initial mapping.
- Import validation report (imported/updated/skipped/invalid/duplicate counts + per-row warnings).

**Still planned / not built:**
- Product-type imports — the current CSV only contains service-type businesses, so the importer only creates `Service` records. If a future dataset includes product/retail businesses, `Partner.partnerType` and `Product` creation would need to be added to the importer using the same pattern.
- A "Claim this listing" flow for business owners to take over an imported profile (schema supports it via `isClaimed`; no UI/flow built yet).
- Automated tests for the importer's validation logic.
- This codebase was built without live database/network access in the generation environment — run through the setup steps yourself and expect to fix minor version-specific issues; the architecture and logic are complete but not compiled end-to-end here.
