# ClassPulse — Deployment & Testing Guide

This guide covers running ClassPulse locally, the backend environment reference, and
deploying the backend, web dashboard, and Android APK.

---

## 1. Local Development & End-to-End Testing

### Step 1: Start the Backend API & WebSocket Server

```bash
cd backend
cp .env.example .env
npm ci
npm test
npm run dev
```

- **API**: `http://localhost:4000`
- **Health check**: `http://localhost:4000/health`
- **WebSocket layer**: `ws://localhost:4000` (Socket.io)
- **Database**: connects to PostgreSQL using `DATABASE_URL` in `backend/.env`
- **Cache**: uses `REDIS_URL` when reachable, otherwise falls back to a per-instance
  in-memory cache

At minimum, set `DATABASE_URL`, `JWT_SECRET`, and `QR_HMAC_SECRET`. The server exits at
startup if any of those are missing. See
[Section 2](#2-backend-environment-reference) for every supported variable.

### Step 2: Start the Web Instructor Dashboard

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

- **Web app**: `http://localhost:3000`
- Set `NEXT_PUBLIC_API_URL` to the backend origin (`http://localhost:4000` locally).
- Create the instructor account on the web signup page. If
  `TEACHER_INVITE_CODE` is set, teacher signup requires that code. In production,
  teacher signup is disabled when no invite code is configured.
- Current capabilities:
  - Create classroom sections from the course catalog.
  - View and rotate 6-character student join codes.
  - Launch live QR attendance sessions with a rotating 3-QR projector, and watch the
    roster update in real time with attendance capture latency (ACL) badges.
  - Author and launch PulseMeters (word cloud, MCQ, rating scale) and live quizzes.
  - Review section analytics, attendance percentages, per-student drill-downs, and live
    activity results.
  - Moderate the doubt forum, including muted word-cloud terms and pseudonymous author
    reveal.

### Step 3: Run the Flutter Android App (Student)

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

- **Runs on**: Android emulator or a physical Android device via USB debugging.
- `http://10.0.2.2:4000` reaches the host machine from the Android emulator. For a
  physical device, use your machine's LAN IP (for example
  `http://192.168.1.20:4000`).
- If `API_BASE_URL` is omitted, the app uses its built-in deployed API default.
- Create the student account in the mobile app.
- Current capabilities:
  - Join classroom sections with a 6-character code.
  - Scan the instructor's rotating 3-QR stream to mark attendance.
  - Answer live PulseMeters and quizzes.
  - Browse and post in the doubt forum.
  - View overall attendance percentage and per-course session history.

---

## 2. Backend Environment Reference

Set these in `backend/.env` locally and in the hosting provider's environment settings
in production.

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (Neon or self-hosted). |
| `JWT_SECRET` | Yes | — | Secret used to sign authentication tokens. Use a long random value. |
| `QR_HMAC_SECRET` | Yes | — | Secret used to sign rotating QR attendance tokens. Use a long random value. |
| `REDIS_URL` | No | — | Redis connection string. Without it, or if Redis is unreachable, the backend uses per-instance memory. |
| `PORT` | No | `4000` | HTTP/WebSocket port. |
| `NODE_ENV` | No | `development` | Set to `production` when deployed. Enables production-only checks and SSL defaults. |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowlist of browser origins, for example `https://app.example.com,http://localhost:3000`. Do not add trailing slashes. |
| `TEACHER_INVITE_CODE` | Prod. | — | Invite code required for teacher self-signup. If unset in production, teacher signup is closed. |
| `SESSION_MAX_HOURS` | No | `4` | Attendance sessions older than this are auto-ended by the background sweep. |
| `ATTENDANCE_LINK_WINDOW_HOURS` | No | `12` | How recent an ended attendance session must be to be linked to a launched PulseMeter or quiz. |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `true` | Set to `false` only if your database uses a self-signed certificate. |
| `BREVO_API_KEY` | No | — | Brevo HTTPS API key for warning emails (first provider tried). |
| `BREVO_SENDER_EMAIL` | No | `EMAIL_FROM` or `no-reply@classpulse.edu` | Sender address for Brevo. |
| `RESEND_API_KEY` | No | — | Resend HTTPS API key (second provider tried). |
| `EMAIL_FROM` | No | `no-reply@classpulse.edu` | From address; accepts `Name <address>`. |
| `SMTP_HOST` | No | — | SMTP host for the final email fallback. |
| `SMTP_PORT` | No | `465` | SMTP port; port `465` uses implicit TLS. |
| `SMTP_USER` | No | — | SMTP username. Also used as a fallback sender when `EMAIL_FROM` is unset. |
| `SMTP_PASS` | No | — | SMTP password or app password. |
| `SMTP_TLS_REJECT_UNAUTHORIZED` | No | `true` | Set to `false` only for a local SMTP server with a self-signed certificate. |
| `AUTH_LOGIN_EMAIL_RATE_LIMIT_MAX` | No | `10` | Login attempts allowed per account (normalized email) per 15-minute window. |
| `AUTH_LOGIN_IP_RATE_LIMIT_MAX` | No | `100` | Login requests allowed per client IP per 15-minute window (NAT-friendly backstop). |
| `AUTH_SIGNUP_RATE_LIMIT_MAX` | No | `50` | Signup requests allowed per client IP per 15-minute window. |
| `SEARCH_RATE_LIMIT_MAX` | No | `60` | Search requests allowed per 1-minute window. |

