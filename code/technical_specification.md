# ClassPulse — Technical Specification (Iteration 1)

Scope: Section 9.1 of the project proposal — classroom creation/join flow,
anti-proxy QR attendance (web generator + Flutter scanner), auth, base schema,
ACL logging, and CI. This document is the source of truth referenced by
`prompt.md`.

---

## 0. First-Time Project Guidance

This is a first software project, so a few terms used throughout this doc,
in plain language:

- **`.env` file**: a local, private file holding secret values (passwords,
  connection strings) that your code reads at runtime. It's never uploaded to
  GitHub — that's what keeps credentials safe.
- **Connection string**: a single text value (looks like a long URL) that
  tells your backend how to reach a database. You copy it from the
  database provider's dashboard after creating an account.
- **API endpoint**: a specific URL your frontend calls to ask the backend to
  do something (e.g., "log this user in", "create this classroom").
- **JWT (JSON Web Token)**: a signed piece of text issued when a user logs
  in, proving who they are on later requests, without needing to re-enter a
  password every time.
- **Deploying**: taking code that runs on your laptop and putting it on a
  server so it's reachable from any device, at a real URL, all the time.
- **APK**: the installable file format for Android apps — like a `.exe` for
  Windows, but for phones.
- **CI/CD**: automation that runs your tests and deploys your app
  automatically every time you push new code, instead of doing it by hand.

Section 8 below repeats, part by part, exactly when you'll need to create an
account somewhere and what to do with the credentials it gives you — you
don't need to figure any of this out in advance.

---

## 1. Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Next.js Web     │◄────►│  Express Backend  │◄────►│  PostgreSQL (Neon)│
│  (teacher +      │ REST │  + Socket.io      │      └──────────────────┘
│  student browser)│  &   │  (Render)         │      ┌──────────────────┐
└─────────────────┘  WS   │                   │◄────►│  Redis (Upstash)  │
┌─────────────────┐      │                   │      └──────────────────┘
│  Flutter Android │◄────►│                   │
│  App             │      └──────────────────┘
└─────────────────┘
```

- **Web** (Next.js + MUI): teacher dashboard (classroom mgmt, session control,
  QR display) and a student web view (join, view own classrooms/attendance).
- **Mobile** (Flutter): student app — join classrooms, scan attendance QR via
  camera + ML Kit, view attendance homepage.
- **Backend** (Express): auth, classroom/session CRUD, QR token issuance,
  attendance validation, ACL logging. Talks to both frontends over REST; QR
  rotation and live "marked present" events go over Socket.io.
- **Postgres**: source of truth for all persistent data.
- **Redis**: short-lived QR token storage/validation and Socket.io pub/sub
  adapter (for horizontal scaling readiness, even though Iteration 1 runs a
  single backend instance).

---

## 2. Hosting & Environments

| Service              | Provider                  | Free tier notes                                                                                                                                                                                                                   |
| -------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web                  | Vercel                    | Native Next.js support, generous free tier                                                                                                                                                                                        |
| Backend              | Render (free tier)        | Spins down after 15 min idle (~30–60s cold start on wake). Use a free external pinger (e.g. cron-job.org) hitting `/health` every 10 min during active pilot windows to avoid cold starts; disable the pinger outside pilot week. |
| Postgres             | Neon                      | Free tier does not expire (unlike Render's bundled free Postgres)                                                                                                                                                                 |
| Redis                | Upstash                   | Free tier, serverless-friendly                                                                                                                                                                                                    |
| Android distribution | Firebase App Distribution | Free, unlimited testers/builds; students install via emailed invite link, one-time tester app setup                                                                                                                               |
| CI                   | GitHub Actions            | Free minutes tier                                                                                                                                                                                                                 |

`.env.example` (backend):

```
DATABASE_URL=postgres://...          # Neon connection string
REDIS_URL=redis://...                # Upstash connection string
JWT_SECRET=...
QR_HMAC_SECRET=...
PORT=4000
```

---

## 3. Design System

**Material Design 3**, shared across both platforms via a single set of tokens
defined once and consumed by both apps:

- **Web**: MUI v5+ theme configured to Material 3 tokens (color scheme,
  typography scale, shape/elevation).
- **Mobile**: Flutter's native `ThemeData` with `useMaterial3: true`, same
  color seed/typography scale as the web theme.
- Do not introduce a second design language (e.g., Tailwind/shadcn on web) —
  it breaks visual parity with the Flutter app, which is Material-native by
  default.
- Reference: Google's official Material 3 Figma kit may be used for visual
  reference only, not as a source of code — build directly against MUI and
  Flutter Material components.

---

## 4. Database Schema (Iteration 1)

```sql
-- Users: both teachers and students
Users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- Courses: predefined course-code catalog (avoids "UCS101" vs "UCS 101")
Courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code  TEXT UNIQUE NOT NULL,   -- e.g. "UCS503P"
  course_name  TEXT NOT NULL
)

