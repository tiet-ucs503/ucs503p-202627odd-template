# AgriConnect — API endpoint catalog

> **Audience:** faculty, tech lead, and anyone who needs every surface in one place.  
> **Deep request/response shapes:** [API_CONTRACT.md](./API_CONTRACT.md)  
> **HTTP status / approve-discard-change / errors:** [API_STATUS_CODES.md](./API_STATUS_CODES.md)  
> **Base URL (dev):** `http://localhost:5001` · **REST prefix:** `/api/v1` · **Version:** `v1`  
> **Envelope:** `{ success, data | error }` · **IDs:** UUID · **Decimals:** JSON strings

This catalog is the **discovery** document. The contract is the **integration** document. Browser clients talk **only** to Express. Outbound integrations (mandi, Gemini, Supabase) are **server-side only**.

---

## 1. Audience legend

| Tag | Meaning |
|---|---|
| **Ops** | Process / load-balancer probes (no `/api/v1` prefix) |
| **Public** | No `Authorization` header |
| **Optional auth** | Works anonymously; Bearer may enrich response |
| **Auth** | Bearer access JWT required (`requireAuth`) |
| **+ active** | `requireActiveAccount` — suspended users blocked on mutations |
| **Role** | `FARMER` / `BUYER` / `ADMIN` via `roleGuard` |
| **Realtime** | Socket.io (not REST) |
| **Webhook** | Inbound from a third party; authenticated by signature, not by JWT |
| **Outbound** | Server → third party / infra (not callable from the browser) |

---

## 2. Rate limits

| Scope | Limit | Notes |
|---|---|---|
| All `/api/*` | **100** req / 60s | Global |
| `/api/v1/auth/*` | **10** req / 60s | Skips successful requests |
| `/api/v1/assistant/*` | **20** req / 60s | Kisan advisory |
| Skipped when `NODE_ENV=test` | — | — |

Exceeded → **429 `RATE_LIMIT_EXCEEDED`**.

The Razorpay webhook sits under `/api`, so it shares the global bucket. Razorpay retries a
throttled delivery, and the handler is idempotent, so a retry cannot double-hold escrow.

---

## 3. Coverage summary

| Surface | Count | Status |
|---|---|---|
| Ops HTTP | 2 | Live |
| REST `/api/v1` (incl. meta) | 63 | Live |
| **Total product HTTP** | **65** | Live |
| Of those, inbound webhooks | 1 | `POST /api/v1/payments/webhook` |
| Socket.io | 1 namespace (default `/`) — chat + voice calls | Live |
| Outbound integrations | 3 families | Server-only |
| Documented but **not implemented** | 1 | `GET /api/v1/admin/reports.csv` → 404 |

---

## 4. Ops

