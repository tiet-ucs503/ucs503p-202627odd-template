# ClassPulse — Team Handbook & Viva Prep

> One document to understand the whole project: what it is, what it uses, how the
> pieces connect, what each file does, and the questions an examiner is likely to ask.
>
> Keep this file updated when the architecture changes.

---

## 1. ClassPulse in one paragraph

ClassPulse is a **real-time classroom engagement platform** for a university course.
Instructors use a **Next.js web dashboard** to create classroom sections, project a
**rotating 3-QR attendance stream**, launch **PulseMeter** polls (word cloud, MCQ,
rating scale), run **live MCQ quizzes** with a leaderboard, and moderate a
**pseudonymous doubt forum**. Students use either the **installable student PWA** or a
**native Flutter Android app** to join a section with a 6-character code, scan the QR
stream to mark attendance, answer live activities, take quizzes, and post doubts.
A **Node.js + Express + Socket.io** backend exposes a REST API and WebSocket events,
stores durable data in **PostgreSQL (Neon)**, and uses **Redis (Upstash)** only as a
short-lived cache for QR tokens.

The core anti-proxy idea: one QR code is easy to photograph and forward. ClassPulse
projects **three different signed QR frames in rotation**; the student app must capture
all three from the same batch within a **10-second freshness window** before the server
accepts attendance.

---

## 2. Tech stack at a glance

| Layer | Technology | Why it is used |
|---|---|---|
| Instructor web | **Next.js 14 (App Router)**, **React 18**, **TypeScript** | File-based routing, SSR/CSR mix, one codebase for dashboard + student PWA |
| UI library | **Material UI (MUI) v5** + custom M3 tokens | Consistent Material 3 light-mode design |
| Charts | **Recharts** | Attendance trends, ACL latency, live poll/quiz charts |
| Student PWA | Next.js route group `/student`, **manifest + service worker** | Installable on iOS/Android without App Store |
| QR scanning (web) | **barcode-detector** (ZXing WASM ponyfill), self-hosted `zxing_reader.wasm` | Works offline and without a CDN |
| Mobile app | **Flutter 3.29 / Dart 3.7**, `mobile_scanner`, `fl_chart`, `http`, `shared_preferences` | Native Android student app |
| Backend | **Node.js 20**, **Express 4**, **CommonJS** | Simple REST API and middleware model |
| Real time | **Socket.io 4** | Live roster, poll results, quiz state, activity launch/end |
| Database | **PostgreSQL** (Neon in production) | Relational data, constraints, transactions, full-text search |
| Cache | **Redis** (Upstash) with in-memory fallback | Holds rotating QR token batches for 15 s |
| Auth | **JWT** (7-day) + **bcryptjs** | Stateless API auth, password hashing |
| Email | **Brevo API → Resend API → SMTP (nodemailer) → simulation** | Low-attendance warning emails |
| Files/exports | **exceljs** (XLSX), custom CSV writer | Attendance matrix export |
| Testing | **Node test runner** (backend), **Vitest + jsdom** (web), **flutter_test** | Unit/integration tests |
| CI/CD | **GitHub Actions** | Backend tests, web tests + build, Flutter analyze/test/APK |
| Hosting | **Render** (backend), **Vercel** (web), **Neon** (DB), **Upstash** (Redis) | Free-tier cloud deployment |

---

## 3. High-level architecture

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  Instructor Web (Next.js)│        │ Student PWA (Next.js)    │
│  http://localhost:3000   │        │ http://localhost:3000/   │
│  MUI dashboard           │        │ student                  │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │  REST (fetch + Bearer JWT)        │
             │  Socket.io (JWT in handshake)      │
             └──────────────┬────────────────────┘
                            │
                ┌───────────▼────────────┐
                │  Backend (Node/Express)│
                │  Render · port 4000    │
                │  REST + Socket.io      │
                └───┬───────────────┬────┘
                    │               │
       ┌────────────▼───┐     ┌─────▼─────────────┐
       │ PostgreSQL     │     │ Redis (Upstash)   │
       │ Neon           │     │ QR batch cache    │
       │ durable data   │     │ 15 s TTL + memory │
       └────────────────┘     └───────────────────┘

┌──────────────────────────┐
│ Flutter Android app      │  same REST API + Socket.io
│ Student (mobile_scanner) │
└──────────────────────────┘
```

**Three-tier architecture:** presentation (web/PWA/Flutter) → application (Express
routes + services + Socket.io) → data (PostgreSQL + Redis).

**Monorepo layout:**

```
classpulse-1/
├── backend/      Node + Express REST & Socket.io API
├── web/          Next.js instructor dashboard + student PWA
├── mobile/       Flutter Android student app
├── .github/      CI workflow
├── README.md     setup and feature overview
├── DEPLOYMENT_GUIDE.md
├── TEST_CASES.md
└── HANDBOOK.md   this file
```

---

## 4. Backend: entry point and request lifecycle

### `backend/src/index.js` — the spine

1. Loads `.env` with `dotenv`.
2. **Fails fast** if `DATABASE_URL`, `JWT_SECRET`, or `QR_HMAC_SECRET` is missing.
3. Creates an HTTP server and attaches **Socket.io** to it.
4. Configures **CORS** from a comma-separated allowlist (`CORS_ORIGINS`).
5. Parses JSON bodies with a **200 KB limit**.
6. Calls `db.initDb()` to run `schema.sql` (idempotent `CREATE TABLE IF NOT EXISTS`).
7. Starts Redis connection and a **stale-session sweep** every 5 minutes.
8. Mounts all route modules.
9. Adds `/health`, a JSON 404 handler, and a final error handler that never leaks
   stack traces.
10. Handles `SIGTERM`/`SIGINT` for graceful shutdown.

### Request path for a normal REST call

```
Browser/Flutter
  → CORS check
  → express.json()
  → route module (e.g. /attendance)
  → authenticateToken (JWT verify)
  → requireRole(...) (teacher/student)
  → ownership/enrollment checks (utils/access.js)
  → parameterized SQL via db.query()
  → optional Socket.io broadcast
  → JSON response