-- Classrooms: a specific lecture/lab section taught by one teacher
Classrooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES Courses(id),
  teacher_id   UUID NOT NULL REFERENCES Users(id),
  section_name TEXT NOT NULL,          -- e.g. "Section A"
  join_code    TEXT UNIQUE NOT NULL,   -- short human-typeable code
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- Enrollments: which students belong to which classroom
Enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES Classrooms(id),
  student_id    UUID NOT NULL REFERENCES Users(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
)

-- Sessions: one live class instance where attendance is taken
Sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES Classrooms(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ
)

-- AttendanceRecords: one row per student marked present in a session
AttendanceRecords (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES Sessions(id),
  student_id        UUID NOT NULL REFERENCES Users(id),
  scan_started_at   TIMESTAMPTZ NOT NULL,  -- device-reported, for ACL
  validated_at      TIMESTAMPTZ NOT NULL DEFAULT now(), -- backend-confirmed
  status            TEXT NOT NULL DEFAULT 'PRESENT',
  UNIQUE (session_id, student_id)
)
```

`AttendanceRecords.validated_at - scan_started_at` is the raw material for the
Attendance Capture Latency (ACL) metric (Section 6.1 of the proposal).

---

## 5. API Endpoints (Iteration 1)

| Method | Path                              | Auth             | Purpose                                              |
| ------ | --------------------------------- | ---------------- | ---------------------------------------------------- |
| POST   | `/auth/signup`                    | —                | Create account, role = teacher/student               |
| POST   | `/auth/login`                     | —                | Returns JWT                                          |
| GET    | `/courses`                        | any              | Predefined course-code list                          |
| POST   | `/classrooms`                     | teacher          | Create classroom, returns join_code/link/QR payload  |
| POST   | `/classrooms/:id/regenerate-join` | teacher          | Rotate join code/link/QR                             |
| POST   | `/classrooms/join`                | student          | Join via code                                        |
| GET    | `/classrooms/mine`                | any              | List classrooms (teacher: taught, student: enrolled) |
| GET    | `/classrooms/:id/roster`          | teacher          | Enrolled students                                    |
| POST   | `/sessions`                       | teacher          | Start a session for a classroom                      |
| POST   | `/sessions/:id/end`               | teacher          | End a session                                        |
| GET    | `/sessions/:id/qr-stream`         | teacher (via WS) | Live rotating 3-QR-code sequence                     |
| POST   | `/attendance/scan`                | student          | Submit decoded 3-code sequence + scan_started_at     |
| GET    | `/attendance/me`                  | student          | Own attendance summary, per-classroom                |
| GET    | `/attendance/session/:id`         | teacher          | Live roster of who's marked present                  |

WebSocket events (Socket.io namespace per session):

- `qr:rotate` (server → teacher web) — next signed QR payload
- `attendance:marked` (server → teacher web) — student just validated

---

## 6. Core UI Shell

Built once in Part 1, reused by every later part and every future iteration.

**Navigation structure (both web and Flutter, mirrored):**

```
[Classrooms]  [Attendance]  [PulseMeter*]  [Quizzes*]  [Forum*]  [Profile]
```

`*` = visible but disabled with a "Coming soon" badge in Iteration 1. Do not
hide these tabs — they must exist in the nav from Part 1 onward so later
iterations only need to un-disable them and route in the real screens.

**Layout primitives** (define once, reuse everywhere):

- App shell with top bar (role-aware: teacher vs student) + bottom/side nav
- Classroom card component (used in classroom list, roster, homepage)
- Empty-state component (used across future features too)

---

## 7. Future Feature Hooks

Explicitly documented so Part 1's scaffolding doesn't need rework later:

- **PulseMeter**: will render as a new tab inside a per-classroom tabbed view
  (`Classroom Detail → [Overview | PulseMeter | Quizzes | Forum]`). Reserve
  this tab strip in the classroom detail screen now, even though only
  "Overview" (attendance-related) is functional in Iteration 1.
- **Live Quizzing**: same tab strip; leaderboard will live under a "Past
  Quizzes" sub-route already reserved in the routing table.
- **Doubt Forum**: needs an audience-scope selector (app-wide / course-wide /
  classroom-specific) — reserve this as a disabled dropdown pattern reusable
  from Part 1's component library.
- **Homepages** (Part 6 in this doc): teacher and student homepages are built
  attendance-only now, but their layout should use a card-grid pattern that
  later accepts additional summary cards (quiz performance, doubt activity)
  without restructuring the page.

---

## 8. Part-by-Part Build Sequence

Each part must be independently reviewable and deployed before the next
begins, per `prompt.md`'s working rules.

### Part 1 — Project Scaffold + Core UI Shell

**Setup before this part:**

1. Create a GitHub account if you don't have one, and a new (private is fine)
   repository for this project.
2. Nothing else needed yet — this part runs entirely on your own laptop.

**Build:**

- Monorepo or multi-repo structure: `web/`, `backend/`, `mobile/`
- Next.js app with MUI Material 3 theme configured
- Flutter app skeleton with matching Material 3 theme (same tokens as web)
- Express backend skeleton with `/health` endpoint
- Nav structure and layout primitives from Section 6, including disabled
  future-feature tabs
- **Acceptance:** web and Flutter apps run locally, show matching themed nav
  shells with placeholder tabs visibly disabled; backend responds on `/health`.

### Part 2 — Auth & Roles

**Setup before this part** (do both now, even though Redis isn't used until
Part 4 — gathering all cloud credentials in one sitting is easier than doing
it piecemeal):

1. **Neon (Postgres)** — go to neon.tech, sign up free (no card needed),
   create a new project. On the project dashboard, copy the "connection
   string" shown (starts with `postgres://`). Paste it into your backend's
   `.env` file as `DATABASE_URL`.
