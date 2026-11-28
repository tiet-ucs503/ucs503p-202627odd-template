# AgriConnect — Changelog

Keep this file in reverse chronological order. Flag **breaking** changes so frontend and backend teammates can migrate.

Format: `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`.

---

## Unreleased

### Added

- **Grounded Kisan (RAG) — Capstone §8.2 upgrade of the same Kisan widget** — marketplace/app questions still use the legacy Gemini chat path; crop / scheme / weather asks retrieve curated ICAR-style + PM-Kisan / PMFBY / MSP + weather chunks, cite sources, and **refuse** when retrieval is empty. Pesticide-dose / medical-adjacent (and low-confidence retrieval) escalate to a seeded **`AGRONOMIST`** role (`AdvisoryEscalation`, `ADVISORY_ESCALATION` notifications). Additive RBAC — farmers cannot self-register as agronomist. Optional `OPENWEATHER_API_KEY` injects a live sample into weather evidence and powers **`GET /api/v1/weather`** plus a header forecast chip (temp + description; click for 24–48h rain outlook). Eval: `npm run eval:grounded` (~30 labelled questions; reports correct-escalation rate). Routes: `GET/PATCH /api/v1/agronomist/escalations`. Migration `20260911120000_grounded_kisan_agronomist`.
- **The buyer is now asked to pay** — escrow existed but nothing ever pointed a buyer at it: accepting an order sent only the generic "Order status changed from pending to accepted" to both parties, so an order could reach `fulfilled` with `No payment started yet` and escrow silently skipped. `PATCH /orders/:id/status` now also writes a buyer-only notification on `accepted` and `confirmed` — `ORDER_STATUS_CHANGED` with `params.variant: "payment"` and the order total in `amount` ("Pay ₹12,250.00 to hold this order in escrow"). Reuses the existing enum value on purpose: a new `NotificationType` would need a Prisma enum migration, a new `variant` needs only a copy key. Skipped once the payment is `held` / `released` / `refunded`, and for `cod`, which never enters escrow. Fulfilment is deliberately **not** blocked for an unpaid order — cash on delivery is legitimate — so the farmer's order page shows `order.escrowNotHeld` next to **Mark fulfilled** instead. 3 new keys across all 13 locales (477 × 13) and a `notification-copy` test for the new variant.
- **Full UI translation across all 13 locales, enforced by tests** — every screen, badge, error toast, and page title now reads from the dictionaries; `en|hi|pa|bn|ta|te|mr|gu|kn|ml|or|as|ur` each define the complete key set. Non-hook modules translate through `tt()` (`frontend/src/lib/i18n/active-locale.ts`), the Razorpay adapter returns error codes the UI maps to keys, `formatMoney` / `formatQty` take a locale (Latin digits by design), and `LocaleProvider` writes an `agriconnect.locale` cookie that the root layout reads for `<html lang>` and localized `generateMetadata`. New frontend test layer (Vitest + Testing Library, jsdom): locale parity and script checks, a static guard that fails on hardcoded JSX strings, Punjabi render tests for every screen, and unit tests for the locale context and formatters — all wired into CI alongside `typecheck` and `build`.
- **Localizable notification copy** — `Notification.params` (nullable `Jsonb`, migration `20260907220000_notification_params`) stores the values behind each notification's English `title` / `body`, and `GET /api/v1/notifications` exposes them as a flat `params` object. The client rebuilds the sentence in the reader's language from `type` + `params` (`frontend/src/features/notifications/notification-copy.ts`) and falls back to the stored English strings when `params` is `null` (pre-migration rows) or the `type` is unknown. Chat previews and admin-written suspension reasons stay verbatim. Admin activity-log `action` / `targetType` are now mapped to translations client-side, no schema change needed. Compatible: `params` is additive and optional.
- **Contact blocking now covers order notes and listing copy** — the chat guard was trivially bypassable: `POST /orders` `notes` are read by the farmer and a listing `description` is read by every buyer, neither was scanned. `assertNoContactInfo` (`backend/src/common/contact-guard.ts`) now runs on `notes` in `createOrder` and on `description` / `variety` / `village` in `createListing` **and** `updateListing`, so an edit cannot smuggle a number back into a published listing. Same **400 `CONTACT_INFO_BLOCKED`**, plus `error.fields` keyed by the offending field so forms can highlight the input, and non-chat copy that does not say "in order chat". Behaviour change for clients that posted contact details in those fields; nothing is stored on rejection. 4 new unit tests and 8 new live checks in `npm run smoke:antibypass` (33 total).
- **Contact-exchange blocking in order chat (anti-disintermediation)** — `POST /orders/:id/messages` now rejects phone numbers, emails, UPI IDs, and off-platform app names with **400 `CONTACT_INFO_BLOCKED`**. Nothing is stored and no notification is sent. Catches spaced/dashed digits (`98765 43210`), spelled digits in English and Hindi (`nine eight…`, `nau aath…`), lookalike characters (`98o6543210`), and obfuscated emails (`name (at) example (dot) com`), while leaving prices and quantities (`1000 kg at 2500 per quintal`) untouched. Detector: `backend/src/common/contact-guard.ts` with 30 unit tests.
- **In-app voice calls** — buyers and farmers talk without swapping phone numbers. Peer-to-peer WebRTC with Socket.io signalling: `call:invite` / `call:accept` / `call:decline` / `call:end` / `call:signal` client→server and `call:incoming` / `call:accepted` / `call:declined` / `call:ended` / `call:signal` server→client. Media never touches the server and calls are not persisted. Admins cannot join; suspended accounts and cancelled orders cannot call; one live call per order. New optional `WEBRTC_ICE_SERVERS` env var (defaults to public Google STUN). Frontend: `OrderCallPanel` with ring / accept / decline / mute / duration / hang-up.
- **Payment methods** — **breaking:** `POST /orders/:id/payment` now requires a body `{ "method": "upi" | "card" | "netbanking" | "cod" }`. New `GET /api/v1/payments/methods` returns the picker catalog with an `escrow` flag. `POST /orders/:id/payment/confirm` accepts an optional `{ "providerRef" }`. Frontend `OrderPaymentPanel` renders the method picker plus escrow status, and Razorpay Checkout is now actually opened when keys are configured.
- **Payment escrow guards and refunds** — cancelling an order refunds a `pending` / `authorized` / `held` payment (`refunded` + `refundedAt`) in the same transaction, so a cancelled order can no longer hold the buyer's money. Re-paying a settled payment is **409 `CONFLICT`**; confirming a `cod` payment is **400 `INVALID_REQUEST`**; confirm is idempotent when already `held`. Payment init now upserts, closing a race on the unique `payments.orderId` index, and the Razorpay call has a 15 s timeout.
- **API endpoint catalog** — [docs/API_ENDPOINTS.md](./API_ENDPOINTS.md) inventories all 65 product HTTP routes, Socket.io chat, outbound integrations (data.gov.in, Gemini, Supabase), rate limits, and explicit exclusions for faculty/lead review.
- **Smoke scripts** — `npm run smoke:antibypass` (contact guard + full escrow lifecycle incl. refund) and `npm run smoke:calls` (two-socket call handshake and signal relay) run against a local dev server.

