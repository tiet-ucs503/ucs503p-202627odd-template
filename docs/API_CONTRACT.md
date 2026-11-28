# AgriConnect — API Contract (V1)

> **Base URL (dev):** `http://localhost:5001`
> **API prefix:** `/api/v1`
> **Frontend depends on this document only** — not on Prisma models or file paths.
> **Envelope:** blueprint standard (`success` / `data` / `error`)
> **IDs:** UUID strings
> **Decimals:** JSON **strings** (`"25.00"`, `"500.000"`)
> **Dates:** ISO-8601 UTC (`2026-08-17T16:30:00.000Z`); `harvestDate` is `YYYY-MM-DD`

This is the contract between backend and frontend teammates. Mock responses below are canonical examples.

**Complete endpoint catalog (every HTTP + Socket + outbound):** [API_ENDPOINTS.md](./API_ENDPOINTS.md)  
**Status codes, approve / discard / change scenarios, and every error:** [API_STATUS_CODES.md](./API_STATUS_CODES.md)  
**How to consume this API in Next.js:** [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md)  
**How to implement or extend endpoints:** [BACKEND_GUIDE.md](./BACKEND_GUIDE.md)  
**Doc index / handoff:** [README.md](./README.md)

---

## 0. Conventions

### Headers

```
Content-Type: application/json
Authorization: Bearer <accessToken>   # when Auth required = Yes
Cookie: refreshToken=<httpOnly>       # sent automatically with credentials
```

All authenticated browser calls use `credentials: 'include'` / Axios `withCredentials: true`.

### Pagination query

| Param | Default | Max |
|---|---|---|
| `page` | 1 | — |
| `limit` | 20 | 100 |

Paginated responses:

```json
{
  "success": true,
  "data": [],
  "pagination": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
```

### Auth column legend

- **Auth:** No | Yes
- **Roles:** `public` | `FARMER` | `BUYER` | `ADMIN` | `any authenticated`

### Error codes (master)

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failed |
| 400 | `INVALID_REQUEST` | Illegal state transition or business rule |
| 400 | `CONTACT_INFO_BLOCKED` | Chat message, order notes, or listing copy carried a phone, email, UPI id, or off-platform handle |
| 401 | `UNAUTHORIZED` | No access token |
| 401 | `TOKEN_EXPIRED` | Access JWT expired — client must refresh |
| 401 | `TOKEN_INVALID` | Tampered / wrong secret |
| 401 | `REFRESH_TOKEN_INVALID` | Missing, expired, reused, or rotated refresh |
| 401 | `INVALID_CREDENTIALS` | Login failed (generic) |
| 402 | `PAYMENT_NOT_VERIFIED` | Razorpay does not confirm the payment the client sent for escrow |
| 403 | `FORBIDDEN` | Wrong role |
| 403 | `ACCOUNT_SUSPENDED` | Suspended user on a mutating route |
| 404 | `NOT_FOUND` | Missing or not owned (IDOR-safe) |
| 409 | `CONFLICT` | Duplicate email, oversell, unique clash |
| 413 | `PAYLOAD_TOO_LARGE` | File or body too large |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Bad image MIME |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected |
| 502 | `PAYMENT_UNAVAILABLE` | Razorpay unreachable, timed out, or rejected the request |
| 502 | `MANDI_FEED_UNAVAILABLE` | Agmarknet / data.gov.in feed unreachable or rate-limited |
| 503 | `NOT_READY` | `/ready` when DB down, or webhook secret not configured |

Error body:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": { "email": ["Invalid email address"] }
  }
}
```

---

## 1. Health

### GET /health

**Description:** Liveness. Process is up. No DB.
**Auth:** No  
**Roles:** public

#### Response — 200

```json
{ "success": true, "data": { "status": "ok" } }
```

---

### GET /ready

**Description:** Readiness. Postgres reachable via Prisma.
**Auth:** No  
**Roles:** public

#### Response — 200

```json
{ "success": true, "data": { "status": "ready", "database": "up" } }
```

#### Response — 503

```json
{ "success": false, "error": { "code": "NOT_READY", "message": "Database unavailable" } }
```

---

## 1b. Meta — `/api/v1/`

### GET /api/v1/

**Description:** API name and version probe (smoke tests / Postman).  
**Auth:** No  
**Roles:** public

#### Response — 200

```json
{
  "success": true,
  "data": {
    "name": "AgriConnect API",
    "version": "v1"
  }
}
```

---

## 2. Auth

Cookie set on login/register/refresh:

```
Set-Cookie: refreshToken=<opaque>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800
```

Logout clears the cookie (`Max-Age=0`).

Access token is **only** in JSON `data.accessToken`, never in localStorage.

---

### POST /api/v1/auth/register

**Description:** Create farmer or buyer account and matching profile.
**Auth:** No  
**Roles:** public  
**Rate limit:** strict auth limiter

#### Request

```json
{
  "email": "farmer@example.com",
  "password": "CorrectHorse9!",
  "name": "Ravi Kumar",
  "role": "FARMER",
  "phone": "+919876543210",
  "state": "Punjab",
  "district": "Ludhiana",
  "village": "Sahnewal",
  "languagePref": "en"
}
```

| Field | Required | Rules |
|---|---|---|
| email | yes | valid email, unique |
| password | yes | min 8, max 128 |
| name | yes | 1–100 chars |
| role | yes | `FARMER` or `BUYER` only (`ADMIN` rejected) |
| phone | yes | 1–30 chars |
| state | yes | 1–100 chars |
| district | yes | 1–100 chars |
| village | no | 1–100 chars when provided |
| languagePref | no | `en` \| `hi` \| `pa` (default `en`) |

#### Response — 201

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "email": "farmer@example.com",
      "name": "Ravi Kumar",
      "role": "FARMER",
      "phone": "+919876543210",
      "languagePref": "en",
      "state": "Punjab",
      "district": "Ludhiana",
      "village": "Sahnewal",
      "verified": false,
      "isSuspended": false,
      "createdAt": "2026-08-17T16:00:00.000Z"
    }
  }
}
```

Sets refresh cookie.

#### Errors

- 400 `VALIDATION_ERROR`
- 409 `CONFLICT` — email taken (`"Email already registered"`)

#### Business rules

- Creating `FARMER` inserts empty `FarmerProfile`.
- Creating `BUYER` inserts `BuyerProfile` with `buyerType: "trader"`.
- Password never returned.

---

### POST /api/v1/auth/login

**Description:** Authenticate with email/password.
**Auth:** No  
**Roles:** public

#### Request

```json
{
  "email": "farmer@example.com",
  "password": "CorrectHorse9!"
}
```

#### Response — 200

Same shape as register `data` (`accessToken` + `user`). Sets refresh cookie.

#### Errors

- 401 `INVALID_CREDENTIALS` — `"Invalid email or password"` (also used when locked)
- 403 `ACCOUNT_SUSPENDED` — `"This account has been suspended"` (valid credentials but account suspended)
- 400 `VALIDATION_ERROR`

---

### POST /api/v1/auth/refresh

**Description:** Rotate refresh cookie; issue new access token.
**Auth:** Refresh cookie (no Bearer required)
**Roles:** public (cookie-gated)

#### Request

Empty body `{}`. Cookie required.

#### Response — 200

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Sets new refresh cookie.

#### Errors

- 401 `REFRESH_TOKEN_INVALID`

#### Business rules

- Rotation + reuse detection (see architecture).
- Suspended users **may** refresh so the client can load `/me` and show suspended UI.

---

### POST /api/v1/auth/logout

**Description:** Revoke current refresh token; clear cookie.
**Auth:** Yes (access token) **or** refresh cookie  
**Roles:** any authenticated preferred; cookie-only also accepted so expired access still logs out

#### Request

Empty body.