### CORS

`CORS_ORIGINS` is a comma-separated allowlist of browser origins. The default is
`http://localhost:3000`. The deployed web origin must be added before the dashboard can
call the API. Requests without an `Origin` header (mobile apps, `curl`, server-to-server
calls) are still allowed. A disallowed origin receives `403 Not allowed by CORS`.

### Teacher signup

Teacher accounts are created on the web app. In production, teacher signup requires
`TEACHER_INVITE_CODE`: if the variable is set, the submitted code must match; if it is
unset, teacher signup is rejected with `403`. Development and test environments allow
teacher signup without a code for local convenience.

### Health endpoint

`GET /health` reports database and Redis status:

- `200` with `"status": "ok"` when PostgreSQL is reachable.
- `503` with `"status": "degraded"` when PostgreSQL is unreachable.

Redis status is reported separately under `redis`. A degraded Redis does **not** change
the HTTP status, because the backend falls back to an in-memory cache; however, that
fallback is per instance and is not suitable for multi-instance deployments.

---

## 3. Cloud Deployment (Production)

### A. Deploy the Backend to Render

1. Open [render.com](https://render.com) and log in with your GitHub account.
2. Click **"New +"** → **"Web Service"**.
3. Select your repository.
4. Configure the service:
   - **Name**: `classpulse-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Add the environment variables from Section 2. At minimum:
   - `DATABASE_URL`
   - `JWT_SECRET` (generate a long random value)
   - `QR_HMAC_SECRET` (generate a long random value)
   - `NODE_ENV=production`
   - `REDIS_URL`
   - `CORS_ORIGINS` (include the deployed web origin)
   - `TEACHER_INVITE_CODE` if teacher self-signup should remain open
6. Click **"Create Web Service"**.
7. Once deployed, copy the live backend URL and verify
   `https://<your-service>.onrender.com/health` returns `200` and `"status": "ok"`.

> The server starts even if PostgreSQL is unavailable so `/health` can report a
> degraded state, but API requests that need the database will fail until it reconnects.

### B. Deploy the Web Dashboard to Vercel

1. Open [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **"Add New..."** → **"Project"**.
3. Import the repository.
4. Configure the project:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `web`
5. Under **"Environment Variables"**, add:
   - `NEXT_PUBLIC_API_URL` — the deployed backend origin from Step A
6. Add the same web origin to the backend's `CORS_ORIGINS` and redeploy the backend.
7. Click **"Deploy"**. Vercel builds and serves the instructor dashboard at `/`
   and the student PWA at `/student`.

### B2. Student PWA on iOS

The student PWA is part of the same `web/` deployment. No additional service is
required.

Requirements:

- HTTPS on the deployed web origin. Camera access will not work over plain HTTP.
- The web origin must be in the backend's `CORS_ORIGINS` (the same origin that
  already serves the instructor dashboard).
- `NEXT_PUBLIC_API_URL` must point at the deployed API origin.
- `web/public/student/wasm/zxing_reader.wasm` must be deployed with the app. It
  is committed as a static asset and is loaded only when the scanner opens.
- `web/public/student/sw.js` and `web/public/student/manifest.webmanifest` must
  be served from the same origin.

After deploying:

1. Open `https://<web-domain>/student/install` in Safari on an iPhone (iOS 18+).
2. Follow the Share → Add to Home Screen steps.
3. Launch the installed app, sign in with a student account, and test the QR
   scanner against a live instructor session.
4. Run the full device checklist in [`IOS_TEST_CHECKLIST.md`](IOS_TEST_CHECKLIST.md).

The service worker and manifest are sent with `Cache-Control: no-cache` by
`web/next.config.js`. Do not add long-lived caching for those two files.

### C. Build and Distribute the Android APK

1. **Build the release APK**:
   ```bash
   cd mobile
   flutter build apk --release --dart-define=API_BASE_URL=https://your-api.example.com
   ```
   The APK is generated at `mobile/build/app/outputs/flutter-apk/app-release.apk`.

2. **Upload to Firebase App Distribution** (optional):
   - Open the [Firebase Console](https://console.firebase.google.com).
   - Create a project, then open **App Distribution** under *Release & Monitor*.
   - Upload `app-release.apk` and invite testers by email.
   - Testers receive an install invitation; no Play Store release is required.

3. **Direct installation** (alternative):
   - Copy the APK to an Android phone via USB or cloud storage and tap to install.
   - Enable installation from unknown sources if prompted.

---

## 4. Pre-Deploy Checklist

Run these from a clean checkout before deploying:

```bash
# Backend
cd backend
npm ci
npm test

# Web
cd ../web
npm ci
npm test
npm run typecheck
npm run build

# Mobile
cd ../mobile
flutter pub get
flutter analyze --no-fatal-infos
flutter test
flutter build apk --release --dart-define=API_BASE_URL=https://your-api.example.com
```

Deployment checks:

- [ ] Backend starts with `DATABASE_URL`, `JWT_SECRET`, and `QR_HMAC_SECRET` set.
- [ ] `REDIS_URL` points at a live Redis instance (recommended for production).
- [ ] `CORS_ORIGINS` contains the deployed web origin, with no trailing slash.
- [ ] `TEACHER_INVITE_CODE` is set if teacher self-signup is enabled.
- [ ] `NEXT_PUBLIC_API_URL` points at the deployed backend origin.
- [ ] `/health` returns `200` with `"status": "ok"`.
- [ ] The deployed web origin serves `/student/manifest.webmanifest` as
      `application/manifest+json`.
- [ ] `/student/sw.js` returns `Cache-Control: no-cache`.
- [ ] `/student/wasm/zxing_reader.wasm` returns `200` (camera scanning depends on it).
- [ ] The iOS install flow and scanner pass [`IOS_TEST_CHECKLIST.md`](IOS_TEST_CHECKLIST.md).
- [ ] Mobile APK was built with the production `API_BASE_URL`.
- [ ] Warning emails work if `BREVO_API_KEY`, `RESEND_API_KEY`, or SMTP is configured.

The GitHub Actions workflow performs the backend syntax check and tests, the web tests,
type-check, and production build, and the mobile analyze, test, and APK build.

---

## 5. Troubleshooting: "Failed to start attendance session"

This error appears when the QR token cache (Upstash Redis) is unreachable. Because the
session row is written to PostgreSQL *before* the first token batch is generated, a dead
Redis used to leave you with a 500 error, an "active" session after refresh, and a blank
QR projector.

**Diagnose it in one request:**

```bash
curl https://<your-backend-host>/health
```

```json
{ "status": "ok", "redis": { "status": "degraded", "backend": "memory", "reason": "getaddrinfo ENOTFOUND ..." } }
```

`redis.status = "degraded"` means QR tokens are being kept in this backend instance's
memory instead of Upstash.

**Fix (root cause):** free Upstash databases are deleted after long inactivity, and the
hostname stops resolving (`getaddrinfo ENOTFOUND <name>.upstash.io`).

1. Sign in to [console.upstash.com](https://console.upstash.com) and create a new Redis
   database close to your backend region.
2. Copy its **TLS** connection string (starts with `rediss://`) into `REDIS_URL`:
   - locally in `backend/.env`
   - in your hosting provider's environment settings
3. Save the change and redeploy the backend.
4. Re-check `/health`; `redis.status` should now be `connected`.

> The backend does not fail requests when Redis is down: it automatically falls back to
> an in-memory cache so a single-instance deployment keeps working. That fallback is
> per-instance only, so fix `REDIS_URL` before scaling to multiple instances (tokens
> issued by one instance would not be visible to another).

---

## 6. Current Definition of Done

| Area | Current implementation |
|---|---|
| **Authentication & roles** | Teacher and student login/signup with role guards; `/` is instructor-only, `/student` is student-only, and the native Android app remains student-only. |
| **Classroom management** | Course catalog, section creation, 6-character join code/link/QR. |
| **Student join flow** | Students join sections from the mobile app using the join code. |
| **Anti-proxy QR attendance** | 3-QR timestamped, HMAC-SHA256 signed rotating token stream with short-lived Redis tokens. |
| **Live projector (web)** | Rotating SVG QR stream and real-time Socket.io attendance roster. |
| **Multi-frame scanner** | Flutter camera scanner buffers the 3 sequential frames and tracks ACL. |
| **PulseMeter** | Word cloud, MCQ, and rating-scale activities with live student responses and results. |
| **Live quizzes** | Instructor-authored MCQs with WIDE/NARROW scoring and live results. |
| **Doubt forum** | Pseudonymous classroom, course, and app-wide threads with replies, accepted solutions, helpful votes, and instructor endorsement. |
| **Analytics** | Teacher section analytics and per-student drill-down; student attendance dashboard. |
| **Moderation** | Profanity filtering, muted word-cloud terms, and instructor author reveal. |
| **CI/CD** | GitHub Actions workflow for backend syntax/tests, web build, and mobile analyze/test/APK. |
