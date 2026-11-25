# ClassPulse — Technical Specification (Iteration 2)

Scope: Section 9.2 of the project proposal — PulseMeter, Live MCQ Quizzing,
Doubt Forum (with audience-scoped search), the teacher-facing authoring
interface for quizzes/PulseMeters, and a proper analytics/charting layer
across both Iteration 1 and Iteration 2 features (explicitly requested —
Iteration 1 shipped without real charts, this closes that gap).

This document **extends** `technical_specification.md` (Iteration 1). It does
not repeat Iteration 1's schema, endpoints, or design tokens — assume those
already exist and are being added to, not replaced. `appearance_mode.md`
(light mode only) still applies to every screen built in this iteration.

---

## 0. Where each proposal feature maps to a part

| Proposal feature (Section 9.2) | Built in |
|---|---|
| Analytics & charts (implicit gap from Iteration 1) | Part 1 |
| PulseMeter (3 response types), engagement analytics, word-cloud moderation | Parts 2–3 |
| Live MCQ quizzing, time-weighted scoring, leaderboard | Parts 4–5 |
| Teacher authoring interface for quizzes/PulseMeters | Parts 2 & 4 (built alongside each feature, not separately) |
| Doubt forum, audience scoping, "Helpful" marking | Part 6 |
| Search over past discussions, scoped to audience | Part 7 |
| Refined homepages (roster, trends, past-quizzes, doubt activity) | Part 8 |

---

## 1. Architecture additions

- **Charting**: Recharts (already idiomatic for this Next.js/MUI stack) on
  web; `fl_chart` (new pub dependency) on Flutter, themed to the same M3
  seed color and typography tokens defined in Iteration 1.
- **Live activity broadcasting**: PulseMeter and Quiz sessions reuse the
  existing Socket.io + Redis adapter infrastructure from Iteration 1 (new
  namespaces, not a new transport).
- **Full-text search**: PostgreSQL's built-in `tsvector`/`tsquery` (via a
  generated column + GIN index on `DoubtPosts`) — no external search service,
  per the proposal's "established techniques, not novel IR research."
- **No new hosting/cloud accounts required.** Everything runs on the existing
  Neon, Upstash, Render, Vercel, and Firebase setup from Iteration 1.

---

## 2. Database Schema Additions