- **Urdu right-to-left layout** — `<html>` now carries `dir` derived from the locale (`localeDirection` in `frontend/src/lib/i18n/locales.ts`), set server-side from the `agriconnect.locale` cookie and updated by `LocaleProvider` when the language changes, so Urdu mirrors without a reload. Physical spacing utilities were converted to logical ones (`pe-`, `start-`, `end-`, `text-start`) across the mandi table, listing cards, and the Kisan launcher, which now docks to the left edge in Urdu. Numbers, prices, and dates stay in Latin digits.
- **Webfonts for every script** — `app/layout.tsx` loads Noto Sans Bengali / Tamil / Telugu / Gujarati / Kannada / Malayalam / Oriya and Noto Nastaliq Urdu (`preload: false`, so only the active locale downloads a face), bound per `html[lang]` in `globals.css`. Previously ten locales fell back to a locally installed font — fine on Windows, tofu boxes elsewhere. Urdu gets `line-height: 2` for Nastaliq descenders.
- **Width budget for constrained copy** — `frontend/tests/i18n-width-budget.test.ts` estimates rendered width as graphemes x a per-script advance factor (Latin 0.52em … Kannada 0.80em), and fails when a role's nav row exceeds 520px, a single-line label exceeds `max(1.6x English, 8em)`, or `nav.alerts` equals `nav.notifications`. `frontend/tests/screens/header.test.tsx` asserts the header keeps its overflow-proof shape.

