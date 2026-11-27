# API

JSON over HTTPS, same origin as the web app, under `/api`. Defined in `server.ts` (data endpoints) and `src/server/auth.ts` (auth and user admin).

## Conventions

- **Authentication**: httpOnly session cookie `tt_session`, set by the sign-in endpoints. There are no bearer tokens and the token is never returned in a response body. Clients must send cookies (`credentials: 'same-origin'`).
- **Cross-site protection**: non-GET requests to `/api` with an `Origin` header must come from the same host or from `APP_URL`; otherwise 403. Requests without `Origin` (e.g. curl) are allowed.
- **Bodies**: `application/json`, at most 10 MB (413 above that; 400 for malformed JSON). Unknown fields in academic entities are dropped; wrong types are rejected (`src/server/validate.ts`).
- **Responses**: most endpoints return `{ "success": true, ... }`. Errors return:

  ```json
  { "success": false, "message": "Readable reason." }
  ```

  Guards add `"error": "UNAUTHENTICATED"` (401) or `"error": "FORBIDDEN"` (403). Login rate limiting also sets `Retry-After`. Unknown `/api` paths return 404 JSON.
- **Writes are durable**: a successful response to a data write means it is committed to Postgres.
- **Caching**: `/api/academic/bootstrap` and the health endpoints send `Cache-Control: no-store`.

| Status | Meaning here |
| --- | --- |
| 200 / 201 | OK / created |
| 400 | Invalid input, missing field, malformed JSON |
| 401 | Not signed in, or wrong email/password |
| 403 | Role not allowed, not your item, account locked, cross-site request, demo mode off |
| 404 | Unknown record or path |
| 409 | Duplicate, record still in use, already cancelled/voted/decided, slot no longer free, or data changed by another server instance (reload and retry) |
| 413 | Body larger than 10 MB |
| 422 | Breaks a hard constraint (move, swap, add, select, approve, publish), or Excel import rejected |
| 429 | Rate limited |
| 500 | Unexpected error (details only in server logs) |
| 503 | Change could not be saved, or database not ready |

## Endpoints

Roles per endpoint: [permissions.md](permissions.md).

**Health** (no auth): `GET /api/health/live` -> `{"status":"LIVE"}`; `GET /api/health/ready` -> `{"status":"READY"}` after `select 1` on the database, else 503 `{"status":"DATABASE_UNAVAILABLE"}`.

**Auth**
- `GET /api/auth/config`: `{ googleEnabled, demoEnabled, allowedDomains }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/demo-login` `{ roleKey: "Coordinator" | "Faculty" | "Student" | "Admin" | "HOD" }` (only when `DEMO_MODE` is on)
- `GET /api/auth/google/start`, `GET /api/auth/google/callback`: full-page redirect flow; errors come back as `/?auth_error=...`
- `GET /api/auth/me`, `POST /api/auth/logout`
- `PATCH /api/auth/profile` `{ name?, profile? }` (phone, office location/hours, specialization, notification preferences)
- `POST /api/auth/change-password` `{ currentPassword, newPassword }` (signs out other devices)
- `POST /api/auth/forgot-password`: same reply for every email; tells the user to use Google or ask an admin. No email is sent.

**User admin**: `GET|POST /api/admin/users`, `PATCH|DELETE /api/admin/users/:id`, `POST /api/admin/users/:id/revoke-sessions`, `GET /api/admin/sessions`.

**Reads**: `GET /api/me` (user + roster link), `GET /api/academic/bootstrap` (everything the UI needs), `GET /api/students?page&limit&search&sectionId`, `GET /api/audit?limit`, `GET /api/timetable/versions/:n`, `GET /api/timetable/benchmark` (runs the engine three times; once per 10 s per user).

**Academic data**: `POST /api/academic/{departments|programs|courses|faculty|rooms|groups|allocations}`, `PUT` and `DELETE .../:id`; `POST /api/academic/groups/bulk`; `POST /api/academic/subgroups`, `DELETE /api/academic/subgroups/:groupId/:subgroupId`; `PUT /api/academic/year`; `POST /api/academic/import` `{ parsedData, mode: "upsert" | "replace" }`; `POST /api/academic/constraints/:id/toggle`; `POST /api/academic/faculty-protected-slot` `{ day, periodId, reason?, facultyId? }`.

