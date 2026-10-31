# AgriConnect — Frontend developer guide

Audience: anyone building or extending the Next.js app. The UI is a client of the Express API. You do not query Supabase from the browser.

Related: [API_CONTRACT.md](./API_CONTRACT.md) · [API_STATUS_CODES.md](./API_STATUS_CODES.md) · [README.md](./README.md)

---

## 1. Run the UI

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` must be `http://localhost:5001` (no trailing slash). The backend must already be running.

| Script | What it does |
|---|---|
| `npm run dev` | Next.js on port **3000** |
| `npm run build` / `npm start` | Production build |
| `npm run lint` | ESLint |

There is no frontend unit-test script in V1. Treat the API contract + manual flows as the test plan.

---

## 2. Folder map

```
frontend/src/
├── app/                      # App Router pages
│   ├── page.tsx              # Public landing (logo hero + live listings)
│   ├── login / register / forgot-password / reset-password
│   ├── marketplace/          # Public browse (no login)
│   ├── listings/[id]/        # Public listing detail (order needs buyer)
│   ├── market-prices/        # Public mandi / reference prices
│   ├── farmer/               # Farmer dashboard + listing CRUD
│   ├── buyer/                # Buyer home
│   ├── orders/               # List + [id] status actions
│   ├── notifications/
│   ├── profile/
│   ├── dashboard/            # Role redirect hub
│   └── admin/                # Users, listings moderate, logs, analytics
├── components/               # shell, listing-card, ui primitives, providers
├── features/
│   ├── auth/                 # AuthProvider, RequireAuth, GuestOnly
│   ├── i18n/                 # LocaleProvider, LanguageSwitcher (13 locales)
│   ├── home/                 # Public landing listings preview
│   ├── assistant/            # Kisan chat widget
│   ├── messages/             # Order chat
│   ├── listings/             # Listing form
│   └── reviews/              # Order review UI
└── lib/
    ├── api/                  # HTTP client — keep in sync with the contract
    ├── i18n/                 # 13 dictionaries + translate() / tt() / dynamic keys
    ├── env.ts
    ├── constants.ts
    └── format.ts             # money / qty / dates for decimal strings
```

The landing page uses the illustrated AgriConnect logo on a forest banner, a marketplace promo, and a live listings preview. Live mandi rates are on `/market-prices` (linked in the header). Marketplace, listing, and dashboard pages stay conventional UI.

**i18n:** Header language switcher sets one of 13 locales (`en` / `hi` / `pa` / `bn` / `ta` / `te` / `mr` / `gu` / `kn` / `ml` / `or` / `as` / `ur`), and every locale is fully translated. Strings live in `src/lib/i18n/messages/`; `en.ts` is the source of truth for both the key set and the `MessageKey` type.

Rules for adding copy:

1. Add the key to `en.ts`, then to `hi.ts` and `pa.ts` (both are typed as complete `MessageTree`s, so TypeScript fails the build if you skip one). The other ten files use `withEnglishFallback`, so add the key there too — the test suite fails on any value still written in Latin script.
2. In components, call `useLocale().t('nav.dashboard')`. In modules that cannot use hooks (`lib/api/client.ts`, `lib/api/errors.ts`, `lib/call-signaling.ts`), call `tt(...)` from `lib/i18n/active-locale.ts`, which mirrors the provider's locale.
3. Adapters that sit below the UI return stable codes instead of copy — `features/payments/razorpay.ts` and `lib/speech.ts` do this, and the caller maps the code to a key. Socket acks carry an `error.code` that `useOrderCall` maps the same way.
4. Values that arrive as plain `string` from the API (listing category, mandi commodity, unit) go through `categoryKey` / `mandiCropKey` / `unitKey` in `lib/i18n/dynamic-keys.ts`, which return `null` for unknown values so the raw name still renders.
5. Copy in width-constrained chrome (`nav.*`, `order.status.*`, `listing.status.*`, the Kisan mic caption) has a width budget — see the table below. A Tamil or Kannada grapheme renders about 1.5x the width of a Latin one, so character count is not a usable proxy.