```sql
-- ============ Live activity mutual exclusion ============
-- One PulseMeter or Quiz "live" per classroom at a time (proposal 4.3 step 4).
LiveActivities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES Classrooms(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('PULSEMETER','QUIZ')),
  activity_ref_id UUID NOT NULL, -- FK to PulseMeters(id) or Quizzes(id) depending on activity_type
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  -- Present-vs-responded resolution (PulseMeter analytics; see Section 4a):
  attendance_session_id UUID REFERENCES Sessions(id), -- the attendance Session used as the "present" denominator, once resolved
  attendance_pending    BOOLEAN NOT NULL DEFAULT FALSE -- TRUE = still waiting for a valid attendance Session to resolve against
)
-- Partial unique index enforces "one active activity per classroom":
CREATE UNIQUE INDEX one_active_activity_per_classroom
  ON LiveActivities (classroom_id) WHERE status = 'ACTIVE';

-- ============ PulseMeter ============
PulseMeters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES Classrooms(id),
  created_by   UUID NOT NULL REFERENCES Users(id),
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('WORD_CLOUD','MCQ','RATING_SCALE')),
  config       JSONB NOT NULL, -- MCQ: {options:[...]}; RATING_SCALE: {min:1,max:5,labels?}; WORD_CLOUD: {prompt}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Authored once, reusable across sessions, per proposal 4.2.
)

PulseMeterResponses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_activity_id UUID NOT NULL REFERENCES LiveActivities(id),
  student_id       UUID NOT NULL REFERENCES Users(id),
  response_value   TEXT NOT NULL, -- word-cloud token, MCQ option_id, or rating integer as text
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_activity_id, student_id) -- one response per student per instance
)

WordCloudMutes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES Users(id),
  classroom_id UUID NOT NULL REFERENCES Classrooms(id),
  muted_by     UUID NOT NULL REFERENCES Users(id),
  reason       TEXT,
  muted_until  TIMESTAMPTZ NOT NULL, -- CONFIRMED: teacher picks from {7,14,30,90,180} days in the UI
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- ============ Live MCQ Quizzing ============
Quizzes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES Classrooms(id),
  created_by   UUID NOT NULL REFERENCES Users(id),
  title        TEXT NOT NULL,
  scoring_mode TEXT NOT NULL DEFAULT 'WIDE' CHECK (scoring_mode IN ('WIDE','NARROW')), -- see Section 4a
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)

QuizQuestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id          UUID NOT NULL REFERENCES Quizzes(id),
  question_text    TEXT NOT NULL,
  options          JSONB NOT NULL, -- [{id:"a", text:"..."}, ...]
  correct_option_id TEXT NOT NULL,
  order_index      INT NOT NULL,
  time_limit_seconds INT NOT NULL DEFAULT 20
)

QuizResponses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_activity_id UUID NOT NULL REFERENCES LiveActivities(id),
  question_id     UUID NOT NULL REFERENCES QuizQuestions(id),
  student_id      UUID NOT NULL REFERENCES Users(id),
  selected_option_id TEXT NOT NULL,
  is_correct      BOOLEAN NOT NULL,
  response_time_ms INT NOT NULL, -- server-clock measured, per proposal 5.2
  score_awarded   INT NOT NULL DEFAULT 0,
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_activity_id, question_id, student_id)
)
-- Leaderboard is computed on read (SUM(score_awarded) per student per quiz),
-- not a separate materialized table, for Iteration 2 simplicity.

-- ============ Doubt Forum ============
-- CONFIRMED: tags are course-level (not per-classroom), so a student sees
-- one consistent tag list whether they're in the lecture or lab section of
-- the same course. Seeded by the developer via migration/seed script, not
-- authored through any UI — this project is demo-focused, so only the
-- courses actually used in the demo need seed rows.
CourseTopics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES Courses(id),
  topic_name TEXT NOT NULL,
  UNIQUE (course_id, topic_name)
)

-- CONFIRMED pseudonym scheme (see Section 4b): one stable pseudonym per
-- (student, course) — shared across every classroom under that course
-- (e.g. same pseudonym in both the lecture and lab section), but a
-- different pseudonym in a different course. Assigned on first post/reply,
-- in simple incrementing order per course (Student #1, #2, ...) rather than
-- a hash, to avoid awkward or colliding labels.
PseudonymAssignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES Users(id),
  course_id    UUID NOT NULL REFERENCES Courses(id),
  display_label TEXT NOT NULL, -- e.g. "Student #4"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
)

DoubtPosts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES Users(id),
  audience_scope TEXT NOT NULL CHECK (audience_scope IN ('APP','COURSE','CLASSROOM')),
  course_id     UUID REFERENCES Courses(id),       -- required if scope = COURSE or CLASSROOM (derivable); null only if scope = APP
  classroom_id  UUID REFERENCES Classrooms(id),     -- required if scope = CLASSROOM
  topic_id      UUID REFERENCES CourseTopics(id),   -- optional; only meaningful when course_id is set
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
  is_flagged    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
)
CREATE INDEX doubt_posts_search_idx ON DoubtPosts USING GIN (search_vector);

DoubtReplies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES DoubtPosts(id),
  author_id  UUID NOT NULL REFERENCES Users(id),
  body       TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

DoubtHelpfulMarks (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id  UUID NOT NULL REFERENCES DoubtReplies(id),
  marked_by UUID NOT NULL REFERENCES Users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reply_id, marked_by) -- proposal: "no points/reputation system," just a mark
)
```

**Pseudonymity note (proposal 4.2, "pseudonymous Q&A") — CONFIRMED:**
`author_id` is always stored (needed for moderation/edit/delete-by-author),
but students never see another student's real name anywhere in the forum —
only their `PseudonymAssignments.display_label` for that course. Other
students cannot reveal a name under any circumstance.

Teachers are the only role that can reveal a name, and it's deliberately
one extra click, not shown by default: the UI shows the pseudonym plus a
small "Reveal name" action; clicking it calls a teacher-only endpoint
(Section 3) scoped to courses the teacher actually teaches, and shows the
real name inline for that teacher's session only — it doesn't change what
other users see.

Teachers themselves are **never** pseudonymized — their real name always
shows on their own posts/replies, with a small verified-teacher badge/tick
mark next to it so students can distinguish teacher responses from student
ones at a glance.

---