### Fixed

- **Oversized request bodies returned 500 instead of 413** — `express.json({ limit: '10kb' })` rejects a large body before any route runs and throws an `http-errors` object, which the error handler did not recognise: a 20 kb login body answered **500 `INTERNAL_ERROR`** while [docs/API_STATUS_CODES.md](./API_STATUS_CODES.md) promised **413 `PAYLOAD_TOO_LARGE`**. `fromBodyParserError` now maps body-parser rejections — `entity.too.large` → 413, `charset.unsupported` / `encoding.unsupported` → **415 `UNSUPPORTED_MEDIA_TYPE`**, anything else 4xx → **400 `INVALID_REQUEST`** — so the documented codes are the real ones. Covered in `backend/tests/api.security.test.ts`.
- **Razorpay webhook could miss the payment it was about** — the handler looked the order up only through `notes.orderId`, a marker Checkout options can override and that Razorpay does not guarantee on the payment entity, so a genuine `payment.captured` could be acknowledged with 200 and no escrow hold. It now matches on either the stored checkout (`entity.order_id` = `payments.providerRef`) or `notes.orderId`, and an unmatched or checkout-less delivery is logged at `warn` instead of disappearing into a 200 — those are the cases where money moved at the gateway with nothing here to attach it to.
- **An unanswered call locked the order** — one live call per order is tracked in memory with no timeout, so a callee who was not on the order page never rang, the caller sat on “Ringing…” forever, and every later invite was refused with `CONFLICT` until the caller's socket dropped. Invites now expire after 45 s: the call is cleared, both ends get `call:ended` with `reason: "unanswered"` (`socket.to()` skips the caller, who is the one left ringing), and the slot is free to retry. Accept, decline, hang-up, and disconnect all cancel the timer, which is `unref`'d so it cannot delay shutdown. Three tests in `backend/tests/calls.ring-timeout.test.ts`.
- **Live chat and incoming calls went dead after ~15 minutes** — the Socket.io handshake captured the access token once, so when it expired every reconnect retried with the stale token and was refused while REST kept working behind a silent refresh: an order page left open lost message delivery and could not be called. `auth` is now a callback, re-read on every connect attempt, plus a one-shot `refreshAccessToken()` on an `Unauthorized` `connect_error`.
- **Cash on delivery could not be undone** — the payment panel hid the method picker for a `pending` COD payment, so a mis-tapped COD left the buyer with no way to pay online even though `POST /orders/:id/payment` re-opens any pending payment. The picker now stays available until the payment settles and pre-selects the method already chosen.
- **Kisan replies were truncated, then stopped answering entirely** — `gemini-3.6-flash` is a thinking model and Gemini bills thinking tokens against `maxOutputTokens`, which the request never constrained. Measured on the live API with the same prompt: at `maxOutputTokens: 512` the model spent 518 tokens thinking and returned **33 characters** with `finishReason: MAX_TOKENS` (the "it doesn't read the full thing" report — the *text* was cut off, not the audio); at 1024 it spent 929 thinking tokens and took **29.1 s**, past the 25 s abort, surfacing **502 `ASSISTANT_UNAVAILABLE`** ("Could not reach the farm assistant right now."). Requests now send a model-aware thinking config — `thinkingLevel` for Gemini 3.x, `thinkingBudget` for the 2.5 series, since each is a 400 on the other family — with `maxOutputTokens: 2048`. Same question now answers in **4.8–7.1 s** with complete 590–645-character Gurmukhi. New `GEMINI_THINKING_LEVEL` env var (`minimal` default). Also: 30 s timeout with one automatic retry on transport/5xx failures, a retry without `thinkingConfig` on 400 `INVALID_ARGUMENT` so a future model change cannot take Kisan offline, and a warning log when a reply hits `MAX_TOKENS`.
- **Read-aloud could hang for minutes** — `synthesizeSpeech` walked 3 TTS models x 2 `languageCode` variants at 45 s each (~270 s worst case). It now remembers the model that worked, caps attempts at 3 with a 30 s timeout, drops `languageCode` only when the model actually rejects it, and caches rendered WAVs — re-tapping read-aloud on the same reply returns in **0.8 s** instead of 20 s and costs no quota.
- **English error bubble in a non-English chat** — an assistant failure rendered the server's English `error.message`; **502 `ASSISTANT_UNAVAILABLE`** now shows the localized `kisan.errorUnreachable` instead.