```

### Why the server still starts if the DB is down

`db.initDb()` is called with `.catch(...)`, and `/health` probes the DB with a 3-second
timeout. This lets a hosting platform report `503 degraded` instead of crashing the
process.

---

## 5. Backend file-by-file cheat sheet

### Core

| File | Responsibility |
|---|---|
| `src/index.js` | App bootstrap, CORS, route mounting, `/health`, 404/error handlers, graceful shutdown |
| `src/db/index.js` | PostgreSQL `Pool`, SSL handling, `initDb()` runs `schema.sql`, `healthCheck()` |
| `src/db/schema.sql` | Full schema + seed courses + indexes (idempotent) |
| `src/redis/index.js` | ioredis client, 3 s connect / 2 s command timeouts, in-memory fallback, `/health` status |
| `src/socket.js` | Authenticated Socket.io server, room joins with DB authorization |
| `src/middleware/auth.js` | `authenticateToken`, `requireRole`, exports `JWT_SECRET` |
| `src/middleware/rateLimit.js` | Dependency-free fixed-window in-memory rate limiter |
| `src/utils/access.js` | `isEnrolled`, `isClassroomTeacher`, `canAccessClassroom`, `isCourseMember`, `resolveDoubtAccess` |
| `src/utils/pseudonym.js` | Deterministic HMAC-based per-course pseudonyms |
| `src/utils/profanityFilter.js` | Leetspeak normalization, repeat collapsing, whole-token matching |
| `src/services/qrTokenService.js` | 3-QR generation, HMAC signing, validation, attendance insert, ACL |
| `src/services/sessionLifecycle.js` | Auto-end sessions older than `SESSION_MAX_HOURS` (default 4 h) |
| `src/services/exportService.js` | Attendance matrix CSV/XLSX generation |
| `src/services/emailService.js` | Warning email with Brevo → Resend → SMTP → simulation fallback |

### Routes

| Route file | Mounted at | Main endpoints |
|---|---|---|
| `auth.js` | `/auth` | `POST /signup`, `POST /login`, `GET /me` |
| `courses.js` | `/courses` | `GET /` (seeded catalog) |
| `classrooms.js` | `/classrooms` | create, regenerate join code, join, mine, summary, roster, delete, leave |
| `sessions.js` | `/sessions` | start, end, active-mine, get by id, active-tokens |
| `attendance.js` | `/attendance` | scan, session roster, classroom summary, student drill-down, me, override, export, send-warnings |
| `pulsemeters.js` | `/pulsemeters` | create, list, launch, update, delete |
| `liveActivities.js` | `/live-activities` | history, end, respond, analytics, word-cloud submissions, approve/delete response, active, quiz start/answer/reveal/leaderboard/end/results |
| `wordCloudMutes.js` | `/word-cloud-mutes` | create mute, list mutes, remove mute |
| `quizzes.js` | `/quizzes` | create (transactional), list, launch, delete |
| `doubts.js` | `/doubts` | list, create, detail, reply, reveal author, helpful toggle, accept solution, endorse, edit, delete |
| `topics.js` | `/courses` | `GET/POST /:course_id/topics` |
| `search.js` | `/search` | full-text + ILIKE search with access scoping |

> `topics.js` and `courses.js` are both mounted at `/courses`; Express merges their
> routes.

---

## 6. Database model

### Tables (20)

**Identity & classrooms**

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id` UUID, `email` unique, `password_hash`, `full_name`, `role` (`teacher`/`student`) | `CHECK` on role |
| `courses` | `id`, `course_code` unique, `course_name` | Seeded catalog (`UCS503P`, `UCS405`, `UCS301`, `UCS507`) |
| `classrooms` | `course_id`, `teacher_id`, `section_name`, `join_code` unique | A section of a course taught by a teacher |
| `enrollments` | `classroom_id`, `student_id`, `joined_at` | `UNIQUE(classroom_id, student_id)` |

**Attendance**

| Table | Key columns | Notes |
|---|---|---|
| `sessions` | `classroom_id`, `started_at`, `ended_at` | `ended_at IS NULL` = live |
| `attendance_records` | `session_id`, `student_id`, `scan_started_at`, `validated_at`, `status`, `is_manual` | `UNIQUE(session_id, student_id)` prevents duplicates |

**Live activities**

| Table | Key columns | Notes |
|---|---|---|
| `live_activities` | `classroom_id`, `activity_type` (`PULSEMETER`/`QUIZ`), `activity_ref_id`, `status`, `attendance_session_id`, `attendance_pending`, `title_snapshot`, `config_snapshot` | Partial unique index allows **one ACTIVE activity per classroom** |
| `pulsemeters` | `classroom_id`, `created_by`, `title`, `type`, `config` JSONB | Reusable template |
| `pulsemeter_responses` | `live_activity_id`, `student_id`, `response_value`, `is_blocked` | `UNIQUE(live_activity_id, student_id)` = one response |
| `word_cloud_mutes` | `student_id`, `classroom_id`, `muted_by`, `muted_until` | Duration 7/14/30/90/180 days |
| `quizzes` | `classroom_id`, `created_by`, `title`, `scoring_mode` (`WIDE`/`NARROW`) | Reusable template |
| `quiz_questions` | `quiz_id`, `question_text`, `options` JSONB, `correct_option_id`, `order_index`, `time_limit_seconds` | 2–6 options, 5–120 s |
| `quiz_responses` | `live_activity_id`, `question_id`, `student_id`, `selected_option_id`, `is_correct`, `response_time_ms`, `score_awarded` | `UNIQUE(live_activity_id, question_id, student_id)` |
| `activity_question_states` | `live_activity_id`, `question_id`, `started_at_ms`, `ends_at_ms`, `revealed` | Durable server-authoritative quiz timer |

**Doubt forum & search**

| Table | Key columns | Notes |
|---|---|---|
| `course_topics` | `course_id`, `name` | `UNIQUE(course_id, name)` |
| `pseudonym_assignments` | `user_id`, `course_id`, `pseudonym` | `UNIQUE(user_id, course_id)` |
| `doubt_posts` | `course_id`, `classroom_id`, `topic_id`, `author_id`, `audience_scope`, `title`, `body`, `is_anonymous`, `pseudonym`, `status`, `helpful_count`, `search_vector` | Scope `APP`/`COURSE`/`CLASSROOM`; status `OPEN`/`RESOLVED`/`FLAGGED` |
| `doubt_replies` | `doubt_post_id`, `author_id`, `body`, `is_anonymous`, `is_teacher_endorsed`, `is_solution`, `helpful_count` | Only one accepted solution per post (enforced in code) |
| `doubt_helpful_marks` | `user_id`, `target_type`, `target_id` | `UNIQUE(user_id, target_type, target_id)` stops double voting |
| `doubt_moderation_flags` | `target_type`, `target_id`, `reported_by`, `reason`, `status` | Reporting table for moderation |

### Relationships (simplified ER)

```
users 1─┬─< classrooms >─ courses
        ├─< enrollments >─ classrooms
        ├─< sessions >─ classrooms
        ├─< attendance_records >─ sessions, users
        ├─< pulsemeters / quizzes
        ├─< doubt_posts / doubt_replies / helpful_marks
        └─< pseudonym_assignments >─ courses

classrooms 1─< sessions 1─< attendance_records
classrooms 1─< live_activities >─ pulsemeters | quizzes
live_activities 1─< pulsemeter_responses
live_activities 1─< quiz_responses >─ quiz_questions
live_activities 1─< activity_question_states
```

### Important indexes

- `one_active_activity_per_classroom` — partial unique index on `live_activities(classroom_id) WHERE status = 'ACTIVE'`.
- `idx_doubt_posts_search_gin` — GIN index on the generated `search_vector` tsvector.
- `idx_attendance_records_student`, `idx_sessions_classroom_started`, `idx_enrollments_student`.
- `idx_live_activities_history` for activity history pagination.

---

## 7. Feature deep dives

### 7.1 Authentication and roles

- **Signup** (`POST /auth/signup`): validates email, name (≤120), password (≥8),
  role. Teacher signup is gated by `TEACHER_INVITE_CODE` (required in production).
  Password hashed with `bcryptjs` (salt rounds 10). Returns a **JWT valid 7 days**
  containing `id`, `email`, `role`, `full_name`.
- **Login** (`POST /auth/login`): looks up by normalized email, `bcrypt.compare`,
  issues JWT.
- **Protected routes** use `authenticateToken` (reads `Authorization: Bearer <token>`)
  and `requireRole('teacher'|'student')`.
- **Web dashboard** is instructor-only (`/login` rejects student accounts and points
  them to `/student`). Students use `/student/login` or the Flutter app.
- Toasts/errors: `401` missing token, `403` invalid/expired token or wrong role.

**Why JWT?** Stateless auth: the server does not need a session table, and the same
token authorizes both REST calls and the Socket.io handshake. Trade-off: a token
cannot be revoked before expiry (mitigated by a 7-day lifetime; a production system
could add a refresh/denylist).

### 7.2 Classrooms and enrollment

- Teacher creates a section from the seeded course catalog (`POST /classrooms`).
- Server generates a **6-character join code** from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
  (ambiguous `I`, `O`, `0`, `1` excluded), using `crypto.randomBytes`; 32 characters
  divide 256 evenly, so modulo is unbiased. Uniqueness is checked and retried.