## 3. REST API Additions

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/pulsemeters` | teacher | Author a new PulseMeter |
| GET | `/pulsemeters?classroom_id=` | teacher | List reusable PulseMeters for a classroom |
| POST | `/pulsemeters/:id/launch` | teacher | Launch as the classroom's live activity |
| POST | `/live-activities/:id/end` | teacher | End the live activity |
| POST | `/live-activities/:id/respond` | student | Submit a PulseMeter response |
| GET | `/live-activities/:id/analytics` | teacher | Present-vs-responded + distribution data for charts |
| POST | `/word-cloud-mutes` | teacher | Mute a student from word-cloud participation |
| POST | `/quizzes` | teacher | Author a quiz (with questions) |
| GET | `/quizzes?classroom_id=` | teacher | List reusable quizzes |
| POST | `/quizzes/:id/launch` | teacher | Launch as the classroom's live activity |
| POST | `/live-activities/:id/answer` | student | Submit an answer (server timestamps for scoring) |
| GET | `/quizzes/:id/leaderboard` | any (enrolled) | Past-quiz leaderboard, per proposal 4.2 |
| GET | `/courses/:id/topics` | any (enrolled in a classroom under this course) | List the course's seeded topic tags (read-only — no create/edit endpoint; tags are seeded via migration, per Section 2) |
| POST | `/doubts` | student | Create a post (audience scope + optional topic); backend assigns/reuses the student's pseudonym for that course on first post |
| GET | `/doubts?scope=&course_id=&classroom_id=` | any | List posts scoped correctly, returning `author_pseudonym` (or real name + teacher badge if the author is the teacher) — never `author_id` or a student's real name |
| POST | `/doubts/:id/replies` | any | Reply to a post |
| POST | `/doubts/replies/:id/helpful` | any | Toggle "Helpful" mark |
| DELETE | `/doubts/:id` | author, teacher | Delete/moderate a post |
| POST | `/doubts/reveal-author` | teacher only | Body: `{pseudonym_assignment_id}`. Returns the real name, only if the requesting teacher teaches a classroom under that pseudonym's course. Not shown to students under any request. |
| GET | `/doubts/search?q=&scope=&course_id=&classroom_id=` | any | Full-text search, audience-scoped |
| GET | `/classrooms/:id/engagement-analytics` | teacher | Cross-feature chart data (attendance + PulseMeter + quiz + doubt) for the homepage card-grid |

**WebSocket events** (new, per-classroom Socket.io room, reusing Iteration 1's Redis adapter):
- `activity:launched` (server → all) — a PulseMeter/quiz just went live
- `activity:response_count` (server → teacher) — live present-vs-responded tick
- `pulsemeter:results` (server → teacher) — live aggregated distribution, for the chart to update in real time
- `quiz:question` (server → students) — next question + server-authoritative deadline timestamp
- `quiz:leaderboard_update` (server → all) — running standings after each question
- `activity:ended` (server → all)

---

## 4a. Scoring formula (Live Quizzing) — CONFIRMED, two modes

Every quiz has a `scoring_mode` (Section 2), set by the teacher when
authoring it — default **WIDE**, with **NARROW** available as an opt-in
toggle in the authoring UI.

```
if answer is incorrect or unanswered: score_awarded = 0, streak resets to 0
if answer is correct:
  time_fraction_used = response_time_ms / (time_limit_seconds * 1000)   // 0.0–1.0
  k     = 0.7 if scoring_mode == 'WIDE' else 0.3   // spread multiplier
  floor = 300 if scoring_mode == 'WIDE' else 700   // minimum score for a correct answer
  base_score = max(round(1000 * (1 - k * time_fraction_used)), floor)
  streak_bonus = min(25 * (current_consecutive_correct_streak - 1), 100) // starts at streak=1
  score_awarded = base_score + streak_bonus