**Layout under long translations.** The header cannot overlap regardless of label length: the left group is `flex-1 min-w-0` and the inline nav is `min-w-0 flex-1 overflow-x-auto`, so worst case the links scroll inside their own box. The inline nav starts at `lg`; between 768px and 1023px every locale uses the scrollable second row. The right-hand cluster is fixed-width by construction — the language switcher shows a globe and the locale code (`EN`, `TA`) over a transparent native `<select>`, notifications are a bell plus a count badge, and the profile name is `max-w-[7rem] truncate`. Use logical spacing utilities (`ms-` / `me-` / `ps-` / `pe-` / `start-` / `end-` / `text-start`) rather than physical ones so Urdu mirrors correctly.

**Direction.** `localeDirection(locale)` in `lib/i18n/locales.ts` is the single source of truth; `ur` is the only RTL locale. `app/layout.tsx` sets `dir` on `<html>` from the same cookie it reads for `lang`, and `LocaleProvider` updates `document.documentElement.dir` when the language changes so switching does not need a reload. Numbers, prices, and dates stay in Latin digits.

**Fonts.** `app/layout.tsx` loads one `next/font/google` Noto family per script (`preload: false`, so only the active locale downloads its face) and exposes each as a CSS variable; `globals.css` binds them per `html[lang]`. Without this, the ten non-Latin locales depend on a font the visitor happens to have installed. Urdu also gets `line-height: 2`, because Nastaliq descenders collide at the default leading.

Formatting: `formatDate(value, locale)`, `formatMoney(value, locale)`, and `formatQty(value, unit, locale)` all take the active locale. Digits stay in the Latin numbering system on purpose (`numberingSystem: 'latn'`) — mandi rates and prices are read against printed govt reports, which use Latin digits even in regional-language editions.

`LocaleProvider` writes an `agriconnect.locale` cookie alongside `localStorage`; `app/layout.tsx` reads it with `cookies()` to set `<html lang>` and localized `generateMetadata`, which removes the English-first flash (and makes every route server-rendered on demand). Signed-in preference syncs to `PATCH /users/me` `languagePref`. Kisan receives the same locale on `POST /assistant/query` (rewrites if the reply is still English) and reads the full answer via `POST /assistant/speak` (`audio/wav`, cached server-side per text + language, so re-tapping read-aloud is instant). Browser speech synthesis is only a fallback. A `502 ASSISTANT_UNAVAILABLE` renders the localized `kisan.errorUnreachable` rather than the server's English message.

Server-written copy is localized client-side too. `GET /notifications` returns a `params` object next to the English `title` / `body`, and `features/notifications/notification-copy.ts` rebuilds the sentence from `type` + `params` (translating the `OrderStatus` / `LogisticsStatus` values inside it), falling back to the stored strings for rows created before the `notification_params` migration. One `type` can mean several sentences, so `params.variant` picks the copy: `ORDER_STATUS_CHANGED` is a status change, a delivery update (`logistics`), or a request to pay (`payment`, buyer-only, carrying `amount`). Chat previews and admin-written suspension reasons are human text and are rendered verbatim. Admin activity-log `action` / `targetType` map to `admin.logAction.*` / `admin.logTarget.*` from their enum values.

**Tests** (`npm test`, Vitest + Testing Library, jsdom):

| Suite | What it protects |
| --- | --- |
| `tests/i18n-parity.test.ts` | Every locale has the English key set, no empty values, identical `{placeholder}` variables, and values written in that locale's Unicode script |
| `tests/no-hardcoded-strings.test.ts` | Parses every `src/**/*.tsx` and fails on JSX text or `placeholder` / `aria-label` / `title` / `alt` literals that are not translated |
| `tests/screens/*.test.tsx` | Renders each screen with the locale pinned to Punjabi and asserts the translated copy is present and the English copy is gone |
| `tests/locale-context.test.tsx`, `tests/format.test.ts` | Language switching, persistence, `languagePref` sync, English fallback, and per-locale formatting |
| `tests/notification-copy.test.ts` | Server-written notifications rebuilt from `params`, including the English fallback for rows without them |
| `tests/i18n-width-budget.test.ts` | Estimates rendered width as graphemes x a per-script advance factor: each role's nav row stays under 520px, single-line labels stay within `max(1.6x English, 8em)`, and `nav.alerts` never equals `nav.notifications` |
| `tests/screens/header.test.tsx` | The nav keeps its `min-w-0 overflow-x-auto lg:flex` shape, the bell carries the unread count and an accessible name, and the switcher chip shows the locale code |