- Student joins with `POST /classrooms/join`; duplicate enrollment returns `409`.
- `GET /classrooms/mine` returns role-specific cards with micro-metrics: student count,
  quiz count, PulseMeter count, open/resolved doubts, attendance average.
- **Attendance percentage is enrollment-aware:** sessions held before a student joined
  are excluded from that student's denominator (shown as `N/A`, not absent).
- Teacher can regenerate the join code, view the roster, remove a student, or delete
  the classroom (cascade in a transaction).
- Students never receive the join code back from the API; it is an enrollment secret.

### 7.3 Anti-proxy QR attendance (the flagship feature)

**Generation** — `backend/src/services/qrTokenService.js`

1. Server creates a `batch_id` (UUID) and one `timestamp`.
2. It generates **3 tokens** with `seq_idx` 0, 1, 2. Each token has a random
   `token_id` and an **HMAC-SHA256** signature over:
   `sessionId:batchId:seqIdx:timestamp:tokenId` using `QR_HMAC_SECRET`.
3. The compact QR payload is JSON: `{s, b, i, t, k, h}` (session, batch, index,
   timestamp, token id, hash) — small enough for a low-density, readable QR.
4. The whole batch is cached in Redis under `session:<id>:batch:<batchId>` with a
   **15-second TTL**, and `latest_batch` points to it.
5. Batches are reused for **4 seconds** (`BATCH_REUSE_MS`) so polling does not rotate
   the projector faster than students can scan. The reuse window is deliberately
   different from the client polling interval to avoid serving an almost-expired batch.

**Display** — `web/src/components/LiveSessionModal.tsx`

- Fullscreen projector shows one large QR at a time and cycles through frames 0 → 1 → 2
  at a configurable speed (800 ms / 300 ms / 100 ms).
- Also shows the live roster, present count, and ACL badges via Socket.io.

**Scanning** — `web/src/lib/qr/*` and `mobile/lib/screens/qr_scanner_screen.dart`

- Camera runs a throttled decode loop (~8–10 fps, frames capped at 960 px) using
  ZXing WASM.
- A `FrameAccumulator` keeps frames keyed by `batch_id` and `seq_idx`. A new batch
  resets the buffer; duplicate indices are ignored; submission only when 0, 1, and 2
  from the **same batch** are present.
- The client records `scan_started_at` when it sees the first frame of the batch.

**Validation** — `validateAndMarkAttendance()` performs 11 ordered checks:

1. Exactly 3 tokens.
2. Sequence order is 0, 1, 2.
3. All tokens share the same `session_id` and `batch_id`.
4. Freshness: token age ≤ **10 s** (allows −2 s clock drift).
5. HMAC signature matches for every token.
6. Batch still exists in Redis (not rotated out).
7. Session exists in the DB.
8. Session has not ended.
9. Student is enrolled in that classroom.
10. Student has not already marked attendance (also protected by a DB unique
    constraint to close the check-then-insert race).
11. `scan_started_at` is not in the future; ACL is computed as
    `validated_at − max(scan_started_at, token_timestamp)` and stored.

**Why this resists proxies:** a screenshot is one frame; the server needs three
ordered frames from the same batch. A forwarded screenshot goes stale within 10 s.
The HMAC signature prevents forged tokens. Even a screen-shared live video would have
to deliver all three frames inside the window, and the teacher can rotate faster.

**Attendance Capture Latency (ACL):** client-observed scan start → server validation
time, in milliseconds. It is a UX/performance metric, not a security check. Manual
teacher overrides set `is_manual = TRUE` and are excluded from ACL averages.

### 7.4 Attendance analytics, override, export, warnings

- `GET /attendance/session/:id` — live roster with per-student ACL.
- `GET /attendance/classroom/:id/summary` — sessions, per-student percentages,
  class average, overall ACL.
- `GET /attendance/classroom/:id/student/:studentId` — drill-down with `eligible`
  flag so pre-enrollment sessions are not counted as absences.
- `GET /attendance/me` — student's own summary and records.
- `POST /attendance/override` — teacher marks PRESENT/ABSENT; rejects sessions held
  before the student enrolled; `ON CONFLICT` upsert keeps an existing real scan's
  timestamps.
- `GET /attendance/classroom/:id/export?format=csv|xlsx` — matrix of students ×
  sessions with `P`/`A`/`N/A`, totals, percentage, eligibility. CSV cells starting
  with `= + - @` are prefixed with `'` to prevent **spreadsheet formula injection**.
- `POST /attendance/classroom/:id/send-warnings` — emails students below a threshold
  (default 75%), rate-limited to 3 requests per 10 minutes. Email providers fall back
  in order: Brevo → Resend → SMTP → console simulation.

### 7.5 PulseMeter (live polls)

- Teacher authors a reusable template: `WORD_CLOUD`, `MCQ`, or `RATING_SCALE`
  (`POST /pulsemeters`). Config is validated and stored as JSONB.
- Launch (`POST /pulsemeters/:id/launch`) creates a `live_activities` row with
  `title_snapshot` and `config_snapshot`, so editing/deleting the template later does
  not break history. The partial unique index blocks a second active activity.
- **Present-vs-responded linking:** if a session ended within
  `ATTENDANCE_LINK_WINDOW_HOURS` (default 12), the activity links to it. Otherwise it
  sets `attendance_pending = TRUE`; when the teacher later ends an attendance session,
  pending activities in that classroom are linked.
- Student submits `POST /live-activities/:id/respond`:
  - must be enrolled and activity must be ACTIVE;
  - WORD_CLOUD: max 60 chars, checked by the profanity filter, and muted students
    are blocked;
  - MCQ: option id must exist;
  - RATING_SCALE: value within min/max;
  - unique constraint prevents a second response.
- Results are aggregated server-side and emitted to the **teacher-only** room
  `activity_<id>_teacher` as `pulsemeter:results` and `activity:response_count`.
- Teacher can approve an auto-blocked word or delete a submission.
- Word-cloud mutes last 7/14/30/90/180 days.

### 7.6 Live quizzes and scoring

- Teacher authors a quiz transactionally: quiz row + questions in one transaction
  (`BEGIN`/`COMMIT`/`ROLLBACK`). Each question has 2–6 options, one correct option,
  and a 5–120 s timer.
- Launch snapshots title, scoring mode, and questions into `config_snapshot`.
- **Server-authoritative timer:** starting a question writes
  `activity_question_states` (`started_at_ms`, `ends_at_ms`). Students cannot choose
  their own timer; late answers are rejected. State survives a server restart.
- **Scoring** (`POST /live-activities/:id/quiz/answer`):
  - Let `T` = time limit, `t` = response time in seconds, and
    `f = clamp((T − t) / T, 0, 1)`.
  - **WIDE** (default): `300 + 700·f` → 300–1000 points.
  - **NARROW**: `700 + 300·f` → 700–1000 points.
  - Wrong answer: `0`.
  - Score is computed on the server from the server clock.
- Correct answers are **never sent to students before reveal**. `show-results`
  computes the option distribution, marks the question revealed, broadcasts
  `quiz:question_results` with the correct option and cumulative leaderboard.
- Leaderboard: sum of `score_awarded` per student. Students do not see other
  students' emails.
- Ending the quiz broadcasts `quiz:ended` with final leaderboard and top-3 podium.

### 7.7 Doubt forum

- Three audience scopes:
  - **APP** — any authenticated user can view.
  - **COURSE** — members of the course (teacher who teaches it, or enrolled student).
  - **CLASSROOM** — members of that specific section.
- Every query adds a **SQL access predicate** built from the JWT user id and role;
  client-supplied filters cannot remove it.