### Changed

- **Faster Kisan talk** — pin `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` (one flash fallback only, not the full pro list), keep `GEMINI_THINKING_LEVEL=minimal`, ask for ~45-word replies, clip spoken audio to ~280 chars (full text still on screen), lower chat `maxOutputTokens` to 768.
- **Assistant rate limit 20 → 60 / minute** — a single chat turn now spends three requests (`/status`, `/query`, `/speak`), so 20/min meant ~7 questions before a spurious **429**.
- **Header can no longer overlap in any language** — the nav links used to keep their width (`whitespace-nowrap`, no `overflow`) inside a shrinkable box and paint over the right-hand cluster; Tamil, Kannada, and Malayalam hit it first because their labels render ~20% wider than English. The inline nav is now `min-w-0 flex-1 overflow-x-auto` (worst case it scrolls inside its own box) and starts at `lg` instead of `md`, so 768–1023px uses the scrollable second row. The right cluster is fixed-width: the language switcher is a globe + locale-code chip over a transparent native `<select>` (was as wide as `മലയാളം`), notifications are a bell + count badge, and the profile name truncates. New `nav.notifications` key in all 13 locales — the bell and the buyer's produce-alert link no longer render the same word twice. Tamil and Urdu `nav.alerts` moved to the crop-alert sense to keep the two distinct.
- **Clipped surfaces** — the Kisan mic caption clamps to two lines instead of ellipsising in most locales, and the marketplace filter row steps `sm:2 / lg:3 / xl:6` columns instead of squeezing six filters into 768px.
- **Payment shape on the order object** — `order.payment` gained `method`, `methodLabel`, `failureReason`, `heldAt`, `releasedAt`, and `refundedAt`. `frontend/src/lib/api/types.ts` now exports `OrderPayment`, `PaymentMethod`, `PaymentStatus`, and `PaymentMethodOption` instead of an inline object with `status: string`.
- **Migration history repaired** — `20260902120000_v2_market_logistics_payments` had been applied by hand but never recorded, so `prisma migrate deploy` failed with `42710 type "LogisticsStatus" already exists`. Marked resolved, then applied `20260907180000_payment_methods`.

### Security

- **Escrow holds are verified with Razorpay, not with the browser** — **breaking** when Razorpay keys are configured: `POST /orders/:id/payment/confirm` previously moved a payment to `held` on the strength of a client-supplied `providerRef`, so a buyer could mark an order paid without paying. Confirm now requires `providerRef` and reads the payment back via Razorpay `GET /v1/payments/{id}`, requiring status `captured`/`authorized`, a matching `order_id`, the exact order total in paise, and `INR`. A mismatch sets the payment to `failed` with a reason and returns **402 `PAYMENT_NOT_VERIFIED`**; an unreachable gateway returns **502** and leaves the payment untouched. Mock mode and cash on delivery are unchanged, so key-less demos still work.
- **Signed Razorpay webhook** — new `POST /api/v1/payments/webhook` (no JWT) accepts `payment.captured` and `payment.failed`, authenticated by `x-razorpay-signature` HMAC-SHA256 over the raw body compared with `timingSafeEqual`. It re-checks checkout id and amount, is idempotent against the confirm path, and answers 200 for benign no-ops so Razorpay stops retrying; bad signature is **401**, missing `RAZORPAY_WEBHOOK_SECRET` is **503**. `createApp` mounts `express.raw` for that one path ahead of `express.json` so the signed bytes survive. New optional `RAZORPAY_WEBHOOK_SECRET` env var; 22 unit tests in `backend/src/modules/payments/payments.test.ts` cover the signature and match rules, and `backend/tests/payments.webhook.route.test.ts` drives the route itself — including a delivery signed over re-serialized JSON, which only passes if the raw bytes reach the handler intact.
- **Row level security on late tables** — `payments`, `price_trends`, and `buyer_crop_alerts` were created after the RLS lockdown migration and had RLS disabled. `20260907180000_payment_methods` enables RLS and revokes `anon` / `authenticated` grants on all three. Express connects as the table owner and is unaffected.

