# IntelliSchedule v2 — Low-Level Design (LLD) & Database Architecture

## 1. Database Architecture (PostgreSQL + Forced Tenant RLS)

All v2 entities live in the isolated `intellischedule_v2` schema with `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` enforced on every table via `current_setting('app.institution_id', true)::uuid`.

### 9 Normalized Data Domains (`migrations/versions/0001` – `0004`)
1. **Institution Data:** `institutions`, `academic_years`
2. **Academic Data:** `departments`, `programs`, `courses`, `sections`
3. **People Data:** `users` (supports `SUPER_ADMIN`, `COLLEGE_ADMIN`, `COORDINATOR`, `HOD`, `FACULTY`, `CLASS_REPRESENTATIVE`/`CR`, `STUDENT`)
4. **Resource Data:** `rooms`, `time_slots`, `availability_blocks`
5. **Scheduling Data:** `timetable_versions`, `timetable_sessions`
6. **Operational Data:** `makeup_tasks`, `recovery_opportunities`
7. **Academic Tracking:** `syllabus_progress`
8. **Communication:** `polls`, `poll_votes`, `notifications`
9. **Governance & Reliability:** `audit_logs`, `event_outbox`, `idempotency_keys`

### Database-Level Hard Constraint Enforcement
`0004_complete_v2_lld_schema.py` enforces zero double-booking directly in PostgreSQL using partial unique indexes on `timetable_sessions` (excluding `CANCELLED` rows):
- `tt_sessions_no_faculty_clash_uq (institution_id, version_id, faculty_user_id, slot_id)`
- `tt_sessions_no_room_clash_uq (institution_id, version_id, room_id, slot_id)`
- `tt_sessions_no_section_clash_uq (institution_id, version_id, section_id, slot_id)`

## 2. Low-Level Design (LLD) & System Design Modules (`apps/api/app/lld/`)
- **API Gateway Rate Limiting (`rate_limiter.py`):** O(1) bounded LRU token-bucket limiter emitting `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`.
- **Caching & Tag Invalidation (`cache.py`):** O(1) LRU+TTL cache with tag invalidation for hot timetable/catalog reads.
- **Fault Tolerance (`resilience.py`):** 3-state Circuit Breaker (`CLOSED -> OPEN -> HALF_OPEN`) protecting external identity/provider calls.
- **Idempotency (`idempotency.py`):** `Idempotency-Key` SHA-256 payload-hash verification preventing duplicate writes on retries.
- **Impact Analysis & What-If Simulator (`impact_simulator.py`):** Entity dependency graph + locked-session incremental re-optimization comparing V1 vs V2 health and stability scores.
- **Transactional Outbox Worker (`worker.py`):** `FOR UPDATE SKIP LOCKED` polling with exponential backoff and dead-letter queue (`DEAD_LETTER`) after 5 failed attempts.
- **Realtime Pub/Sub (`realtime.py`):** Tenant-partitioned WebSocket hub for live cancellation and publish broadcasts.
