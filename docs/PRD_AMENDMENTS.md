# AgriConnect — PRD Amendments (Phase 0)

> **Date:** August 17, 2026
> **Status:** Binding for V1 implementation
> **Applies to:** [AgriConnect_PRD.md](./AgriConnect_PRD.md) (PRD v1.0)
> **Source of practices:** Full-Stack Project Blueprint v2.2 (`instruction.md`)

This document records **required clarifications** to the PRD before any application code is written. The PRD remains the product source of truth; where this file conflicts with the PRD on V1 scope or stack, **this file wins**.

---

## 1. Compliance verdict

The PRD is **strong and mostly aligned** with blueprint *practices*. It correctly keeps RBAC, Zod validation, JWT cookie auth, module-per-resource structure, security checklists, health/ready probes, and a phased V1→V2→V3 roadmap.

It also correctly **replaces** blueprint *defaults* that do not fit AgriConnect:

| Blueprint default | AgriConnect decision | Verdict |
|---|---|---|
| MongoDB Atlas + Mongoose | Supabase PostgreSQL + Prisma | Required; relational integrity for orders/listings |
| Vite + React SPA | Next.js App Router + Tailwind | Required by project kickoff |
| `express-mongo-sanitize` | Prisma parameterized queries + Zod | Correct; no Mongo injection surface |
| Cloudinary-first uploads | Express → Supabase Storage | Required |
| Socket.io from day one | Socket.io in V2 | Correct; V1 polls in-app notifications |
| FastAPI colocated | Separate V3 ML service | Correct |

**Do not** treat MongoDB examples, ObjectId language, or Vite env prefixes (`VITE_*`) as implementation instructions.

---

## 2. Amendments (must apply in V1)

### A1. Database provider is Supabase only

**PRD §10** lists Neon / Supabase / Railway Postgres as options.

**Amendment:** V1 uses **Supabase as the managed PostgreSQL provider** and **Supabase Storage** for listing photos. No Neon, no Railway Postgres, no MongoDB. The application path is:

```
Next.js → Express REST API → Prisma → Supabase PostgreSQL
```

The frontend must **never** query Supabase Postgres directly (no anon-key table access for app data).

### A2. API version prefix

**Kickoff examples** used `/api/listings`. **Blueprint** requires `/api/v1`.

**Amendment:** All application endpoints are under **`/api/v1`**. Health probes stay unversioned:

- `GET /health`
- `GET /ready`

### A3. Prisma lives with the backend

**Kickoff sketch** put `prisma/` at the repo root. **PRD §12** already places it under `backend/prisma/`.

**Amendment:** Schema, migrations, and seed live at **`backend/prisma/`**. There is no root `prisma/` directory. Reason: the backend teammate owns migrations; the frontend teammate never generates Prisma Client.

### A4. Money is never a JavaScript float

**Amendment:** `Listing.pricePerUnit` and `Order.priceTotal` are stored as Prisma **`Decimal`** (PostgreSQL `NUMERIC(12,2)`). API JSON serializes them as **strings** (e.g. `"25.00"`) so the frontend does not lose precision. Currency is INR. Do not store paise in V1 unless a later migration requires it.

### A5. Password reset is in V1

**PRD §6.1** requires password reset via email token.

**Amendment:** Contract includes:

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

Forgot-password always returns a generic success message (no email enumeration). Reset tokens are random 32-byte values, hashed before storage, TTL 1 hour.

### A6. Defer §14 scope that would blow V1

**PRD §14** adds multilingual UI, offline PWA, and phone OTP KYC as near-baseline.

**Amendment for V1:**

| Feature | V1 treatment |
|---|---|
| i18n / vernacular UI | Folder stub + English copy only. Hindi/Punjabi strings land in V1.1 or V2. |
| PWA / offline cache | Out of V1. |
| Phone OTP KYC | Out of V1. Admin sets `User.verified`. OTP in V2. |
| Voice input | Out of V1. |

Low-literacy **layout** (large tap targets, short copy) is still expected on farmer screens.

### A7. Google OAuth is out of V1

**PRD §10** lists optional Google OAuth via Passport.

**Amendment:** V1 is **email/password only**. Do not add Passport/Google env vars or callback routes until V2.

### A8. Language cleanup (Postgres, not Mongo)

Replace in all engineering docs and comments:

- “notifications collection” → **`notifications` table**
- MongoDB ObjectId → **UUID** (`uuid` primary keys)
- `MONGODB_URI` → **`DATABASE_URL` + `DIRECT_URL`**
- `express-mongo-sanitize` → **not used**
- `VITE_*` → **`NEXT_PUBLIC_*`** on the frontend

### A9. Listing `perishable` is required in V1

**PRD §11** includes `perishable`; **PRD §6.2** listing fields omit it; kickoff requires it.

**Amendment:** Create/update listing **requires** `perishable: boolean`. Default is not assumed by the API; the client must send it.

### A10. Refresh-token security (blueprint §6, unmodified)

**Amendment:** Implement the full refresh model:

- Access JWT: 15 minutes, `Authorization: Bearer` only
- Refresh token: 7 days, `HttpOnly; Secure; SameSite=Strict` cookie
- Store **bcrypt hash** of refresh token in `RefreshToken` table (never plaintext)
- **Rotate** on every `POST /api/v1/auth/refresh`
- Reuse of a revoked/rotated token → **revoke all** refresh tokens for that user (breach signal)
- Compare tokens with `crypto.timingSafeEqual` (via length-safe wrapper)
- Access token lives in **frontend memory only** — never `localStorage` / `sessionStorage`

### A11. Response envelope is mandatory

**Amendment:** Every JSON API response uses the blueprint envelope:

Success:

```json
{ "success": true, "data": { } }
```

Paginated success:

```json
{
  "success": true,
  "data": [],
  "pagination": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
}
```

Error:

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Human readable", "fields": {} }
}
```

`fields` is present only on `VALIDATION_ERROR`.

### A12. Ownership failures return 404

**Amendment:** If a user requests a resource they do not own (and they are not admin), return **404 `NOT_FOUND`**, never 403. Wrong **role** on a role-gated route returns **403 `FORBIDDEN`**. Missing/invalid auth returns **401**.

### A13. Soft delete on primary resources

**Amendment:** `User` and `Listing` support `deletedAt` (null = live). List/search queries exclude soft-deleted rows. Hard delete is admin-only or omitted in V1 (prefer `removed` listing status + soft delete).

### A14. Account lockout

**Amendment:** After **5** failed logins, lock the account for **15 minutes** (`failedLoginAttempts`, `lockedUntil`). Return a generic invalid-credentials message; do not reveal lockout vs wrong password in a way that helps enumeration beyond a generic `INVALID_CREDENTIALS` / `ACCOUNT_LOCKED` only if we already authenticated the email… **Use generic `INVALID_CREDENTIALS` for unknown email and wrong password. Use `ACCOUNT_LOCKED` only after a correct email match would otherwise proceed** — actually blueprint says generic messages to prevent enumeration.

**Locked-in rule:** unknown email, wrong password, and locked account all return **401** with code `INVALID_CREDENTIALS` and the same message, *except* if the account is locked we return **423** or **401** with `ACCOUNT_LOCKED` after the email is known to exist from a successful user lookup. To avoid enumeration, **always** return `INVALID_CREDENTIALS` for failed login, and `ACCOUNT_LOCKED` only when the password is correct but the account is locked — wait, that leaks existence.

**Final V1 rule (enumeration-safe):**

- Failed login (bad email, bad password, or locked): **401 `INVALID_CREDENTIALS`** with message `"Invalid email or password"`.
- Internally increment attempts and set `lockedUntil` when email exists.
- Suspended user who authenticates correctly: **403 `ACCOUNT_SUSPENDED`**.

### A15. Health probes excluded from strict rate limits

**Amendment:** `GET /health` and `GET /ready` are mounted **outside** `/api` global rate limits (or explicitly skipped). `/ready` checks Prisma/Postgres connectivity and returns 503 if down.

---

## 3. V1 vs later (do not build now)

| Capability | Phase |
|---|---|
| Socket.io chat, typing, read receipts | V2 |
| Reviews / ratings | V2 |
| Escrow payments (Razorpay/Stripe) | V2 |
| Logistics checkpoints, 3PL | V2 |
| Mandi price feeds (Agmarknet / e-NAM) | V2 |
| Docker + GitHub Actions CI (minimal CI may land late V1; full pipeline V2) | V2 |
| Winston + Sentry production wiring | V2 preferred; V1 may log via console/Winston without Sentry DSN |
| Agronomist / FPO roles as first-class RBAC | V2+ (schema reserves `fpoId`; enum may include future roles unused) |
| CV disease detection, NLP chatbot, soil IoT | V3 |
| Blockchain traceability | V3 optional |

V1 **Role** enum: `FARMER | BUYER | ADMIN` only. Do not accept `AGRONOMIST` or `FPO` at registration.

---

## 4. What the PRD already got right (do not regress)

- Farmer / Buyer / Admin from day one
- JWT 15m / 7d lifetimes
- Listing and order state machines
- Admin moderation + activity log
- In-app + email notifications (poll on load in V1)
- Farmer/buyer/admin basic reports
- Acceptance criteria in PRD §6.7
- Version Safety Rule: never copy versions from docs into `package.json`
- DPDP-aligned `GET /api/v1/users/me/export`
- Region-level location on public listings; no exact GPS in V1

---

## 5. Recommended PRD text patches (for the next PRD revision)

When the PRD is next edited, apply:

1. §10 Database row → “PostgreSQL hosted by Supabase (required).”
2. §6.2 listing fields → add `perishable`.
3. §6.5 → “`notifications` table”, not collection.
4. §12 → remove any implication of Mongo; keep `backend/prisma/`.
5. §9 i18n → “English in V1; i18n stub; additional locale in V2.”
6. §14.6 OTP → “V2; V1 uses admin `verified` flag.”

Until then, **this amendments file is authoritative for engineers.**
