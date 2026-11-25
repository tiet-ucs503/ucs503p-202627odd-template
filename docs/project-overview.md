# ClassPulse — Real-Time Classroom Engagement Platform

ClassPulse is a classroom engagement platform with anti-proxy QR attendance, live
PulseMeter polls, live quizzes, a structured doubt forum, attendance analytics, and
instructor moderation tools.

Current implementation:

- **QR attendance** — instructors project a rotating stream of three HMAC-signed QR
  tokens; the mobile app scans all three frames to record attendance.
- **PulseMeter** — live word-cloud, MCQ, and rating-scale activities with real-time
  student responses.
- **Live quizzes** — instructor-authored multiple-choice quizzes with live results and
  WIDE/NARROW scoring modes.
- **Doubt forum** — pseudonymous classroom, course-wide, and app-wide doubt threads with
  replies, accepted solutions, helpful votes, and instructor endorsement.
- **Analytics** — section-level attendance summaries, per-student drill-downs, and live
  activity results.
- **Moderation** — profanity filtering, muted word-cloud terms, and instructor-only
  author reveal for pseudonymous forum posts.

## Project Structure

```
classpulse-1/
├── backend/    # Node.js + Express REST & Socket.io API
├── web/        # Next.js + MUI instructor dashboard and student PWA
└── mobile/     # Flutter Android student app
```

## Prerequisites

- **Node.js 20+** and npm (backend and web)
- **PostgreSQL** (local or [Neon](https://neon.tech))
- **Redis** (local or [Upstash](https://upstash.com)); optional, but required for
  multi-instance deployments
- **Flutter 3.29+** (Dart 3.7+) and the Android toolchain for the mobile app

## Backend Setup

```bash
cd backend
cp .env.example .env
npm ci
npm test
npm run dev
```

`backend/.env.example` documents the core variables. The server refuses to start
without these required values:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — secret used to sign auth tokens
- `QR_HMAC_SECRET` — secret used to sign QR attendance tokens

Also set `REDIS_URL` for shared token storage (the backend falls back to per-instance
memory if Redis is unavailable). Set `CORS_ORIGINS` to the web origin(s) allowed to call
the API; it defaults to `http://localhost:3000`. See
[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for the full variable reference.

- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health` (`200 ok` / `503 degraded`)
- WebSocket: `ws://localhost:4000` (Socket.io)

## Web Setup

The web app hosts the instructor dashboard at `/` and the student PWA at
`/student`.

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the backend origin (for example
`http://localhost:4000`). In production it must be the deployed API origin, and that
origin must also be listed in the backend's `CORS_ORIGINS`.

Build the production bundle with:

```bash
npm run build
```

- Instructor dashboard: `http://localhost:3000`
- Student web app: `http://localhost:3000/student`
- Install guide: `http://localhost:3000/student/install`

## Student PWA (iOS + Android)

The student PWA supports iOS 18+ and is installed from Safari via
**Share → Add to Home Screen**. It does not go through the App Store. The same
web app also installs from Chrome on Android; the native Flutter app remains
available.

What is included:

- Student login/signup and session persistence
- Classroom join/unenroll and classroom details
- Multi-frame QR attendance using a self-hosted WASM decoder
  (`barcode-detector` + ZXing)
- Attendance history with per-classroom drill-downs and capture latency (ACL)
- PulseMeter (word cloud, MCQ, rating scale)
- Live quizzes with server-driven timers, reveal states, and final results
- Doubt forum with search, filters, topics, pseudonymity, helpful marks,
  accepted solutions, and teacher endorsements
- PWA manifest, service worker, offline screen, install onboarding, and update
  prompt

Camera access requires HTTPS. On a physical iPhone, install first and then sign
in: the installed app has its own storage container, separate from Safari. iOS may
re-request camera permission on each cold launch; this is a known WebKit
behaviour. See [`IOS_TEST_CHECKLIST.md`](IOS_TEST_CHECKLIST.md) for the device
release checklist and [`IOS_PWA_EXECUTION_PLAN.md`](IOS_PWA_EXECUTION_PLAN.md) for
the build plan.

The QR decoder WASM file lives at
`web/public/student/wasm/zxing_reader.wasm`; it is served locally so scanning
does not depend on a CDN.

## Mobile Setup

The mobile app is the student app for Android.

```bash
cd mobile
flutter pub get
flutter test
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

`API_BASE_URL` defaults to the deployed API when omitted. Use `http://10.0.2.2:4000`
from the Android emulator, or your machine's LAN address for a physical device.

Build a release APK with:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://your-api.example.com
```

## Roles

- **Instructor dashboard (`/`).** Teachers create and manage sections, sessions,
  activities, quizzes, analytics, and forum moderation. Teacher accounts are created
  on the web signup page; when `TEACHER_INVITE_CODE` is configured, signup requires
  that code. In production, teacher signup is closed if no invite code is configured.
- **Student PWA (`/student`).** Students join sections with a 6-character code, scan
  QR attendance streams, answer live activities and quizzes, and participate in the
  forum. Works on iOS 18+, Android, and desktop browsers.
- **Native Android app.** The Flutter student app remains fully supported and uses
  the same backend.
- Student accounts can be created in the PWA or the Android app; teacher accounts
  are created on the instructor signup page.

## Testing

Run each suite from its app directory:

```bash
# Backend — Node.js test runner
cd backend
npm test

# Web — unit tests, type-check, and production build
cd web
npm test
npm run typecheck
npm run build

# Mobile — static analysis and tests
cd mobile
flutter analyze --no-fatal-infos
flutter test
```

Backend tests use mocked PostgreSQL and Redis helpers, so they do not require live
database or Redis services. Web tests run with Vitest and jsdom.

The GitHub Actions workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml) runs
the backend syntax check and tests, the web tests and production build, and the mobile
analyze, test, and APK build.

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for local end-to-end testing and cloud
deployment steps.