**Timetable**: `POST /api/academic/generate` `{ budgetMode?, timeBudgetMs?, routines? }`; `POST /api/timetable/select-routine` `{ versionNumber }`; `POST /api/timetable/move` `{ sessionId, targetDay, targetTimeSlotId, targetRoomId, reason? }`; `POST /api/timetable/swap` `{ sessionAId, sessionBId, reason? }`; `POST /api/timetable/sessions` (add a class); `POST /api/timetable/sessions/:id/lock` `{ reason? }` (toggles); `POST /api/timetable/status` `{ status: "Draft" | "Review" }`; `POST /api/timetable/approve`; `POST /api/timetable/publish`; `POST /api/timetable/versions/:n/restore`.

**Recovery, polls, notifications**: `POST /api/recovery/cancel-class` `{ sessionId, reason? }`; `POST /api/recovery/schedule-makeup` `{ opportunityId }`; `POST /api/recovery/decline` `{ opportunityId }`; `POST /api/voting/polls` `{ sectionId, courseId?, question, options[2..6] }`; `POST /api/voting/polls/:id/close`; `POST /api/voting/vote` `{ pollId, optionId }` (a voter may change their choice while the poll is active); `POST /api/notifications` `{ title, message, type?, category?, recipientRole? }` (10 per minute); `POST /api/notifications/:id/read`.

**Administrative / review**: `GET /api/admin/users`; `POST /api/admin/users`; `PATCH /api/admin/users/:id`; `DELETE /api/admin/users/:id`; `POST /api/admin/users/:id/revoke-sessions`; `GET /api/admin/sessions`; `POST /api/timetable/department-approval` (HOD department sign-off; does not replace final Admin approval).

## Target platform API (migration in progress)

The parallel FastAPI service lives under `apps/api`; it does not replace `/api` in the current Express app. It uses bearer access tokens from Supabase Auth, resolves role and tenant membership from `intellischedule_v2.users`, and returns 503 when its database is unavailable. All data writes commit before reporting success.

- `GET /v1/me`: verified active app identity.
- `GET /v1/academic/courses?search=&limit=&offset=`: tenant-scoped course catalog for Super Admin, College Admin, and Coordinator.
- `POST /v1/academic/courses`: create a course; the institution comes from the authenticated principal, never request data.
- `PATCH /v1/academic/courses/{id}`: update a tenant-owned active course.
- `DELETE /v1/academic/courses/{id}`: archive a tenant-owned course; it is retained for historical timetable references.

Course creation, updates, and archival append an `event_outbox` record in the same database transaction. Database RLS remains a second tenant boundary. HOD reads are not enabled in this API until department ownership is represented and enforced in the schema.

## Rate limits

In process memory, per instance, reset on restart.

| What | Limit |
| --- | --- |
| Password sign-in, per email | 10 attempts per 15 minutes (successful attempts count too) |
| Password sign-in, per IP; Google sign-in start, per IP (separate counters) | `LOGIN_RATE_LIMIT_PER_IP` per minute each (default 300; campus NAT puts many users behind one address) |
| Forgot password, per IP | 30 per minute |
| Change password, per user | 5 per 15 minutes |
| Post notification, per user | 10 per minute |
| Solver benchmark, per user | once per 10 seconds |

## Phase 1A target API: Academic course catalog

The isolated FastAPI service exposes institution-scoped course management under `/v1/academic/courses` (list/search/paginate, create, update, and soft archive). Access is limited to `SUPER_ADMIN`, `COLLEGE_ADMIN`, and `COORDINATOR`; faculty, HOD, and student accounts cannot manage the master catalog. Every query includes the active institution, and PostgreSQL forced RLS is an additional boundary. Create/update/archive writes and their `event_outbox` events commit atomically. Listing accepts `search`, `limit` (1–100), and `offset`. Duplicate institution course codes return 409; missing/cross-institution records return 404.