- **Kisan language-matched audio** — `POST /assistant/speak` returns a full WAV in the selected language (Gemini TTS). `/query` rewrites if the reply is still English. Browser TTS is only a fallback.
- **API contract gaps** — documented `GET /api/v1/`, `GET /users/me` as a subsection, `GET /market/mandi/commodities`, outbound integrations appendix; marked `GET /admin/reports.csv` as not implemented (404).
- **Register required contact fields** — **breaking:** `POST /auth/register` now requires `phone`, `state`, and `district` (1–30 / 1–100 chars). `village` stays optional. Register UI labels and HTML `required` match.

### Added

- **Indian languages + voice-first Kisan** — 13 locales (`en|hi|pa|bn|ta|te|mr|gu|kn|ml|or|as|ur`). Kisan panel redesigned from research: quiet circular launcher, mobile fullscreen, large mic with live transcript (review then Send), listening/speaking waveform, read-aloud + auto-read.
- **Hindi / Punjabi i18n** — English, Hindi (हिन्दी), and Punjabi (ਪੰਜਾਬੀ) UI via header language switcher; persists in `localStorage` and syncs to `languagePref` when signed in. Register/`PATCH /users/me` accept only `en`|`hi`|`pa`. Kisan assistant accepts optional `language` (`en`|`hi`|`pa`) and replies in that language.
- **Order timeline** — visual stepper on order detail for order status, escrow payment, and delivery logistics.
- **Mandi compare badge** — `POST /api/v1/market/prices/compare`; marketplace listing cards show Below/Above/Matches mandi vs Agmarknet reference.
- **Mandi prices resilience** — unsupported states (e.g. Haryana) and rate-limited live feed fall back to seeded Agmarknet reference data; expanded demo mandi seed across Punjab/Haryana/API states.

### Removed

- **3D harvest hero** — dropped the WebGL farm scene and Three.js packages. Landing is the original logo banner again.

### Fixed

- **Login double-submit** — form ignored rapid re-clicks while the ~2s login request was in flight (`pendingRef` + `preventDefault`).
- **Listing photos** — demo onion/tomato Unsplash URLs were 404; cards now fall back to local crop photos and skip the redundant Active badge.
- **Landing discoverability** — marketplace-focused home; live mandi rates live on `/market-prices` only (header link). Audit test listings hidden from public browse.
- **data.gov.in mandi filters** — live prices queried `filters[state.keyword]`, which always returned zero rows even with a valid `DATA_GOV_IN_API_KEY`. Filters now use `filters[state]`. Empty mandi history is `200 []` instead of `502`.
- **Mandi page offline UX** — “Failed to fetch” mapped to a clear backend-down message; Haryana kept in the state dropdown fallback; live/history/trends load with `Promise.allSettled` so one failure does not wipe the page.

### Added (V2)