2. **Upstash (Redis)** — go to upstash.com, sign up free, create a new Redis
   database, choose a region close to you. Copy the connection string it
   gives you and paste it into `.env` as `REDIS_URL`.
3. Also generate a random secret string for `JWT_SECRET` (the AI can generate
   this for you — it's not tied to any account).

**Build:**

- JWT auth (signup/login) on backend, bcrypt password hashing
- Teacher vs student role stored and enforced via middleware
- Signup/login screens on web and Flutter
- Route guards on both platforms (unauthenticated → login; wrong role → blocked)
- **Acceptance:** a teacher and a student account can each sign up, log in,
  and see a role-appropriate empty shell; protected routes reject bad/missing tokens.

### Part 3 — Classroom Management & Join Flow

- Teacher: create classroom from predefined course list, view roster, generate/regenerate join code+link+QR
- Student (web + app): join via code entry, link, or QR scan; see joined classrooms list
- **Acceptance:** a teacher creates a classroom and a student joins it via each of the three methods (code, link, QR), and both see it reflected in their respective classroom lists.

### Part 4 — Attendance Session Engine (Backend)

**Setup before this part:** none — this is where the `REDIS_URL` you set up
in Part 2 starts actually getting used, for storing short-lived QR tokens.

**Build:**

- Session start/end logic
- Signed, timestamped 3-QR-token generator (HMAC), Redis-backed short-lived tokens
- Validation endpoint: sequence correctness + ≤10s freshness check
- ACL timestamp logging (`scan_started_at` vs `validated_at`)
- **Acceptance:** via direct API calls (Postman/curl), a session can be started, tokens generated and rotated, and a simulated scan validated or correctly rejected (stale/out-of-order).

### Part 5 — QR Display (Web) + Multi-Frame Scanner (Flutter)

**Setup before this part** (needed now because a physical phone can't reach
your laptop's `localhost` over Wi-Fi — you need a real deployed backend URL
to test the scan flow on an actual device):

1. **Render (backend)** — go to render.com, sign up free, click "New Web
   Service," connect your GitHub repo, point it at the `backend/` folder.
   Paste in the same environment variables from your `.env` (`DATABASE_URL`,
   `REDIS_URL`, `JWT_SECRET`, etc.) into Render's dashboard under
   "Environment." Once deployed, Render gives you a live URL
   (e.g. `https://your-app.onrender.com`) — this is your backend's real address.
2. **Vercel (web)** — go to vercel.com, sign up free, import the same GitHub
   repo, point it at the `web/` folder, deploy. Set the `NEXT_PUBLIC_API_URL`
   environment variable to your Render URL from step 1.
3. Update the Flutter app's API base URL to point at the Render URL as well,
   instead of `localhost`.

**Build:**

- Web: teacher's live session view streaming the rotating 3-QR sequence via Socket.io
- Flutter: camera + ML Kit multi-frame decode, submits to `/attendance/scan`, shows on-device confirmation
- **Acceptance:** end-to-end on real devices — teacher starts a session, projects/displays the QR stream, a student scans on the Flutter app, and is marked PRESENT with the teacher's dashboard updating live. This is the proposal's Iteration 1 success criterion.

### Part 6 — Homepages & Dashboards

- Student: combined attendance summary with per-subject drill-down
- Teacher: roster + class-level attendance trend + per-student drill-down
- Built with the card-grid pattern from Section 7 (future-proofed for quiz/forum summary cards)
- **Acceptance:** both homepages show accurate data matching what's in the database after Part 5's test scans.

### Part 7 — CI/CD

**Setup before this part:**

1. **Firebase (App Distribution)** — go to console.firebase.google.com, sign
   up/sign in with a Google account, click "Add project," name it (e.g.
   "ClassPulse"). Inside the project, add an Android app, following the
   prompts to register the app's package name (the AI can tell you this
   from the Flutter project config). Download the generated
   `google-services.json` config file and place it where the AI instructs in
   the Flutter project. In the Firebase console's left sidebar, find
   "App Distribution" and enable it — no further setup needed until you're
   ready to invite testers, which happens after this part is built.
2. Nothing else — GitHub Actions runs on your existing GitHub account for free.

**Build:**

- GitHub Actions: build/lint/test on every push for web + backend
- Android build pipeline (Gradle) producing a signed testable APK
- Auto-deploy web → Vercel, backend → Render on merge to main
- APK auto-upload to Firebase App Distribution on tagged releases
- **Acceptance:** a push to main results in live updated web + backend deployments, and a tagged release produces an APK that pilot testers receive via Firebase App Distribution invite.

---

## 9. Explicit Non-Goals for Iteration 1

Do not build, even partially: PulseMeter logic, quiz engine, doubt forum,
search, word-cloud moderation, AI-assisted authoring. These are Section 9.2/9.3
of the proposal and belong to later iterations — Section 7 above defines their
*only* footprint in Iteration 1 (disabled UI placeholders and reserved routes).