**Without an account** a visitor can use: `/` (home), `/marketplace`, `/listings/:id` (view only), `/market-prices`. Sign-in is required to list, order, chat, or open dashboards.

---

## 3. How the API is called

Never `fetch` ad-hoc in a page if a wrapper already exists. Add a function in `src/lib/api/` instead.

| File | Endpoints |
|---|---|
| `client.ts` | `apiRequest`, `apiRequestBlob`, automatic refresh on `TOKEN_EXPIRED` |
| `auth.ts` | register, login, logout, me, forgot/reset password |
| `listings.ts` | CRUD + photo upload (`FormData` field `files`) |
| `orders.ts` | create, list, get, **status change** |
| `users.ts` | profile, export, delete |
| `notifications.ts` | list, read, read-all |
| `reports.ts` | `/reports/me` |
| `messages.ts` | order chat history, send, mark read |
| `reviews.ts` | order/user reviews, submit rating |
| `assistant.ts` | Kisan query (legacy + grounded + escalate), status, and `POST /assistant/speak` (WAV) |
| `socket.ts` | Socket.io client (`join:order`, `message:new`); `auth` is a callback so every reconnect re-reads the current access token, and an `Unauthorized` handshake triggers one `refreshAccessToken()` retry |
| `admin.ts` | users, suspend, verify, moderate, analytics, logs |
| `types.ts` | Shared TS types (must match API JSON) |
| `errors.ts` | `ApiError`, `getErrorMessage` (includes Zod `fields` when present), `formatFieldErrors` |
| `notifications-events.ts` | `notifyNotificationsUpdated` / `onNotificationsUpdated` for header badge refresh |
| `token-store.ts` | In-memory access token (**not** localStorage) |

### Rules the client already enforces

- `credentials: 'include'` so the HttpOnly refresh cookie is sent.
- JSON `Content-Type` unless the body is `FormData`.
- On **401 `TOKEN_EXPIRED`**, one refresh then retry. Other 401s clear the session.
- Failures throw `ApiError(status, code, message, fields?)`.

```ts
import { createOrder } from '@/lib/api/orders';
import { ApiError, getErrorMessage } from '@/lib/api/errors';

try {
  const { data } = await createOrder({
    listingId,
    quantity: '100',
    deliveryMode: 'pickup',
  });
} catch (error) {
  if (error instanceof ApiError && error.status === 409) {
    // insufficient quantity
  }
  setError(getErrorMessage(error));
}
```

Decimals and money are **strings** (`"25.00"`, `"500.000"`). Do not `Number()` them for display without `format.ts`.

---

## 4. Auth and route guards

`AuthProvider` (`features/auth/auth-context.tsx`):

1. On load, uses memory token or `POST /auth/refresh`.
2. Then `GET /auth/me`.
3. Login/register stores `accessToken` in memory only.

Use:

- `RequireAuth` — any logged-in user
- `RequireAuth roles={['FARMER']}` — farmer pages
- `RequireAuth roles={['ADMIN']}` — admin pages
- `GuestOnly` — login/register

Wrong role → redirect to that user’s dashboard. Logged out → `/login`.

If `user.isSuspended`, mutating API calls return **403 `ACCOUNT_SUSPENDED`**. Show a blocked state; still allow `/auth/me` and logout.

---

## 5. Screens ↔ APIs (where to continue)