- **Pseudonymity:** when `is_anonymous` is true, the server assigns a deterministic
  pseudonym per `(user, course)`:
  `HMAC-SHA256(userId:courseId)` → adjective + noun + 2-digit number
  (e.g. `QuantumFalcon42`). The secret (`PSEUDONYM_SECRET` or `JWT_SECRET`) prevents
  outsiders from recomputing it. The author and the course teacher can see the real
  identity; other students cannot.
- Replies: helpful marks (toggle, unique per user/target), accepted solution
  (author or teacher; only one per post; sets post to `RESOLVED`), teacher
  endorsement (`is_teacher_endorsed`).
- Teacher-only `POST /doubts/:id/reveal-author` returns the real identity for
  moderation.
- Profanity filter blocks abusive title/body/reply before insert.
- Editing/deleting is allowed for the author or a teacher who can moderate the post.

### 7.8 Audience-scoped full-text search

- `doubt_posts.search_vector` is a **generated `tsvector`**:
  title weight `A`, body weight `B`, English configuration.
- A **GIN index** makes `@@ plainto_tsquery` fast.
- `GET /search` combines:
  - full-text match,
  - `ILIKE` fallback for partial words, pseudonyms, topic names, course codes,
  - `ts_rank` relevance ordering,
  - `ts_headline` highlighted snippets,
  - the same audience access predicate as the forum,
  - topic/status filters and pagination.
- Rate-limited to 60 requests/minute by default.

### 7.9 Moderation

- **Profanity filter** (`utils/profanityFilter.js`):
  - lowercases, maps leetspeak (`@`→a, `0`→o, `$`→s, …), splits on non-alphanumerics,
    collapses repeated characters (`fuuuck`→`fuck`);
  - matches **whole tokens plus common suffixes**, plus a squished form for
    `f.u.c.k`;
  - intentionally avoids naive substring matching so `shiitake` / `Scunthorpe`
    are not blocked.
- Word-cloud responses are auto-blocked (stored with `is_blocked` and a reason) but
  the teacher can approve false positives.
- Teachers can mute a student from word clouds for a fixed duration.
- Teachers can reveal pseudonymous authors and flag/resolve moderation reports.
- Rate limiting: per-email login (10/15 min), per-IP login (100/15 min), signup
  (50/15 min), search (60/min), warning emails (3/10 min).

### 7.10 Student PWA

- Route group `web/src/app/student/*`: login, signup, home, join, classrooms,
  attendance, scan, pulse, quizzes, doubts, profile, install, offline.
- `manifest.webmanifest` + `sw.js` make it installable from Safari (iOS) and Chrome
  (Android); `display: standalone`, portrait, M3 theme color.
- Service worker strategy:
  - never cache API or cross-origin responses,
  - network-first for navigations,
  - stale-while-revalidate for `/_next/static/`, icons, fonts, and WASM.
- Camera requires **HTTPS** (or localhost); the install page explains
  Share → Add to Home Screen.
- The QR decoder WASM is served from `/student/wasm/zxing_reader.wasm`, not a CDN.

### 7.11 Flutter Android app

- `main.dart` switches between login/signup, a teacher notice screen (teachers must
  use the web dashboard), and the student host.
- Tabs: Classrooms, Attendance, PulseMeter, Quizzes, Forum, Profile.
- Services: `auth_service.dart` (SharedPreferences session + JWT expiry check),
  `classroom_service.dart`, `jwt.dart`.
- `mobile_scanner` captures the 3 QR frames with the same accumulator logic as the
  web; zoom buttons (1×–20×) help scan a projector from the back of a room.
- `fl_chart` renders per-subject attendance bars with a 75% threshold.
- `API_BASE_URL` is a `--dart-define`; defaults to the deployed Render API.

### 7.12 Web instructor dashboard

- `/` — classroom cards, create/join details/roster/delete, active session banners,
  live projector modal.
- Tabs: Classrooms, Attendance, PulseMeter, Quizzes, Forum, Profile.
- `AttendanceAnalyticsView` — metrics, Recharts trend, ACL bar chart, student table,
  drill-down, session timeline, export and warning buttons.
- `PulseMeterAuthoringView` + `LivePulseMeterModal` — author, launch, live results,
  moderation.
- `QuizAuthoringView` + `LiveQuizModal` — author, launch, start question, reveal,
  leaderboard.
- `DoubtForumView`, `DoubtDetailModal`, `CreateDoubtDialog` — forum, filters, search,
  moderation.
- `AuthContext` stores the JWT in local/session storage, checks expiry every minute,
  and `apiFetch` redirects to login on `401`.

---

## 8. Real-time (Socket.io) contract

**Handshake:** client sends `auth: { token }`; the server verifies the JWT and
disconnects on failure. The JWT is the only identity source.

| Client → server | Purpose | Authorization |
|---|---|---|
| `join_session` | Join `session_<id>` for live roster | **Owning teacher only** (room broadcasts names/emails) |
| `leave_session` | Leave room | — |
| `join_classroom` | Join `classroom_<id>` | Teacher owner or enrolled student |
| `leave_classroom` | Leave room | — |
| `join_activity` | Join `activity_<id>` | Classroom member |
| `join_activity_teacher` | Join `activity_<id>_teacher` | Owning teacher only |
| `leave_activity` | Leave both activity rooms | — |

| Server → client | Emitted to | Meaning |
|---|---|---|
| `attendance:marked` | `session_<id>` | A student's attendance was recorded |
| `activity:launched` | `classroom_<id>` | PulseMeter/quiz went live |
| `activity:ended` | `classroom_<id>` | PulseMeter ended |
| `pulsemeter:results` | `activity_<id>_teacher` | Aggregated live results |
| `activity:response_count` | `activity_<id>_teacher` | Response/present counts |
| `quiz:question_start` | `classroom_<id>` | New question + server timestamps |
| `quiz:live_answers` | `activity_<id>_teacher` | Answer count tick |
| `quiz:question_results` | `classroom_<id>` | Correct option, distribution, leaderboard |
| `quiz:ended` | `classroom_<id>` | Final leaderboard + podium |
| `auth:error` | the socket | Auth failure before disconnect |

**Why rooms?** They are the real-time equivalent of a broadcast channel. A teacher's
projector only needs its session room; students only need their classroom/activity
room, which limits data exposure.

---

## 9. API quick reference

All routes except `/health`, `/`, and `/auth/*` require `Authorization: Bearer <jwt>`.

