# ClassPulse — Development Progress & Handover State

> **Purpose**: This document tracks the exact implementation progress, completed build steps, architectural decisions, and remaining tasks for ClassPulse. It serves as a single source of truth for seamless continuation of work across AI coding assistants, account switches, or quota resets.

---

## Source Specifications & Governing Rules

This project is built strictly according to the following 3 core specification files located in the repository root:

1. **[`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md)**
   - Defines the 7-part strict sequential build process, working rules, tech stack choices, and definition of done for Iteration 1.
2. **[`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md)**
   - Source of truth for architecture, database schema, REST API endpoints, Socket.io events, design system guidelines, and future feature hooks.
3. **[`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md)**
   - **STRICT RULE**: The entire website (MUI) and mobile app (Flutter) must be designed to be used in **LIGHT MODE ONLY**. No dark theme, mode toggle, or dark-mode media query handling is allowed (not even stubbed).

---

## Overall Build Status — Iteration 1 (100% Completed)

| Part             | Name                                     | Status        | Git Commit                                 | Key Artifacts / Features Built                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------- | ------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Part 1**       | Project Scaffold + Core UI Shell         | **COMPLETED** | `43c5887`                                  | Monorepo layout (`backend/`, `web/`, `mobile/`), Express `/health` API, M3 Design System Tokens, Web & Flutter UI shells with disabled future tabs (`PulseMeter*`, `Quizzes*`, `Forum*`).                                                                                                                                                                                                                                                                |
| **Part 2**       | Auth & Roles                             | **COMPLETED** | `1f3cb99`, `9d0a015`                       | Neon PostgreSQL tables (`users`, `courses`, `classrooms`, `enrollments`, `sessions`, `attendance_records`), bcrypt password hashing, signed JWT auth API (`/auth/signup`, `/auth/login`, `/auth/me`), Instructor-only Web dashboard restriction (`9d0a015`), Mobile Flutter Light-Mode login/signup screens.                                                                                                                                             |
| **Part 3**       | Classroom Management & Join Flow         | **COMPLETED** | `4b60326`                                  | `GET /courses`, `POST /classrooms`, `POST /classrooms/:id/regenerate-join`, `POST /classrooms/join`, `GET /classrooms/mine`, `GET /classrooms/:id/roster` REST endpoints; Web: `CreateClassroomDialog`, `ClassroomJoinDetailsModal` (join code + copyable link + code regeneration), `ClassroomRosterDialog`; Mobile: `ClassroomService`, `JoinClassroomDialog` widget; Live classroom grid on Instructor Dashboard.                                     |
| **Part 4**       | Attendance Session Engine                | **COMPLETED** | `1293fe9`                                  | Upstash Redis connection & cache management, HMAC-SHA256 3-QR token generator with short-lived batches (15s TTL), `POST /sessions` (start), `POST /sessions/:id/end` (end), `GET /sessions/:id/active-tokens`, `POST /attendance/scan` (enforces order `[0,1,2]`, HMAC signature, $\le 10\text{s}$ freshness, enrollment, duplicate check, and logs ACL latency), `GET /attendance/session/:id`, `GET /attendance/me`, and Socket.io server integration. |
| **Part 5**       | QR Display (Web) + Scanner (Flutter)     | **COMPLETED** | `4390a80`                                  | Live Web 3-QR rotating projector (`LiveSessionModal.tsx`) with Socket.io real-time roster feed and ACL chips; Flutter multi-frame camera scanner (`QrScannerScreen.dart`) with 3-frame sequence buffer and instant Attendance Capture Latency display.                                                                                                                                                                                                   |
| **Part 6**       | Homepages & Dashboards                   | **COMPLETED** | `5959c99`                                  | Teacher analytics dashboard (`AttendanceAnalyticsView.tsx`) with 4 top metrics, student attendance performance table, student drill-down modal, past sessions timeline, and future-proof card grid (`PulseMeter*`, `Quizzes*`, `Forum*`); Student mobile attendance dashboard (`attendance_dashboard_screen.dart`) with overall percentage card, per-subject breakdown, and interactive session history drill-downs.                                     |
| **Part 7**       | CI/CD & Distribution                     | **COMPLETED** | `10682c8`                                  | GitHub Actions multi-job pipeline (`.github/workflows/ci.yml`) for automated backend, web, and mobile testing & APK generation; Android camera & internet permissions; and comprehensive [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/DEPLOYMENT_GUIDE.md).                                                                                                                              |
| **Enhancements** | Lifecycle Management                     | **COMPLETED** | `b35c404`                                  | Teacher classroom deletion (end of semester cascade delete) with M3 red confirmation dialog (`DELETE /classrooms/:id`); Student unenrollment on mobile via long-press bottom sheet (`DELETE /classrooms/:id/leave`).                                                                                                                                                                                                                                     |
| **Enhancements** | Projector Distance Scanning              | **COMPLETED** | `1520387`, `df18324`, `2a2c114`, `e4277bf` | Edge-to-edge maximized QR code (`calc(100vh - 32px)`) in Fullscreen Projector mode with zero wasted top/bottom margins; Real-time `800ms / 300ms / 100ms` stream rotation speed selector; Flutter mobile scanner with `[1x, 2x, 5x, 10x, 15x, 20x]` zoom buttons for far-distance scanning.                                                                                                                                                              |
| **Enhancements** | Analytics Navigation & Robustness        | **COMPLETED** | `4b4ec09`                                  | Fixed mobile attendance dashboard type casting for String vs num PostgreSQL numerics; Connected top navigation "Attendance" tab in web dashboard to dedicated section analytics view with live section selector dropdown.                                                                                                                                                                                                                                |
| **Enhancements** | CI Pipeline & AGP/Gradle Compatibility   | **COMPLETED** | `512a811`                                  | Upgraded AGP to `8.11.1` in `settings.gradle.kts`, updated Gradle wrapper to `8.14`, and added `--android-skip-build-dependency-validation` in CI workflow.                                                                                                                                                                                                                                                                                              |
| **Enhancements** | Matrix Export, Override & Warning System | **COMPLETED** | `f414b4f`                                  | CSV & Excel (.xlsx) matrix report generator (`exportService.js`); Teacher manual attendance override (`POST /attendance/override`); Low-attendance shortage warnings on Web & Mobile + `nodemailer` email dispatch engine (`emailService.js`).                                                                                                                                                                                                           |

---

## Overall Build Status — Iteration 2

| Part             | Name                                     | Status        | Git Commit                                 | Key Artifacts / Features Built                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------- | ------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Part 1**       | Analytics Foundation & Retrofit          | **COMPLETED** | `bb14ed0`                                  | Recharts (Web) and `fl_chart` (Mobile) dependencies; M3 Light-Mode chart tokens (`tokens.ts`, `tokens.dart`); Web Teacher Analytics retrofit with attendance % turnout trend (`AreaChart`) and ACL latency (`BarChart`); Mobile Student Attendance Dashboard retrofit with per-subject attendance comparison (`BarChart`) and 75% threshold indicator.                                                                                                |
| **Part 2**       | PulseMeter: Schema & Authoring           | **COMPLETED** | `bb14ed0`                                  | `live_activities`, `pulsemeters`, `pulsemeter_responses`, `word_cloud_mutes` tables; `POST /pulsemeters` and `GET /pulsemeters` REST routes; Web `CreatePulseMeterDialog` and `PulseMeterAuthoringView` for Word Cloud, MCQ, and Rating Scale feedback.                                                                                                                                                                                              |
| **Part 3**       | PulseMeter: Live Session & Analytics     | **COMPLETED** | `bb14ed0`                                  | One-click launch (`POST /pulsemeters/:id/launch`), mutual exclusion enforcement, student response submission (`POST /live-activities/:id/respond`), live Recharts charts on Web (`LivePulseMeterModal`), Mobile student response UI (`LivePulseMeterScreen`, `PulseMeterStudentView`), Section 4b pending attendance resolution on session end, and word-cloud moderation mute system (`WordCloudMuteDialog`). |
| **Part 4**       | Live Quizzing: Schema & Authoring        | **COMPLETED** | `bb14ed0`                                  | `quizzes`, `quiz_questions`, `quiz_responses` tables; `POST /quizzes` and `GET /quizzes` REST endpoints with transaction-safe authoring; Web `CreateQuizDialog` with WIDE (300-1000 pts) / NARROW (700-1000 pts) scoring mode toggle and dynamic multi-question builder; Web `QuizAuthoringView` with question accordions and disabled launch hooks. |
| **Part 5**       | Live Quizzing: Session & Leaderboard     | **COMPLETED** | `bb14ed0`                                  | Server-clock synced question countdowns (`POST /live-activities/:id/quiz/start-question`), student answering with Section 4a WIDE/NARROW scoring formula (`POST /live-activities/:id/quiz/answer`), live Recharts answer reveal & distribution (`LiveQuizModal`), Web live cumulative leaderboard & final podium, Mobile student live quiz screen (`LiveQuizStudentScreen`, `PulseMeterStudentView`). |
| **Part 6**       | Doubt Forum                              | **COMPLETED** | `bb14ed0`                                  | `course_topics`, `pseudonym_assignments`, `doubt_posts`, `doubt_replies`, `doubt_helpful_marks`, `doubt_moderation_flags` tables; 3 audience scopes (`APP`, `COURSE`, `CLASSROOM`), deterministic per-course pseudonym generator, teacher reveal-name, helpful marks, solution acceptance, teacher endorsements; Web `DoubtForumView`, `CreateDoubtDialog`, `DoubtDetailModal`; Mobile `DoubtForumScreen`, `CreateDoubtScreen`, `DoubtDetailScreen`. |
| **Part 7**       | Audience-Scoped Search                   | **COMPLETED** | `bb14ed0`                                  | Postgres full-text search with `tsvector`/`tsquery` GIN index (`idx_doubt_posts_search_gin`); weighted ranking (`ts_rank`) with title (weight 'A') and body (weight 'B'); `GET /search` REST API with audience scope resolution (`ALL`, `APP`, `COURSE`, `CLASSROOM`), topic/status filters, headline generation (`ts_headline`); Web & Mobile search integration. |
| **Part 8**       | Unified Homepages & Card-Grid            | **COMPLETED** | `bb14ed0`                                  | Cross-feature card-grid combining attendance rate, quiz and PulseMeter counts, open doubt badges, and full overview summary drill-down on Web (`ClassroomCard`, `page.tsx`) and Mobile (`classroom_card.dart`, `ClassroomsHomeView`). |

---

## Detailed Log of Completed Actions

### Action 1: Environment & Repository Initialization (Part 1)

- **Git Repo**: Cloned empty GitHub repository `https://github.com/priyamgoel/classpulse-1.git` locally.
- **Monorepo Layout**: Created `backend/`, `web/`, `mobile/`, `README.md`, and `.gitignore`.
- **Backend Setup**: Scaffolded Express server on port 4000 with GET `/health` endpoint returning server status & timestamp.
- **Shared Material 3 System**: Defined canonical M3 design tokens (`#6750A4` seed color) in `web/src/theme/tokens.ts` and `mobile/lib/theme/tokens.dart`.
- **UI Shells**: Built mirrored navigation bars across Web (Next.js + MUI) and Mobile (Flutter) with disabled tabs (`PulseMeter*`, `Quizzes*`, `Forum*`) displaying "Coming soon" badges.
- **Verification**: `curl http://localhost:4000/health` (200 OK), `npm run build` in `web/` (0 errors), `flutter analyze && flutter test` in `mobile/` (0 errors).

### Action 2: Cloud Database Setup & Credentials Gathering

- **Neon (PostgreSQL)**: Connected to Neon Postgres database instance via `DATABASE_URL` in `backend/.env`.
- **Upstash (Redis)**: Configured Upstash Redis connection via `REDIS_URL` in `backend/.env`.

### Action 3: Database Migration & Authentication System (Part 2)

- **Database Schema**: Created automated initialization script (`backend/src/db/index.js`) executing `backend/src/db/schema.sql` on startup. Created tables `users`, `courses`, `classrooms`, `enrollments`, `sessions`, `attendance_records` and pre-seeded course catalog.
- **Backend Auth Controller**: Created `backend/src/routes/auth.js` with `POST /auth/signup`, `POST /auth/login`, and `GET /auth/me`. Passwords hashed with `bcryptjs`, 7-day JWT tokens issued using `jsonwebtoken`.
- **Auth Middleware**: Created `backend/src/middleware/auth.js` enforcing token verification and role restrictions (`teacher` vs `student`).
- **Web App Scope Adjustment (Teacher-Only)**: Updated `web/src/app/login/page.tsx` and `web/src/app/signup/page.tsx` so Web Dashboard exclusively registers and logs in Instructor/Teacher accounts (`9d0a015`). Student accounts attempting Web login receive a friendly M3 Alert directing them to the Android mobile app.
- **Mobile App Auth**: Built `mobile/lib/services/auth_service.dart`, Light Mode `LoginScreen`, Light Mode `SignupScreen` with Role segmented button, and stateful app routing.
- **UI Polish**: Fixed `ClassroomCard` hover outline distortion by moving selection border directly into `Card` styling with `overflow: hidden` and smooth 0.15s border color transition (`88dce29`).
- **Verification**: Tested signup/login for both Teacher and Student roles, verified `/auth/me` protected endpoint and 401 Unauthorized rejection. Web build and Flutter analysis passed cleanly.

### Action 4: Classroom Management & Join Flow (Part 3) — Commit `4b60326`

- **Backend Routes**: `GET /courses`, `POST /classrooms`, `POST /classrooms/:id/regenerate-join`, `POST /classrooms/join`, `GET /classrooms/mine`, `GET /classrooms/:id/roster`.
- **Web Components**: `CreateClassroomDialog.tsx`, `ClassroomJoinDetailsModal.tsx`, `ClassroomRosterDialog.tsx`, and live Instructor Dashboard grid.
- **Mobile Components**: `ClassroomService`, `JoinClassroomDialog` (6-char code input), and live enrolled classroom view.
- **Verification**: All API endpoints tested; web & mobile builds passed with 0 errors.

### Action 5: Attendance Session Engine (Part 4) — Commit `1293fe9`

- **Redis Client (`backend/src/redis/index.js`)**: Connected to Upstash Redis with auto-reconnection and in-memory fallback.
- **Cryptographic Anti-Proxy Service (`backend/src/services/qrTokenService.js`)**:
  - Generated HMAC-SHA256 signed 3-QR token batches (`seq_idx: 0, 1, 2`) with 15-second TTL in Redis.
  - Built validation pipeline enforcing sequence ordering, signature authenticity, freshness window ($\le 10\text{s}$), active Redis batch lookup, classroom enrollment, and duplicate check.
  - Logged `scan_started_at` vs `validated_at` in PostgreSQL and computed Attendance Capture Latency (`acl_ms`).
- **Session & Attendance REST Routes (`backend/src/routes/sessions.js`, `backend/src/routes/attendance.js`)**:
  - `POST /sessions` (teacher starts session).
  - `POST /sessions/:id/end` (teacher ends session).
  - `GET /sessions/:id/active-tokens` (generates current rotating 3-QR token batch).
  - `POST /attendance/scan` (student submits scan with ACL calculation and broadcasts `attendance:marked` via Socket.io).
  - `GET /attendance/session/:id` (teacher views live attendance roster).
  - `GET /attendance/me` (student views personal attendance summary).
- **Socket.io Layer**: Configured WebSocket server on Express with session room management (`join_session`, `leave_session`).
- **Verification**: Executed automated verification suite testing: session start, token generation, valid scan with ACL calculation (353ms), duplicate scan rejection (409 Conflict), out-of-order sequence rejection (400 Bad Request), expired token rejection (400 Bad Request), tampered signature rejection (400 Bad Request), live roster retrieval, and session termination.

### Action 6: QR Display (Web) & Scanner (Flutter) (Part 5) — Commit `4390a80`

- **Web Projector Component (`web/src/components/LiveSessionModal.tsx`)**:
  - Fullscreen/modal projector displaying high-definition SVG rotating QR stream (`qrcode.react`) switching every 800ms across indices `[0, 1, 2]`.
  - Connected to Socket.io `session_${sessionId}` room; automatically appends newly validated students to the live roster feed in real-time without refreshing.
  - Displays student name, email, and live Attendance Capture Latency chip (`⚡ ACL: 413ms`).
  - Added "Start Attendance Session" trigger button on Instructor Dashboard.
- **Mobile Multi-Frame Scanner (`mobile/lib/screens/qr_scanner_screen.dart`)**:
  - Built camera scanner using `mobile_scanner` with viewfinder target HUD.
  - Implemented multi-frame buffer accumulating tokens `[0, 1, 2]` for the active batch.
  - Recorded `scan_started_at` timestamp on first detected frame and submitted sequence to `POST /attendance/scan`.
  - Displayed M3 success dialog with `PRESENT` status and Attendance Capture Latency metric (`ACL: XXXms`).
  - Added "Scan Attendance QR" fast-action card on student home screen.
- **Verification**: End-to-end Socket.io event delivery verified; Web build passed (`npm run build` compiled 6 static pages); Flutter analyze & tests passed with 0 issues.

### Action 7: Homepages & Dashboards (Part 6) — Commit `5959c99`

- **Backend Analytics Endpoints (`backend/src/routes/attendance.js`)**:
  - `GET /attendance/classroom/:id/summary`: Returns section stats (total sessions, enrolled headcount, avg attendance %, avg ACL ms), past sessions log, and per-student performance.
  - `GET /attendance/classroom/:id/student/:studentId`: Returns student-specific session attendance history and timestamps.
  - `GET /attendance/me`: Returns student's overall attendance rate and per-course attendance records.
- **Web Analytics & Drill-Downs (`web/src/components/AttendanceAnalyticsView.tsx`, `web/src/app/page.tsx`)**:
  - 4 Metric Cards: Class Attendance %, Sessions Conducted, Enrolled Count, Avg Capture Latency.
  - Student Attendance Table with progress bars and "View Log" drilldown modal.
  - Past Sessions Timeline table with headcount and ACL latency metrics.
  - Future Feature Hooks Card Grid: M3 cards for `PulseMeter*`, `Quizzes*`, `Forum*` with "Coming soon in Iteration 2" badges.
- **Mobile Student Attendance Dashboard (`mobile/lib/screens/attendance_dashboard_screen.dart`, `mobile/lib/main.dart`)**:
  - Overall attendance progress card with percentage and total sessions count.
  - Enrolled subjects breakdown cards with individual attendance rate progress bars.
  - Interactive bottom sheet drill-down showing chronological session history with ACL capture latencies.
  - Stateful tab switching in `AppShell` connecting `[Classrooms]`, `[Attendance]`, and `[Profile]`.
- **Verification**: API responses tested; Web Next.js build compiled successfully (`npm run build`); Flutter analyze & test passed with 0 errors.

### Action 8: CI/CD & Distribution (Part 7) — Commit `10682c8`

- **GitHub Actions Multi-Job Pipeline (`.github/workflows/ci.yml`)**:
  - Automated CI workflow executing on every push to `main`: `backend-ci` (Node 20), `web-ci` (Next.js production build), and `mobile-ci` (Java 17, Flutter 3.x, analyze, test, and debug APK build).
- **Android Permissions & Configuration**: Configured `INTERNET`, `CAMERA`, and autofocus hardware features in `mobile/android/app/src/main/AndroidManifest.xml` with app label `ClassPulse`.
  
  ### Action 9: CI Pipeline & AGP/Gradle Compatibility Fix
- **Issue**: Flutter's `dev.flutter.flutter-gradle-plugin` enforces strict minimum checks: Gradle >= 8.14.0 and AGP >= 8.11.1.
- **Fix**:
  - Upgraded Gradle wrapper to `https\://services.gradle.org/distributions/gradle-8.14-all.zip` in `mobile/android/gradle/wrapper/gradle-wrapper.properties`.
  - Upgraded Android Gradle Plugin to `8.11.1` in `mobile/android/settings.gradle.kts`.
  - Added `--android-skip-build-dependency-validation` flag to `flutter build apk` step in `.github/workflows/ci.yml` to prevent runner version mismatches from breaking CI builds.

### Action 10: Matrix Export, Manual Override & Low Attendance Email Warnings

- **CSV & Excel (.xlsx) Matrix Exporter (`backend/src/services/exportService.js`)**:
  - Implemented attendance matrix generation with students in rows and chronological sessions in columns (`S1, S2, ...`).
  - Marked entries using standard `P` (Present) and `A` (Absent), with summary columns for total attended, total sessions, percentage, and eligibility status (`Eligible` vs `Shortage Warning`).
  - Added formatted `.xlsx` output using `exceljs` with custom header styles, colored status cells, and auto-adjusted column widths.
  - Added REST endpoint: `GET /attendance/classroom/:id/export?format=csv|xlsx`.
- **Manual Attendance Override (`backend/src/routes/attendance.js`, `web/src/components/AttendanceAnalyticsView.tsx`)**:
  - Added endpoint `POST /attendance/override` allowing instructors to manually flip a student's attendance between `PRESENT` and `ABSENT`.
  - Added interactive "Mark Present" / "Mark Absent" action controls inside the Student Drill-Down modal with instantaneous optimistic UI updates.
- **Low Attendance Warning & Email Dispatch Engine (`backend/src/services/emailService.js`, `mobile/.../attendance_dashboard_screen.dart`)**:
  - Added `nodemailer` integration with HTML/plain-text email templates informing students when attendance falls below the 75% threshold.
  - Added instructor-triggered warning modal on Web Analytics (`POST /attendance/classroom/:id/send-warnings`) showing flagged student count and one-click email blast.
  - Added M3 warning alert banners and shortage chips across both Teacher Web Dashboard and Student Mobile App.

### Action 11: Analytics Foundation & Retrofit (Iteration 2 — Part 1)

- **Charting Dependencies & Theming Tokens**:
  - Installed `recharts` on Web and `fl_chart` on Mobile Flutter.
  - Added canonical M3 light-mode chart design tokens in `web/src/theme/tokens.ts` (`chartTokens`) and `mobile/lib/theme/tokens.dart` (`ChartTokens`).
- **Web Teacher Classroom Analytics Retrofit (`web/src/components/AttendanceAnalyticsView.tsx`)**:
  - Implemented attendance turnout percentage trend across chronological sessions using Recharts `AreaChart` with smooth gradient fills, session tooltips, and a 75% attendance threshold reference line.
  - Implemented average Attendance Capture Latency (ACL) response speed bar chart using Recharts `BarChart` with millisecond units and custom tooltips.
- **Mobile Student Attendance Dashboard Retrofit (`mobile/lib/screens/attendance_dashboard_screen.dart`)**:
  - Replaced/augmented basic progress meters with an interactive `fl_chart` `BarChart` comparing per-subject attendance percentages with 75% requirement guideline.
  - Color-coded bars using M3 Primary (`#6750A4`) for eligible courses and M3 Error (`#B3261E`) for shortage warnings, with rich touch tooltips.
- **Verification**: `npm run build` in `web/` passed with 0 errors; `flutter analyze` in `mobile/` passed with 0 issues; `flutter test` passed all test suites.

### Action 12: PulseMeter Schema & Authoring (Iteration 2 — Part 2)

- **PostgreSQL Database Schema & Neon Migration (`backend/src/db/schema.sql`)**:
  - Created `live_activities` table with `activity_type IN ('PULSEMETER', 'QUIZ')`, `status IN ('ACTIVE', 'ENDED')`, `attendance_session_id`, and `attendance_pending`.
  - Enforced mutual exclusion with partial unique index `one_active_activity_per_classroom` (`WHERE status = 'ACTIVE'`).
  - Created `pulsemeters` table supporting `WORD_CLOUD`, `MCQ`, and `RATING_SCALE` response types with structured `JSONB` configurations.
  - Created `pulsemeter_responses` table with unique constraint `(live_activity_id, student_id)`.
  - Created `word_cloud_mutes` table with `student_id`, `classroom_id`, `muted_by`, `reason`, and `muted_until` timestamp.
- **Backend Authoring & Listing REST API (`backend/src/routes/pulsemeters.js`, `backend/src/index.js`)**:
  - Implemented `POST /pulsemeters`: validates classroom ownership and role (`teacher`), performs type-specific JSON sanitization, and returns 201 Created with the persisted entity.
  - Implemented `GET /pulsemeters?classroom_id=...`: returns all authored PulseMeters for a section sorted chronologically.
  - Added negative test validation rejecting invalid types and malformed configurations with 400 Bad Request.
- **Web Teacher Authoring Interface (`web/src/components/CreatePulseMeterDialog.tsx`, `web/src/components/PulseMeterAuthoringView.tsx`)**:
  - Built `CreatePulseMeterDialog` supporting dynamic forms for all three response types (dynamic option inputs for MCQ, 1–5 / 1–10 Likert scales with custom labels, and Word Cloud prompt inputs).
  - Built `PulseMeterAuthoringView` rendering authored activity cards with M3 type badges, preview summaries, and disabled `// TODO(part3):` live launch hooks.
  - Un-disabled the PulseMeter tab across `AppShell` and `page.tsx` Classroom Detail view.
- **Verification**: Integration test suite `test_pulsemeters.js` verified DB persistence and REST routes; Next.js production build `npm run build` passed with 0 errors.

### Action 13: PulseMeter Live Session, Analytics & Moderation (Iteration 2 — Part 3)

- **Backend Live Activity Management & Endpoints (`backend/src/routes/liveActivities.js`, `backend/src/routes/pulsemeters.js`, `backend/src/routes/wordCloudMutes.js`)**:
  - Implemented `POST /pulsemeters/:id/launch`: launches reusable activity as the live activity for the section, enforces mutual exclusion (409 conflict when another activity is live), emits `activity:launched` via Socket.io.
  - Implemented `POST /live-activities/:id/respond`: handles student responses, validates classroom enrollment, prevents duplicate answers (409), checks active `word_cloud_mutes` (403), and broadcasts live aggregated results via `pulsemeter:results` and `activity:response_count`.
  - Implemented `POST /word-cloud-mutes`: teacher moderation with confirmed duration picker (`7, 14, 30, 90, 180` days) and optional reason.
  - Implemented `GET /live-activities/:id/analytics`: aggregates response count, present count, attendance pending state, and type-specific distribution (MCQ options, Rating scale histogram, Word Cloud frequencies).
  - Implemented `POST /live-activities/:id/end`: sets activity to `ENDED` and broadcasts `activity:ended`.
  - Implemented Section 4b auto-resolution in `POST /sessions/:id/end` (`backend/src/routes/sessions.js`) which automatically links pending live activities to the ended attendance session.
- **Web Teacher Live Interface (`web/src/components/LivePulseMeterModal.tsx`, `web/src/components/WordCloudMuteDialog.tsx`, `web/src/components/PulseMeterAuthoringView.tsx`)**:
  - Connected "Launch PulseMeter" button with active state and error feedback.
  - Built `LivePulseMeterModal` with real-time Socket.io updates:
    - MCQ: Live Recharts `BarChart` of option distribution with custom M3 palette.
    - Rating Scale: Live Recharts histogram.
    - Word Cloud: Dynamic font-scaled SVG/flex word cloud with individual "Mute Student" action opening `WordCloudMuteDialog`.
    - Turnout Donut: Present-vs-responded participation rate donut (or clear pending badge if attendance is pending).
- **Mobile Student Participation (`mobile/lib/screens/live_pulsemeter_screen.dart`, `mobile/lib/screens/pulsemeter_student_view.dart`, `mobile/lib/widgets/app_shell.dart`, `mobile/lib/main.dart`)**:
  - Enabled PulseMeter tab in AppShell and classroom detail tab strip.
  - Built `PulseMeterStudentView` allowing students to detect live activities and jump into responses.
  - Built `LivePulseMeterScreen` supporting Word Cloud text input (with mute handling), MCQ radio cards, and Rating Scale 1..max chip selectors with submission confirmation states.
- **Verification**: Ran full integration test suite (`test_part3_live_pulsemeter.js`) verifying launch, mutual exclusion, responses, duplicate rejection, moderation mute blocking, live analytics, activity end, and attendance pending auto-resolution. Next.js production build (`npm run build`) passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

### Action 14: Live Quizzing Schema & Authoring (Iteration 2 — Part 4)

- **PostgreSQL Database Schema & Neon Migration (`backend/src/db/schema.sql`)**:
  - Created `quizzes` table with `classroom_id`, `created_by`, `title`, and `scoring_mode CHECK (scoring_mode IN ('WIDE', 'NARROW'))`.
  - Created `quiz_questions` table with `quiz_id`, `question_text`, `options` (`JSONB`), `correct_option_id`, `order_index`, and `time_limit_seconds`.
  - Created `quiz_responses` table with `live_activity_id`, `question_id`, `student_id`, `selected_option_id`, `is_correct`, `response_time_ms`, `score_awarded`, and unique constraint `(live_activity_id, question_id, student_id)`.
- **Backend Quizzing REST API (`backend/src/routes/quizzes.js`, `backend/src/index.js`)**:
  - Implemented `POST /quizzes`: validates teacher ownership, scoring mode (`'WIDE'` vs `'NARROW'`), question text, option counts (min 2, max 6), valid correct option ID, and time limits (5–120s) with transaction rollback safety.
  - Implemented `GET /quizzes?classroom_id=...`: lists authored quizzes with question counts and full question details sorted by order index.
  - Implemented negative test validation rejecting empty questions, invalid correct options, and malformed scoring modes with 400 Bad Request.
- **Web Teacher Quiz Authoring Interface (`web/src/components/CreateQuizDialog.tsx`, `web/src/components/QuizAuthoringView.tsx`, `web/src/app/page.tsx`, `web/src/components/AppShell.tsx`)**:
  - Built `CreateQuizDialog` with interactive WIDE (300–1000 pts speed focus) vs NARROW (700–1000 pts accuracy focus) radio cards, dynamic question adder/remover, time limit selectors (10s–60s), dynamic option inputs, and radio selector for designated correct answers.
  - Built `QuizAuthoringView` rendering cards with M3 scoring mode badges, total duration estimates, question accordions with correct answer chips, and disabled `// TODO(part5):` launch button hooks.
  - Enabled Quizzes navigation in `AppShell` and Classroom Detail tab strip (and dedicated Quizzes page).
- **Verification**: Integration test suite `test_part4_quizzes.js` verified DB persistence, transactions, and REST endpoints; Next.js production build `npm run build` passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

### Action 15: Live Quizzing Session & Leaderboard (Iteration 2 — Part 5)

- **Backend Live Quizzing Engine (`backend/src/routes/quizzes.js`, `backend/src/routes/liveActivities.js`)**:
  - Implemented `POST /quizzes/:id/launch`: creates `live_activities` row (`activity_type='QUIZ'`), enforces one-active-activity mutual exclusion (`409 Conflict`), resolves Section 4b attendance session, sanitizes `correct_option_id` for student privacy, and broadcasts `activity:launched`.
  - Implemented `POST /live-activities/:id/quiz/start-question`: stores server-clock question start time (`startTimeMs`) and broadcasts `quiz:question_start` with server timestamps for synchronized countdowns across clients.
  - Implemented `POST /live-activities/:id/quiz/answer`: verifies enrollment, enforces single answer submission per question (`409 Conflict`), computes response latency from server clock, evaluates correctness, calculates Section 4a scoring formula ($f = (T - t)/T$; WIDE mode: $300 + 700 \times f$; NARROW mode: $700 + 300 \times f$), inserts into `quiz_responses`, and emits `quiz:live_answers` live ticker.
  - Implemented `POST /live-activities/:id/quiz/show-results`: aggregates option distribution and cumulative leaderboard, broadcasting `quiz:question_results` to the classroom.
  - Implemented `GET /live-activities/:id/quiz/leaderboard`: retrieves cumulative ranked leaderboard with total score, accuracy, and average response times.
  - Implemented `POST /live-activities/:id/quiz/end`: concludes the quiz, marks activity `ENDED`, and broadcasts `quiz:ended` with podium standings.
- **Web Teacher Live Quiz Modal (`web/src/components/LiveQuizModal.tsx`, `web/src/components/QuizAuthoringView.tsx`)**:
  - Connected "Launch Live Quiz Session" button in `QuizAuthoringView`.
  - Built 4-stage `LiveQuizModal`:
    - Stage 1 (Lobby): Quiz overview, question count, and Start Question 1 button.
    - Stage 2 (Active Question): Synchronized timer progress bar, question prompt, option cards, and live answered counter.
    - Stage 3 (Results & Distribution): Recharts `BarChart` option breakdown with correct option highlighted in green (`chartTokens.success`), plus live cumulative leaderboard widget.
    - Stage 4 (Final Podium): Gold/Silver/Bronze podium cards with trophies, total scores, accuracy rates, and full ranked student table.
- **Mobile Student Live Quiz Participation (`mobile/lib/screens/live_quiz_student_screen.dart`, `mobile/lib/screens/pulsemeter_student_view.dart`, `mobile/lib/widgets/app_shell.dart`, `mobile/lib/main.dart`)**:
  - Built `LiveQuizStudentScreen`: synchronized timer countdown, radio option cards, instant submission, locked state feedback ("Answer Locked — Waiting for instructor reveal"), and points awarded confirmation (`+989 pts`).
  - Enabled Quizzes navigation in mobile `AppShell` and classroom detail tab strip.
- **Verification**: Integration test suite `test_part5_live_quiz_session.js` passed all 10 test steps (launch, mutual exclusion, server question start, WIDE/NARROW scoring calculations, duplicate answer rejection, results reveal, and podium finalization). Next.js production build (`npm run build`) passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

### Action 16: Doubt Forum (Iteration 2 — Part 6)

- **PostgreSQL Database Schema & Neon Migration (`backend/src/db/schema.sql`)**:
  - Created `course_topics` table: `id`, `course_id`, `name`, unique `(course_id, name)`.
  - Created `pseudonym_assignments` table: deterministic per-course pseudonym storage with unique `(user_id, course_id)`.
  - Created `doubt_posts` table: 3 audience scopes (`APP`, `COURSE`, `CLASSROOM`), `title`, `body`, `is_anonymous`, `pseudonym`, `status` (`'OPEN'`, `'RESOLVED'`, `'FLAGGED'`), `helpful_count`.
  - Created `doubt_replies` table: `doubt_post_id`, `author_id`, `body`, `is_anonymous`, `pseudonym`, `is_teacher_endorsed`, `is_solution`, `helpful_count`.
  - Created `doubt_helpful_marks` table: unique `(user_id, target_type, target_id)` to prevent double upvoting.
  - Created `doubt_moderation_flags` table for reporting inappropriate content.
- **Backend Doubt Forum REST API & Deterministic Pseudonym Utility (`backend/src/routes/doubts.js`, `backend/src/routes/topics.js`, `backend/src/utils/pseudonym.js`, `backend/src/index.js`)**:
  - Built `getOrAssignPseudonym(userId, courseId)` with 20 adjectives + 20 animals + 2-digit number hashed deterministically for persistent per-course pseudonymity.
  - Implemented `GET /courses/:id/topics` and `POST /courses/:id/topics`: topic creation and listing.
  - Implemented `GET /doubts`: multi-scope filter (`ALL`, `APP`, `COURSE`, `CLASSROOM`), topic chips filter, status filter, keyword search, and vote state tracking.
  - Implemented `POST /doubts`: creates doubt post with audience scope and optional persistent pseudonym.
  - Implemented `GET /doubts/:id`: full post thread and replies sorted with accepted solutions first.
  - Implemented `POST /doubts/:id/replies`: posts discussion replies.
  - Implemented `POST /doubts/helpful`: toggles upvote count atomically.
  - Implemented `POST /doubts/replies/:id/accept-solution`: marks reply as solution and resolves parent post.
  - Implemented `POST /doubts/replies/:id/endorse`: teacher endorsement badge toggle.
  - Implemented `POST /doubts/:id/reveal-author`: teacher-only unmasking of anonymous student identities for academic integrity.
- **Web Teacher & Student Doubt Forum Interface (`web/src/components/CreateDoubtDialog.tsx`, `web/src/components/DoubtDetailModal.tsx`, `web/src/components/DoubtForumView.tsx`, `web/src/app/page.tsx`, `web/src/components/AppShell.tsx`)**:
  - Built `CreateDoubtDialog` with 3 audience scope radio options, topic selector/creator, and pseudonym switch.
  - Built `DoubtDetailModal` displaying discussion threads, solution highlights, teacher endorsements, upvote buttons, instructor reveal controls, and reply composer.
  - Built `DoubtForumView` with scope tabs, topic scroll chips, search bar, and doubt cards list.
  - Enabled Forum nav item in `AppShell` and Classroom Detail tab strip.
- **Mobile Student Doubt Forum (`mobile/lib/screens/create_doubt_screen.dart`, `mobile/lib/screens/doubt_detail_screen.dart`, `mobile/lib/screens/doubt_forum_screen.dart`, `mobile/lib/widgets/app_shell.dart`, `mobile/lib/main.dart`)**:
  - Built `DoubtForumScreen` with scope filter chips, topic filters, post cards with upvoting and reply counters.
  - Built `CreateDoubtScreen` with scope selector, topic dropdown, and anonymous toggle.
  - Built `DoubtDetailScreen` with thread view, solution acceptance, and reply composer.
  - Enabled Forum navigation in mobile `AppShell` and classroom detail tab bar.
- **Verification**: Integration test suite `test_part6_doubt_forum.js` verified 10/10 test steps (topic creation, classroom/course/app posting, persistent pseudonym determinism, replies, upvoting, solution acceptance, teacher endorsements, instructor reveal, and scope filtering). Next.js production build (`npm run build`) passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

### Action 17: Audience-Scoped Full-Text Search (Iteration 2 — Part 7)

- **PostgreSQL Database Schema & GIN Index (`backend/src/db/schema.sql`)**:
  - Added stored generated `search_vector tsvector` column to `doubt_posts` combining weighted title (Weight 'A') and body (Weight 'B') with `'english'` dictionary.
  - Created GIN expression index `idx_doubt_posts_search_gin` on `doubt_posts(search_vector)` for fast sub-millisecond full-text queries.
  - Executed migration on Neon PostgreSQL.
- **Audience-Scoped Search REST API (`backend/src/routes/search.js`, `backend/src/index.js`)**:
  - Implemented `GET /search`:
    - Validates presence of `q` query string (returns `400 Bad Request` if empty).
    - Uses `plainto_tsquery('english', $q)` for natural language parsing, with partial keyword ILIKE fallback for abbreviations and codes.
    - Computes relevance ranking scores via `ts_rank(dp.search_vector, plainto_tsquery('english', $q))`.
    - Generates dynamic highlighted text snippets via `ts_headline` with `<b>...</b>` highlight delimiters.
    - Enforces audience scoping rules across `APP` (global), `COURSE` (course-wide), and `CLASSROOM` (section-only) contexts.
    - Supports topic and status filtering.
    - Preserves deterministic pseudonym anonymity while allowing teachers and authors to view real identities.
  - Mounted `/search` in `backend/src/index.js`.
- **Web & Mobile Search Integration (`web/src/components/DoubtForumView.tsx`, `mobile/lib/screens/doubt_forum_screen.dart`)**:
  - Connected search bar inputs in Web `DoubtForumView` and Mobile `DoubtForumScreen` to call `/search` endpoint when query terms are entered.
- **Verification**: Integration test suite `test_part7_search.js` verified 5/5 test cases (full-text ranking, scope filtering, headline generation, non-existent keyword handling, and missing query validation). Next.js production build (`npm run build`) passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

### Action 18: Unified Homepages & Cross-Feature Card-Grid (Iteration 2 — Part 8)

- **Backend Aggregated Micro-Metrics API (`backend/src/routes/classrooms.js`)**:
  - Enhanced `GET /classrooms/mine` with computed micro-metrics for each classroom section:
    - `attendance_avg_rate`: average percentage turnout across past sessions.
    - `quiz_count`: number of quizzes authored for this section.
    - `pulsemeter_count`: number of PulseMeters authored for this section.
    - `open_doubts_count` & `resolved_doubts_count`: active question counts.
  - Implemented `GET /classrooms/:id/summary`: returns comprehensive drill-down metrics covering attendance health, interactive engagement (PulseMeter/Quiz activity), and Doubt Forum status.
- **Web Unified Card-Grid & Drill-Down Dashboard (`web/src/components/ClassroomCard.tsx`, `web/src/app/page.tsx`)**:
  - Upgraded `ClassroomCard` with 3-chip micro-metrics strip (Turnout badge colored green $\ge 75\%$ or amber $< 75\%$, Quiz/PulseMeter counts, and Open Doubts indicator).
  - Connected classroom cards to dynamic selection and drill-down across Overview & Analytics, PulseMeter, Quizzes, and Doubt Forum tabs.
- **Mobile Student Card-Grid & Navigation (`mobile/lib/widgets/classroom_card.dart`, `mobile/lib/services/classroom_service.dart`, `mobile/lib/main.dart`)**:
  - Upgraded `ClassroomCardWidget` with micro-metrics chips for attendance %, quiz count, and open doubt count.
  - Connected bottom navigation and classroom detail tab bar for seamless navigation across all features.
- **Verification**: Integration test suite `test_part8_unified_homepage.js` verified enriched `GET /classrooms/mine` and `GET /classrooms/:id/summary` metrics. Next.js production build (`npm run build`) passed with 0 errors; Flutter analysis (`flutter analyze`) and unit tests (`flutter test`) passed with 0 issues.

---

## Instructions for Next AI Session / Handover

When resuming this project in a new AI assistant session or account:

1. Read `progress.md`, [`prompt.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/prompt.md), [`technical_specification.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/technical_specification.md), [`appearance_mode.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/appearance_mode.md), and [`DEPLOYMENT_GUIDE.md`](file:///C:/Users/priya/OneDrive/Documents/priyam-goel/5th-sem/ucs503_SE/classpulse-1/DEPLOYMENT_GUIDE.md).
2. **Iteration 1 is 100% built, verified, and committed.**
3. To test or demonstrate:
   - Backend: `cd backend && npm run dev`
   - Web: `cd web && npm run dev`
   - Mobile: `cd mobile && flutter run`
4. If the user asks to deploy to cloud, follow the step-by-step instructions in `DEPLOYMENT_GUIDE.md` for Render, Vercel, and Firebase App Distribution.
5. If the user asks to start Iteration 2, refer to Section 7 of `technical_specification.md` (`PulseMeter`, `Live Quizzing`, `Doubt Forum`).
