# Database Cutover Plan & API Route-to-Persistence Map

## 1. Cutover Strategy (Zero Data Loss, Reversible)
1. **Schema Provisioning:** Run `cd apps/api && alembic upgrade head` (`0001` through `0006`, using `CREATE INDEX CONCURRENTLY` in `0006` for zero write locks).
2. **Dry-Run Backfill & Count Verification:** Run `python -m scripts.backfill_legacy_jsonb_to_v2 --dry-run` to inspect legacy `intellischedule.app_state` (`legacy_academic_runtime`) counts without mutating any table.
3. **Transactional Backfill:** Run `python -m scripts.backfill_legacy_jsonb_to_v2` — idempotently copies departments, programs, courses, rooms, sections, timetable versions, sessions, makeup tasks, and polls into `intellischedule_v2.*` and verifies exact source-vs-target counts and zero FK orphans.
4. **Shadow Read & Dual-Instance Verification:** Point staging `apps/web` + 2 instances of `apps/api` at the migrated database; run multi-instance concurrency and Playwright E2E suites.
5. **Traffic Cutover & Rollback:** Switch Vercel `/api/*` rewrite to `apps/api` (`render.yaml`). Legacy `intellischedule.app_state` remains untouched for instant rollback if needed.

## 2. Complete `server.ts` Route-to-Persistence Map (102 Routes Audited)

| Line | Method | Endpoint | Current Persistence | Normalized v2 Target |
| :--- | :--- | :--- | :--- | :--- |
| L899 | `GET` | `/api/health/live` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L909 | `GET` | `/api/health/ready` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L938 | `POST` | `/api/test/reset-rate-limits` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L1030 | `POST` | `/api/auth/login` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1396 | `GET` | `/api/auth/me` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1428 | `POST` | `/api/auth/logout` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1479 | `PUT` | `/api/auth/profile` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1512 | `GET` | `/api/me` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L1557 | `GET` | `/api/me/timetable` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L1609 | `GET` | `/api/demo/status` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L1670 | `POST` | `/api/auth/demo-login` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1789 | `POST` | `/api/demo/reset` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L1824 | `POST` | `/api/academic/faculty/:id/availability` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L1857 | `POST` | `/api/auth/register` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1972 | `POST` | `/api/auth/verify-email` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1977 | `POST` | `/api/auth/resend-verification` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L1984 | `GET` | `/api/auth/google/status` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2021 | `GET` | `/api/auth/google/authorize` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2065 | `GET` | `/api/auth/google/callback` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2348 | `POST` | `/api/auth/forgot-password` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2349 | `POST` | `/auth/forgot-password` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L2354 | `GET` | `/api/auth/validate-token` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2372 | `POST` | `/api/auth/reset-password` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L2762 | `GET` | `/api/events/stream` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L2805 | `GET` | `/api/academic/bootstrap` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2820 | `GET` | `/api/students` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L2841 | `GET` | `/api/academic/departments` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2846 | `POST` | `/api/academic/departments` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2868 | `PUT` | `/api/academic/departments/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2878 | `DELETE` | `/api/academic/departments/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2889 | `GET` | `/api/academic/programs` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2894 | `POST` | `/api/academic/programs` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2917 | `PUT` | `/api/academic/programs/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2927 | `DELETE` | `/api/academic/programs/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2938 | `GET` | `/api/academic/courses` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2943 | `POST` | `/api/academic/courses` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L2995 | `PUT` | `/api/academic/courses/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3005 | `DELETE` | `/api/academic/courses/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3016 | `GET` | `/api/academic/faculty` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3021 | `POST` | `/api/academic/faculty` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3054 | `PUT` | `/api/academic/faculty/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3064 | `DELETE` | `/api/academic/faculty/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3075 | `GET` | `/api/academic/rooms` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3080 | `POST` | `/api/academic/rooms` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3109 | `PUT` | `/api/academic/rooms/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3119 | `DELETE` | `/api/academic/rooms/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3130 | `GET` | `/api/academic/groups` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3135 | `POST` | `/api/academic/groups` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3167 | `PUT` | `/api/academic/groups/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3177 | `DELETE` | `/api/academic/groups/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3188 | `POST` | `/api/academic/groups/bulk` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3213 | `POST` | `/api/academic/subgroups` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3226 | `DELETE` | `/api/academic/subgroups/:groupId/:subgroupId` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3238 | `GET` | `/api/academic/allocations` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3243 | `POST` | `/api/academic/allocations` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3273 | `PUT` | `/api/academic/allocations/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3283 | `DELETE` | `/api/academic/allocations/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3294 | `POST` | `/api/academic/import` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3355 | `POST` | `/api/academic/generate` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3356 | `POST` | `/api/timetable/generate` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3357 | `POST` | `/api/timetables/generate` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L3358 | `POST` | `/api/timetable/generate-engine` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3361 | `POST` | `/api/timetable/jobs` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3392 | `GET` | `/api/timetable/jobs/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3401 | `POST` | `/api/timetable/jobs/:id/apply` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3412 | `POST` | `/api/timetable/jobs/:id/cancel` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3422 | `POST` | `/api/timetable/select-routine` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3441 | `POST` | `/api/timetable/sessions` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3458 | `DELETE` | `/api/timetable/sessions/:id` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3464 | `PUT` | `/api/timetable/sessions/:id/lock` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3474 | `POST` | `/api/timetable/move` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3501 | `POST` | `/api/timetable/swap` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3526 | `POST` | `/api/timetable/approve` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3537 | `POST` | `/api/timetable/department-approval` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3565 | `POST` | `/api/timetable/publish` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3566 | `POST` | `/api/timetables/publish` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
| L3567 | `POST` | `/api/timetable/unpublish` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3573 | `GET` | `/api/timetable/versions` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3578 | `POST` | `/api/timetable/versions/:versionNumber/restore` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3588 | `GET` | `/api/timetable/benchmark` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3640 | `POST` | `/api/recovery/cancel-class` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3679 | `POST` | `/api/recovery/undo-cancel` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3693 | `POST` | `/api/recovery/request-change` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3718 | `POST` | `/api/recovery/schedule-makeup` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3799 | `POST` | `/api/recovery/decline` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3809 | `POST` | `/api/voting/polls` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3850 | `POST` | `/api/voting/polls/:id/close` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3876 | `POST` | `/api/voting/polls/:id/apply` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3884 | `POST` | `/api/voting/vote` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3910 | `GET` | `/api/notifications` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3935 | `POST` | `/api/notifications/:id/read` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L3995 | `GET` | `/api/audit` | Legacy JSONB (`supabaseStore` -> `intellischedule.app_state`) | `apps/api` normalized `intellischedule_v2.*` + Outbox |
| L4048 | `GET` | `/api/admin/pending-registrations` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4057 | `POST` | `/api/admin/pending-registrations/:email/approve` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4098 | `POST` | `/api/admin/pending-registrations/:email/reject` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4113 | `GET` | `/api/admin/users` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4174 | `POST` | `/api/admin/users` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4236 | `PATCH` | `/api/admin/users/:id` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4308 | `DELETE` | `/api/admin/users/:id` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4328 | `POST` | `/api/admin/users/:id/revoke-sessions` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4338 | `GET` | `/api/admin/sessions` | Hybrid (`intellischedule.users` / `sessions` / `pending_registrations`) | Supabase Auth JWKS + `intellischedule_v2.users` |
| L4398 | `GET` | `/` | Runtime / Health / SSE | `apps/api` `/health`, `/ready`, `/v1/ws/{institution_id}` |