| Method & path | Role | Purpose |
|---|---|---|
| `POST /auth/signup` | public | Create teacher/student |
| `POST /auth/login` | public | Get JWT |
| `GET /auth/me` | any | Current profile |
| `GET /courses` | any | Course catalog |
| `POST /classrooms` | teacher | Create section |
| `POST /classrooms/:id/regenerate-join` | teacher | Rotate join code |
| `POST /classrooms/join` | student | Enroll with code |
| `GET /classrooms/mine` | any | My classrooms + metrics |
| `GET /classrooms/:id/summary` | member | Cross-feature summary |
| `GET /classrooms/:id/roster` | teacher | Enrolled students |
| `DELETE /classrooms/:id/roster/:student_id` | teacher | Remove student |
| `DELETE /classrooms/:id` | teacher | Delete section (transaction) |
| `DELETE /classrooms/:id/leave` | student | Unenroll |
| `POST /sessions` | teacher | Start attendance |
| `POST /sessions/:id/end` | teacher | End attendance |
| `GET /sessions/active-mine` | teacher | Active sessions |
| `GET /sessions/:id` | member | Session details |
| `GET /sessions/:id/active-tokens` | teacher | Current 3-QR batch |
| `POST /attendance/scan` | student | Submit 3 tokens |
| `GET /attendance/session/:id` | teacher | Live roster |
| `GET /attendance/classroom/:id/summary` | teacher | Analytics |
| `GET /attendance/classroom/:id/student/:studentId` | teacher | Drill-down |
| `GET /attendance/me` | student | My attendance |
| `POST /attendance/override` | teacher | Manual PRESENT/ABSENT |
| `GET /attendance/classroom/:id/export` | teacher | CSV/XLSX |
| `POST /attendance/classroom/:id/send-warnings` | teacher | Email warnings |
| `POST /pulsemeters` | teacher | Author poll |
| `GET /pulsemeters?classroom_id=` | teacher | List polls |
| `POST /pulsemeters/:id/launch` | teacher | Go live |
| `PUT /pulsemeters/:id` | teacher | Edit |
| `DELETE /pulsemeters/:id` | teacher | Delete (if no history) |
| `POST /quizzes` | teacher | Author quiz |
| `GET /quizzes?classroom_id=` | teacher | List quizzes |
| `POST /quizzes/:id/launch` | teacher | Go live |
| `DELETE /quizzes/:id` | teacher | Delete (if no history) |
| `GET /live-activities?classroom_id=` | teacher | History |
| `GET /live-activities/active?classroom_id=` | member | Current activity |
| `POST /live-activities/:id/end` | teacher | End any activity |
| `POST /live-activities/:id/respond` | student | PulseMeter response |
| `GET /live-activities/:id/analytics` | teacher | Poll analytics |
| `GET /live-activities/:id/word-cloud-submissions` | teacher | Submissions |
| `POST /live-activities/:id/responses/:rid/approve` | teacher | Approve blocked word |
| `DELETE /live-activities/:id/responses/:rid` | teacher | Delete response |
| `POST /live-activities/:id/quiz/start-question` | teacher | Open question |
| `POST /live-activities/:id/quiz/answer` | student | Submit answer |
| `POST /live-activities/:id/quiz/show-results` | teacher | Reveal |
| `GET /live-activities/:id/quiz/leaderboard` | member | Leaderboard |
| `POST /live-activities/:id/quiz/end` | teacher | End quiz |
| `GET /live-activities/:id/quiz/results` | teacher | Full results |
| `POST /word-cloud-mutes` | teacher | Mute student |
| `GET /word-cloud-mutes?classroom_id=` | teacher | Active mutes |
| `DELETE /word-cloud-mutes/:id` | teacher | Unmute |
| `GET /doubts` | any | Scoped list/search |
| `POST /doubts` | any | Create post |
| `GET /doubts/:id` | any (scoped) | Post + replies |
| `POST /doubts/:id/replies` | any (scoped) | Reply |
| `POST /doubts/:id/reveal-author` | teacher | Unmask author |
| `POST /doubts/helpful` | any (scoped) | Toggle helpful |
| `POST /doubts/replies/:id/accept-solution` | author/teacher | Mark solution |
| `POST /doubts/replies/:id/endorse` | teacher | Endorse |
| `PUT /doubts/:id`, `PUT /doubts/replies/:id` | author/teacher | Edit |
| `DELETE /doubts/:id`, `DELETE /doubts/replies/:id` | author/teacher | Delete |
| `GET/POST /courses/:course_id/topics` | any | Topics |
| `GET /search?q=` | any | Full-text search |
| `GET /health` | public | DB/Redis health |

---

## 10. Running the project

### Backend

```bash
cd backend
cp .env.example .env     # set DATABASE_URL, JWT_SECRET, QR_HMAC_SECRET
npm ci
npm test
npm run dev              # http://localhost:4000
```

### Web (dashboard + student PWA)

```bash
cd web
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm ci
npm run dev                  # http://localhost:3000  and  /student
```

### Flutter Android

```bash
cd mobile
flutter pub get
flutter test
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

`10.0.2.2` is the host machine from the Android emulator. For a physical phone,
use the machine's LAN IP. Release build:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://your-api.example.com
```

### Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL (Neon) connection |
| `JWT_SECRET` | yes | JWT signing |
| `QR_HMAC_SECRET` | yes | QR token signing |
| `REDIS_URL` | no | QR batch cache; falls back to memory |
| `CORS_ORIGINS` | no | Comma-separated browser origins |
| `TEACHER_INVITE_CODE` | prod | Enables/gates teacher signup |
| `PSEUDONYM_SECRET` | no | Defaults to `JWT_SECRET` |
| `SESSION_MAX_HOURS` | no | Auto-end stale sessions (default 4) |
| `ATTENDANCE_LINK_WINDOW_HOURS` | no | Link activities to recent attendance (default 12) |
| Email keys (`BREVO_*`, `RESEND_*`, `SMTP_*`) | no | Warning emails; simulated if absent |

---

## 11. Testing and CI

| Suite | Command | Count / scope |
|---|---|---|
| Backend | `cd backend && npm test` | **213 tests** across auth, attendance, classrooms, doubts, live activities, PulseMeters, quizzes, QR tokens, sessions, socket auth, security, email, export, profanity |
| Web | `cd web && npm test` | **29 Vitest tests** (auth storage/routing, QR parsing/accumulation, student API, PWA helpers, attendance formatting) |
| Web type-check | `cd web && npm run typecheck` | TypeScript strict check |
| Web build | `cd web && npm run build` | Production Next.js build |
| Mobile | `cd mobile && flutter analyze --no-fatal-infos && flutter test` | Static analysis + unit/widget tests |

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs three parallel jobs on
every push/PR to `main`: backend syntax + tests, web tests + typecheck + build, mobile
analyze + test + release APK upload. Backend tests use mocked PostgreSQL/Redis, so CI
does not need live services.

**Testing philosophy to mention in viva:** security-critical logic (QR validation,
access predicates, scoring, profanity normalization) is unit-tested; the web build
and Flutter analyze catch integration/type regressions. The test files are a good
place to see expected behavior.

---

## 12. Security design decisions (quick reference)

| Threat | Mitigation |
|---|---|
| Password theft | bcrypt hashing (never plaintext) |
| Forged/expired sessions | Signed JWT with 7-day expiry; 401/403 handling |
| SQL injection | Parameterized queries (`$1`, `$2`); no string interpolation of user input |
| Unauthorized access | `requireRole` + ownership/enrollment checks in `utils/access.js`; socket rooms re-check DB |
| Proxy attendance | 3 ordered HMAC-signed frames, 10 s freshness, Redis batch check |
| Replay / duplicate attendance | Batch TTL + `UNIQUE(session_id, student_id)` |
| Forged QR | HMAC-SHA256 with server-only secret |
| Double voting | `UNIQUE(user_id, target_type, target_id)` |
| Double response/answer | Unique constraints on responses and quiz answers |
| Brute force | Fixed-window rate limits on login, signup, search, warnings |
| XSS in emails | `escapeHtml` on every interpolated value |
| CSV formula injection | Prefix `= + - @` cells with `'` |
| Identity leak in anonymous forum | Server-side masking; identity only for author/teacher |
| Pseudonym reversal | HMAC secret prevents recomputation from public ids |
| CORS abuse | Explicit origin allowlist; requests without Origin still allowed for mobile |
| Stack trace leak | Final error handler returns generic 500 |
| Stale session left open | Background sweep after `SESSION_MAX_HOURS` |
| Redis outage | 2 s command timeout + in-memory fallback, never fails attendance |
| Concurrent duplicate insert | DB unique constraint catches the race, returns 409 |
| Unauthorized socket listening | Room joins authorized against the DB before `socket.join` |

---

## 13. Viva questions and answers

### A. Project overview

**Q1. What is ClassPulse in one line?**
A real-time classroom engagement platform combining anti-proxy QR attendance, live
polls, live quizzes, a pseudonymous doubt forum, and attendance analytics.

