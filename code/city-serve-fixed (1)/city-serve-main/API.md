# CityServe API Reference

REST API for the CityServe local-services marketplace (Express + Sequelize + MySQL).

- **Base URL (local):** `http://localhost:4000/api`
- **Format:** JSON requests and responses (`Content-Type: application/json`, body limit 2 MB)
- **Health check:** `GET /api/health`

All paths below are relative to the base URL.

## Contents

1. [Conventions](#conventions)
2. [Quick start](#quick-start)
3. [Health](#health)
4. [Auth](#auth)
5. [Categories](#categories)
6. [Vendors](#vendors)
7. [Catalog (products and services)](#catalog-products-and-services)
8. [Search](#search)
9. [Orders](#orders)
10. [Reviews](#reviews)
11. [Admin](#admin)
12. [Data models](#data-models)
13. [Known limitations](#known-limitations)

---

## Conventions

### Authentication

Protected endpoints accept a JWT in either of two ways:

1. `Authorization: Bearer <accessToken>` header, or
2. the `accessToken` cookie (set automatically on login/register; `httpOnly`, `SameSite=Lax`).

If both are present, the header wins. In production (`NODE_ENV=production`) cookies are marked `Secure`, so a browser will not store them over plain HTTP. Use the Bearer header in that case.

| Token | Lifetime (default) | Obtained from |
|---|---|---|
| Access token | 15 minutes | `login`, `register/*`, `refresh` |
| Refresh token | 7 days | same; used by `POST /auth/refresh` |

### Roles

| Role | Description |
|---|---|
| `CUSTOMER` | Browses, orders, reviews |
| `VENDOR` | Manages own offerings and incoming orders |
| `ADMIN` | Lists users and vendors, verifies vendors, views analytics |

Role is stored in the token and set only by the server (the `role` field in request bodies is ignored).

### Errors

Errors always have this shape:

```json
{ "error": "Human-readable message." }
```

| Status | Meaning |
|---|---|
| 400 | Bad request or business-rule violation |
| 401 | Missing, invalid or expired token; bad credentials |
| 403 | Authenticated but wrong role |
| 404 | Resource not found (also returned when you do not own it) |
| 409 | Conflict (duplicate account, duplicate review) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

### Rate limits (per IP, 15-minute window)

| Scope | Limit |
|---|---|
| All endpoints | 300 requests |
| `POST /auth/login`, `/auth/register/customer`, `/auth/register/vendor` | 20 requests |

### Identifiers

All `id` values are UUIDs, except vendors that come from the CSV dataset, which are addressed by `place_id` or name slug (see [Vendors](#vendors)).

---

## Quick start

Demo accounts (created by `npm run seed`):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cityserve.demo` | `Admin@123` |
| Customer | `student@thapar.demo` | `Student@123` |
| Vendor | `greenbasket.farms@cityserve.demo` | `Vendor@123` |

```bash
BASE=http://localhost:4000/api

# 1. Log in and keep the token
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@thapar.demo","password":"Student@123"}' | jq -r .accessToken)

# 2. Pick a product
OFFERING=$(curl -s $BASE/catalog/products | jq -r '.[0].id')

# 3. Place an order
curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"offeringId\":\"$OFFERING\",\"quantity\":2,\"address\":\"Hostel H, Thapar\"}"
```

---

## Health

### `GET /health`

Public. Reports server status and whether payments and maps are running in demo mode.

```json
{ "status": "ok", "time": "2026-11-28T09:33:50.341Z", "paymentsDemoMode": true, "mapsDemoMode": true }
```

---

## Auth

### `POST /auth/register/customer`

Public. Creates a `CUSTOMER` account and signs the user in.

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `email` | string (unique) | yes |
| `phone` | string (unique) | yes |
| `password` | string | yes |
| `address`, `city` | string | no |

**201**
```json
{
  "user": { "id": "…", "name": "Eve", "email": "eve@test.com", "role": "CUSTOMER", "address": null, "city": null },
  "accessToken": "…", "refreshToken": "…"
}
```
Errors: `400` missing fields, `409` email or phone already used.

### `POST /auth/register/vendor`

Public. Creates a `VENDOR` user and its vendor profile in one transaction. The vendor starts **unverified** and active.

| Field | Type | Required |
|---|---|---|
| `name`, `email`, `password`, `businessName`, `categoryId` | string | yes |
| `phone` | string | recommended (used for the unique-phone check) |
| `type` | `PRODUCT` \| `SERVICE` \| `BOTH` | no (default `BOTH`) |
| `description`, `address`, `city` | string | no |
| `latitude`, `longitude` | number | no |

**201** → `{ user, vendor, accessToken, refreshToken }`. Errors: `400`, `409`.

### `POST /auth/login`

Public.

```json
{ "email": "student@thapar.demo", "password": "Student@123" }
```

**200** → `{ user, vendor?, accessToken, refreshToken }` (`vendor` is included for vendor accounts). Error: `401 Invalid credentials.`

### `POST /auth/logout`

Clears both cookies. **200** → `{ "message": "Logged out successfully." }`. Bearer tokens are not revoked; they expire on their own.

### `POST /auth/refresh`

Reads the `refreshToken` cookie, or `{ "refreshToken": "…" }` in the body. **200** → `{ accessToken, refreshToken }`. Error: `401`.

### `GET /auth/me`

🔒 Any role. Returns the current user (without `passwordHash`); vendor accounts include a `vendor` object.

### `PATCH /auth/me`

🔒 Any role. Updates any of `name`, `phone`, `address`, `city`. **200** → updated user. Other fields (including `role`) are ignored.

---

## Categories

### `GET /categories`

Public. Returns all categories (from the DB, falling back to the CSV dataset's categories if the DB has none), sorted by name.

```json
[{ "id": "…", "name": "Home Services", "slug": "home-services", "icon": "Wrench", "description": "…" }]
```

### `GET /categories/:slug`

Public. Returns one category by slug (or by case-insensitive name for dataset categories). Error: `404`.

---

## Vendors

### `GET /vendors`

Public. Returns a flat array combining **database vendors** (active only, verified first, max 500) and **CSV dataset listings**.

| Query | Applies to | Description |
|---|---|---|
| `q` | dataset listings | Text match |
| `category` | dataset listings | Category name |
| `locality` | dataset listings | Area / locality |

> The filters are applied to the CSV listings only. Database vendors are always returned in full.

Verified partners carry `isVerified: true`; imported directory listings are unverified.

### `GET /vendors/:id`

Public. `:id` can be a vendor UUID, or a dataset `place_id`, name slug, or exact business name. A DB vendor includes its `category` and its `Offerings`. Error: `404`.

### `GET /vendors/my/orders`

🔒 Vendor. Orders received by the logged-in vendor, newest first, each with `Offering` and `customer` (`name`, `phone`). Error: `404 Vendor profile not found` for users without a vendor profile.

### `PATCH /vendors/my/orders/:id/status`

🔒 Vendor (owner of the order). Moves an order to the next state.

```json
{ "status": "APPROVED" }
```

Allowed transitions:

| From | To |
|---|---|
| `PENDING` | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | `COMPLETED` (sets `completedAt`) |
| `REJECTED`, `COMPLETED`, `CANCELLED` | none (final) |

**200** → updated order. Errors: `400 Cannot move an order from X to Y.`, `404` if the order does not belong to this vendor.

---

## Catalog (products and services)

An *offering* is something a vendor sells: a `PRODUCT` (has stock) or a `SERVICE` (has duration). `/catalog/products` and `/catalog/services` are the same data filtered by `type`.

### `GET /catalog/products` and `GET /catalog/services`

Public. Lists available offerings (`isAvailable = true`), newest first.

| Query | Description |
|---|---|
| `categorySlug` | Only offerings in this category |
| `q` | Name contains text |
| `vendorId` | Only this vendor's offerings |

Each item includes `vendor` (`businessName`, `city`, `isVerified`) and `category`.

### `GET /catalog/products/:id` and `GET /catalog/services/:id`

Public. One offering with full `vendor` and `category`. Error: `404`.

### `POST /catalog/products` and `POST /catalog/services`

🔒 Vendor. Creates an offering owned by the logged-in vendor (`vendorId` comes from the token). Both paths run the same handler and **do not set `type` for you**, so send it in the body.

| Field | Type | Required |
|---|---|---|
| `name` | string (≤150) | yes |
| `categoryId` | UUID | yes |
| `type` | `PRODUCT` \| `SERVICE` | yes (defaults to `PRODUCT`) |
| `description`, `imageUrl`, `unit` | string | no |
| `price` | decimal | no |
| `stock` | integer | no (default 0) |
| `durationMinutes` | integer | no (default 60) |
| `isAvailable` | boolean | no (default true) |

**201** → the offering.

### `PATCH /catalog/products/:id` and `PATCH /catalog/services/:id`

🔒 Vendor (owner). Updates any of the fields above. Error: `404` if the offering is not yours.

---

## Search

### `GET /search?q=<text>`

Public. Searches offerings (by name), vendors (by business name or description) and categories (by name).

```json
{ "offerings": [ … ], "vendors": [ … ], "categories": [ … ] }
```

- An empty `q` returns three empty arrays.
- Up to 10 offerings and 10 DB vendors are returned, plus up to 15 matching CSV listings merged into `vendors`.
- Only `q` is supported. There is no location or distance filter.

---

## Orders

All order endpoints require login.

### `POST /orders`

🔒 Creates an order in status `PENDING` with payment status `PENDING`.

| Field | Type | Notes |
|---|---|---|
| `offeringId` | UUID | required |
| `quantity` | integer | products only; services are always 1 |
| `address` | string (≤300) | delivery / service address |
| `scheduledAt` | ISO date | optional appointment time |
| `customerNote` | string | optional |

**201**
```json
{
  "id": "…", "orderNumber": "ORD-451336-810", "customerId": "…", "vendorId": "…", "offeringId": "…",
  "quantity": 2, "type": "PRODUCT", "price": "90.00", "totalAmount": "180.00",
  "status": "PENDING", "paymentStatus": "PENDING"
}
```
Errors: `404` offering not found, `400` offering unavailable or `Insufficient stock`.

### `GET /orders`

🔒 The logged-in user's own orders (as customer), newest first, each with `vendor` and `Offering`.

### `GET /orders/:id`

🔒 One of your own orders, including `vendor` (with phone), `Offering` and `review`. Another user's order returns `404`.

### Order lifecycle

```
PENDING ──approve──▶ APPROVED ──complete──▶ COMPLETED ──▶ (can be reviewed once)
   ├──reject──▶ REJECTED
   └──cancel──▶ CANCELLED
```

Only the owning vendor changes state (`PATCH /vendors/my/orders/:id/status`).

---

## Reviews

### `POST /reviews`

🔒 Customer only (`403` for vendors and admins). Reviews one of **your own `COMPLETED` orders**, once.

```json
{ "orderId": "…", "rating": 5, "comment": "Great food" }
```

**201** → the review. Errors: `400` if `orderId` is missing, or the order is not yours or not completed; `409` if the order was already reviewed.

### `GET /reviews`

🔒 The logged-in user's reviews, with `vendor` and `offering`.

### `GET /reviews/vendor/:vendorId`

Public. All reviews for a vendor, newest first, with the customer's `name`.

---

## Admin

All endpoints require the `ADMIN` role (`403` otherwise).

### `GET /admin/users`

| Query | Description |
|---|---|
| `role` | `CUSTOMER`, `VENDOR` or `ADMIN` |
| `q` | Name or email contains text |
| `page`, `pageSize` | Default 1 and 20; `pageSize` max 100 |

**200** → `{ "users": [ … ], "total": 107, "page": 1, "pageSize": 20 }`

### `GET /admin/vendors`

Query: `isVerified` (`true`/`false`), `q` (business name), `page`, `pageSize`. **200** → `{ vendors, total, page, pageSize }`.

### `PATCH /admin/vendors/:id/verify`

Toggles the vendor's `isVerified` flag and returns the vendor. Error: `404`.

### `GET /admin/analytics`

```json
{
  "totalUsers": 4, "totalVendors": 113, "totalOrders": 12, "completedOrders": 5,
  "revenue": 1150, "cancellationRate": 0,
  "popularCategories": [{ "name": "Home Services", "vendorCount": 40, "offeringCount": 12 }]
}
```

`cancellationRate` is a percentage; `revenue` sums `totalAmount` of completed orders; `totalUsers` counts customers only.

---

## Data models

| Table | Key fields |
|---|---|
| `users` | `id`, `name`, `email` (unique), `phone` (unique), `passwordHash`, `role`, `address`, `city` |
| `categories` | `id`, `name`, `slug`, `icon`, `description` |
| `vendors` | `id`, `userId`, `businessName`, `categoryId`, `type`, `phone`, `address`, `city`, `latitude`, `longitude`, `isVerified`, `isActive` |
| `offerings` | `id`, `vendorId`, `categoryId`, `type`, `name`, `price`, `unit`, `stock`, `durationMinutes`, `isAvailable` |
| `orders` | `id`, `orderNumber`, `customerId`, `vendorId`, `offeringId`, `quantity`, `price`, `totalAmount`, `status`, `paymentStatus`, `address`, `scheduledAt`, `completedAt` |
| `reviews` | `id`, `customerId`, `vendorId`, `offeringId`, `orderId` (unique), `rating`, `comment` |

Enums: order `status` = `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`; `paymentStatus` = `PENDING`, `PAID`, `FAILED`; offering `type` = `PRODUCT`, `SERVICE`; vendor `type` adds `BOTH`.

---

## Known limitations

These match the current code and are worth knowing when calling the API:

- **Input validation is minimal.** Request bodies are not schema-validated. `rating` is not range-checked (it should be an integer from 1 to 5), `quantity` is not checked (it should be a positive integer), and passwords have no length rule.
- **Stock is not decremented** when a product order is created, only checked.
- **No customer-cancel endpoint.** `CANCELLED` can only be set by the vendor on a `PENDING` order.
- **Any logged-in user can create an order**, including vendors and admins.
- **`GET /vendors` can contain duplicates** when a business exists both in the database and in the CSV dataset (de-duplication on `place_id` is planned).
- **Payments and maps run in demo mode** unless Razorpay and Mapbox keys are configured (see `/health`).