| Method | Path | Audience | Purpose | Contract |
|---|---|---|---|---|
| `GET` | `/health` | Ops / Public | Liveness `{ status: "ok" }` | [§1 Health](./API_CONTRACT.md#1-health) |
| `GET` | `/ready` | Ops / Public | Readiness + DB check; **503** if down | [§1 Health](./API_CONTRACT.md#1-health) |

---

## 5. Meta

| Method | Path | Audience | Purpose | Contract |
|---|---|---|---|---|
| `GET` | `/api/v1/` | Public | API name + version probe | [§1b Meta](./API_CONTRACT.md#1b-meta--apiv1) |

---

## 6. Auth — `/api/v1/auth`

Extra limiter: **10/min**.

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | — | Register farmer/buyer | [§2](./API_CONTRACT.md#2-auth) |
| `POST` | `/api/v1/auth/login` | Public | — | Issue access + refresh cookie | [§2](./API_CONTRACT.md#2-auth) |
| `POST` | `/api/v1/auth/refresh` | Cookie | — | Rotate access token (no Bearer) | [§2](./API_CONTRACT.md#2-auth) |
| `POST` | `/api/v1/auth/logout` | Cookie | — | Invalidate refresh session | [§2](./API_CONTRACT.md#2-auth) |
| `GET` | `/api/v1/auth/me` | Auth | any | Current identity (preferred) | [§2](./API_CONTRACT.md#2-auth) |
| `POST` | `/api/v1/auth/forgot-password` | Public | — | Start reset email flow | [§2](./API_CONTRACT.md#2-auth) |
| `POST` | `/api/v1/auth/reset-password` | Public | — | Complete reset with token | [§2](./API_CONTRACT.md#2-auth) |

---

## 7. Users & profiles — `/api/v1/users`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/users/me` | Auth | any | Alias of `/auth/me` (prefer `/auth/me`) | [§3](./API_CONTRACT.md#3-users--profiles) |
| `PATCH` | `/api/v1/users/me` | Auth + active | any | Update account fields | [§3](./API_CONTRACT.md#3-users--profiles) |
| `GET` | `/api/v1/users/me/farmer-profile` | Auth | FARMER | Get farmer profile | [§3](./API_CONTRACT.md#3-users--profiles) |
| `PATCH` | `/api/v1/users/me/farmer-profile` | Auth + active | FARMER | Update farmer profile | [§3](./API_CONTRACT.md#3-users--profiles) |
| `GET` | `/api/v1/users/me/buyer-profile` | Auth | BUYER | Get buyer profile | [§3](./API_CONTRACT.md#3-users--profiles) |
| `PATCH` | `/api/v1/users/me/buyer-profile` | Auth + active | BUYER | Update buyer profile | [§3](./API_CONTRACT.md#3-users--profiles) |
| `GET` | `/api/v1/users/me/export` | Auth | any | GDPR-style data export | [§3](./API_CONTRACT.md#3-users--profiles) |
| `DELETE` | `/api/v1/users/me` | Auth | FARMER\|BUYER | Soft-delete account | [§3](./API_CONTRACT.md#3-users--profiles) |
| `GET` | `/api/v1/users/:id/public` | Public | — | Public farmer card | [§3](./API_CONTRACT.md#3-users--profiles) |

---

## 8. Listings — `/api/v1/listings`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/listings` | Optional auth | — | Browse / search listings | [§4](./API_CONTRACT.md#4-listings) |
| `GET` | `/api/v1/listings/:id` | Optional auth | — | Listing detail | [§4](./API_CONTRACT.md#4-listings) |
| `POST` | `/api/v1/listings` | Auth + active | FARMER | Create listing — **contact details rejected** in `description` / `variety` / `village` (`CONTACT_INFO_BLOCKED`) | [§4](./API_CONTRACT.md#4-listings) |
| `PATCH` | `/api/v1/listings/:id` | Auth + active | FARMER | Update own listing — same contact scan as create | [§4](./API_CONTRACT.md#4-listings) |
| `DELETE` | `/api/v1/listings/:id` | Auth + active | FARMER | Remove listing | [§4](./API_CONTRACT.md#4-listings) |
| `POST` | `/api/v1/listings/:id/photos` | Auth + active | FARMER | Upload photos (multipart) | [§4](./API_CONTRACT.md#4-listings) |
| `DELETE` | `/api/v1/listings/:id/photos/:photoId` | Auth + active | FARMER\|ADMIN | Delete photo | [§4](./API_CONTRACT.md#4-listings) |

---

## 9. Orders, payments, messages — `/api/v1/orders`

Router-level: **Auth** on all rows. Ownership / role enforced in services.

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `POST` | `/api/v1/orders` | Auth + active | BUYER | Place order — **contact details rejected** in `notes` (`CONTACT_INFO_BLOCKED`) | [§5](./API_CONTRACT.md#5-orders) |
| `GET` | `/api/v1/orders` | Auth | any* | List my orders | [§5](./API_CONTRACT.md#5-orders) |
| `GET` | `/api/v1/orders/:id` | Auth | any* | Order detail | [§5](./API_CONTRACT.md#5-orders) |
| `PATCH` | `/api/v1/orders/:id/status` | Auth + active | any* | Advance / cancel status | [§5](./API_CONTRACT.md#5-orders) |
| `PATCH` | `/api/v1/orders/:id/logistics` | Auth + active | any* | Logistics tracking | [§5](./API_CONTRACT.md#5-orders) |
| `POST` | `/api/v1/orders/:id/payment` | Auth + active | BUYER | Start payment with a chosen method (`upi`/`card`/`netbanking`/`cod`) | [§5](./API_CONTRACT.md#post-apiv1ordersidpayment) |
| `POST` | `/api/v1/orders/:id/payment/confirm` | Auth + active | BUYER | Move payment into escrow (`held`) after the server verifies it with Razorpay | [§5](./API_CONTRACT.md#post-apiv1ordersidpaymentconfirm) |
| `GET` | `/api/v1/orders/:id/messages` | Auth | any* | List order chat | [§5](./API_CONTRACT.md#5-orders) |
| `POST` | `/api/v1/orders/:id/messages` | Auth + active | any* | Send chat message — **contact details rejected** (`CONTACT_INFO_BLOCKED`) | [§5](./API_CONTRACT.md#contact-info-blocking-anti-disintermediation) |
| `POST` | `/api/v1/orders/:id/messages/read` | Auth + active | any* | Mark messages read | [§5](./API_CONTRACT.md#5-orders) |

\*Buyer, farmer on the order, or admin (where allowed).

---

## 9b. Payments — `/api/v1/payments`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/payments/methods` | Auth | any | Method catalog for the checkout picker | [§5](./API_CONTRACT.md#get-apiv1paymentsmethods) |
| `POST` | `/api/v1/payments/webhook` | **Webhook** | — | Razorpay `payment.captured` / `payment.failed`; HMAC-signed raw body, no JWT | [§5](./API_CONTRACT.md#post-apiv1paymentswebhook) |

Escrow lifecycle (`pending → authorized → held → released`, plus `refunded` on cancellation)
is documented in [Payment methods and escrow lifecycle](./API_CONTRACT.md#payment-methods-and-escrow-lifecycle).

A payment reaches `held` only after the server itself confirms it with Razorpay — either by
reading the payment back during confirm, or from the signed webhook. The browser reports
which payment id to check, never whether it succeeded.

---

## 10. Reviews (mounted at `/api/v1`)

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/users/:id/reviews` | Public | — | Public reviews for a user | [§5b](./API_CONTRACT.md#5b-reviews) |
| `GET` | `/api/v1/orders/:id/reviews` | Auth | any* | Reviews on an order | [§5b](./API_CONTRACT.md#5b-reviews) |
| `GET` | `/api/v1/orders/:id/reviews/me` | Auth | any* | My review for an order | [§5b](./API_CONTRACT.md#5b-reviews) |
| `POST` | `/api/v1/orders/:id/reviews` | Auth + active | any* | Create review after fulfilled | [§5b](./API_CONTRACT.md#5b-reviews) |

---

## 11. Notifications — `/api/v1/notifications`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/notifications` | Auth | any | List notifications | [§6](./API_CONTRACT.md#6-notifications) |
| `PATCH` | `/api/v1/notifications/:id/read` | Auth | any | Mark one read | [§6](./API_CONTRACT.md#6-notifications) |
| `POST` | `/api/v1/notifications/read-all` | Auth | any | Mark all read | [§6](./API_CONTRACT.md#6-notifications) |

---

## 12. Reports — `/api/v1/reports`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/reports/me` | Auth + active | FARMER\|BUYER | Personal activity / GMV report | [§7](./API_CONTRACT.md#7-reports) |

---

## 13. Market / mandi — `/api/v1/market`

All **Public** (no auth). Live rows depend on Agmarknet / data.gov.in; empty arrays are success when no arrivals.

| Method | Path | Audience | Purpose | Contract |
|---|---|---|---|---|
| `GET` | `/api/v1/market/prices` | Public | Stored price trends | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/prices/summary` | Public | Latest per crop/state | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `POST` | `/api/v1/market/prices/compare` | Public | Listing vs mandi compare | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/mandi/states` | Public | States covered by feed | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/mandi/commodities` | Public | Crop names for a state | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/mandi/markets` | Public | APMCs by state | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/mandi/prices` | Public | Live mandi prices | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |
| `GET` | `/api/v1/market/mandi/history` | Public | Mandi price history | [§5c](./API_CONTRACT.md#5c-market-prices-v2) |

---

## 14. Buyer alerts — `/api/v1/alerts`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/alerts` | Auth | BUYER | List produce alerts | [§5d](./API_CONTRACT.md#5d-buyer-produce-alerts-v2) |
| `POST` | `/api/v1/alerts` | Auth + active | BUYER | Create alert | [§5d](./API_CONTRACT.md#5d-buyer-produce-alerts-v2) |
| `DELETE` | `/api/v1/alerts/:id` | Auth + active | BUYER | Delete alert | [§5d](./API_CONTRACT.md#5d-buyer-produce-alerts-v2) |

---

## 15. Admin — `/api/v1/admin`

All rows: **Auth + ADMIN**.

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/users` | Auth | ADMIN | List / filter users | [§8](./API_CONTRACT.md#8-admin) |
| `PATCH` | `/api/v1/admin/users/:id/suspend` | Auth | ADMIN | Suspend / unsuspend | [§8](./API_CONTRACT.md#8-admin) |
| `PATCH` | `/api/v1/admin/users/:id/verify` | Auth | ADMIN | Verify user | [§8](./API_CONTRACT.md#8-admin) |
| `PATCH` | `/api/v1/admin/listings/:id/moderate` | Auth | ADMIN | Moderate listing | [§8](./API_CONTRACT.md#8-admin) |
| `GET` | `/api/v1/admin/analytics` | Auth | ADMIN | Dashboard analytics | [§8](./API_CONTRACT.md#8-admin) |
| `GET` | `/api/v1/admin/activity-logs` | Auth | ADMIN | Admin activity logs | [§8](./API_CONTRACT.md#8-admin) |

---

## 16. Assistant (Kisan) — `/api/v1/assistant`

Extra limiter: **20/min**. Same widget: marketplace chat stays legacy Gemini; crop/scheme/weather uses Grounded RAG; high-stakes asks escalate.

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/assistant/status` | Auth | any | Online / offline + config | [§7b](./API_CONTRACT.md#7b-assistant-kisan) |
| `POST` | `/api/v1/assistant/query` | Auth + active | any | Ask Kisan (legacy \| grounded \| escalate \| refuse) | [§7b](./API_CONTRACT.md#7b-assistant-kisan) |
| `POST` | `/api/v1/assistant/speak` | Auth + active | any | Spoken WAV of a reply | [§7b](./API_CONTRACT.md#7b-assistant-kisan) |

## 16b. Agronomist — `/api/v1/agronomist`

Seeded `AGRONOMIST` only (not self-registerable). Admins allowed.

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/agronomist/escalations` | Auth | AGRONOMIST\|ADMIN | List advisory escalations | [§7b Agronomist](./API_CONTRACT.md#7b-agronomist-grounded-kisan-escalations) |
| `PATCH` | `/api/v1/agronomist/escalations/:id` | Auth | AGRONOMIST\|ADMIN | Claim / resolve escalation | [§7b Agronomist](./API_CONTRACT.md#7b-agronomist-grounded-kisan-escalations) |

## 16c. Weather — `/api/v1/weather`

| Method | Path | Audience | Role | Purpose | Contract |
|---|---|---|---|---|---|
| `GET` | `/api/v1/weather` | Auth | any | Live regional sample + 24–48h rain outlook for header chip | OpenWeatherMap via `OPENWEATHER_API_KEY` |

---

## 17. Realtime — Socket.io

| Item | Detail |
|---|---|
| Path | `/socket.io` (Socket.io default) |
| Namespace | Default `/` only (no custom namespaces) |
| Audience | **Realtime** + **Auth** |
| Auth | `handshake.auth.token` or `Authorization: Bearer` |
| Rooms | `order:{orderId}` after access check (buyer/farmer on order; ADMIN any) |
| Client → server | `join:order`, `leave:order`, `typing:start`, `call:invite`, `call:accept`, `call:decline`, `call:end`, `call:signal` |
| Server → client | `message:new`, `typing`, `call:incoming`, `call:accepted`, `call:declined`, `call:ended`, `call:signal` |
| Contract | [Real-time chat](./API_CONTRACT.md#real-time-chat-socketio) · [Voice calls](./API_CONTRACT.md#in-app-voice-calls-socketio) |

REST chat (`GET/POST .../messages`) remains the durable store; sockets push live updates.

**Voice calls** let the buyer and farmer talk without swapping phone numbers, which is why
chat rejects contact details. Audio is peer-to-peer WebRTC — the server relays only SDP and
ICE candidates, never media, and calls are not persisted. Admins cannot join a call. One live
call per order, tracked in memory on the API process.

---

## 18. Outbound / external integrations (server-only)

These are **not** product HTTP routes for the browser. Express calls them; the Next.js app must never hold their secrets.

| Integration | Direction | Env / config | Used by | Notes |
|---|---|---|---|---|
| **data.gov.in / Agmarknet** | Outbound HTTP | `DATA_GOV_IN_API_KEY` (optional for some states) | `mandi-prices.service.ts` → `/market/mandi/*` | Live wholesale prices; empty day = `200 []` |
| **Google Gemini** | Outbound HTTP | `GEMINI_API_KEY`, `GEMINI_MODEL`, optional `GEMINI_TTS_MODEL`, `GEMINI_THINKING_LEVEL` | `assistant.service.ts` / `assistant-tts.ts` → `/assistant/*` | Kisan advisory + spoken WAV; status offline if key missing |
| **Supabase PostgreSQL** | Outbound DB | `DATABASE_URL`, `DIRECT_URL` | Prisma | All persistent product data |
| **Supabase Storage** | Outbound storage | `SUPABASE_*` service role | Listing photo upload | Browser never gets service-role key |
| **SMTP / console mail** | Outbound mail | SMTP env or console | Password reset / notifications | Dev may log to console |
| **Razorpay** (optional) | Outbound payments **+ inbound webhook** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `payments.service.ts` → `/orders/:id/payment*`; webhook → `POST /payments/webhook` | UPI / card / net banking. Creates the order, reads the payment back before escrowing, and accepts signed `payment.captured` / `payment.failed` events. Simulated hold/confirm without keys; COD never calls the gateway |
| **STUN (public Google)** | Outbound UDP from the **browser** | `WEBRTC_ICE_SERVERS` (optional override) | Socket.io `call:*` | NAT discovery for voice calls. Add TURN for strict NATs |

Details: [Outbound integrations appendix](./API_CONTRACT.md#12-outbound-integrations-server-only).

---

## 19. Explicit exclusions (do not call)

| Path / surface | Status | Client rule |
|---|---|---|
| `GET /api/v1/admin/reports.csv` | **Not implemented** → **404 `NOT_FOUND`** | Do not depend on CSV export; use `GET /admin/analytics` |
| Supabase REST / Storage from browser | Forbidden by architecture | Photos via `POST /listings/:id/photos` only |
| Gemini / data.gov.in from browser | Forbidden | Use `/assistant/*` and `/market/mandi/*` |
| Direct Prisma / DB URLs in frontend | Forbidden | Express owns data |

---

## 20. Mount map (implementation)

```text
createApp()
├── GET /health
├── GET /ready
├── express.raw /api/v1/payments/webhook   (before express.json)
├── rateLimit /api/*
└── /api/v1
    ├── GET /
    ├── /auth          (auth limiter)
    ├── /users
    ├── /listings
    ├── /orders        (+ payment + messages nested)
    ├── /payments      (webhook [no JWT] + method catalog)
    ├── /notifications
    ├── /reports
    ├── /              (reviews routes)
    ├── /market
    ├── /alerts
    ├── /admin
    └── /assistant     (assistant limiter)
```

Source: `backend/src/app.ts`, `backend/src/routes/v1.ts`, module `*.routes.ts`.

---

## 21. How to use this doc in review

1. **Lead / faculty:** skim §§3–19 for completeness and audience tags.  
2. **Frontend:** implement only catalogued REST + Socket paths; follow contract examples.  
3. **Backend:** any new route must update this catalog, [API_CONTRACT.md](./API_CONTRACT.md), [API_STATUS_CODES.md](./API_STATUS_CODES.md), Postman, and [CHANGELOG.md](./CHANGELOG.md) in the same change.