**Q2. Why did you build it?**
Traditional QR attendance is easy to proxy: a student photographs the code and sends
it to an absent friend. ClassPulse makes attendance a short-lived, multi-frame,
cryptographically signed challenge, and adds engagement features so the same app is
useful during class.

**Q3. What are the three main components?**
A Node/Express + Socket.io backend, a Next.js web app (instructor dashboard + student
PWA), and a Flutter Android student app.

**Q4. What is the architecture style?**
Three-tier client–server: presentation (React/Flutter), application (Express +
services + Socket.io), data (PostgreSQL + Redis). It is a monorepo but three
independently deployable apps.

**Q5. Why a monorepo?**
One repository keeps the API contract, web client, and mobile client in sync and
lets CI test all three together.

**Q6. What is the deployment topology?**
Backend on Render, web/PWA on Vercel, PostgreSQL on Neon, Redis on Upstash, APK built
by GitHub Actions.

**Q7. Which part is the "system of record"?**
PostgreSQL. Redis is only a short-lived cache; losing Redis does not lose data.

### B. Technology choices

**Q8. Why Node.js and Express?**
JavaScript on both server and client, a huge ecosystem, non-blocking I/O for many
concurrent students, and Socket.io integrates naturally.

**Q9. Why Next.js instead of plain React?**
File-based routing, server components/layouts, built-in production build, easy
Vercel deployment, and one app can host both `/` and `/student`.

**Q10. Why MUI?**
Prebuilt accessible Material components speed up a consistent dashboard; the M3
token file keeps colors/spacing aligned with the Flutter app.

**Q11. Why PostgreSQL rather than MongoDB?**
The data is highly relational (users → classrooms → sessions → attendance), needs
foreign keys, uniqueness constraints, transactions, and full-text search. SQL fits
better than a document store.

**Q12. Why Redis?**
QR batches are short-lived (15 s), read on every scan, and must be shared across
backend instances. Redis gives TTL and fast shared reads. It is optional locally.

**Q13. Why Socket.io rather than raw WebSockets or polling?**
Socket.io handles reconnection, rooms, acknowledgements, and fallbacks. Polling
would add latency and load for live rosters and quiz state.

**Q14. Why Flutter and a PWA?**
Flutter gives a native Android app with a strong camera scanner; the PWA covers iOS
(which cannot sideload an APK) and desktop without App Store review.

**Q15. Why store QR state in Redis instead of only the DB?**
The batch is ephemeral and must expire automatically; Redis TTL is ideal and avoids
writing thousands of short-lived rows. The durable attendance result still goes to
PostgreSQL.

### C. Attendance / QR (most likely deep-dive)

**Q16. Explain the anti-proxy attendance flow step by step.**
Teacher starts a session → server issues 3 HMAC-signed tokens in one batch → projector
cycles them → student app captures all 3 → app posts the sequence + scan start time →
server checks count, order, batch consistency, freshness, HMAC, Redis presence,
session state, enrollment, and duplicates → inserts attendance and computes ACL.

**Q17. Why three QR codes?**
One code can be screenshotted and forwarded. Requiring three ordered frames from the
same batch forces the scan to happen live within the rotation window.

**Q18. What exactly is signed?**
`HMAC-SHA256(secret, sessionId:batchId:seqIdx:timestamp:tokenId)`. The secret never
leaves the server, so a student cannot forge a valid token.

**Q19. Why HMAC and not a JWT for the QR?**
The QR only needs integrity and authenticity, not claims or expiry parsing. HMAC is
smaller and simpler, and expiry is enforced by the 10 s freshness check plus the
Redis TTL.

**Q20. What is the freshness window and why 10 seconds?**
Tokens older than 10 s are rejected (with 2 s clock-drift tolerance). It is short
enough that a forwarded screenshot is useless, but long enough for a slow phone
camera to capture three frames.

**Q21. Why is the Redis TTL 15 s when freshness is 10 s?**
The extra 5 s is grace so an in-flight scan is not rejected just because the cache
entry expired a moment earlier.

**Q22. How do you stop a student from submitting the same batch twice?**
The `UNIQUE(session_id, student_id)` constraint on `attendance_records`; the second
insert fails and returns `409`. The pre-check gives a friendly message, the
constraint closes the race.

**Q23. How do you stop two concurrent requests from both inserting?**
The database unique constraint is the final authority. A check-then-insert alone
would race; the insert is wrapped in a `try/catch` for PostgreSQL error `23505`.

**Q24. What is ACL?**
Attendance Capture Latency: the time from when the client began scanning the batch
to when the server validated it, in milliseconds. It is shown as a badge and used in
analytics, not for security.

**Q25. How is ACL protected from cheating?**
The client's `scan_started_at` is untrusted. The server rejects future times and uses
`max(scan_started_at, token_timestamp)` so the latency can never be smaller than the
token's real age.

**Q26. Why reuse a batch for 4 seconds?**
If every poll generated a new batch, the projector would rotate too fast to scan. The
4 s reuse is deliberately not equal to the client polling interval, avoiding a
boundary case where an almost-expired batch is served.

**Q27. What happens if Redis is down?**
The backend logs a warning and uses a per-instance in-memory Map with the same TTL.
Attendance still works on one instance; multi-instance deployments would need Redis
fixed.

**Q28. What happens if the projector and phone clocks differ?**
The server signs the timestamp, allows −2 s drift, and computes age against server
time. The student's clock is never trusted for freshness.

**Q29. Can a student share a video of the QR stream?**
In theory a live video could work, but it must deliver all three frames within the
window; the teacher can rotate faster (100 ms) and the app only accepts one batch.
It raises the cost far above a screenshot. This is a limitation worth stating
honestly.

**Q30. How does the scanner know when it has all three?**
`FrameAccumulator` keys frames by `batch_id` and `seq_idx`, resets on a new batch,
ignores duplicates, and reports `ready` only when 0, 1, and 2 all exist.

### D. Authentication and authorization

**Q31. How does authentication work?**
`POST /auth/login` verifies the bcrypt hash and returns a 7-day JWT. Clients send
`Authorization: Bearer <token>`. `authenticateToken` verifies it and sets
`req.user`; `requireRole` checks the role.

**Q32. Where is the JWT stored on the client?**
Web: local storage (remember me) or session storage. Flutter: `SharedPreferences`.
The token is also sent in the Socket.io handshake `auth.token`.

**Q33. Why bcrypt and not SHA-256?**
bcrypt is deliberately slow and salted, resisting brute force and rainbow tables.
SHA-256 is fast and unsuitable for passwords.

**Q34. What is inside the JWT?**
`id`, `email`, `role`, `full_name`, plus `iat`/`exp`. It is signed, not encrypted, so
it must never contain secrets.

**Q35. How do you prevent a student from calling teacher APIs?**
`requireRole('teacher')` on every teacher route, plus ownership checks
(`classroom.teacher_id === req.user.id`). Role comes from the verified JWT, never
from the request body.

**Q36. How do you prevent student A from seeing student B's data?**
Queries filter by `req.user.id` (e.g. `/attendance/me`), and classroom endpoints check
enrollment. The session room is teacher-only because it broadcasts names/emails.

**Q37. What happens when the token expires?**
REST returns `401`; `apiFetch` clears storage and redirects to login. The web app also
checks expiry every minute. Flutter clears an expired saved session at startup.

**Q38. Can a JWT be revoked?**
Not before expiry with this design. A production upgrade would add short-lived access
tokens plus refresh-token rotation or a denylist.

**Q39. What is CORS and how is it configured?**
Cross-Origin Resource Sharing. The backend allows only origins in `CORS_ORIGINS`;
requests without an `Origin` header (mobile/curl) are allowed. A disallowed origin
gets `403`.

**Q40. Why rate limit login by both email and IP?**
Per-email stops brute-forcing one account; per-IP is a NAT-friendly backstop. A class
behind one campus IP should not block itself at 10 attempts, so the IP cap is higher
(100).