#### Response — 200

```json
{ "success": true, "data": { "loggedOut": true } }
```

---

### GET /api/v1/auth/me

**Description:** Current user from access token.
**Auth:** Yes  
**Roles:** any authenticated

#### Response — 200

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "farmer@example.com",
    "name": "Ravi Kumar",
    "role": "FARMER",
    "phone": "+919876543210",
    "languagePref": "en",
    "state": "Punjab",
    "district": "Ludhiana",
    "village": "Sahnewal",
    "verified": false,
    "isSuspended": false,
    "createdAt": "2026-08-17T16:00:00.000Z",
    "farmerProfile": {
      "id": "22222222-2222-4222-8222-222222222222",
      "farmName": "Kumar Farms",
      "region": "Punjab",
      "ratingAvg": null
    },
    "buyerProfile": null
  }
}
```

Buyer example: `farmerProfile: null`, `buyerProfile` object present. Admin: both null.

---

### POST /api/v1/auth/forgot-password

**Description:** Request password reset email.
**Auth:** No  
**Roles:** public

#### Request

```json
{ "email": "farmer@example.com" }
```

#### Response — 200

Always the same, whether or not the email exists:

```json
{
  "success": true,
  "data": {
    "message": "If that email is registered, a reset link has been sent."
  }
}
```

#### Business rules

- Token TTL 1 hour.
- Email contains `{CLIENT_URL}/reset-password?token=<rawToken>`.

---

### POST /api/v1/auth/reset-password

**Description:** Set a new password using the email token.
**Auth:** No  
**Roles:** public

#### Request

```json
{
  "token": "raw-token-from-email",
  "password": "NewCorrectHorse9!"
}
```

#### Response — 200

```json
{ "success": true, "data": { "reset": true } }
```

#### Errors

- 400 `INVALID_REQUEST` — token invalid, expired, or used
- 400 `VALIDATION_ERROR`

Revokes **all** refresh tokens for that user after success.

---

## 3. Users & profiles

### GET /api/v1/users/me

**Description:** Full current user payload. **Alias** of `GET /api/v1/auth/me` (same JSON).  
**Auth:** Yes  
**Roles:** any authenticated

Frontend may call either path; **prefer `/auth/me`**.

#### Response — 200

Same body as [GET /api/v1/auth/me](#get-apiv1authme).

---

### PATCH /api/v1/users/me

**Description:** Update basic profile fields (not role, not email in V1).
**Auth:** Yes  
**Roles:** any authenticated

#### Request (all optional)

`languagePref` if sent must be `en` | `hi` | `pa`.

```json
{
  "name": "Ravi Kumar",
  "phone": "+919876543210",
  "languagePref": "en",
  "state": "Punjab",
  "district": "Ludhiana",
  "village": "Sahnewal"
}
```

#### Response — 200

`data` = user object (same fields as login `user`, without profiles).

---

### GET /api/v1/users/me/farmer-profile

**Auth:** Yes  
**Roles:** FARMER

#### Response — 200

```json
{
  "success": true,
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "farmName": "Kumar Farms",
    "region": "Punjab",
    "ratingAvg": null
  }
}
```

403 if role is not FARMER.

---

### PATCH /api/v1/users/me/farmer-profile

**Auth:** Yes  
**Roles:** FARMER

#### Request

```json
{
  "farmName": "Kumar Farms",
  "region": "Ludhiana, Punjab"
}
```

#### Response — 200 — updated profile object.

---

### GET /api/v1/users/me/buyer-profile  
### PATCH /api/v1/users/me/buyer-profile

**Auth:** Yes  
**Roles:** BUYER

#### GET 200

```json
{
  "success": true,
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "businessName": "Singh Traders",
    "buyerType": "trader",
    "ratingAvg": null
  }
}
```

#### PATCH body

```json
{
  "businessName": "Singh Traders",
  "buyerType": "horeca"
}
```

`buyerType`: `trader` | `retailer` | `bulk` | `horeca`

---

### GET /api/v1/users/me/export

**Description:** DPDP-style export of the caller’s data.
**Auth:** Yes  
**Roles:** any authenticated

#### Response — 200

```json
{
  "success": true,
  "data": {
    "user": {},
    "farmerProfile": null,
    "buyerProfile": null,
    "listings": [],
    "orders": [],
    "notifications": []
  }
}
```

---

### DELETE /api/v1/users/me

**Description:** Soft-delete own account.
**Auth:** Yes  
**Roles:** FARMER | BUYER (not ADMIN)

#### Request

```json
{ "confirm": "DELETE" }
```

#### Response — 200

```json
{ "success": true, "data": { "deleted": true } }
```

#### Errors

- 400 `CONFIRM_TEXT_MISMATCH` if `confirm` !== `"DELETE"`
- 403 `FORBIDDEN` for admin self-delete

Cancels pending orders; removes active listings (`removed`); revokes refresh tokens.

---

### GET /api/v1/users/:id/public

**Description:** Public farmer summary for listing detail (no email/phone).
**Auth:** No  
**Roles:** public

#### Response — 200

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Ravi Kumar",
    "role": "FARMER",
    "state": "Punjab",
    "district": "Ludhiana",
    "verified": true,
    "farmName": "Kumar Farms",
    "ratingAvg": null
  }
}
```

404 if user missing, not a farmer, or deleted. Village omitted.

---

## 4. Listings

