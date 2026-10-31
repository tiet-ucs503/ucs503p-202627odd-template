# AgriConnect — Backend developer guide

Audience: anyone extending the Express API. Prisma is the only data layer. The frontend depends on the JSON contract, not on file paths or table names.

Related: [API_CONTRACT.md](./API_CONTRACT.md) · [API_STATUS_CODES.md](./API_STATUS_CODES.md) · [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Run the API

```bash
cd backend
copy .env.example .env
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Listens on **PORT** (default `5001`). Optional local Postgres: `docker compose up -d postgres` and the URL in `.env.example`.

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/server.ts` |
| `npm run build` / `npm start` | Compile + `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:seed` | Admin user from `ADMIN_SEED_*` |

Postman: `backend/postman/collection.json` + `environment.json`.

---

## 2. Folder map

```
backend/src/
├── server.ts                 # Prisma connect, listen
├── app.ts                    # Helmet, CORS, JSON 10kb, rate limits, mounts
├── routes/v1.ts              # /api/v1 router
├── config/                   # env (Zod), db, logger, cookies
├── common/                   # AppError, sendSuccess/sendError, decimals
├── middleware/
│   ├── require-auth.ts       # Bearer JWT → req.user
│   ├── optional-auth.ts      # listings browse
│   ├── require-active-account.ts  # 403 ACCOUNT_SUSPENDED
│   ├── role-guard.ts         # 403 FORBIDDEN
│   ├── validate.ts           # Zod → 400 VALIDATION_ERROR
│   ├── error-handler.ts      # envelope + Prisma / body-parser mapping
│   └── not-found.ts
├── modules/<resource>/
│   ├── *.routes.ts
│   ├── *.controller.ts
│   ├── *.service.ts
│   └── *.schema.ts           # Zod
├── services/                 # email, storage, notifications
└── utils/                    # jwt, tokens
```

Mounts in `routes/v1.ts`: `auth`, `users`, `listings`, `orders`, `notifications`, `reports`, `admin`.

`createNotification` / `createNotifications` (`services/notification.service.ts`) take a `params` object alongside `title` / `body`. Keep writing the English sentence for email and for old clients, and pass the same values as flat `params` (`{ qty, unit, crop }`, `{ variant: 'status', from, to }`, …) so the UI can re-render the copy in the reader's language. When one `NotificationType` covers more than one sentence, distinguish them with `params.variant` and add the matching `alerts.heading.*` / `alerts.body.*` keys in the frontend dictionaries.

---

## 3. Request pipeline

Typical protected mutation:

`requireAuth` → `roleGuard('FARMER')` → `requireActiveAccount` → `validate({ body, params, query })` → controller → service → `sendSuccess`.

| Layer | Failure |
|---|---|
| `requireAuth` | 401 `UNAUTHORIZED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` |
| `roleGuard` | 403 `FORBIDDEN` |
| `requireActiveAccount` | 403 `ACCOUNT_SUSPENDED` |
| `validate` | 400 `VALIDATION_ERROR` + `fields` |
| Service `AppError` | whatever you threw |
| Prisma `P2002` | 409 `CONFLICT` |
| Prisma `P2025` | 404 `NOT_FOUND` |
| body-parser `entity.too.large` | 413 `PAYLOAD_TOO_LARGE` |
| body-parser bad charset / encoding | 415 `UNSUPPORTED_MEDIA_TYPE` |
| Malformed JSON | 400 `INVALID_REQUEST` |
| Unknown | 500 `INTERNAL_ERROR` |
| No route | 404 `NOT_FOUND` |

body-parser rejects before any route runs and throws `http-errors`, not `AppError`, so
`fromBodyParserError` in `error-handler.ts` translates it. Without that mapping an oversized
body leaves as a 500.

Always throw `AppError`. Do not `response.status(400).json(...)` in a service.

```ts
throw new AppError(400, 'INVALID_REQUEST', 'Order status transition is not allowed');
```

Success:

```ts
sendSuccess(response, body);       // 200
sendSuccess(response, body, 201);  // create
sendPaginated(response, rows, pagination);
```

---

## 4. Auth and cookies

- Access JWT: ~15 minutes, `Authorization: Bearer`.
- Refresh: opaque token in HttpOnly cookie, `Path=/api/v1/auth`, 7 days, rotation + reuse detection.
- CORS: `CORS_ORIGINS` must include `http://localhost:3000` with `credentials: true`.
- Rate limits (`app.ts`): 100 req/min on `/api`; 10 **failed** req/min on `/api/v1/auth`; 60 req/min on `/api/v1/assistant` (one Kisan turn spends `status` + `query` + `speak`).
- **Grounded Kisan** (`modules/assistant/`): `queryAssistant` classifies → legacy `queryAssistantChat` \| `answerGrounded` (knowledge pack + top-k) \| escalate to `AdvisoryEscalation`. Seeded `AGRONOMIST` via `prisma/seed.ts`. Queue: `GET/PATCH /api/v1/agronomist/escalations`. Offline eval: `npm run eval:grounded`.

Suspended users can refresh and read `/auth/me`. They cannot hit routes with `requireActiveAccount`.

---

## 5. Domain rules you must not break

### Listings

State file: `modules/listings/listing-status.ts`.

- `POST /listings` **always** inserts `draft`. `status: "active"` on create → 400 (no photos).
- Farmer transitions: `draft→active`, `active→draft`, `sold_out→active`, `expired→active`. `removed` is terminal for farmers.
- Activate requires ≥1 photo, quantity > 0, MOQ ≤ quantity.
- Deleting the last photo of an **active** listing forces `draft`.
- Public `GET /listings` is `active` only. Non-admin `status` filter → 400.
- Soft delete: `DELETE` sets `removed` + `deletedAt`.

### Orders

State file: `modules/orders/order-state-machine.ts`.

```
pending   → accepted | cancelled
accepted  → confirmed | cancelled
confirmed → fulfilled | cancelled
fulfilled / cancelled → (terminal)
```

| Actor | Approve | Change | Discard |
|---|---|---|---|
| Farmer owner | pending→accepted | accepted→confirmed, confirmed→fulfilled | cancel from pending/accepted/confirmed |
| Buyer owner | — | — | pending→cancelled only |
| Admin | — | — | cancel only |

Cancel **requires** `cancellationReason`. Cancel restores listing stock (`inventory.ts`) **and refunds the payment** (`refundHeldPaymentForOrder`) in the same transaction. Create order uses an interactive transaction to avoid oversell → **409 `CONFLICT`**.

Wrong actor for a valid-looking transition → **400 `INVALID_REQUEST`**, not 403. Wrong owner of the row → **404**.

### Payments and escrow

Files: `modules/payments/payments.service.ts`, `payments.schema.ts`, `payments.routes.ts`,
`payments.webhook.ts`.

```
pending → authorized → held → released
        ↘ failed        ↘ refunded (order cancelled)
```

- Methods are `upi` | `card` | `netbanking` | `cod`. Only the first three enter escrow; `cod` sets `provider: 'cash'` and never calls the gateway.
- One payment per order (`payments.orderId` is unique). Init **upserts**, so two concurrent checkouts cannot trip `P2002`.
- Init on a `held` / `released` / `refunded` payment → **409 `CONFLICT`**. Confirming a `cod` payment → **400 `INVALID_REQUEST`**. Confirm is idempotent when already `held`.
- `released` is written only from the `fulfilled` branch of `updateOrderStatus`; `refunded` only from the `cancelled` branch. Do not set either from a controller.
- Mock mode is inferred from missing `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. Razorpay calls have a 15 s `AbortController` timeout and map every failure to **502 `PAYMENT_UNAVAILABLE`**.

#### The client never decides that money moved

With live keys, `markPaymentHeld` fetches `GET /v1/payments/{providerRef}` from Razorpay and
runs `checkGatewayPayment` before writing `held`. All four must hold: status `captured` or
`authorized`, `order_id` equal to the `razorpayOrderId` saved at init, amount equal to the
order total in paise, currency `INR`. A mismatch writes `failed` + `failureReason` and throws
**402 `PAYMENT_NOT_VERIFIED`**; an unreachable gateway leaves the row alone and throws 502 so
a retry is safe. `providerRef` is **required** whenever the gateway is live.

`checkGatewayPayment` is exported and pure — extend it there (with cases in `payments.test.ts`)
rather than inlining new rules in the service.

#### Webhook

`POST /api/v1/payments/webhook` is the authoritative signal, because it still arrives when the
buyer closes the tab before confirm. It is mounted **above** `requireAuth` (Razorpay sends no
JWT) and trust comes from `verifyWebhookSignature`, which HMACs the raw body with
`RAZORPAY_WEBHOOK_SECRET` and compares with `timingSafeEqual`.

- The raw body is essential, so `createApp` mounts `express.raw` for this exact path **before**
  `express.json`. Moving that line breaks signature checks in a way tests will not catch.
- `applyGatewayWebhook` re-runs the same match rules, so a replayed event from another order
  cannot hold the wrong escrow, and it no-ops on an already `held` / `released` / `refunded`
  payment (confirm and webhook race safely — whichever lands first wins).
- The payment is found by **either** `entity.order_id` matching the stored `providerRef` **or**
  `notes.orderId`. Do not drop back to notes alone: they live on the Razorpay *order*, Checkout
  options can override them, and the payment entity is not guaranteed to carry ours.
- A delivery that matches no payment, or matches one with no stored checkout (buyer restarted
  checkout or switched to COD after paying), is logged at `warn` and left alone. Those are the
  only cases where money can sit at the gateway with no escrow row, so they must stay visible.
- Answer **200** for anything except a bad signature or missing secret: Razorpay retries other
  statuses, and "valid but not acted on" is not a delivery failure.

Still not built: farmer payouts and settlement.

### Asking the buyer to pay

`updateOrderStatus` writes the usual `ORDER_STATUS_CHANGED` row for both parties, then a second
buyer-only row with `params.variant: "payment"` when the order moves to `accepted` or
`confirmed` and no escrow exists yet. It reuses the existing enum value on purpose — a new
`NotificationType` needs a Prisma enum migration, while a new `variant` only needs a copy key.

Escrow stays **opt-in**: fulfilment is not blocked when nothing was paid, because cash on
delivery is a legitimate flow with no escrow. The farmer's order page shows a warning next to
**Mark fulfilled** instead. Release only ever touches a payment already in `held`, so an unpaid
order simply completes with no money movement.

### Order chat and contact blocking

`modules/messages/messages.service.ts` calls `scanForContactInfo` (`common/contact-guard.ts`) before it writes anything. A hit throws **400 `CONTACT_INFO_BLOCKED`**, so the message is never stored and the counterparty is never notified. Blocked attempts are logged at `warn` with the violation list.

Keep the scan as the **first** thing after the cancelled-order guard: it must run before both the DB write and the socket broadcast. If you add a detector rule, add cases to `contact-guard.test.ts` for both the block **and** the legitimate trade phrasing it must not break (prices and quantities are the easy thing to get wrong).

Chat is not the only channel, so the same scan runs on the other free text the counterparty
reads, through `assertNoContactInfo(text, field)` — which throws the same 400 with
`error.fields` keyed by the request-body field:

| Service | Fields |
|---|---|
| `orders.service.ts` → `createOrder` | `notes` (the farmer reads them) |
| `listings.service.ts` → `createListing` / `updateListing` | `description`, `variety`, `village` (every buyer reads them) |

**Any new free-text field that one user writes and another reads needs this call**, otherwise it
becomes the new bypass. Enumerated and numeric fields (crop, unit, price, quantity) cannot carry
a message and are left alone. `contactViolationMessage` keeps the chat-specific wording; other
surfaces get the generic copy, because "in order chat" would be wrong on a listing form.

### Voice calls

`modules/calls/calls.gateway.ts` registers the `call:*` Socket.io handlers; `calls.service.ts` owns the permission check. The server relays SDP and ICE only — no media, no persistence.

- Live calls sit in a module-level `Map` keyed by order id, so this is **single-process only**. A multi-instance deploy needs a shared store.
- One live call per order, so an unanswered invite cannot keep the slot: a 45 s `RING_TIMEOUT_MS` timer clears the call and emits `call:ended` with `reason: "unanswered"` to **both** ends (`socket.to()` excludes the caller, who is the one still ringing). Accept, decline, hang-up, and disconnect go through `clearCall`, which cancels that timer — add any new teardown path there rather than calling `activeCalls.delete` directly.
- `call:incoming` only reaches sockets already in `order:<id>`, i.e. the counterparty has the order page open. There is no global ring, which is why the timeout exists.
- Socket handshake auth trusts the JWT and does **not** hit the DB, unlike `requireAuth`. `resolveCallPermission` therefore re-checks `deletedAt` and `isSuspended` itself.
- `call:incoming` carries the caller's name only. Never add a phone number to a call payload — it would defeat the contact-blocking rule above.

### Admin

- Cannot suspend self or another admin.
- Moderate listing: body `status` is only `removed` | `active`.
- Every mutation writes `AdminActivityLog`.

---

## 6. Adding or changing an endpoint

Do these in one change. The Cursor rule `.cursor/rules/update-api-docs.mdc` will remind you.

1. **Schema** — Zod in `*.schema.ts` (`.strict()` so extra keys 400).
2. **Route** — auth, role, active-account, `validate`, HTTP method/path.
3. **Service** — business rules as `AppError` with the **existing** `error.code` list (see status-code doc). Prefer 404 over 403 for IDOR.
4. **Tests** — Vitest next to the module (`*.test.ts`) for state machines and validation.
5. **Docs (required)**  
   - [API_CONTRACT.md](./API_CONTRACT.md) — path, body, success example  
   - [API_STATUS_CODES.md](./API_STATUS_CODES.md) — every HTTP code and approve/discard/change row  
   - [FRONTEND_GUIDE.md](./FRONTEND_GUIDE.md) if a screen must change  
   - [CHANGELOG.md](./CHANGELOG.md) — breaking vs compatible  
6. **Frontend client** — `frontend/src/lib/api/` wrappers + `types.ts` if the JSON shape changed.
7. **Postman** — `backend/postman/collection.json` for the new request.

### Status-code policy

| Situation | HTTP | Code |
|---|---|---|
| Bad input shape | 400 | `VALIDATION_ERROR` |
| Illegal lifecycle (approve/discard/change) | 400 | `INVALID_REQUEST` |
| Not logged in | 401 | `UNAUTHORIZED` |
| Expired access JWT | 401 | `TOKEN_EXPIRED` |
| Wrong role | 403 | `FORBIDDEN` |
| Suspended mutating | 403 | `ACCOUNT_SUSPENDED` |
| Missing or not owned | 404 | `NOT_FOUND` |
| Duplicate / oversell | 409 | `CONFLICT` |
| Photo too big / bad MIME | 413 / 415 | `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` |
| Limiter | 429 | `RATE_LIMIT_EXCEEDED` |

Do not add a new `error.code` unless you document it in the master catalog.

---

## 7. Money, ids, dates

- UUIDs everywhere.
- Prices `NUMERIC(12,2)` → JSON **strings**. Quantities `NUMERIC(12,3)` → JSON **strings**. Helpers: `common/decimal.ts`.
- `priceTotal` is computed server-side (`round(qty * pricePerUnit, 2)`). Never trust a client total.
- Timestamps ISO-8601 UTC. `harvestDate` is `YYYY-MM-DD`.

---

## 8. What not to build in V1

- Socket.io, payments, reviews, messaging, ML.
- `GET /api/v1/admin/reports.csv`.
- Frontend-facing Supabase keys.
- Returning 200 with an error body.

---

## 9. Quick verification before you push

```bash
cd backend
npm run typecheck
npm run lint
npm test
```

Hit `/health` and `/ready`. Walk one approve and one discard on `PATCH /orders/:id/status` (farmer accept, buyer cancel) and confirm the codes in [API_STATUS_CODES.md](./API_STATUS_CODES.md) §4.1 still match `order-state-machine.ts`.