### E. Database and concurrency

**Q41. Why UUID primary keys?**
They are globally unique, safe to expose in URLs, and avoid guessable sequential IDs.

**Q42. What is a foreign key and where do you use it?**
It enforces referential integrity, e.g. `attendance_records.session_id REFERENCES
sessions(id) ON DELETE CASCADE`. Deleting a session removes its attendance.

**Q43. What is a transaction and where is it used?**
An all-or-nothing unit. Used for quiz authoring (quiz + questions), classroom
deletion (attendance → sessions → enrollments → classroom), helpful-mark toggling,
and stale-session sweeping.

**Q44. What is a unique constraint and why does it matter?**
It lets the database, not application code, enforce one row per key. It closes
concurrent race conditions for attendance, quiz answers, PulseMeter responses,
helpful votes, and enrollments.

**Q45. What is a partial unique index?**
An index with a `WHERE` clause. `one_active_activity_per_classroom` applies only to
`status = 'ACTIVE'`, so a classroom can have many ended activities but only one live.

**Q46. Why is the attendance percentage enrollment-aware?**
If a student joins in week 5, sessions from weeks 1–4 are not their responsibility.
They are shown as `N/A` and excluded from the denominator, so they are not falsely
marked absent.

**Q47. Why exclude live sessions from analytics denominators?**
A session still in progress would constantly change percentages and understate
attendance. It is included in history but not in completed-session stats.

**Q48. What is a generated column?**
`search_vector` is computed automatically from `title` and `body` by PostgreSQL, so
it can never drift out of sync with the source text.

**Q49. How does full-text search work?**
`to_tsvector` converts text to normalized lexemes; `plainto_tsquery` parses the query;
`@@` matches; `ts_rank` orders by relevance; `ts_headline` produces highlighted
snippets. A GIN index makes it fast.

**Q50. Why also use `ILIKE`?**
Full-text search matches whole lexemes, so partial words and course codes may miss.
`ILIKE '%term%'` is a fallback for those cases.

### F. Live activities and quizzes

**Q51. How do you ensure only one live activity per classroom?**
A partial unique index on `(classroom_id) WHERE status='ACTIVE'`. A second launch
gets `409`.

**Q52. Why snapshot the activity at launch?**
If a teacher edits or deletes the reusable template, historical runs and live results
must still work. `title_snapshot` and `config_snapshot` are immutable per run.

**Q53. What is the "present vs responded" problem?**
Live activity analytics want to compare responses with the students who were actually
present. If attendance has not been taken yet, the activity is marked
`attendance_pending` and linked when a session ends.

**Q54. Explain the quiz scoring formula.**
`f = clamp((T − t)/T, 0, 1)`. WIDE: `300 + 700f` (300–1000). NARROW: `700 + 300f`
(700–1000). Wrong answers score 0. NARROW compresses the speed advantage.

**Q55. Why is scoring server-side?**
So a student cannot submit a fake response time or score. The server reads
`started_at_ms`/`ends_at_ms` from `activity_question_states` and uses `Date.now()`.

**Q56. What happens if the server restarts mid-quiz?**
The timer lives in `activity_question_states` in PostgreSQL, not in memory, so quiz
state survives the restart.

**Q57. How do you stop a student from seeing the correct answer early?**
The sanitized quiz payload omits `correct_option_id`. It is only broadcast in
`quiz:question_results` after the teacher reveals, and `revealed` blocks late answers.

**Q58. How do you stop answering the same question twice?**
`UNIQUE(live_activity_id, question_id, student_id)` on `quiz_responses`.

**Q59. How do you stop answering a question that is not current?**
The server checks the latest question state and that `now <= ends_at_ms`; otherwise
`409`/`400`.

**Q60. How does the leaderboard work?**
Sum `score_awarded` per student for the activity, order descending. Students do not
see others' emails; the final top 3 form the podium.

### G. Doubt forum and moderation

**Q61. What are the three audience scopes?**
APP (everyone authenticated), COURSE (course members), CLASSROOM (section members).

**Q62. How is access enforced in the forum?**
A SQL predicate is appended to every forum/search query based on `req.user.id` and
role. Client filters cannot remove it, and direct post/reply actions call
`resolveDoubtAccess`.

**Q63. How does pseudonymity work?**
`HMAC-SHA256(userId:courseId)` with a server secret maps to an adjective + noun +
number. It is stable per course, unlinkable across courses, and not recomputable
without the secret.

**Q64. Can a teacher identify an anonymous student?**
Yes, via a teacher-only endpoint, but only for posts they can moderate. This supports
safeguarding/moderation while hiding identity from peers.

**Q65. How do helpful votes avoid duplicates?**
`UNIQUE(user_id, target_type, target_id)`; the endpoint toggles insert/delete and
updates the count in a transaction.

**Q66. How does "accepted solution" work?**
Only the post author or a teacher can accept. Marking one reply resets all others and
sets the post to `RESOLVED`; unmarking reopens it.

**Q67. How does the profanity filter avoid false positives?**
It normalizes leetspeak and repeats, then matches whole tokens plus known suffixes.
It does not do naive substring matching, so "shiitake" or "Scunthorpe" are safe.
Obfuscated `f.u.c.k` is caught by the squished form.

**Q68. What happens to a blocked word-cloud submission?**
It is stored with `is_blocked = true` and a reason, excluded from live results, and
the teacher can approve or delete it.

### H. Frontend / PWA / mobile

**Q69. What is a PWA and why use it?**
A Progressive Web App: a normal website plus a manifest and service worker, so it can
be installed to the home screen, run standalone, and cache an app shell. It avoids
app-store review and covers iOS.

**Q70. What does your service worker cache?**
Only same-origin static assets (`/_next/static/`, icons, fonts, WASM) with
stale-while-revalidate. It never caches API responses; navigations are network-first.

**Q71. Why does the camera need HTTPS?**
Browsers expose `getUserMedia` only in secure contexts (HTTPS or localhost) to prevent
silent spying.

**Q72. Why self-host the ZXing WASM file?**
Offline support, strict CSP compatibility, and no dependency on a third-party CDN at
scan time.

**Q73. Why is the web dashboard teacher-only?**
Separation of concerns: instructors need a large-screen authoring/analytics UI;
students use the mobile-first PWA or Flutter app. The web login redirects students to
`/student`.

**Q74. Why does the Flutter app show a notice to teachers?**
Teachers are expected to use the web dashboard for authoring and analytics; the
mobile app is optimized for student actions.

**Q75. How does the app keep the user logged in?**
The token and user are persisted (local/session storage on web, SharedPreferences on
Flutter) and checked for expiry at startup and periodically.

### I. Security and quality

**Q76. How do you prevent SQL injection?**
Every query uses parameter placeholders (`$1`, `$2`) and passes values separately;
no user input is concatenated into SQL. Dynamic sort/table names are chosen from
fixed allowlists.

**Q77. How do you prevent XSS?**
React escapes rendered strings by default; email HTML escapes every interpolated
value with `escapeHtml`; no `dangerouslySetInnerHTML` is used for user content.

**Q78. What about CSRF?**
Auth uses a Bearer token in a header, not an ambient cookie, so classic CSRF does not
apply. CORS also restricts which browser origins can call the API.

**Q79. How do you stop brute-force login?**
Fixed-window rate limits per email and per IP, plus bcrypt's cost. A production
system could add account lockout or CAPTCHA.

**Q80. How do you stop CSV formula injection?**
Cells starting with `=`, `+`, `-`, `@`, tab, or CR are prefixed with `'`, so a
spreadsheet treats them as text, not formulas.

