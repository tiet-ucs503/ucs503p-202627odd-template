CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code  TEXT UNIQUE NOT NULL,
  course_name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classrooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  join_code    TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id  UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_started_at   TIMESTAMPTZ NOT NULL,
  validated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'PRESENT',
  UNIQUE (session_id, student_id)
);

-- Teacher overrides are tagged so ACL metrics can exclude non-scan records.
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed predefined course catalog if empty (Spec requirement: course-code catalog)
INSERT INTO courses (course_code, course_name)
VALUES 
  ('UCS503P', 'Software Engineering Lab'),
  ('UCS405', 'Discrete Mathematical Structures'),
  ('UCS301', 'Data Structures & Algorithms'),
  ('UCS507', 'Computer Networks')
ON CONFLICT (course_code) DO NOTHING;

-- ============ Iteration 2: PulseMeter & Live Activities ============

CREATE TABLE IF NOT EXISTS live_activities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id          UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  activity_type         TEXT NOT NULL CHECK (activity_type IN ('PULSEMETER', 'QUIZ')),
  activity_ref_id       UUID NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at              TIMESTAMPTZ,
  attendance_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  attendance_pending    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_activity_per_classroom
  ON live_activities (classroom_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS pulsemeters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('WORD_CLOUD', 'MCQ', 'RATING_SCALE')),
  config       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pulsemeter_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_activity_id UUID NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_value   TEXT NOT NULL,
  is_blocked       BOOLEAN NOT NULL DEFAULT false,
  blocked_reason   TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_activity_id, student_id)
);

ALTER TABLE pulsemeter_responses ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pulsemeter_responses ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

CREATE TABLE IF NOT EXISTS word_cloud_mutes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  muted_by     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT,
  muted_until  TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Iteration 2: Live MCQ Quizzing ============

CREATE TABLE IF NOT EXISTS quizzes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  scoring_mode TEXT NOT NULL DEFAULT 'WIDE' CHECK (scoring_mode IN ('WIDE', 'NARROW')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text      TEXT NOT NULL,
  options            JSONB NOT NULL,
  correct_option_id  TEXT NOT NULL,
  order_index        INT NOT NULL,
  time_limit_seconds INT NOT NULL DEFAULT 20
);

CREATE TABLE IF NOT EXISTS quiz_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_activity_id   UUID NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_option_id TEXT NOT NULL,
  is_correct         BOOLEAN NOT NULL,
  response_time_ms   INT NOT NULL,
  score_awarded      INT NOT NULL DEFAULT 0,
  answered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_activity_id, question_id, student_id)
);-- =========================================================
-- ITERATION 2: PART 6 — DOUBT FORUM SCHEMA
-- =========================================================

-- Course Topics table (Categorization for doubts, e.g. "Dynamic Programming")
CREATE TABLE IF NOT EXISTS course_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_course_topic_name UNIQUE (course_id, name)
);

-- Pseudonym Assignments (Deterministic per-course student pseudonyms)
CREATE TABLE IF NOT EXISTS pseudonym_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    pseudonym VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_course_pseudonym UNIQUE (user_id, course_id)
);

-- Doubt Posts (3 Audience scopes: APP, COURSE, CLASSROOM)
CREATE TABLE IF NOT EXISTS doubt_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
    topic_id UUID REFERENCES course_topics(id) ON DELETE SET NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    audience_scope VARCHAR(20) NOT NULL CHECK (audience_scope IN ('APP', 'COURSE', 'CLASSROOM')),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    pseudonym VARCHAR(100),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'FLAGGED')),
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Doubt Replies (Discussion answers & teacher endorsements)
CREATE TABLE IF NOT EXISTS doubt_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doubt_post_id UUID NOT NULL REFERENCES doubt_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    pseudonym VARCHAR(100),
    is_teacher_endorsed BOOLEAN DEFAULT FALSE,
    is_solution BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Doubt Helpful Marks (Thumbs-up tracking preventing duplicate votes)
CREATE TABLE IF NOT EXISTS doubt_helpful_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('POST', 'REPLY')),
    target_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_target_helpful UNIQUE (user_id, target_type, target_id)
);

-- Doubt Moderation Flags (Reporting inappropriate content)
CREATE TABLE IF NOT EXISTS doubt_moderation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('POST', 'REPLY')),
    target_id UUID NOT NULL,
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient scoping and searching
CREATE INDEX IF NOT EXISTS idx_doubt_posts_scope ON doubt_posts(audience_scope, course_id, classroom_id);
CREATE INDEX IF NOT EXISTS idx_doubt_posts_topic ON doubt_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_doubt_replies_post ON doubt_replies(doubt_post_id);

-- =========================================================
-- ITERATION 2: PART 7 — FULL-TEXT SEARCH GIN INDEX
-- =========================================================

-- Add search_vector tsvector column (weighted title 'A' + body 'B')
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doubt_posts' AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE doubt_posts ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(body, '')), 'B')
        ) STORED;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_doubt_posts_search_gin ON doubt_posts USING gin(search_vector);

-- =========================================================
-- ITERATION 3: LIVE ACTIVITY HISTORY & DURABLE QUIZ STATE
-- =========================================================

-- Run snapshots so history survives template edits/deletes
ALTER TABLE live_activities ADD COLUMN IF NOT EXISTS title_snapshot TEXT;
ALTER TABLE live_activities ADD COLUMN IF NOT EXISTS config_snapshot JSONB;

-- Durable per-question quiz state (replaces the in-memory Map)
CREATE TABLE IF NOT EXISTS activity_question_states (
  live_activity_id UUID NOT NULL REFERENCES live_activities(id) ON DELETE CASCADE,
  question_id      UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  started_at_ms    BIGINT NOT NULL,
  ends_at_ms       BIGINT NOT NULL,
  revealed         BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (live_activity_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_live_activities_history
  ON live_activities (classroom_id, activity_type, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_activity_student
  ON quiz_responses (live_activity_id, student_id);

-- =========================================================
-- ITERATION 3: ATTENDANCE, HISTORY & MODERATION INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records (student_id);

CREATE INDEX IF NOT EXISTS idx_sessions_classroom_started
  ON sessions (classroom_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollments_student
  ON enrollments (student_id);

CREATE INDEX IF NOT EXISTS idx_word_cloud_mutes_student_classroom_until
  ON word_cloud_mutes (student_id, classroom_id, muted_until);

CREATE INDEX IF NOT EXISTS idx_doubt_helpful_marks_target
  ON doubt_helpful_marks (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_doubt_moderation_flags_target
  ON doubt_moderation_flags (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_live_activities_attendance_pending
  ON live_activities (classroom_id) WHERE attendance_pending = TRUE;