| User goal | Page | API |
|---|---|---|
| Register / login | `app/register`, `app/login` | `POST /auth/register`, `/login` |
| Browse crops | `app/marketplace` | `GET /listings` (public) |
| Mandi / reference prices | `app/market-prices` | `GET /market/prices`, `/market/mandi/prices` (public). Requires API on `NEXT_PUBLIC_API_BASE_URL` (default `:5001`). Empty table = no Agmarknet arrivals for that crop/state today (e.g. Haryana Wheat); try Potato/Onion. `502 MANDI_FEED_UNAVAILABLE` = feed down/rate-limited. |
| Ask Kisan | `FarmerChatWidget` | Voice-first: quiet launcher, mobile fullscreen, large mic (transcript → review → Send), waveform states, full read-aloud in the selected language. `POST /assistant/query` + `/assistant/speak`. Capstone Grounded Kisan uses the **same** widget: citations render under grounded replies; marketplace how-to stays on the legacy chat path. |
| Listing detail | `app/listings/[id]` | `GET /listings/:id`, `GET /users/:id/public` |
| Create listing | `app/farmer/listings/new` | `POST /listings` (draft) → `POST .../photos` → `PATCH` `{ status: "active" }` |
| Edit listing | `app/farmer/listings/[id]/edit` | `PATCH /listings/:id`, photo add/delete |
| Place order | listing detail / buyer flow | `POST /orders` |
| **Approve / discard / change order** | `app/orders/[id]` | `PATCH /orders/:id/status` — see below |
| Pay for an order | `features/payments/OrderPaymentPanel` | `GET /payments/methods` → `POST /orders/:id/payment` → `POST .../payment/confirm` |
| Call the other party | `features/calls/OrderCallPanel` | Socket.io `call:*` (no REST) |
| Order chat | `features/messages/OrderChat` | `GET/POST /orders/:id/messages` + Socket.io `message:new` |
| Notifications | `app/notifications` | `GET /notifications`, `PATCH .../read` |
| Reports | farmer/buyer dashboards | `GET /reports/me` |
| Admin moderate listing | `app/admin/listings` | `PATCH /admin/listings/:id/moderate` (`removed` = discard, `active` = approve) |
| Admin users | `app/admin/users` | suspend / verify |

### Order buttons (already implemented)

`app/orders/[id]/page.tsx` → `nextActions()`:

| Role | Current status | Button | Body |
|---|---|---|---|
| Farmer | pending | Accept order | `{ status: "accepted" }` |
| Farmer | accepted | Confirm | `{ status: "confirmed" }` |
| Farmer | confirmed | Mark fulfilled | `{ status: "fulfilled" }` |
| Farmer | pending/accepted/confirmed | Cancel | `{ status: "cancelled", cancellationReason }` |
| Buyer | pending only | Cancel order | cancelled + reason |
| Admin | pending/accepted/confirmed | Admin cancel | cancelled + reason |

Illegal clicks are still possible if the order changed under you → **400 `INVALID_REQUEST`**. Show `error.message`.

When the farmer can see **Mark fulfilled** and the payment is not `held` (and is not `cod`), the
page shows `order.escrowNotHeld` above the actions. Fulfilling an unpaid order is allowed — it
just releases nothing — so this is a warning, not a disabled button.

### Payment panel

`features/payments/OrderPaymentPanel.tsx` loads `GET /payments/methods` and renders a radio
picker. On submit it posts the chosen `method`, then branches on the response `mode`:

| `mode` | Next step |
|---|---|
| `cod` | Nothing to charge — show the message and refetch the order |
| `mock` | Call `POST .../payment/confirm` straight away (no gateway keys configured) |
| `razorpay` | `openRazorpayCheckout()` (`features/payments/razorpay.ts`) loads Checkout, and the returned `razorpay_payment_id` is sent as `providerRef` to confirm |

`providerRef` is mandatory in `razorpay` mode: the server verifies that id with Razorpay and
answers **402 `PAYMENT_NOT_VERIFIED`** if the gateway does not confirm the payment, its
checkout, or its amount. That leaves the payment `failed`, so surface `error.message`, refetch
the order, and let the buyer start a new payment rather than retrying the same reference.