```

- **WIDE (default):** 300–1000 pts for a correct answer depending on speed —
  speed matters a lot, closer to a live-quiz-show feel.
- **NARROW (opt-in):** 700–1000 pts — speed barely matters, rewards knowing
  the answer over reflexes; a teacher would pick this for a lab/concept
  check rather than a fun live event.

Both modes keep the same streak bonus (+25/consecutive correct, capped at
+100) and the same reset-streak-on-miss rule. The constants
(1000 / k / floor / 25 / 100) are isolated in one config object in the
scoring service per mode, not scattered, so tuning either mode later is a
one-line change.

---

## 4b. Present-vs-responded resolution (PulseMeter) — CONFIRMED

PulseMeter's "present-vs-responded" metric (proposal 4.2) needs a "present"
denominator that's actually accurate, not just "whoever's connected." The
resolution logic:

**Default case — attendance already taken this lecture:** when a PulseMeter
is launched, the backend looks for the most recent **ended** attendance
`Session` in that classroom with `started_at` before the PulseMeter's launch
time. If one exists, `LiveActivities.attendance_session_id` is set
immediately, and "present" = the count of `AttendanceRecords` for that
Session. This covers the normal flow: teacher takes attendance at the start
of class, ends it after ~5 minutes, then runs PulseMeters later in the same
lecture.

**Pending case — attendance not taken yet, or still in progress:** if no
ended Session exists yet for this lecture (either the teacher hasn't started
one, or one is currently active but not yet ended — an in-progress headcount
isn't final), the backend sets `attendance_pending = TRUE` instead of
guessing. The teacher doesn't need to remember to flag this manually for the
"not started yet" case — the backend detects it automatically from Session
state. The UI shows "Present count: pending — will fill in once today's
attendance is finalized" instead of a number, while still showing the raw
responded count and response-distribution chart (those don't need "present"
to be useful).

**Resolving a pending activity:** whenever an attendance `Session` is ended
(existing Iteration 1 endpoint, `POST /sessions/:id/end`), the backend checks
that classroom for any `LiveActivities` where `attendance_pending = TRUE`
and `started_at` is before this Session's `started_at`. Each match gets
`attendance_session_id` set to this just-ended Session, `attendance_pending`
flipped to `FALSE`, and its analytics recompute — so "attendance at the end
of class" resolves correctly against whichever session actually ends up
covering that lecture.

If a lecture never gets an attendance session at all that day, the
PulseMeter's present-count simply stays "pending" indefinitely — this is
correct behavior, not a bug: there's no valid denominator to show.

---

## 5. Analytics & Charts (cross-cutting — Part 1, then extended per feature)

Explicitly requested: Iteration 1 shipped tables/progress-bars, not real
charts. This is corrected retroactively (Part 1) and built-in going forward.

| Screen | Chart(s) | Library |
|---|---|---|
| Teacher classroom analytics (retrofit) | Attendance % trend line across sessions; ACL distribution bar chart | Recharts |
| Student attendance dashboard (retrofit) | Per-subject attendance % as a small multiples bar chart instead of plain progress bars | `fl_chart` |
| PulseMeter live results | MCQ: bar chart of option counts. Rating: histogram. Word cloud: sized-text cloud (custom SVG, not a charting-lib primitive). Present-vs-responded: donut. | Recharts |
| Quiz leaderboard | Horizontal bar chart of top scores; line chart of per-question accuracy % | Recharts |
| Doubt forum analytics | Posts-per-topic bar chart; % marked "Helpful" within 24h trend | Recharts |
| Unified homepage (Part 8) | Card-grid combining attendance trend, quiz performance sparkline, and doubt activity count — extends Iteration 1's already-reserved card-grid pattern | Recharts / `fl_chart` |

All charts must respect `appearance_mode.md` — no dark-mode-only chart
themes/palettes; use light-mode-appropriate contrast throughout.

---

## 6. Core UI Shell changes

- Un-disable the `PulseMeter*` and `Quizzes*` tabs from Iteration 1's nav —
  remove "Coming soon" badges, route in real screens.
- Un-disable the `Forum*` tab; wire in the audience-scope dropdown pattern
  that was reserved (but disabled) in Iteration 1's component library.
- Classroom Detail screen gains the tab strip reserved in Iteration 1:
  `Overview | PulseMeter | Quizzes | Forum`.
- "Past Quizzes" sub-route (already reserved in the routing table per
  Iteration 1 spec) now renders the leaderboard list.

---

## 7. Part-by-Part Build Sequence

Same working rules as Iteration 1 (`prompt_iteration2.md`): strictly
sequential, pause for review after each part, no credential checkpoints
needed (no new external services).

### Part 1 — Analytics Foundation & Retrofit
**Build:** Add Recharts + `fl_chart` dependencies and shared chart theming
tokens (light-mode only). Retrofit Iteration 1's teacher analytics view and
student attendance dashboard to use real charts (per Section 5 table) instead
of tables/progress bars, without changing their underlying data.
**Acceptance:** Both dashboards render live charts backed by existing
Iteration 1 data; no visual/behavioral change to anything else.

### Part 2 — PulseMeter: Schema + Authoring
**Build:** `LiveActivities`, `PulseMeters`, `PulseMeterResponses`,
`WordCloudMutes` tables + migrations. Teacher authoring UI (create/reuse a
PulseMeter of any of the 3 types) on web only (authoring is teacher-only,
web-only per proposal's dual-interface split).
**Acceptance:** A teacher can author and list reusable PulseMeters of all 3
types; nothing is launchable yet.

### Part 3 — PulseMeter: Live Session + Analytics + Moderation
**Build:** One-click launch (enforcing one-active-activity-per-classroom),
student response submission (web + Flutter), live Socket.io-driven results
chart per Section 5, present-vs-responded analytics using the resolution
logic in Section 4b (including the pending state and its resolution when a
later attendance Session ends), teacher mute action with the confirmed
severity-duration picker (7/14/30/90/180 days).
**Acceptance:** End-to-end on real devices — teacher launches a PulseMeter,
students respond from the Flutter app, teacher's chart updates live; present
count resolves correctly whether attendance was taken before or after the
PulseMeter (test both orderings); a muted student cannot submit word-cloud
responses in that classroom until `muted_until`.

### Part 4 — Live Quizzing: Schema + Authoring
**Build:** `Quizzes`, `QuizQuestions`, `QuizResponses` tables + migrations.
Teacher authoring UI (multi-question quiz builder, reusable, with a
WIDE/NARROW scoring-mode toggle per Section 4a — default WIDE), web only.
**Acceptance:** A teacher can author and list a reusable multi-question quiz,
choosing either scoring mode.

### Part 5 — Live Quizzing: Session, Scoring, Leaderboard
**Build:** One-click launch, server-clock-synced question delivery with
countdown, answer submission (Flutter), scoring per Section 4a's formula,
live leaderboard updates, "Past Quizzes" leaderboard view (Section 6).
**Acceptance:** End-to-end on real devices — a full quiz runs live, scores
compute correctly per the documented formula, leaderboard is visible during
and after the quiz.

### Part 6 — Doubt Forum
**Build:** `CourseTopics`, `PseudonymAssignments`, `DoubtPosts`,
`DoubtReplies`, `DoubtHelpfulMarks` tables + migrations, plus a seed
script populating `CourseTopics` for the demo course(s) only (no
tag-authoring UI needed — see Section 2). Post/reply/helpful-mark flows
(web + Flutter), audience-scope selector, pseudonym assignment-and-display
logic and the teacher-only "Reveal name" action (Section 4b's sibling —
see the pseudonymity note in Section 2), teacher's verified badge on their
own posts, teacher delete/flag moderation controls, basic
spam/inappropriate-text filtering (proposal Section 10 risk).
**Acceptance:** A student can post at all 3 audience scopes, reply, and mark
"Helpful"; the same student shows the same pseudonym across every classroom
in one course, and a different pseudonym in a different course; a teacher
sees pseudonyms by default and can reveal a real name with one click, scoped
to courses they teach; teacher's own posts always show their real name plus
the verified badge; a teacher can delete/flag.

### Part 7 — Search
**Build:** `/doubts/search` endpoint using the `search_vector` GIN index,
audience-scope-respecting query, search UI (web + Flutter).
**Acceptance:** Searching returns only posts visible at the requester's
scope, ranked reasonably, in both apps.

### Part 8 — Unified Homepages & Cross-Feature Analytics
**Build:** Extend Iteration 1's already-reserved card-grid pattern
(`technical_specification.md` Section 7) on both teacher and student
homepages to add quiz-performance and doubt-activity summary cards per
Section 5's table, backed by `/classrooms/:id/engagement-analytics`.
**Acceptance:** Both homepages show attendance + quiz + doubt data together,
matching the database after Parts 3/5/6 testing.

---

## 8. Explicit Non-Goals for Iteration 2

Per proposal Section 9.3, **AI-assisted authoring remains a stretch goal,
not built now.** Also out of scope: a points/reputation system for the forum
(explicitly excluded by the proposal), and the proxy-attendance survey
(that's a pilot-logistics artifact, not an app feature).