### Listing object (full, owner/admin)

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "farmerProfileId": "22222222-2222-4222-8222-222222222222",
  "farmer": {
    "userId": "11111111-1111-4111-8111-111111111111",
    "name": "Ravi Kumar",
    "state": "Punjab",
    "district": "Ludhiana",
    "verified": false,
    "farmName": "Kumar Farms",
    "ratingAvg": null
  },
  "crop": "Wheat",
  "category": "grains",
  "variety": "HD-2967",
  "quantity": "500.000",
  "unit": "kg",
  "pricePerUnit": "25.00",
  "harvestDate": "2026-04-10",
  "state": "Punjab",
  "district": "Ludhiana",
  "village": "Sahnewal",
  "description": "Freshly harvested wheat, stored dry.",
  "minimumOrderQuantity": "50.000",
  "status": "active",
  "perishable": false,
  "viewCount": 12,
  "interestCount": 3,
  "expiresAt": "2026-04-24T00:00:00.000Z",
  "photos": [
    {
      "id": "55555555-5555-4555-8555-555555555555",
      "publicUrl": "https://<project>.supabase.co/storage/v1/object/public/listings/...",
      "sortOrder": 0
    }
  ],
  "createdAt": "2026-08-17T16:10:00.000Z",
  "updatedAt": "2026-08-17T16:10:00.000Z"
}
```

**Public listing object:** same, but `village` is `null` unless the caller is owner, related buyer, or admin.

---

### POST /api/v1/listings

**Description:** Create a listing (farmer).
**Auth:** Yes  
**Roles:** FARMER

#### Request

```json
{
  "crop": "Wheat",
  "category": "grains",
  "variety": "HD-2967",
  "quantity": "500",
  "unit": "kg",
  "pricePerUnit": "25.00",
  "harvestDate": "2026-04-10",
  "state": "Punjab",
  "district": "Ludhiana",
  "village": "Sahnewal",
  "description": "Freshly harvested wheat, stored dry.",
  "minimumOrderQuantity": "50",
  "status": "draft",
  "perishable": false
}
```

| Field | Required | Rules |
|---|---|---|
| crop | yes | 1–80 chars |
| category | yes | 1–80 chars |
| variety | no | |
| quantity | yes | positive decimal string or number (coerced) |
| unit | yes | `kg` \| `quintal` \| `ton` |
| pricePerUnit | yes | ≥ 0, 2 decimal money |
| harvestDate | yes | ISO date, not in far future (> 2 years rejected) |
| state, district | yes | |
| village | no | |
| description | no | max 2000 |
| minimumOrderQuantity | yes | > 0, ≤ quantity |
| status | no | `draft` (default) or `active` |
| perishable | yes | boolean |

#### Response — 201 — full listing (`photos: []`).

If `status` is `active` with zero photos → 400 `INVALID_REQUEST` (`"Active listings require at least one photo"`). Client should create as `draft`, upload photos, then PATCH status to `active`.

`description`, `variety`, and `village` are scanned for contact details → 400
`CONTACT_INFO_BLOCKED` with `error.fields` naming the field
(see [contact-info blocking](#contact-info-blocking-anti-disintermediation)).

403 `ACCOUNT_SUSPENDED` if suspended.

---

### GET /api/v1/listings

**Description:** Search/browse listings.
**Auth:** No for public active browse; Yes for `mine=true`
**Roles:** public (default); FARMER when `mine=true`

#### Query

| Param | Description |
|---|---|
| `crop` | case-insensitive contains |
| `category` | exact or contains |
| `state` | exact |
| `district` | exact |
| `minPrice` / `maxPrice` | pricePerUnit range |
| `minQuantity` | remaining quantity ≥ |
| `harvestFrom` / `harvestTo` | dates |
| `perishable` | `true` / `false` |
| `status` | default `active` for public |
| `mine` | `true` = caller’s listings (any status except deleted); requires FARMER |
| `sort` | `createdAt_desc` (default), `price_asc`, `price_desc`, `harvestDate_asc` |
| `page`, `limit` | pagination |

Public default: `status=active` only. Non-admin cannot pass `status=removed`.

#### Response — 200 — paginated array of listing objects (public shape).

---

### GET /api/v1/listings/:id

**Description:** Listing detail. Increments `viewCount` for non-owners.
**Auth:** No  
**Roles:** public

#### Response — 200 — listing object.

404 if missing, deleted, or (`removed`/`draft` and caller is not owner/admin).

`draft` / `removed` / `expired` / `sold_out` visible to owner and admin; `sold_out` and `expired` also visible by direct id to any authenticated user (read-only history). **V1 rule:** public GET by id returns `active`, `sold_out`, and `expired`. `draft` and `removed` are owner/admin only.

---

### PATCH /api/v1/listings/:id

**Description:** Update own listing.
**Auth:** Yes  
**Roles:** FARMER (owner)

Body: any subset of create fields except identity. Cannot change `farmerProfileId`.

Cannot PATCH another farmer’s listing (404).

If setting `status: "active"`, photo count must be ≥ 1.

`description`, `variety`, and `village` are scanned for contact details → 400
`CONTACT_INFO_BLOCKED` (see [contact-info blocking](#contact-info-blocking-anti-disintermediation)),
so an edit cannot smuggle a phone number back into a published listing.

#### Response — 200 — full listing.

---

### DELETE /api/v1/listings/:id

**Description:** Soft-delete / remove own listing.
**Auth:** Yes  
**Roles:** FARMER (owner)

Sets `status=removed`, `deletedAt=now()`. Does not cancel existing orders.

#### Response — 200

```json
{ "success": true, "data": { "deleted": true } }
```

---

### POST /api/v1/listings/:id/photos

**Description:** Upload 1–5 images (multipart).
**Auth:** Yes  
**Roles:** FARMER (owner)

`Content-Type: multipart/form-data`  
Field name: `files` (repeat) or `files[]`

Constraints: jpeg/png/webp, ≤ 5 MB each, listing total photos ≤ 5.

#### Response — 201

```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "publicUrl": "https://example.supabase.co/storage/v1/object/public/listings/4444/uuid.webp",
        "sortOrder": 0
      }
    ]
  }
}
```

#### Errors

- 400 too many photos
- 413 file too large
- 415 bad MIME

---

### DELETE /api/v1/listings/:id/photos/:photoId

**Auth:** Yes  
**Roles:** FARMER (owner) or ADMIN

#### Response — 200

```json
{ "success": true, "data": { "deleted": true } }
```

If listing is `active` and this was the last photo → listing forced to `draft`.

---

## 5. Orders

### Order object

```json
{
  "id": "66666666-6666-4666-8666-666666666666",
  "listingId": "44444444-4444-4444-8444-444444444444",
  "buyerId": "77777777-7777-4777-8777-777777777777",
  "farmerId": "11111111-1111-4111-8111-111111111111",
  "quantity": "100.000",
  "unit": "kg",
  "pricePerUnit": "25.00",
  "priceTotal": "2500.00",
  "status": "pending",
  "deliveryMode": "pickup",
  "logisticsStatus": "none",
  "dispatchedAt": null,
  "inTransitAt": null,
  "logisticsDeliveredAt": null,
  "payment": null,
  "notes": "Will collect Thursday morning",
  "cancellationReason": null,
  "listing": {
    "id": "44444444-4444-4444-8444-444444444444",
    "crop": "Wheat",
    "status": "active",
    "photos": []
  },
  "buyer": { "id": "77777777-7777-4777-8777-777777777777", "name": "Aman Singh", "ratingAvg": "4.50" },
  "farmer": { "id": "11111111-1111-4111-8111-111111111111", "name": "Ravi Kumar", "ratingAvg": "4.80" },
  "createdAt": "2026-08-17T17:00:00.000Z",
  "updatedAt": "2026-08-17T17:00:00.000Z"
}
```

`payment` is `null` until the buyer starts a payment, then:

```json
{
  "payment": {
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "status": "held",
    "provider": "razorpay",
    "amount": "2500.00",
    "method": "upi",
    "methodLabel": "UPI",
    "failureReason": null,
    "heldAt": "2026-08-18T10:00:00.000Z",
    "releasedAt": null,
    "refundedAt": null
  }
}
```

See [Payment methods and escrow lifecycle](#payment-methods-and-escrow-lifecycle) for the
status meanings.

---

### POST /api/v1/orders

**Description:** Buyer places an order against an active listing.
**Auth:** Yes  
**Roles:** BUYER

#### Request

```json
{
  "listingId": "44444444-4444-4444-8444-444444444444",
  "quantity": "100",
  "deliveryMode": "pickup",
  "notes": "Will collect Thursday morning"
}
```

#### Response — 201 — order object (`status: "pending"`).

#### Errors

- 400 `INVALID_REQUEST` — quantity < MOQ, listing not active, buyer ordering own produce (if same email somehow — farmers cannot be buyers in V1)
- 400 `CONTACT_INFO_BLOCKED` — `notes` carried a phone number, email, UPI id, or off-platform handle. The farmer reads these notes, so they get the same scan as chat (see [contact-info blocking](#contact-info-blocking-anti-disintermediation)). The order is **not created**
- 409 `CONFLICT` — insufficient remaining quantity
- 403 `ACCOUNT_SUSPENDED`
- 404 listing not found / not active (treat inactive as 404 for buyers)

#### Business rules

- Server snapshots `unit`, `pricePerUnit`, `priceTotal`.
- Decrements listing quantity; may set `sold_out`.
- Increments `interestCount`.
- Notifies farmer (`ORDER_PLACED`) + email.

---

### GET /api/v1/orders

**Description:** List orders visible to the caller.
**Auth:** Yes  
**Roles:** FARMER | BUYER | ADMIN

#### Query

| Param | Description |
|---|---|
| `status` | filter |
| `page`, `limit` | pagination |

- BUYER: own orders (`buyerId = me`)
- FARMER: incoming (`farmerId = me`)
- ADMIN: all

#### Response — 200 — paginated order objects.

---

### GET /api/v1/orders/:id

**Auth:** Yes  
**Roles:** buyer owner, farmer owner, or ADMIN

Others: 404.

#### Response — 200 — order object.

---

### PATCH /api/v1/orders/:id/status

**Description:** Advance or cancel per state machine.
**Auth:** Yes  
**Roles:** FARMER (seller) | BUYER (cancel pending only) | ADMIN

#### Request

```json
{
  "status": "accepted",
  "cancellationReason": null
}
```

`cancellationReason` required when `status` is `cancelled`.

#### Response — 200 — updated order.

#### Errors

- 400 `INVALID_REQUEST` — illegal transition or actor not allowed
- 404

#### Allowed transitions (must match [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) §6.2)

```
pending → accepted | cancelled
accepted → confirmed | cancelled
confirmed → fulfilled | cancelled
```

On `cancelled` from `pending`/`accepted`/`confirmed`: restore reserved quantity if listing not `removed`.

Notifies both parties (`ORDER_STATUS_CHANGED`).

On `accepted` and on `confirmed`, the **buyer** also gets a second `ORDER_STATUS_CHANGED` with
`params.variant: "payment"` asking them to pay — escrow is opt-in and only the buyer can start
it. Skipped when the payment is already `held` / `released` / `refunded`, and for `cod`, which
never enters escrow. `fulfilled` is **not** blocked by an unpaid order; the farmer's order page
warns instead.

---

### GET /api/v1/orders/:id/messages

**Description:** Paginated order chat history (buyer ↔ farmer).
**Auth:** Yes  
**Roles:** order buyer or farmer

#### Response — 200 — paginated message objects.

```json
{
  "success": true,
  "data": [
    {
      "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "orderId": "66666666-6666-4666-8666-666666666666",
      "senderId": "11111111-1111-4111-8111-111111111111",
      "sender": { "id": "11111111-1111-4111-8111-111111111111", "name": "Ravi Kumar" },
      "body": "Can you deliver tomorrow morning?",
      "sentAt": "2026-08-17T17:05:00.000Z",
      "readAt": null
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 50, "totalPages": 1 }
}
```

---

### POST /api/v1/orders/:id/messages

**Description:** Send a message on an order thread. Persists to DB and pushes `message:new` over Socket.io to room `order:{orderId}`.
**Auth:** Yes (active account)  
**Roles:** order buyer or farmer

#### Request

```json
{ "body": "Can you deliver tomorrow morning?" }
```

#### Response — 201 — message object.

#### Errors

- 400 `INVALID_REQUEST` — order is `cancelled`
- 400 `CONTACT_INFO_BLOCKED` — the message contains contact details (see below)
- 404 — order not found or not a participant

#### Contact-info blocking (anti-disintermediation)

AgriConnect rejects text that would move the trade off the platform. The write is
**rejected outright** — nothing is stored and no notification is sent. Parties talk using the
[in-app voice call](#in-app-voice-calls-socketio) instead, so a phone number is never needed.

The same scan runs on every free-text field the counterparty reads:

| Endpoint | Fields scanned |
|---|---|
| `POST /api/v1/orders/:id/messages` | `body` |
| `POST /api/v1/orders` | `notes` |
| `POST /api/v1/listings`, `PATCH /api/v1/listings/:id` | `description`, `variety`, `village` |

Outside chat the error also carries `error.fields` keyed by the offending field, so a form can
highlight the input:

```json
{
  "success": false,
  "error": {
    "code": "CONTACT_INFO_BLOCKED",
    "message": "Phone numbers cannot be shared here. Buyers and farmers talk on the in-app voice call.",
    "fields": {
      "notes": ["Phone numbers cannot be shared here. Buyers and farmers talk on the in-app voice call."]
    }
  }
}
```

Blocked content:

| Category | Examples caught |
|---|---|
| Phone numbers | `9876543210`, `+91 98765 43210`, `9-8-7-6-5-4-3-2-1-0`, `nine eight seven…`, `nau aath saat…`, `98o6543210`, landlines like `0161 2345678` |
| Emails | `kabir@example.com`, `kabir (at) example (dot) com` |
| UPI IDs | `farmer99@oksbi`, `name@paytm`, `name@ybl` |
| Off-platform contact | `whatsapp`, `telegram`, `gpay`, `phonepe`, `instagram`, `my number is…`, `call me on…` |

Prices and quantities are unaffected — `1000 kg at 2500 per quintal` and
`Rates this week: 1000 2500 3000 4000` both send normally.

```json
{
  "success": false,
  "error": {
    "code": "CONTACT_INFO_BLOCKED",
    "message": "Phone numbers cannot be shared in order chat. Use the in-app voice call instead."
  }
}
```

---

### POST /api/v1/orders/:id/messages/read

**Description:** Mark all messages from the counterparty as read.
**Auth:** Yes (active account)

#### Response — 200

```json
{ "success": true, "data": { "orderId": "66666666-6666-4666-8666-666666666666", "markedRead": 2 } }
```

---

### Real-time chat (Socket.io)

- **Path:** `/socket.io` on the same host as the API (e.g. `http://localhost:5001`)
- **Auth:** pass access JWT in handshake `auth.token` or `Authorization: Bearer`
- **Join room:** emit `join:order` with `orderId` (ack returns `{ ok: true }`)
- **Receive:** listen for `message:new` (same shape as REST message object)
- **Typing (V2):** emit `typing:start` with `{ orderId }`; counterparty receives `typing` with `{ orderId, userId }`

---

### In-app voice calls (Socket.io)

Buyers and farmers speak to each other without exchanging phone numbers. Audio is
**peer-to-peer WebRTC**; the server only relays SDP offers/answers and ICE candidates
and never carries or records audio. Calls are **not persisted** — there is no call log table.

- **Path / auth:** same `/socket.io` connection and JWT handshake as chat
- **Participants:** order buyer and farmer only. `ADMIN` is rejected with `FORBIDDEN`
- **One live call per order**, tracked in memory on the API process
- Suspended accounts and cancelled orders cannot start a call

#### Client → server

| Event | Payload | Ack | Notes |
|---|---|---|---|
| `call:invite` | `{ orderId }` | `{ ok, callId, iceServers }` or `{ ok: false, error, code }` | Rings the counterparty in the order room |
| `call:accept` | `{ orderId, callId }` | `{ ok, iceServers }` | Callee only |
| `call:decline` | `{ orderId, callId }` | — | Clears the call |
| `call:end` | `{ orderId, callId }` | — | Either party |
| `call:signal` | `{ orderId, callId, description?, candidate? }` | — | Relayed verbatim to the other party |

#### Server → client

| Event | Payload |
|---|---|
| `call:incoming` | `{ orderId, callId, from: { id, name } }` |
| `call:accepted` | `{ orderId, callId }` |
| `call:declined` | `{ orderId, callId, byUserId }` |
| `call:ended` | `{ orderId, callId, byUserId, durationSeconds }` |
| `call:signal` | `{ orderId, callId, fromUserId, description, candidate }` |

`call:incoming` deliberately carries only the caller's **name** — never a phone number.

#### Handshake order

1. Caller emits `call:invite` and holds the returned `callId`.
2. Callee receives `call:incoming` and emits `call:accept`.
3. Caller receives `call:accepted`, then sends its SDP **offer** via `call:signal`.
4. Callee answers with its SDP **answer**; both trickle ICE candidates over `call:signal`.
5. Either side emits `call:end`; a disconnect ends the call automatically.

#### Ack error codes

- `VALIDATION_ERROR` — missing or malformed `orderId`
- `CONFLICT` — a call is already in progress on this order
- `NOT_FOUND` — unknown order, or a `callId` the caller is not part of
- `FORBIDDEN` — admin attempted to join
- `ACCOUNT_SUSPENDED` — suspended account attempted to call
- `INVALID_REQUEST` — order is `cancelled`

STUN/TURN servers come from `WEBRTC_ICE_SERVERS` (comma-separated) and default to
public Google STUN. Add a TURN server for callers behind strict NATs.

---

### PATCH /api/v1/orders/:id/logistics

**Description:** Farmer advances logistics checkpoints on a non-cancelled order.
**Auth:** Yes (active account)  
**Roles:** FARMER (order seller)

#### Request

```json
{ "logisticsStatus": "dispatched" }
```

Allowed values: `dispatched` → `in_transit` → `delivered` (from `none` only `dispatched`).

#### Response — 200 — updated order object.

#### Errors

- 400 `INVALID_REQUEST` — illegal transition or order `cancelled`
- 403 `FORBIDDEN` — not the farmer
- 404

Notifies buyer (`ORDER_STATUS_CHANGED`).

---

### Payment methods and escrow lifecycle

| Method | Value | Gateway | Escrow |
|---|---|---|---|
| UPI | `upi` | Razorpay | Yes |
| Credit / debit card | `card` | Razorpay | Yes |
| Net banking | `netbanking` | Razorpay | Yes |
| Cash on delivery | `cod` | none (`provider: "cash"`) | **No** — collected in person |

`PaymentStatus` flow: `pending → authorized → held → released`, with `refunded` on
cancellation and `failed` on gateway failure.

- **`held`** — money is in escrow; the farmer is not paid yet. Reached either by
  [confirm](#post-apiv1ordersidpaymentconfirm) after Razorpay verification, or by the
  [signed webhook](#post-apiv1paymentswebhook) — whichever arrives first; the other is a no-op.
- **`released`** — set automatically when the order becomes `fulfilled`.
- **`refunded`** — set automatically when the order is `cancelled` from `pending`,
  `authorized`, or `held`. A cancelled order never keeps the buyer's money.
- **`cod`** never reaches `held`; nothing is escrowed and confirm is rejected.

One payment per order (`payments.orderId` is unique). Re-initiating replaces the method
while the payment is still `pending`, `authorized`, or `failed`.

---

### GET /api/v1/payments/methods

**Description:** Catalog the checkout UI renders as the method picker.
**Auth:** Yes  
**Roles:** any authenticated user

#### Response — 200

```json
{
  "success": true,
  "data": [
    { "method": "upi", "label": "UPI", "escrow": true },
    { "method": "card", "label": "Credit / debit card", "escrow": true },
    { "method": "netbanking", "label": "Net banking", "escrow": true },
    { "method": "cod", "label": "Cash on delivery", "escrow": false }
  ]
}
```

---

### POST /api/v1/orders/:id/payment

**Description:** Buyer initiates payment for an order using a chosen method.
**Auth:** Yes (active account)  
**Roles:** BUYER

#### Request

```json
{ "method": "upi" }
```

`method` is required — one of `upi`, `card`, `netbanking`, `cod`. Unknown keys are rejected.

#### Response — 201

`mode` tells the client what to do next: `cod` (nothing), `mock` (call confirm directly),
or `razorpay` (open Checkout, then call confirm with the payment id).

**Cash on delivery:**

```json
{
  "success": true,
  "data": {
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "orderId": "66666666-6666-4666-8666-666666666666",
    "method": "cod",
    "methodLabel": "Cash on delivery",
    "provider": "cash",
    "status": "pending",
    "amount": "2500.00",
    "currency": "INR",
    "failureReason": null,
    "heldAt": null,
    "releasedAt": null,
    "refundedAt": null,
    "mode": "cod",
    "message": "Cash on delivery selected. Pay the farmer when the produce arrives — escrow does not apply."
  }
}
```

**Mock mode** (no Razorpay keys): same shape with `"method": "upi"`, `"provider": "razorpay"`,
`"mode": "mock"`, and a message explaining that the payment is simulated.

**Razorpay sandbox** (`RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` set): same shape with
`"status": "authorized"`, `"mode": "razorpay"`, plus `"razorpayOrderId": "order_xxx"` and
`"keyId": "rzp_test_xxx"` for the Checkout widget.

#### Errors

- 400 `VALIDATION_ERROR` — missing or unknown `method`
- 400 `INVALID_REQUEST` — order `cancelled`
- 403 `FORBIDDEN` — not a BUYER
- 404 — order not found or not the buyer's order
- 409 `CONFLICT` — payment already `held`, `released`, or `refunded`
- 502 `PAYMENT_UNAVAILABLE` — Razorpay API error or gateway unreachable

---

### POST /api/v1/orders/:id/payment/confirm

**Description:** Move an authorized payment into **escrow** (`held`) — called after
Razorpay Checkout succeeds, or directly in mock mode. On order `fulfilled` the server
releases the held payment to `released`.
**Auth:** Yes (active account)  
**Roles:** BUYER

#### Request

```json
{ "providerRef": "pay_xxx" }
```

`providerRef` is the Razorpay **payment** id returned by Checkout.

- **Razorpay live** (both keys set): `providerRef` is **required**. The server reads the
  payment back from Razorpay and only escrows it when the gateway agrees — see below.
- **Mock mode / COD**: body may be omitted.

#### Server-side verification (live gateway only)

The browser says *which* payment to check, never *whether* it succeeded. Before anything
is escrowed the server calls Razorpay `GET /v1/payments/{providerRef}` and requires all of:

| Check | Requirement |
|---|---|
| Status | `captured` or `authorized` |
| Checkout | `order_id` matches the `razorpayOrderId` stored when the payment was initiated |
| Amount | equals the order total in paise |
| Currency | `INR` |

A failed check writes `status: "failed"` with a `failureReason` and answers **402
`PAYMENT_NOT_VERIFIED`**; the buyer must start a new payment. If Razorpay cannot be
reached the payment is left untouched and the call answers **502** so a retry is safe.

#### Response — 200

```json
{
  "success": true,
  "data": {
    "id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "orderId": "66666666-6666-4666-8666-666666666666",
    "method": "upi",
    "methodLabel": "UPI",
    "provider": "razorpay",
    "status": "held",
    "amount": "2500.00",
    "currency": "INR",
    "failureReason": null,
    "heldAt": "2026-08-18T10:00:00.000Z",
    "releasedAt": null,
    "refundedAt": null
  }
}
```

Idempotent: confirming an already-`held` payment returns 200 with the same body.

#### Errors

- 400 `VALIDATION_ERROR` — `providerRef` missing while the live gateway is configured
- 400 `INVALID_REQUEST` — method is `cod` (collected on delivery, cannot be escrowed), or the payment `failed`
- 402 `PAYMENT_NOT_VERIFIED` — Razorpay reports the payment as unpaid, for another checkout, or for a different amount
- 403 `FORBIDDEN` — not a BUYER
- 404 — order or payment not found
- 409 `CONFLICT` — payment already `released` or `refunded`, or never started at the gateway
- 502 `PAYMENT_UNAVAILABLE` — Razorpay unreachable while verifying

---

### POST /api/v1/payments/webhook

**Description:** Razorpay server-to-server notification. This is the authoritative payment
signal — it still arrives when the buyer closes the tab before the confirm call.
**Auth:** **None** (no JWT). Trust comes from the HMAC signature over the raw body.
**Roles:** —

Configure it in Razorpay Dashboard → Settings → Webhooks with events `payment.captured`
and `payment.failed`, and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.

#### Request

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-razorpay-signature` | `HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET)` in hex |

The body is Razorpay's standard event envelope; the server reads `event` and
`payload.payment.entity` (including `notes.orderId`, which is set at initiation).

This route is parsed with `express.raw` rather than `express.json`, because the signature
covers the exact bytes Razorpay sent.

#### Response — 200

Always 200 once the signature is valid — any other status makes Razorpay retry. `handled`
says whether our payment record actually changed.

```json
{
  "success": true,
  "data": { "received": true, "handled": true, "reason": "Payment held in escrow" }
}
```

`handled: false` with a reason covers benign cases: unhandled event, payment already
`held`/`released`/`refunded`, unknown order, or a payload that does not match the stored
checkout and amount (same rules as the confirm table above).

`payment.captured` escrows the payment; `payment.failed` marks it `failed` with the
gateway's description.

#### Errors

- 401 `UNAUTHORIZED` — missing, malformed, or wrong `x-razorpay-signature`
- 503 `NOT_READY` — `RAZORPAY_WEBHOOK_SECRET` is not configured

---

## 5c. Market prices (V2)

Public read-only mandi-style price trends (internal trades + seeded Agmarknet samples).

### GET /api/v1/market/prices

**Auth:** No

#### Query

| Param | Default | Description |
|---|---|---|
| `crop` | — | filter |
| `state` | — | filter |
| `days` | 90 | window |
| `limit` | 120 | max rows |

#### Response — 200 — array of price trend points.

---

### GET /api/v1/market/prices/summary

**Auth:** No

Same query params. Returns latest price per crop/state in the window.

---

### POST /api/v1/market/prices/compare

**Auth:** No

Compare listing prices to latest Agmarknet mandi reference (₹/kg) per crop and state.

#### Body

```json
{
  "items": [
    {
      "id": "uuid",
      "crop": "Wheat",
      "state": "Punjab",
      "pricePerUnit": "24.50",
      "unit": "kg"
    }
  ]
}
```

| Field | Rules |
|---|---|
| `items` | 1–50 objects |
| `id` | UUID (echoed in response) |
| `unit` | `kg` \| `quintal` \| `ton` |

#### Response — 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "listingPricePerKg": "24.50",
      "mandiPricePerKg": "26.00",
      "diffPerKg": "-1.50",
      "diffPercent": -6,
      "verdict": "below_mandi"
    }
  ]
}
```

`verdict`: `below_mandi` (≥2% under mandi), `above_mandi` (≥2% over), `at_mandi`, or `unknown` (no mandi row).

#### Errors

| Status | When |
|---|---|
| 400 | Invalid body (Zod) |

---

### GET /api/v1/market/mandi/prices

**Description:** Live wholesale mandi prices from Govt Agmarknet (synced via data.gov.in open feed). Default state **Punjab**.
**Auth:** No

#### Query

| Param | Default | Description |
|---|---|---|
| `state` | Punjab | Indian state |
| `commodity` | — | e.g. `Wheat` |
| `market` | — | APMC name filter |

#### Response — 200

```json
{
  "success": true,
  "data": [
    {
      "state": "Punjab",
      "district": "Fazilka",
      "market": "Abohar APMC",
      "commodity": "Wheat",
      "arrivalDate": "2026-08-28",
      "minPrice": 2610,
      "maxPrice": 2615,
      "modalPrice": 2610,
      "unit": "quintal",
      "pricePerKg": "26.10",
      "source": "agmarknet",
      "fetchedAt": "2026-08-28T23:43:56.945+00:00"
    }
  ]
}
```

Prices are **₹/quintal** from mandi; `pricePerKg` is derived for charts.

#### Errors

- 502 `MANDI_FEED_UNAVAILABLE` — upstream feed unreachable

---

### GET /api/v1/market/mandi/history

**Auth:** No

#### Query

| Param | Required | Description |
|---|---|---|
| `state` | no (default Punjab) | state |
| `commodity` | yes | crop name |
| `market` | no | APMC |
| `from`, `to` | no | `YYYY-MM-DD` range |

#### Response — 200 — daily averaged mandi modal/min/max with `avgModalPricePerKg`. Empty `data: []` when Agmarknet has no arrivals for that crop/state (not an error).

#### Errors

- 502 `MANDI_FEED_UNAVAILABLE` — upstream feed unreachable (network/rate-limit). Missing arrivals are **200** with `[]`.

---

### GET /api/v1/market/mandi/states

**Auth:** No — list states covered by the feed (Punjab, Haryana with key, Maharashtra, UP, MP, Karnataka).

### GET /api/v1/market/mandi/commodities

**Description:** Crop / commodity names available for a state (for UI dropdowns). May include staple grain fallbacks when today’s snapshot is thin.  
**Auth:** No

#### Query

| Param | Required | Description |
|---|---|---|
| `state` | no (default Punjab) | Indian state |

#### Response — 200

```json
{
  "success": true,
  "data": ["Wheat", "Onion", "Potato", "Tomato"],
  "meta": { "stale": false }
}
```

`meta.stale` may be `true` when the list is a staple fallback because the live snapshot for that state is missing or sparse.

#### Errors

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad query |
| 502 | `MANDI_FEED_UNAVAILABLE` | Upstream unreachable (not “empty list”) |

### GET /api/v1/market/mandi/markets

**Auth:** No — query `state` required; lists APMCs in that state.

Server syncs mandi rows into `price_trends` on startup and daily when `MANDI_SYNC_ENABLED=true`.

---

## 5d. Buyer produce alerts (V2)

### GET /api/v1/alerts

**Auth:** Yes  
**Roles:** BUYER

#### Response — 200 — array of alert objects.

---

### POST /api/v1/alerts

**Auth:** Yes (active account)  
**Roles:** BUYER

#### Request

```json
{ "crop": "Wheat", "state": "Punjab" }
```

Both fields optional (`null` = any). Duplicate `(userId, crop, state)` → 409.

#### Response — 201 — alert object.

---

### DELETE /api/v1/alerts/:id

**Auth:** Yes (active account)  
**Roles:** BUYER (owner)

#### Response — 200 — `{ "deleted": true }`

#### Errors

- 404

---

When a farmer **publishes** a listing, matching buyers receive `LISTING_PUBLISHED` notifications (crop/state alerts + same-state buyers). Hourly jobs warn farmers of listings expiring within 3 days (`LISTING_EXPIRING`) and auto-expire due listings.

---

## 5b. Reviews

### Review object

```json
{
  "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "orderId": "66666666-6666-4666-8666-666666666666",
  "fromUserId": "77777777-7777-4777-8777-777777777777",
  "toUserId": "11111111-1111-4111-8111-111111111111",
  "rating": 5,
  "comment": "Fresh produce, on time.",
  "fromUser": { "id": "77777777-7777-4777-8777-777777777777", "name": "Aman Singh" },
  "toUser": { "id": "11111111-1111-4111-8111-111111111111", "name": "Ravi Kumar" },
  "createdAt": "2026-08-18T10:00:00.000Z"
}
```

`ratingAvg` on `FarmerProfile` / `BuyerProfile` updates when a review is submitted.

---

### POST /api/v1/orders/:id/reviews

**Description:** Rate the counterparty after fulfillment (buyer → farmer, farmer → buyer).
**Auth:** Yes  
**Roles:** order buyer or farmer

#### Request

```json
{ "rating": 5, "comment": "Fresh produce, on time." }
```

#### Response — 201 — review object.

#### Errors

- 400 — order not `fulfilled`
- 409 `CONFLICT` — already reviewed this order

---

### GET /api/v1/orders/:id/reviews

**Auth:** Yes — order participants

#### Response — 200 — paginated reviews for the order.

---

### GET /api/v1/orders/:id/reviews/me

**Auth:** Yes — returns caller's review for this order or `null`.

---

### GET /api/v1/users/:id/reviews

**Description:** Public list of reviews received by a user (farmer or buyer profile).
**Auth:** No

#### Response — 200 — paginated review objects.

---

## 6. Notifications

### GET /api/v1/notifications

**Auth:** Yes  
**Roles:** any authenticated

#### Query

`unread=true` optional; `page`, `limit`

#### Response — 200

```json
{
  "success": true,
  "data": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "type": "ORDER_PLACED",
      "title": "New order",
      "body": "Aman Singh ordered 100 kg of Wheat.",
      "params": { "qty": "100", "unit": "kg", "crop": "Wheat" },
      "readAt": null,
      "relatedEntityType": "Order",
      "relatedEntityId": "66666666-6666-4666-8666-666666666666",
      "createdAt": "2026-08-17T17:00:00.000Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

#### `params` — localizable copy

`title` and `body` are stored in English at creation time. `params` carries the values behind
that sentence so the client can rebuild it in the reader's language
(`frontend/src/features/notifications/notification-copy.ts`). It is `null` for rows created
before the `notification_params` migration, and clients must fall back to `title` / `body`
whenever it is `null` or the `type` is unknown. Values are always flat strings or numbers.

| `type` | `params` | Notes |
|---|---|---|
| `ORDER_PLACED` | `qty`, `unit`, `crop` | — |
| `ORDER_STATUS_CHANGED` | `variant: "status"`, `from`, `to` | `from` / `to` are `OrderStatus` values |
| `ORDER_STATUS_CHANGED` | `variant: "logistics"`, `status` | `status` is a `LogisticsStatus` value |
| `ORDER_STATUS_CHANGED` | `variant: "payment"`, `amount` | Buyer only: the order was accepted or confirmed and still has no escrow. `amount` is the order total as a money string |
| `MESSAGE_RECEIVED` | `preview` | Buyer/farmer text, rendered verbatim |
| `LISTING_PUBLISHED` | `crop`, `district`, `state`, `price`, `unit`, `farmer` | — |
| `LISTING_EXPIRING` | `crop`, `days` | — |
| `ACCOUNT_SUSPENDED` | `reason` (optional) | Admin-written text, rendered verbatim |
| `LISTING_MODERATED` | `variant: "removed" \| "reinstated"`, `reason` (optional) | — |

---

### PATCH /api/v1/notifications/:id/read

**Auth:** Yes (owner)

#### Response — 200 — notification with `readAt` set.

---

### POST /api/v1/notifications/read-all

**Auth:** Yes

#### Response — 200

```json
{ "success": true, "data": { "updated": 4 } }
```

---

## 7. Reports

### GET /api/v1/reports/me

**Auth:** Yes  
**Roles:** FARMER | BUYER

#### Farmer 200

```json
{
  "success": true,
  "data": {
    "role": "FARMER",
    "totalListings": 8,
    "totalQuantitySold": "1200.000",
    "revenue": "30000.00"
  }
}
```

`totalQuantitySold` / `revenue` from orders in `fulfilled` only.

#### Buyer 200

```json
{
  "success": true,
  "data": {
    "role": "BUYER",
    "totalOrders": 5,
    "totalSpend": "12500.00"
  }
}
```

`totalSpend` from `fulfilled` (V1; pending not counted).

---

## 7b. Assistant (Kisan)

### GET /api/v1/assistant/status

**Description:** Check whether the Gemini-backed farm assistant is configured and reachable.
**Auth:** Yes

#### Response — 200

```json
{
  "success": true,
  "data": {
    "configured": true,
    "connected": true,
    "model": "gemini-3.6-flash",
    "source": "gemini"
  }
}
```

`source: "local"` when `GEMINI_API_KEY` is missing or the model endpoint is unreachable.

---

### POST /api/v1/assistant/query

**Description:** Ask Kisan. Same widget/endpoint as before — Capstone **Grounded Kisan** upgrades this path in place (not a second chatbot). Routing:

| Route | When | Behaviour |
|---|---|---|
| **legacy chat** | Marketplace / app how-to | Existing Gemini chat (`source: gemini` \| `local`, `mode: chat`) |
| **grounded** | Crop cards, PM-Kisan / PMFBY / MSP, weather rules | Retrieve top-k curated chunks, answer with citations (`source: grounded` \| `local`, `mode: grounded`) |
| **escalate** | Pesticide dose / medical-adjacent, or low retrieval confidence | Creates `AdvisoryEscalation`, notifies seeded `AGRONOMIST` (`source: escalated`, `mode: escalated`) |
| **refuse** | Grounded intent but empty retrieval | No invented answer (`source: refused`, `mode: refused`) |

**Auth:** Yes  
**Rate limit:** 60 requests / minute (shared across `/assistant/*`, since one chat turn uses `status` + `query` + `speak`)

#### Request

```json
{
  "message": "What is PM-Kisan?",
  "history": [{ "role": "user", "content": "Hi" }, { "role": "assistant", "content": "Namaste!" }],
  "language": "hi"
}
```

`message` max **800** characters. Each `history` turn max **4000** characters (longer turns are clipped); up to **4** prior turns. Optional `language`: `en` \| `hi` \| `pa` \| `bn` \| `ta` \| `te` \| `mr` \| `gu` \| `kn` \| `ml` \| `or` \| `as` \| `ur` — Kisan replies politely in that language's native script (defaults to English). If Gemini answers in the wrong script, the API rewrites once before returning. The chat widget reads the full reply via `POST /assistant/speak`. Optional `OPENWEATHER_API_KEY` injects a Delhi-area live sample into weather evidence; curated weather rules still apply without it.

#### Response — 200 (legacy)

```json
{
  "success": true,
  "data": {
    "reply": "Create a draft listing, add photos, then publish.",
    "source": "gemini",
    "mode": "chat"
  }
}
```

#### Response — 200 (grounded)

```json
{
  "success": true,
  "data": {
    "reply": "PM-Kisan pays eligible landholding farmers in installments [1]…",
    "source": "grounded",
    "mode": "grounded",
    "citations": [
      { "id": "scheme-pm-kisan", "title": "PM-Kisan — what it is", "source": "PM-Kisan one-pager (curated summary)" }
    ]
  }
}
```

#### Response — 200 (escalated)

```json
{
  "success": true,
  "data": {
    "reply": "This needs a human agronomist…",
    "source": "escalated",
    "mode": "escalated",
    "escalated": true,
    "escalationId": "uuid",
    "escalationReason": "pesticide_dose"
  }
}
```

`source` / `mode` also include `refused` when retrieval is empty. Eval harness: `npm run eval:grounded` in `backend/` (~30 labelled questions; reports correct-escalation rate).

---

### POST /api/v1/assistant/speak

**Description:** Synthesize the Kisan reply as spoken audio in the selected language (Gemini TTS). Returns a complete WAV file so the browser is not limited to English system voices or short cut-off utterances.
**Auth:** Yes (active account)  
**Rate limit:** 60 requests / minute (shared with `/assistant/*`). Identical `text` + `language` is served from a short-lived audio cache, so re-tapping read-aloud does not re-synthesize.

#### Request

```json
{
  "text": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਕਿਰਪਾ ਕਰਕੇ ਲਿਸਟ ਬਣਾਓ।",
  "language": "pa"
}
```

`text` max **2500** characters. Optional `language`: same 13 locales as `/query` (default English).

#### Response — 200

`Content-Type: audio/wav` (raw WAV bytes, not the JSON envelope).

| HTTP | Code | When |
|---|---|---|
| **200** | — | WAV body |
| **400** | `VALIDATION_ERROR` | Empty / oversized text, invalid language |
| **401** | `UNAUTHORIZED` / `TOKEN_*` | Missing or bad access token |
| **403** | `ACCOUNT_SUSPENDED` | Suspended account |
| **429** | `RATE_LIMIT_EXCEEDED` | Assistant limiter |
| **502** | `ASSISTANT_UNAVAILABLE` | Missing `GEMINI_API_KEY`, TTS model error, or empty audio |

---

### GET /api/v1/weather

**Description:** Live weather + **5-day** outlook for the signed-in user's profile location (`district` / `state` / `village` geocoded via OpenWeather). Falls back to Delhi only if the profile has no geocodable place.
**Auth:** Yes  
**Query:** optional `language` (same 13 locales as Kisan)

#### Response — 200

```json
{
  "success": true,
  "data": {
    "place": "Ludhiana",
    "profilePlace": "Ludhiana, Punjab",
    "description": "overcast clouds",
    "tempC": 31.2,
    "humidity": 58,
    "rainOutlook": "Rain likely in the next 24–48 hours…",
    "alertLine": "Live weather near Ludhiana…",
    "days": [
      { "date": "2026-09-12", "tempMinC": 24.1, "tempMaxC": 33.0, "description": "light rain", "rainMm": 1.7 }
    ],
    "source": "OpenWeatherMap (profile location)",
    "fetchedAt": "2026-09-11T08:00:00.000Z"
  }
}
```

| HTTP | Code | When |
|---|---|---|
| **200** | — | Snapshot |
| **401** | `UNAUTHORIZED` | No token |
| **503** | `WEATHER_UNAVAILABLE` | Missing `OPENWEATHER_API_KEY` or upstream failure |

---

## 7b. Agronomist (Grounded Kisan escalations)


Human experts with role **`AGRONOMIST`** (seeded only — not available at self-registration). Admins may also call these routes.

### GET /api/v1/agronomist/escalations

**Auth:** Yes · Roles: `AGRONOMIST`, `ADMIN`  
**Query:** optional `status` = `pending` \| `claimed` \| `resolved`  
**200:** array of escalations (farmer contact fields included for follow-up).

### PATCH /api/v1/agronomist/escalations/:id

**Auth:** Yes · Roles: `AGRONOMIST`, `ADMIN`  

```json
{ "status": "resolved", "resolution": "Confirm with KVK; do not spray before rain." }
```

`resolved` requires `resolution`. Sets `assignedToId` to the caller. Farmer gets `ADVISORY_ESCALATION` notification on resolve.

| HTTP | Code | When |
|---|---|---|
| **200** | — | Updated row |
| **400** | `VALIDATION_ERROR` | Missing resolution on resolve |
| **401** | `UNAUTHORIZED` | No token |
| **403** | `FORBIDDEN` | Not agronomist/admin |
| **404** | `NOT_FOUND` | Unknown id |

---

## 8. Admin

All admin routes: **Auth Yes, Roles ADMIN**. Non-admin → 403. Every mutating admin action writes `AdminActivityLog`.

---

### GET /api/v1/admin/users

Query: `role`, `q` (email/name), `suspended=true|false`, `page`, `limit`

#### Response — 200 — paginated users (include email, `isSuspended`, `verified`, `createdAt`; no password).

---

### PATCH /api/v1/admin/users/:id/suspend

#### Request

```json
{ "isSuspended": true, "reason": "Fraudulent listings" }
```

#### Response — 200 — user object.

Cannot suspend another admin (403 `CANNOT_SELF_DEMOTE` / `FORBIDDEN`). Cannot suspend self.

Notifies user `ACCOUNT_SUSPENDED` when true.

---

### PATCH /api/v1/admin/users/:id/verify

#### Request

```json
{ "verified": true }
```

#### Response — 200 — user object (`verified` badge).

---

### PATCH /api/v1/admin/listings/:id/moderate

#### Request

```json
{
  "status": "removed",
  "reason": "Misleading photos"
}
```

Allowed admin statuses: `removed`, `active` (reinstate if not deleted).

#### Response — 200 — listing object.

Notifies farmer `LISTING_MODERATED`.

---

### GET /api/v1/admin/analytics

#### Response — 200

```json
{
  "success": true,
  "data": {
    "totalUsers": 120,
    "usersByRole": { "FARMER": 70, "BUYER": 49, "ADMIN": 1 },
    "totalListings": 200,
    "activeListings": 80,
    "totalOrders": 340,
    "gmv": "1250000.00"
  }
}
```

`gmv` = sum of `priceTotal` for orders with status `fulfilled` (V1 proxy).

---

### GET /api/v1/admin/activity-logs

Query: `page`, `limit`, `actorId`, `action`

#### Response — 200 — paginated logs:

```json
{
  "id": "99999999-9999-4999-8999-999999999999",
  "actorId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "action": "USER_SUSPEND",
  "targetType": "User",
  "targetId": "11111111-1111-4111-8111-111111111111",
  "metadata": { "reason": "Fraudulent listings" },
  "createdAt": "2026-08-17T18:00:00.000Z"
}
```

---

### GET /api/v1/admin/reports.csv

**Not implemented.** Calling this path returns **404 `NOT_FOUND`**.

Do **not** depend on CSV export in the frontend. Use `GET /api/v1/admin/analytics` instead. Kept here only so teammates do not invent a client against a missing route.

---

## 9. Frontend mock: complete happy path

Use these literals in UI development before the API exists.

1. **Register farmer** → 201 example in §2 register  
2. **Create listing draft** → 201 with `status: "draft"`, empty photos  
3. **Upload photo** → 201 photos array  
4. **PATCH listing** `{ "status": "active" }` → 200  
5. **Register buyer / login** → 200  
6. **GET /listings?crop=Wheat** → one active listing  
7. **POST /orders** → 201 pending  
8. **Farmer PATCH status accepted → confirmed → fulfilled**  
9. **GET /reports/me** on both sides  
10. **Admin GET /admin/analytics**

---

## 10. Endpoints the frontend must not call

- Supabase REST `/rest/v1/*`
- Supabase Auth
- Direct Storage upload with service role
- data.gov.in / Agmarknet URLs (use `/api/v1/market/mandi/*`)
- Google Gemini URLs (use `/api/v1/assistant/*`)
- Capstone ML service URLs (not shipped)

Socket.io for **order chat** (`join:order`, `message:new`, typing) and **in-app voice calls** (`call:*`) **is** in scope — see [§5 Orders](#5-orders) and [API_ENDPOINTS.md](./API_ENDPOINTS.md).

---

## 11. CORS and cookies

`CORS_ORIGINS` includes the Next.js origin (dev: `http://localhost:3000`).  
`credentials: true`.  
Refresh cookie `Path=/api/v1/auth` so it is sent to refresh/logout only.

---

## 12. Outbound integrations (server-only)

The browser never calls these. Express owns credentials and retries.

| Integration | Env | Product surface | Notes |
|---|---|---|---|
| **data.gov.in / Agmarknet** | `DATA_GOV_IN_API_KEY` (optional for some states) | `GET /api/v1/market/mandi/*` | Live wholesale prices; empty day → `200 []`; upstream failure → `502 MANDI_FEED_UNAVAILABLE` |
| **Google Gemini** | `GEMINI_API_KEY`, `GEMINI_MODEL`, optional `GEMINI_TTS_MODEL`, `GEMINI_THINKING_LEVEL` | `GET/POST /api/v1/assistant/*` | Kisan advisory + spoken replies; status reports offline when key missing |
| **Supabase PostgreSQL** | `DATABASE_URL`, `DIRECT_URL` | All authenticated product data via Prisma | Not a public REST API for the app |
| **Supabase Storage** | `SUPABASE_*` service role | `POST /listings/:id/photos` | Service role stays on the server |
| **SMTP / console mail** | SMTP env or console | Password reset / notification delivery | Dev may log instead of send |
| **Razorpay** (optional) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `POST /orders/:id/payment*`, inbound `POST /payments/webhook` | UPI / card / net banking. Creates the order, then **reads the payment back** before escrowing it; signed webhook is authoritative. Mock hold/confirm without keys; COD never calls the gateway |
| **STUN (public Google)** | `WEBRTC_ICE_SERVERS` (optional override) | Socket.io `call:*` events | NAT discovery for in-app voice calls; media is peer-to-peer, never proxied by us |

Full inventory of product routes: [API_ENDPOINTS.md](./API_ENDPOINTS.md).