Escrow state comes from `order.payment.status`, not local state — always refetch the order
after a payment, because `held` can also be written by the Razorpay webhook, and `released`
and `refunded` are written server-side by order transitions, never by the client.

The picker stays visible until the payment settles (`held` / `released` / `refunded`) and
pre-selects the method already on the order. A `pending` cash-on-delivery choice is therefore
changeable, matching the API, where `POST /orders/:id/payment` re-opens any pending payment —
do not gate it out again or a mis-tapped COD strands the buyer with no way to pay online.

### Voice call panel

`features/calls/OrderCallPanel.tsx` + `features/calls/useOrderCall.ts` own the WebRTC flow;
`lib/call-signaling.ts` wraps the socket events. Things to preserve if you touch it:

- The hook must not **return** a ref. The React Compiler lint (`react-hooks/refs`) treats the whole returned object as ref-tainted, so the remote `Audio` element is created and kept inside the hook.
- The socket is a shared singleton, so `subscribeToCalls` pairs every `on` with an `off` in its cleanup, exactly like `joinOrderRoom`.
- An invite nobody answers ends itself after 45 s: the server emits `call:ended` with `reason: "unanswered"` to both ends and frees the order, so the caller returns to idle instead of ringing forever.
- The **caller** sends the SDP offer only after `call:accepted` arrives — the callee has no peer connection before it accepts.
- ICE candidates that arrive before the remote description is set are queued and flushed afterwards.
- `getUserMedia` needs a secure context: `localhost` is fine, a LAN IP over plain HTTP is not. Denied mic permission surfaces as "Microphone permission denied".

Admins see chat but no call panel (`canCall = isFarmer || isBuyer`).

---

## 6. Status-code handling in UI

Copy this behavior whenever you add a form:

| Status | `error.code` | UI |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Per-field from `error.fields` |
| 400 | `INVALID_REQUEST` | Alert with `error.message` (wrong approve/discard/change) |
| 400 | `CONTACT_INFO_BLOCKED` | Chat `Alert` with `error.message`; keep the draft so the user can edit it, and point at the Voice call panel. From the order or listing form, the same code arrives with `error.fields` (`notes`, `description`, `variety`, `village`) — `formatFieldErrors` already renders it, so keep the rest of the form intact |
| 401 | `TOKEN_EXPIRED` | Handled in `client.ts` |
| 402 | `PAYMENT_NOT_VERIFIED` | Checkout alert with `error.message`; refetch the order and offer a new payment (never retry the same `providerRef`) |
| 401 | else | Redirect login |
| 403 | `FORBIDDEN` | Hide control |
| 403 | `ACCOUNT_SUSPENDED` | Suspended message |
| 404 | `NOT_FOUND` | Not-found page |
| 409 | `CONFLICT` | Email taken, not enough stock, or payment already settled |
| 502 | `PAYMENT_UNAVAILABLE` | Checkout alert; offer retry or another method |
| 413 / 415 | photo errors | File picker hint |
| 429 | | “Too many attempts, wait a minute” |
| 500 / 503 | | Retry later |

Full tables: [API_STATUS_CODES.md](./API_STATUS_CODES.md).

---

## 7. What the frontend must not do

- Call Supabase `/rest/v1`, Auth, or Storage with the service role.
- Store the access token in `localStorage` or cookies you control.
- Call `GET /api/v1/admin/reports.csv` (not implemented).
- Skip steps on orders (`pending` → `fulfilled`).
- Create a listing with `status: "active"` (API returns 400). Always draft → photos → activate.
- Rely on `village` in public listing cards (null unless owner/related buyer/admin).

---

## 8. Adding a new screen

1. Confirm the endpoint exists in [API_CONTRACT.md](./API_CONTRACT.md).
2. Add or extend `src/lib/api/*.ts` + `types.ts`.
3. Handle every error code listed for that endpoint.
4. Guard the page with `RequireAuth` and the correct `roles`.
5. If the backend changed the contract in the same PR, update types in the same commit.