**Q81. What is the biggest security risk in the current design?**
The JWT cannot be revoked before expiry, and rate limiting is per-process (not shared
across instances). Both are acceptable for a course project but would be upgraded
with refresh tokens and a Redis-backed limiter.

**Q82. How do you handle errors without leaking internals?**
The final Express error handler logs server-side and returns a generic
`500 Internal server error`; CORS and body-size errors get specific safe messages.

**Q83. Why is the JSON body limit 200 KB?**
To stop memory abuse from huge payloads while allowing normal quiz/forum content.

### J. Testing, CI, and process

**Q84. How did you test the system?**
213 backend tests (auth, QR validation, access control, scoring, moderation,
socket authorization), 29 web tests (QR accumulator, auth storage, PWA helpers),
Flutter analyze + widget tests, plus manual end-to-end test cases in `TEST_CASES.md`.

**Q85. What is CI/CD here?**
GitHub Actions runs three jobs on every push/PR: backend syntax + tests, web tests +
typecheck + build, Flutter analyze + test + APK build. The APK is uploaded as an
artifact.

**Q86. Why mock PostgreSQL and Redis in tests?**
Unit/integration tests should be fast, deterministic, and runnable in CI without
secrets or network services. The mocks exercise route logic and SQL call shape.

**Q87. What did you test most heavily and why?**
QR token validation and access control, because they are the security-critical core;
plus quiz scoring because a formula bug would silently corrupt grades.

**Q88. How would you load-test it?**
Simulate many students scanning/answering with k6 or Artillery against a staging
deployment; watch PostgreSQL connections, Socket.io room size, and Redis latency.

### K. Design and trade-offs

**Q89. What is the hardest part of the project?**
Coordinating the rotating QR timing across projector, network, camera, and server
freshness, while keeping the scan reliable on slow phones.

**Q90. What would you improve with more time?**
Refresh-token rotation, a Redis-backed rate limiter, WebSocket horizontal scaling
(Socket.io Redis adapter), push notifications, accessibility audit, i18n, and
stronger anti-proxy signals (device binding / BLE proximity).

**Q91. How would you scale to 10,000 students?**
Stateless Express behind a load balancer, Redis for shared QR batches and Socket.io
adapter, PostgreSQL connection pooling (PgBouncer), read replicas for analytics,
and CDN for the web app.

**Q92. Why is Redis not a single point of failure?**
The code times out commands (2 s) and falls back to memory, so attendance does not
return 500s if Redis is down. The trade-off is that the fallback is per instance.

**Q93. What is idempotency and where did you use it?**
An operation that can be repeated safely. Starting an attendance session reuses an
existing active session instead of creating duplicates; manual attendance uses
`ON CONFLICT` upsert.

**Q94. Why use snapshots instead of joins for history?**
History must not change when a template is edited or deleted. Snapshots make each run
self-contained and auditable.

**Q95. What is the difference between authentication and authorization?**
Authentication proves who you are (JWT); authorization decides what you may do
(role + ownership/enrollment checks).

**Q96. Where is the "single source of truth" for permissions?**
The JWT for identity, and the database for relationships (teacher owns classroom,
student is enrolled). The client is never trusted for either.

**Q97. How does the system handle a teacher forgetting to end a session?**
A background sweep every 5 minutes ends sessions older than `SESSION_MAX_HOURS`
(default 4 h) and links any pending activities.

**Q98. What is the role of `activity_question_states`?**
It stores the server-authoritative timer and reveal state per question, making quizzes
restart-safe and preventing late or duplicate answers.

**Q99. Why keep a native app when a PWA exists?**
Flutter gives better camera control (zoom, detection speed) on Android and a
distributable APK; the PWA covers iOS and instant access. Both use the same API.

**Q100. If you had to defend one design decision, which one?**
The multi-frame QR protocol: it directly solves the project's core problem (proxy
attendance) with cryptography, time-bounding, and database constraints rather than
trusting the client.

---

## 14. 60-second elevator pitch

> ClassPulse is a three-tier classroom engagement platform. Instructors use a Next.js
> dashboard, students use a Flutter app or an installable PWA, and both talk to a
> Node/Express + Socket.io backend on PostgreSQL, with Redis caching short-lived QR
> tokens. The flagship feature is anti-proxy attendance: the projector rotates three
> HMAC-signed QR frames, and the server only accepts all three, in order, from the
> same batch, within ten seconds. On top of that we built live PulseMeter polls, live
> quizzes with server-timed scoring and leaderboards, a pseudonymous doubt forum with
> full-text search, and attendance analytics with CSV/Excel export and warning emails.
> The whole thing is tested by 213 backend tests, 29 web tests, and a Flutter suite,
> and deployed through GitHub Actions.

## 15. 5-minute demo script

1. **Teacher login** → create a section → show the 6-character join code.
2. **Student join** (PWA or Flutter) → section appears.
3. **Start attendance** → fullscreen projector cycles 3 QRs → scan → roster appears
   live with ACL badge.
4. **PulseMeter** → launch word cloud → submit from student → live cloud updates;
   show a blocked word and approve it.
5. **Quiz** → launch → start question → student answers → reveal distribution and
   leaderboard.
6. **Forum** → post anonymously → show pseudonym → reply, helpful, accept solution;
   teacher reveals author.
7. **Analytics** → show turnout trend, ACL chart, student drill-down, CSV export.
8. **Health** → `GET /health` shows DB/Redis status.

## 16. Who explains what (suggested split)

| Area | Owner should be able to explain |
|---|---|
| Architecture & stack | Why three tiers, why monorepo, deployment |
| Auth & security | JWT, bcrypt, CORS, rate limits, SQL injection |
| QR attendance | Token generation, validation pipeline, ACL, Redis fallback |
| Database | Schema, constraints, transactions, indexes |
| PulseMeter & quizzes | Snapshots, one-active rule, scoring formula, timers |
| Forum & search | Scopes, pseudonyms, access predicate, tsvector |
| Web/PWA | Next.js routing, service worker, WASM scanner |
| Flutter | Scanner accumulator, SharedPreferences, charts |
| Testing & CI | Test strategy, mocked DB/Redis, GitHub Actions |

---

## 17. Known limitations (be honest if asked)

- JWT cannot be revoked before its 7-day expiry; no refresh-token flow.
- Rate limiting is in-process, so it is per instance, not global.
- Redis fallback is per instance; multi-instance attendance needs Redis healthy.
- A live video of the projector could theoretically satisfy the 3-frame check.
- Full-text search is English-configured; no stemming for other languages.
- Email delivery is best-effort; with no provider configured it only logs a
  simulation.
- No push notifications, no offline attendance queue, no i18n/accessibility audit.
- `activity_question_states` handles quiz timers, but there is no background job to
  auto-close an abandoned quiz beyond the teacher ending it.

## 18. Glossary

| Term | Meaning |
|---|---|
| **ACL** | Attendance Capture Latency (scan start → server validation, ms) |
| **Batch** | One set of three QR tokens sharing `batch_id` and timestamp |
| **PulseMeter** | Live poll: word cloud, MCQ, or rating scale |
| **Live activity** | A launched instance of a PulseMeter or quiz |
| **Snapshot** | Immutable copy of a template stored on the run |
| **Scope** | Doubt audience: APP, COURSE, or CLASSROOM |
| **Pseudonym** | Stable anonymous display name per user per course |
| **PWA** | Progressive Web App (installable website) |
| **JWT** | JSON Web Token, signed stateless auth token |
| **HMAC** | Keyed hash used to sign QR tokens |
| **Partial index** | Index that applies only to rows matching a `WHERE` clause |
| **Idempotent** | Safe to repeat without changing the outcome |

---

*Generated from the current codebase. If a route, table, or environment variable
changes, update the matching section here.*
