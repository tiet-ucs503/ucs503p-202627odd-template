# IntelliSchedule — Enterprise University Management Architecture (HLD, LLD & ER)

## 1. High-Level Architecture (100,000+ Students / 10,000+ Teachers / 10,000+ Rooms)

```mermaid
flowchart TB
  subgraph Clients["Multi-Device Real-Time Clients (5+ Simultaneous Roles)"]
    D1[Super Admin Browser]
    D2[Coordinator Browser]
    D3[Faculty Browser]
    D4[CR Browser]
    D5[Student Browsers]
  end

  subgraph Edge["API Gateway & Real-Time Layer"]
    GW[HTTPS + Token-Bucket Rate Limiter + GZip + Idempotency]
    RT[Targeted SSE / WebSocket Hub with Last-Event-ID Replay]
  end

  subgraph Core["Modular Domain Services"]
    ID[Identity & RBAC]
    ACAD[Academic & Resource Catalog]
    SCHED[Scheduling Engine: Validation -> Conflict Graph -> DSatur/CP-SAT -> Health]
    MAKEUP[Makeup Request, Voting & Approval Engine]
    ATT[Attendance & Exam Services]
    FIN[Idempotent Finance & Payments]
    NOTIF[Targeted Notification Dispatcher]
  end

  subgraph Data["Persistence & Async Messaging"]
    PG[(PostgreSQL 16 + Forced Tenant RLS + Partial Unique Indexes)]
    CACHE[(Tagged LRU / Redis Cache)]
    OUTBOX[(Transactional Outbox + SKIP LOCKED Worker + DLQ)]
  end

  Clients --> GW & RT
  GW --> ID & ACAD & SCHED & MAKEUP & ATT & FIN
  SCHED & MAKEUP & ATT & FIN --> PG
  PG --> OUTBOX --> NOTIF --> RT
  ACAD & SCHED --> CACHE
```

## 2. Entity-Relationship Diagram (Normalized 9-Domain Schema, Migrations 0001–0005)

```mermaid
erDiagram
  INSTITUTIONS ||--o{ USERS : employs_enrolls
  INSTITUTIONS ||--o{ DEPARTMENTS : organizes
  DEPARTMENTS ||--o{ PROGRAMS : offers
  PROGRAMS ||--o{ SECTIONS : groups
  INSTITUTIONS ||--o{ COURSES : catalogs
  INSTITUTIONS ||--o{ ROOMS : manages
  INSTITUTIONS ||--o{ TIME_SLOTS : defines
  INSTITUTIONS ||--o{ TIMETABLE_VERSIONS : versions
  TIMETABLE_VERSIONS ||--o{ TIMETABLE_SESSIONS : contains
  TIMETABLE_SESSIONS ||--o{ ATTENDANCE_SESSIONS : generates
  ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : tracks
  TIMETABLE_SESSIONS ||--o{ MAKEUP_TASKS : triggers_on_cancel
  MAKEUP_TASKS ||--o{ RECOVERY_OPPORTUNITIES : matches
  SECTIONS ||--o{ POLLS : votes_on
  POLLS ||--o{ POLL_VOTES : records
  POLLS ||--o{ MAKEUP_VOTE_AUDIT : audits
  EXAMINATIONS ||--o{ EXAM_SESSIONS : schedules
  EXAM_SESSIONS ||--o{ EXAM_MARKS : grades
  FEE_STRUCTURES ||--o{ INVOICES : bills
  INVOICES ||--o{ PAYMENT_TRANSACTIONS : settles_idempotently
  INSTITUTIONS ||--o{ APPROVAL_REQUESTS : governs
  APPROVAL_REQUESTS ||--o{ WORKFLOW_HISTORY : audits
  INSTITUTIONS ||--o{ EVENT_OUTBOX : emits
```

## 3. Sequence Diagram — Makeup Request -> Multi-Device Student Voting -> Conflict-Checked Approval -> Attendance

```mermaid
sequenceDiagram
  participant CR as CR / Teacher (Device 3)
  participant API as Centralized Backend
  participant DB as PostgreSQL (ACID + Unique Indexes)
  participant HUB as Targeted SSE/WS Hub
  participant STU as Students (Devices 4 & 5)
  participant COORD as Coordinator (Device 2)

  CR->>API: POST /api/voting/polls (proposed slots + deadline)
  API->>DB: Persist poll + Outbox event
  API->>HUB: Push MAKEUP_POLL_CREATED (Section-scoped only)
  HUB-->>STU: Live notification + Poll card appears
  STU->>API: Concurrent POST /api/voting/vote (1 vote/student, auditable)
  API->>DB: Atomic vote update + audit record
  HUB-->>COORD: Live vote tally updates
  COORD->>API: POST /api/voting/polls/:id/apply
  API->>DB: Re-validate teacher/room/section conflicts -> Insert Makeup Session + Attendance Session
  API->>HUB: Push TIMETABLE_PUBLISHED + MAKEUP_CONFIRMED (Section-scoped)
  HUB-->>STU: Timetable + Inbox update automatically without refresh
```

## 4. Applied Design Patterns & Concurrency Controls
- **Repository & Service Layers:** Clear separation between PostgreSQL persistence (`models.py`, `supabaseStore.ts`) and domain orchestration (`solver.py`, `university_engine.py`).
- **Strategy Pattern:** Pluggable scheduling optimization (`DSatur` + optional `OR-Tools CP-SAT`) and recovery matching (`CROSS_CANCELLATION`, `SAME_DAY`, `FUTURE_SLOT`).
- **Observer / Pub-Sub Pattern:** `TargetedNotificationHub` & `/api/events/stream` SSE hub with role/section authorization and `Last-Event-ID` reconnect replay.
- **Transactional Outbox + SKIP LOCKED + DLQ:** Guaranteed at-least-once event dispatch (`worker.py`) with exponential backoff and dead-lettering after 5 attempts.
- **Database Hard-Constraint Uniqueness:** Partial unique indexes (`tt_sessions_no_faculty_clash_uq`, `tt_sessions_no_room_clash_uq`, `tt_sessions_no_section_clash_uq`, `att_records_unique_student_session`, `payment_tx_idempotency_uq`) prevent double-booking, duplicate attendance, and duplicate payment callbacks even under concurrent load.