- **Market prices** — `GET /api/v1/market/prices` and `/prices/summary`; `PriceTrend` model; seeded Agmarknet-style reference data; frontend `/market-prices`.
- **Live govt mandi feed** — `GET /api/v1/market/mandi/prices`, `/mandi/history`, `/mandi/states`, `/mandi/markets`; Punjab/Haryana/Maharashtra sync from Agmarknet via data.gov.in (open mandi API); daily sync into `price_trends`.
- **Demo seed data** — `npm run prisma:seed` creates Punjab farmers/buyers, listings, orders (all statuses), chat messages, payments, reviews, alerts, and price trends for faculty demos.
- **Buyer produce alerts** — `BuyerCropAlert` CRUD (`GET/POST/DELETE /api/v1/alerts`); buyers notified on `LISTING_PUBLISHED` when farmers publish matching listings.
- **Listing jobs** — hourly expiry warnings (`LISTING_EXPIRING`) and auto-expire due listings.
- **Logistics tracking** — `logisticsStatus` on orders (`none` → `dispatched` → `in_transit` → `delivered`); `PATCH /api/v1/orders/:id/logistics`; farmer UI on order detail.
- **Escrow-style payments** — `Payment` model; `POST /orders/:id/payment` + `/payment/confirm`; optional Razorpay sandbox; mock mode without keys; release on `fulfilled`.
- **Chat typing** — Socket.io `typing:start` / `typing` events.
- **Docker** — `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` (postgres + api + web).
- **Price recording** — internal listing publish and order fulfill write `PriceTrend` rows.

### Fixed

- **Kisan chat history** — assistant replies longer than 4000 chars no longer break follow-up questions; frontend clips history to 2000 chars per turn when sending.
- **Nav active state** — Dashboard no longer highlights together with My listings on `/farmer/listings`.
- **Suspended login** — `POST /login` returns **403 `ACCOUNT_SUSPENDED`** instead of issuing tokens for suspended accounts (refresh + `/me` still work for already-signed-in users).
- **Order quantity validation** — Zod rejects `quantity: "0"` at the API boundary (was only rejected in service).
- **Login password** — empty password rejected by validation (`min(1)`).
- **Listing edit** — saving an active listing no longer forces `draft` unless the farmer unpublishes.
- **Register deep link** — `/register?role=BUYER` pre-selects buyer.
- **Buyer dashboard** — pending-order count filters `status=pending` (was total orders).
- **API error fields** — frontend `getErrorMessage` includes Zod `fields` in form errors.
- **Silent spinners** — orders, notifications, farmer listings, and admin pages show errors instead of infinite loading.
- **Notification badge** — header count refreshes immediately after mark-read on the alerts page.
- **Order reviews UI** — counterparty average rating shown on fulfilled orders.
- **Assistant** — suspended users blocked from `POST /assistant/query` (`requireActiveAccount`).

### Added

- **CI** — GitHub Actions workflow runs backend typecheck/lint/test and frontend lint on push/PR.
- **Integration check** — `npx tsx scripts/integration-crud-check.ts` verifies API writes land in Supabase.
- Schema tests for login password and order quantity validation.
- Supabase MCP configured in `.cursor/mcp.json` for live schema checks and migrations from Cursor.

### Security

- Enabled RLS on all `public` tables and revoked `anon` / `authenticated` grants (via Supabase MCP). Express/Prisma still uses the `postgres` connection; browser cannot query tables with the anon key.

### Added (features)

- **Real-time order chat** — `Message` model, REST (`GET/POST /api/v1/orders/:id/messages`, `POST .../read`), Socket.io (`join:order`, `message:new`), order detail chat UI.
- **Reviews & ratings** — `Review` model; buyer ↔ farmer ratings after `fulfilled`; `ratingAvg` updated on profiles; star display on listings and order page.
- **Kisan assistant status** — `GET /api/v1/assistant/status` and Online/Offline indicator in the chat widget.

### Fixed

- Applied `messages` and `reviews` migration to Supabase when direct `DIRECT_URL` (5432) is unreachable; added `npm run prisma:deploy:pooler` fallback script.
- Farmer and buyer dashboards no longer spin forever when the browser reuses cached API responses (`304 Not Modified`). API client now uses `cache: 'no-store'`; API success responses send `Cache-Control: no-store` and Express ETag is disabled.

### Added

- Developer documentation set: `docs/README.md`, `docs/API_STATUS_CODES.md`, `docs/FRONTEND_GUIDE.md`, `docs/BACKEND_GUIDE.md`, and this changelog.
- Cursor rule `.cursor/rules/update-api-docs.mdc` to keep API docs in sync with route and client changes.

---

## V1 (current implementation)

Shipped REST API under `/api/v1` covering auth, users, listings, orders, notifications, reports, and admin. See [API_CONTRACT.md](./API_CONTRACT.md) and [API_STATUS_CODES.md](./API_STATUS_CODES.md).
